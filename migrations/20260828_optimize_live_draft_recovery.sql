-- Keep server-side draft recovery inside the cron budget even for 16-team rooms.
-- The prior implementation repeated normalized-name ranking joins and six JSON
-- roster counts for every candidate on every automatic pick.

create index if not exists ball_knower_live_drafts_due_recovery_idx
  on public.ball_knower_live_drafts(pick_deadline_at,updated_at)
  where status='active' and recovery_enabled;

create index if not exists ball_knower_fantasy_player_groups_recovery_idx
  on public.ball_knower_fantasy_player_groups(draft_group,player_id);

create table if not exists ball_knower_private.live_draft_recovery_rankings (
  player_id text primary key,
  overall_rank integer not null,
  refreshed_at timestamptz not null default clock_timestamp()
);

insert into ball_knower_private.live_draft_recovery_rankings(player_id,overall_rank,refreshed_at)
select g.player_id,coalesce(min(r.overall_rank),9999),clock_timestamp()
from public.ball_knower_fantasy_player_groups g
left join ball_knower_private.draft_order_game_players p on p.player_id=g.player_id
left join public.ball_knower_fantasy_rankings r
  on r.season=2026 and r.scoring_format='ppr'
 and lower(regexp_replace(r.player_name,'[^a-z0-9]','','g'))=lower(regexp_replace(coalesce(p.player_json->>'name',''),'[^a-z0-9]','','g'))
where g.draft_group in ('QB','RB','WR','TE','K','DST')
group by g.player_id
on conflict(player_id) do update set overall_rank=excluded.overall_rank,refreshed_at=excluded.refreshed_at;

revoke all on ball_knower_private.live_draft_recovery_rankings from public,anon,authenticated;
grant all on ball_knower_private.live_draft_recovery_rankings to service_role;

create or replace function public.process_due_ball_knower_draft_picks(p_now timestamptz default clock_timestamp())
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_league_id text;
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_team_count integer; v_total integer; v_round_index integer; v_slot integer; v_order_index integer;
  v_member_id text; v_member_pick_count integer; v_picks_remaining integer; v_missing integer; v_required_now boolean;
  v_player_id text; v_group text; v_next integer; v_pick jsonb; v_processed integer:=0; v_rooms integer:=0; v_guard integer:=0;
