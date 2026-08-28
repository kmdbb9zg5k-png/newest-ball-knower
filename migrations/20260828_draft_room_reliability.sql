-- Persistent draft preparation, visible pick clocks, and server-side recovery.

alter table public.ball_knower_live_drafts
  add column if not exists pick_seconds integer not null default 60,
  add column if not exists pick_started_at timestamptz,
  add column if not exists pick_deadline_at timestamptz,
  add column if not exists recovery_enabled boolean not null default true;

-- Existing abandoned rooms predate the clock contract. Preserve them until a
-- manager makes another real pick; new rooms use the default immediately.
update public.ball_knower_live_drafts set recovery_enabled=false where status='active';

alter table public.ball_knower_live_drafts
  drop constraint if exists ball_knower_live_drafts_pick_seconds_check,
  add constraint ball_knower_live_drafts_pick_seconds_check check (pick_seconds between 15 and 180);

create or replace function public.set_ball_knower_live_draft_clock()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if tg_op = 'UPDATE' and old.pick_index is distinct from new.pick_index then new.recovery_enabled:=true; end if;
  if new.status = 'active' and (tg_op = 'INSERT' or old.pick_index is distinct from new.pick_index or old.status is distinct from new.status or new.pick_deadline_at is null) then
    new.pick_started_at := clock_timestamp();
    new.pick_deadline_at := clock_timestamp() + make_interval(secs => new.pick_seconds);
  elsif new.status <> 'active' then
    new.pick_deadline_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists set_ball_knower_live_draft_clock on public.ball_knower_live_drafts;
create trigger set_ball_knower_live_draft_clock
before insert or update on public.ball_knower_live_drafts
for each row execute function public.set_ball_knower_live_draft_clock();

update public.ball_knower_live_drafts
set pick_started_at=coalesce(pick_started_at,clock_timestamp()),
    pick_deadline_at=coalesce(pick_deadline_at,clock_timestamp()+make_interval(secs=>pick_seconds))
where status='active';

create table if not exists public.ball_knower_draft_preferences (
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  member_id text not null references public.ball_knower_league_members(id) on delete cascade,
  queue jsonb not null default '[]'::jsonb check (jsonb_typeof(queue)='array'),
  favorites jsonb not null default '[]'::jsonb check (jsonb_typeof(favorites)='array'),
  do_not_draft jsonb not null default '[]'::jsonb check (jsonb_typeof(do_not_draft)='array'),
  pre_rankings jsonb not null default '[]'::jsonb check (jsonb_typeof(pre_rankings)='array'),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (league_id,member_id)
);

alter table public.ball_knower_draft_preferences enable row level security;
drop policy if exists ball_knower_draft_preferences_owner on public.ball_knower_draft_preferences;
create policy ball_knower_draft_preferences_owner
on public.ball_knower_draft_preferences
for all
to authenticated
using (exists (
  select 1 from public.ball_knower_league_members m
  where m.league_id=ball_knower_draft_preferences.league_id
    and m.id=ball_knower_draft_preferences.member_id
    and m.auth_user_id=(select auth.uid())
    and coalesce(m.is_ai,false)=false
))
with check (exists (
  select 1 from public.ball_knower_league_members m
  where m.league_id=ball_knower_draft_preferences.league_id
    and m.id=ball_knower_draft_preferences.member_id
    and m.auth_user_id=(select auth.uid())
    and coalesce(m.is_ai,false)=false
));

revoke all on public.ball_knower_draft_preferences from public,anon;
grant select,insert,update,delete on public.ball_knower_draft_preferences to authenticated;
grant all on public.ball_knower_draft_preferences to service_role;

alter table public.ball_knower_fantasy_rankings add column if not exists adp numeric;
update public.ball_knower_fantasy_rankings set adp=overall_rank where adp is null;

-- Cron recovery is intentionally service-only. It advances every immediate CPU
-- turn and only advances a human after their persisted deadline has elapsed.
create or replace function public.process_due_ball_knower_draft_picks(p_now timestamptz default clock_timestamp())
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_team_count integer; v_total integer; v_round_index integer; v_slot integer; v_order_index integer;
  v_member_id text; v_member_pick_count integer; v_picks_remaining integer; v_missing integer; v_required_now boolean;
  v_player_id text; v_group text; v_next integer; v_pick jsonb; v_processed integer:=0; v_guard integer:=0;
