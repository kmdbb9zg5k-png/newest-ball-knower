-- Keep CPU drafting authoritative on the server while mirroring the client's
-- roster-aware endgame. Without this, the server ignored the K/DST player
-- selected by the client, repeatedly chose the best remaining flex player,
-- and could leave an AI roster without a legal starter when the draft ended.

create or replace function public.make_ball_knower_live_draft_pick(
  p_league_id text,p_player_id text,p_group text,p_final_assignments jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid:=(select auth.uid());
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_team_count integer;v_total_picks integer;v_round_index integer;v_slot integer;v_order_index integer;v_member_id text;
  v_selected_player_id text;v_canonical_group text;v_group_count integer;v_pick jsonb;v_next_index integer;
  v_member_pick_count integer;v_picks_remaining integer;v_missing_count integer;v_required_now boolean;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  select * into v_draft from public.ball_knower_live_drafts where league_id=p_league_id for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;
  if v_draft.status<>'active' then raise exception 'Fantasy draft is already complete'; end if;

  v_team_count:=jsonb_array_length(v_draft.order_member_ids);v_total_picks:=v_team_count*v_draft.rounds;
  if v_team_count<1 or v_draft.pick_index>=v_total_picks then raise exception 'Fantasy draft is already complete'; end if;
  v_round_index:=v_draft.pick_index/v_team_count;v_slot:=mod(v_draft.pick_index,v_team_count);
  v_order_index:=case when mod(v_round_index,2)=0 then v_slot else v_team_count-1-v_slot end;
  v_member_id:=v_draft.order_member_ids->>v_order_index;
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and id=v_member_id;
  if not found then raise exception 'The manager on the clock is no longer in the league'; end if;

  if coalesce(v_member.is_ai,false) then
    if not exists(select 1 from public.ball_knower_league_members requester where requester.league_id=p_league_id and requester.auth_user_id=v_auth and coalesce(requester.is_ai,false)=false) then
      raise exception 'Only league members can advance CPU picks';
    end if;

    select count(*) into v_member_pick_count
    from jsonb_array_elements(v_draft.picks) prior
    where prior->>'memberId'=v_member_id;
    v_picks_remaining:=v_draft.rounds-v_member_pick_count;

    select sum(greatest(requirement.minimum-coalesce(picked.position_count,0),0))::integer
    into v_missing_count
    from (values ('QB',1),('RB',2),('WR',2),('TE',1),('K',1),('DST',1)) requirement(draft_group,minimum)
    left join lateral (
      select count(*)::integer position_count
      from jsonb_array_elements(v_draft.picks) prior
      where prior->>'memberId'=v_member_id and prior->>'group'=requirement.draft_group
    ) picked on true;
    v_required_now:=v_picks_remaining<=coalesce(v_missing_count,0);

    select g.player_id,g.draft_group
    into v_selected_player_id,v_canonical_group
    from public.ball_knower_fantasy_player_groups g
    left join ball_knower_private.draft_order_game_players p on p.player_id=g.player_id
    left join lateral (
      select min(r.overall_rank) as overall_rank
      from public.ball_knower_fantasy_rankings r
      where r.season=2026 and r.scoring_format='ppr'
        and lower(regexp_replace(r.player_name,'[^a-z0-9]','','g'))=
            lower(regexp_replace(coalesce(p.player_json->>'name',''),'[^a-z0-9]','','g'))
    ) ranked on true
    where g.draft_group in ('QB','RB','WR','TE','K','DST')
      and (p.player_id is not null or g.draft_group='DST')
      and not exists(select 1 from jsonb_array_elements(v_draft.picks) prior where prior->>'playerId'=g.player_id)
      and (
        not v_required_now
        or case g.draft_group
          when 'QB' then (select count(*) from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'='QB')<1
          when 'RB' then (select count(*) from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'='RB')<2
          when 'WR' then (select count(*) from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'='WR')<2
          when 'TE' then (select count(*) from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'='TE')<1
          when 'K' then (select count(*) from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'='K')<1
          when 'DST' then (select count(*) from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'='DST')<1
          else false
        end
      )
    order by ranked.overall_rank nulls last,
             coalesce(case when (p.player_json->>'ovr') ~ '^[0-9]+([.][0-9]+)?$' then (p.player_json->>'ovr')::numeric end,0) desc,
             g.player_id
    limit 1;
    if v_selected_player_id is null then raise exception 'No legal CPU fantasy player remains'; end if;
  else
    if v_member.auth_user_id<>v_auth then raise exception '% is on the clock',v_member.user_name; end if;
    if nullif(btrim(p_player_id),'') is null then raise exception 'Player id is required'; end if;
    v_selected_player_id:=p_player_id;
    select draft_group into v_canonical_group from public.ball_knower_fantasy_player_groups where player_id=v_selected_player_id;
    if not found then raise exception 'That player is not in the current fantasy player index'; end if;
    if v_canonical_group<>p_group then raise exception 'Player position does not match the submitted draft group'; end if;
  end if;

  if v_canonical_group not in ('QB','RB','WR','TE','K','DST') then raise exception 'Only QB, RB, WR, TE, K and D/ST are valid fantasy positions'; end if;
  if exists(select 1 from jsonb_array_elements(v_draft.picks) prior where prior->>'playerId'=v_selected_player_id) then raise exception 'That player was already drafted'; end if;
  select count(*) into v_group_count from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'=v_canonical_group;
  if v_group_count>=v_draft.rounds then raise exception '% reached the % roster limit',v_member.user_name,v_canonical_group; end if;

  v_pick:=jsonb_build_object('overall',v_draft.pick_index+1,'round',v_round_index+1,'memberId',v_member_id,'playerId',v_selected_player_id,'group',v_canonical_group,'pickedAt',clock_timestamp());
  v_next_index:=v_draft.pick_index+1;
  update public.ball_knower_live_drafts
  set picks=picks||jsonb_build_array(v_pick),pick_index=v_next_index,
      status=case when v_next_index>=v_total_picks then 'completed' else 'active' end,
      completed_at=case when v_next_index>=v_total_picks then clock_timestamp() else null end,
      updated_at=clock_timestamp()
  where league_id=p_league_id returning * into v_draft;

  if v_next_index>=v_total_picks then
    perform public.finalize_ball_knower_live_draft_rosters(p_league_id,null);
  end if;
  return to_jsonb(v_draft);
end;
$$;
revoke all on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) from public,anon;
grant execute on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) to authenticated,service_role;