begin
  if coalesce((select auth.role()),'')<>'service_role' then raise exception 'Service role required'; end if;

  for v_league_id in
    select d.league_id
    from public.ball_knower_live_drafts d
    where d.status='active' and d.recovery_enabled and (
      d.pick_deadline_at is null or d.pick_deadline_at<=p_now or exists (
        select 1 from public.ball_knower_league_members m
        where m.league_id=d.league_id and m.id=(
          case when mod(d.pick_index/nullif(jsonb_array_length(d.order_member_ids),0),2)=0
            then d.order_member_ids->>(d.pick_index%nullif(jsonb_array_length(d.order_member_ids),0))
            else d.order_member_ids->>(jsonb_array_length(d.order_member_ids)-1-(d.pick_index%nullif(jsonb_array_length(d.order_member_ids),0))) end
        ) and coalesce(m.is_ai,false)
      )
    )
    order by d.updated_at
    limit 8
  loop
    v_rooms:=v_rooms+1;
    v_guard:=0;
    loop
      v_guard:=v_guard+1;
      exit when v_guard>260 or v_processed>=48;
      select * into v_draft
      from public.ball_knower_live_drafts
      where league_id=v_league_id
      for update skip locked;
      exit when not found or v_draft.status<>'active';

      v_team_count:=jsonb_array_length(v_draft.order_member_ids);
      v_total:=v_team_count*v_draft.rounds;
      exit when v_team_count<1 or v_draft.pick_index>=v_total;
      v_round_index:=v_draft.pick_index/v_team_count;
      v_slot:=mod(v_draft.pick_index,v_team_count);
      v_order_index:=case when mod(v_round_index,2)=0 then v_slot else v_team_count-1-v_slot end;
      v_member_id:=v_draft.order_member_ids->>v_order_index;
      select * into v_member from public.ball_knower_league_members where league_id=v_league_id and id=v_member_id;
      exit when not found;
      exit when not coalesce(v_member.is_ai,false) and coalesce(v_draft.pick_deadline_at,'infinity'::timestamptz)>p_now;

      select count(*) into v_member_pick_count
      from jsonb_array_elements(v_draft.picks) pick
      where pick->>'memberId'=v_member_id;
      v_picks_remaining:=v_draft.rounds-v_member_pick_count;
      with counts as (
        select pick->>'group' draft_group,count(*)::integer amount
        from jsonb_array_elements(v_draft.picks) pick
        where pick->>'memberId'=v_member_id
        group by pick->>'group'
      )
      select sum(greatest(required.minimum-coalesce(counts.amount,0),0))::integer into v_missing
      from (values ('QB',1),('RB',2),('WR',2),('TE',1),('K',1),('DST',1)) required(draft_group,minimum)
      left join counts using(draft_group);
      v_required_now:=v_picks_remaining<=coalesce(v_missing,0);

      with position_counts as materialized (
        select pick->>'group' draft_group,count(*)::integer amount
        from jsonb_array_elements(v_draft.picks) pick
        where pick->>'memberId'=v_member_id
        group by pick->>'group'
      ), preference as materialized (
        select coalesce(pref.queue,'[]'::jsonb) queue,coalesce(pref.pre_rankings,'[]'::jsonb) pre_rankings,
          coalesce(pref.favorites,'[]'::jsonb) favorites,coalesce(pref.do_not_draft,'[]'::jsonb) do_not_draft
        from (select 1) seed
        left join public.ball_knower_draft_preferences pref on pref.league_id=v_league_id and pref.member_id=v_member_id
      ), candidates as (
        select g.player_id,g.draft_group,coalesce(pc.amount,0) position_count,
          case g.draft_group when 'QB' then 2 when 'RB' then 5 when 'WR' then 7 when 'TE' then 2 when 'K' then 2 when 'DST' then 2 end position_limit,
          case g.draft_group when 'QB' then 1 when 'RB' then 2 when 'WR' then 2 when 'TE' then 1 when 'K' then 1 when 'DST' then 1 end starter_minimum,
          case g.draft_group when 'QB' then 75 when 'TE' then 62 when 'K' then 45 when 'DST' then 45 when 'RB' then 14 else 10 end depth_penalty,
          coalesce(rr.overall_rank,9999) overall_rank,
          coalesce(case when (p.player_json->>'ovr')~'^[0-9]+([.][0-9]+)?$' then (p.player_json->>'ovr')::numeric end,0) ovr,
          coalesce((select ordinality from jsonb_array_elements_text(pref.queue) with ordinality where value=g.player_id limit 1),1000000) queue_ord,
          coalesce((select ordinality from jsonb_array_elements_text(pref.pre_rankings) with ordinality where value=g.player_id limit 1),1000000) pre_rank_ord,
          (pref.favorites ? g.player_id) as is_favorite,(pref.do_not_draft ? g.player_id) as is_dnd
        from public.ball_knower_fantasy_player_groups g
        left join ball_knower_private.draft_order_game_players p on p.player_id=g.player_id
        left join ball_knower_private.live_draft_recovery_rankings rr on rr.player_id=g.player_id
        left join position_counts pc on pc.draft_group=g.draft_group
        cross join preference pref
        where g.draft_group in ('QB','RB','WR','TE','K','DST') and (p.player_id is not null or g.draft_group='DST')
          and not exists(select 1 from jsonb_array_elements(v_draft.picks) picked where picked->>'playerId'=g.player_id)
      )
      select candidate.player_id,candidate.draft_group into v_player_id,v_group
      from candidates candidate
      where candidate.position_count<candidate.position_limit and not candidate.is_dnd
        and (not v_required_now or candidate.position_count<candidate.starter_minimum)
      order by case when candidate.queue_ord<1000000 then 0 when candidate.pre_rank_ord<1000000 then 1 when candidate.is_favorite then 2 else 3 end,
        candidate.queue_ord,candidate.pre_rank_ord,
        case when candidate.position_count<candidate.starter_minimum then 0 else 1 end,
        candidate.overall_rank+candidate.position_count*candidate.depth_penalty+case when candidate.draft_group in ('K','DST') and v_member_pick_count<13 then 500 else 0 end,
        candidate.ovr desc,candidate.player_id
      limit 1;
      if v_player_id is null then raise exception 'No legal automatic fantasy pick remains for %',v_member.user_name; end if;

      v_pick:=jsonb_build_object('overall',v_draft.pick_index+1,'round',v_round_index+1,'memberId',v_member_id,'playerId',v_player_id,'group',v_group,'pickedAt',clock_timestamp(),'source',case when coalesce(v_member.is_ai,false) then 'cpu' else 'autopick' end);
      v_next:=v_draft.pick_index+1;
      update public.ball_knower_live_drafts
      set picks=picks||jsonb_build_array(v_pick),pick_index=v_next,
        status=case when v_next>=v_total then 'completed' else 'active' end,
        completed_at=case when v_next>=v_total then clock_timestamp() else null end,
        updated_at=clock_timestamp()
      where league_id=v_league_id
      returning * into v_draft;
      v_processed:=v_processed+1;
      if v_next>=v_total then
        perform public.finalize_ball_knower_live_draft_rosters(v_league_id,null);
        exit;
      end if;
    end loop;
    exit when v_processed>=48;
  end loop;
  return jsonb_build_object('processed',v_processed,'rooms',v_rooms,'checkedAt',p_now,'bounded',v_processed>=48);
end;
$function$;

revoke all on function public.process_due_ball_knower_draft_picks(timestamptz) from public,anon,authenticated;
grant execute on function public.process_due_ball_knower_draft_picks(timestamptz) to service_role;