begin
  if coalesce((select auth.role()),'') <> 'service_role' then raise exception 'Service role required'; end if;

  <<draft_loop>>
  for v_draft in
    select * from public.ball_knower_live_drafts d
    where d.status='active' and d.recovery_enabled and (
      d.pick_deadline_at is null or d.pick_deadline_at<=p_now or exists (
        select 1 from public.ball_knower_league_members m
        where m.league_id=d.league_id and m.id=(
          case when mod(d.pick_index/jsonb_array_length(d.order_member_ids),2)=0
            then d.order_member_ids->>(d.pick_index%jsonb_array_length(d.order_member_ids))
            else d.order_member_ids->>(jsonb_array_length(d.order_member_ids)-1-(d.pick_index%jsonb_array_length(d.order_member_ids))) end
        ) and coalesce(m.is_ai,false)
      )
    ) order by d.updated_at
  loop
    exit draft_loop when v_processed>=10;
    v_guard:=0;
    loop
      v_guard:=v_guard+1; exit when v_guard>500;
      select * into v_draft from public.ball_knower_live_drafts where league_id=v_draft.league_id for update;
      exit when not found or v_draft.status<>'active';
      v_team_count:=jsonb_array_length(v_draft.order_member_ids); v_total:=v_team_count*v_draft.rounds;
      exit when v_team_count<1 or v_draft.pick_index>=v_total;
      v_round_index:=v_draft.pick_index/v_team_count; v_slot:=mod(v_draft.pick_index,v_team_count);
      v_order_index:=case when mod(v_round_index,2)=0 then v_slot else v_team_count-1-v_slot end;
      v_member_id:=v_draft.order_member_ids->>v_order_index;
      select * into v_member from public.ball_knower_league_members where league_id=v_draft.league_id and id=v_member_id;
      exit when not found;
      exit when not coalesce(v_member.is_ai,false) and coalesce(v_draft.pick_deadline_at,'infinity'::timestamptz)>p_now;

      select count(*) into v_member_pick_count from jsonb_array_elements(v_draft.picks) p where p->>'memberId'=v_member_id;
      v_picks_remaining:=v_draft.rounds-v_member_pick_count;
      select sum(greatest(req.minimum-coalesce(got.n,0),0))::integer into v_missing
      from (values ('QB',1),('RB',2),('WR',2),('TE',1),('K',1),('DST',1)) req(draft_group,minimum)
      left join lateral (select count(*)::integer n from jsonb_array_elements(v_draft.picks) p where p->>'memberId'=v_member_id and p->>'group'=req.draft_group) got on true;
      v_required_now:=v_picks_remaining<=coalesce(v_missing,0);

      select c.player_id,c.draft_group into v_player_id,v_group
      from (
        select g.player_id,g.draft_group,coalesce(got.n,0) position_count,
          case g.draft_group when 'QB' then 2 when 'RB' then 5 when 'WR' then 7 when 'TE' then 2 when 'K' then 2 when 'DST' then 2 end position_limit,
          case g.draft_group when 'QB' then 1 when 'RB' then 2 when 'WR' then 2 when 'TE' then 1 when 'K' then 1 when 'DST' then 1 end starter_minimum,
          case g.draft_group when 'QB' then 75 when 'TE' then 62 when 'K' then 45 when 'DST' then 45 when 'RB' then 14 else 10 end depth_penalty,
          coalesce(r.overall_rank,9999) overall_rank,
          coalesce(case when (p.player_json->>'ovr')~'^[0-9]+([.][0-9]+)?$' then (p.player_json->>'ovr')::numeric end,0) ovr,
          coalesce(q.ord,1000000) queue_ord,coalesce(pr.ord,1000000) pre_rank_ord,
          case when fav.player_id is null then 1 else 0 end favorite_penalty,
          case when dnd.player_id is null then false else true end is_dnd
        from public.ball_knower_fantasy_player_groups g
        left join ball_knower_private.draft_order_game_players p on p.player_id=g.player_id
        left join lateral (select count(*)::integer n from jsonb_array_elements(v_draft.picks) x where x->>'memberId'=v_member_id and x->>'group'=g.draft_group) got on true
        left join lateral (select min(x.overall_rank) overall_rank from public.ball_knower_fantasy_rankings x where x.season=2026 and x.scoring_format='ppr' and lower(regexp_replace(x.player_name,'[^a-z0-9]','','g'))=lower(regexp_replace(coalesce(p.player_json->>'name',''),'[^a-z0-9]','','g'))) r on true
        left join public.ball_knower_draft_preferences pref on pref.league_id=v_draft.league_id and pref.member_id=v_member_id
        left join lateral (select value player_id,ordinality ord from jsonb_array_elements_text(coalesce(pref.queue,'[]'::jsonb)) with ordinality where value=g.player_id limit 1) q on true
        left join lateral (select value player_id,ordinality ord from jsonb_array_elements_text(coalesce(pref.pre_rankings,'[]'::jsonb)) with ordinality where value=g.player_id limit 1) pr on true
        left join lateral (select value player_id from jsonb_array_elements_text(coalesce(pref.favorites,'[]'::jsonb)) where value=g.player_id limit 1) fav on true
        left join lateral (select value player_id from jsonb_array_elements_text(coalesce(pref.do_not_draft,'[]'::jsonb)) where value=g.player_id limit 1) dnd on true
        where g.draft_group in ('QB','RB','WR','TE','K','DST') and (p.player_id is not null or g.draft_group='DST')
          and not exists(select 1 from jsonb_array_elements(v_draft.picks) x where x->>'playerId'=g.player_id)
      ) c
      where c.position_count<c.position_limit and not c.is_dnd and (not v_required_now or c.position_count<c.starter_minimum)
      order by case when c.queue_ord<1000000 then 0 when c.pre_rank_ord<1000000 then 1 when c.favorite_penalty=0 then 2 else 3 end,
        c.queue_ord,c.pre_rank_ord,
        case when c.position_count<c.starter_minimum then 0 else 1 end,
        c.overall_rank+c.position_count*c.depth_penalty+case when c.draft_group in ('K','DST') and v_member_pick_count<13 then 500 else 0 end,
        c.ovr desc,c.player_id limit 1;
      if v_player_id is null then raise exception 'No legal automatic fantasy pick remains for %',v_member.user_name; end if;

      v_pick:=jsonb_build_object('overall',v_draft.pick_index+1,'round',v_round_index+1,'memberId',v_member_id,'playerId',v_player_id,'group',v_group,'pickedAt',clock_timestamp(),'source',case when coalesce(v_member.is_ai,false) then 'cpu' else 'autopick' end);
      v_next:=v_draft.pick_index+1;
      update public.ball_knower_live_drafts set picks=picks||jsonb_build_array(v_pick),pick_index=v_next,
        status=case when v_next>=v_total then 'completed' else 'active' end,
        completed_at=case when v_next>=v_total then clock_timestamp() else null end,updated_at=clock_timestamp()
      where league_id=v_draft.league_id returning * into v_draft;
      v_processed:=v_processed+1;
      if v_next>=v_total then perform public.finalize_ball_knower_live_draft_rosters(v_draft.league_id,null); exit; end if;
      if v_processed>=10 then exit draft_loop; end if;
      -- CPU picks remain immediate. A human gets a fresh deadline from the clock trigger.
    end loop;
  end loop;
  return jsonb_build_object('processed',v_processed,'checkedAt',p_now);
end;
$function$;

revoke all on function public.process_due_ball_knower_draft_picks(timestamptz) from public,anon,authenticated;
grant execute on function public.process_due_ball_knower_draft_picks(timestamptz) to service_role;
revoke all on function public.set_ball_knower_live_draft_clock() from public,anon,authenticated;

-- The existing finalizer remains league-member callable, while allowing the
-- service-only recovery function to finish rosters after the last timeout pick.
create or replace function public.finalize_ball_knower_live_draft_rosters(p_league_id text,p_assignments jsonb)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_auth uuid:=(select auth.uid());v_role text:=coalesce((select auth.role()),'');v_draft public.ball_knower_live_drafts%rowtype;v_member public.ball_knower_league_members%rowtype;v_roster jsonb;v_ratings jsonb;v_member_count integer;
begin
 if v_auth is null and v_role<>'service_role' then raise exception 'Authentication required'; end if;
 if v_role<>'service_role' and not exists(select 1 from public.ball_knower_league_members requester where requester.league_id=p_league_id and requester.auth_user_id=v_auth and coalesce(requester.is_ai,false)=false) then raise exception 'Only league members can finalize completed fantasy rosters'; end if;
 select * into v_draft from public.ball_knower_live_drafts where league_id=p_league_id for update;if not found then raise exception 'Fantasy draft has not started';end if;
 if v_draft.status<>'completed' or v_draft.pick_index<>jsonb_array_length(v_draft.order_member_ids)*v_draft.rounds or jsonb_array_length(v_draft.picks)<>v_draft.pick_index then raise exception 'Fantasy draft is not complete';end if;
 select count(*) into v_member_count from public.ball_knower_league_members where league_id=p_league_id;if v_member_count<>jsonb_array_length(v_draft.order_member_ids) then raise exception 'Draft order no longer matches league membership';end if;
 perform set_config('ball_knower.authorized_roster_operation','on',true);
 for v_member in select * from public.ball_knower_league_members where league_id=p_league_id for update loop
  select jsonb_agg(ball_knower_private.fantasy_player_payload(pick->>'playerId') order by (pick->>'overall')::integer) into v_roster from jsonb_array_elements(v_draft.picks) pick where pick->>'memberId'=v_member.id;
  if jsonb_typeof(v_roster)<>'array' or jsonb_array_length(v_roster)<>v_draft.rounds then raise exception 'Every completed fantasy roster must contain exactly % canonical players',v_draft.rounds;end if;
  if(select count(distinct x->>'id') from jsonb_array_elements(v_roster)x)<>v_draft.rounds then raise exception 'A completed fantasy roster contains duplicate players';end if;
  v_ratings:=ball_knower_private.fantasy_team_ratings_from_roster(v_roster);
  update public.ball_knower_league_members set roster=v_roster,team_ratings=v_ratings,status='ready',submitted_at=coalesce(v_draft.completed_at,clock_timestamp()) where league_id=p_league_id and id=v_member.id;
 end loop;
 update public.ball_knower_leagues set status='drafting',rosters_locked=true where id=p_league_id;return true;
end;$function$;

revoke all on function public.finalize_ball_knower_live_draft_rosters(text,jsonb) from public,anon;
grant execute on function public.finalize_ball_knower_live_draft_rosters(text,jsonb) to authenticated,service_role;
