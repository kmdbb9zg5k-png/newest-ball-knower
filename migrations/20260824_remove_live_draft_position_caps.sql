-- Every fantasy position remains draftable through the final roster spot.
-- The draft roster size is the only effective per-position limit.
create or replace function public.make_ball_knower_live_draft_pick(
  p_league_id text, p_player_id text, p_group text, p_final_assignments jsonb default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_auth uuid := (select auth.uid());
  v_league public.ball_knower_leagues%rowtype;
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_team_count integer; v_total_picks integer; v_round_index integer; v_slot integer;
  v_order_index integer; v_member_id text; v_group_limit integer; v_group_count integer;
  v_pick jsonb; v_next_index integer; v_canonical_group text;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_player_id), '') is null then raise exception 'Player id is required'; end if;

  select * into v_league from public.ball_knower_leagues where id = p_league_id;
  if not found then raise exception 'League not found'; end if;
  select * into v_draft from public.ball_knower_live_drafts where league_id = p_league_id for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;
  if v_draft.status <> 'active' then raise exception 'Fantasy draft is already complete'; end if;

  v_team_count := jsonb_array_length(v_draft.order_member_ids);
  v_total_picks := v_team_count * v_draft.rounds;
  if v_draft.pick_index >= v_total_picks then raise exception 'Fantasy draft is already complete'; end if;
  v_round_index := v_draft.pick_index / v_team_count;
  v_slot := mod(v_draft.pick_index, v_team_count);
  v_order_index := case when mod(v_round_index, 2) = 0 then v_slot else v_team_count - 1 - v_slot end;
  v_member_id := v_draft.order_member_ids ->> v_order_index;

  select * into v_member from public.ball_knower_league_members where league_id = p_league_id and id = v_member_id;
  if not found then raise exception 'The manager on the clock is no longer in the league'; end if;
  if coalesce(v_member.is_ai, false) then
    if v_league.commissioner_auth_id <> v_auth then raise exception 'Waiting for the commissioner to complete the CPU pick'; end if;
  elsif v_member.auth_user_id <> v_auth then raise exception '% is on the clock', v_member.user_name;
  end if;

  if exists (select 1 from jsonb_array_elements(v_draft.picks) pick where pick ->> 'playerId' = p_player_id) then
    raise exception 'That player was already drafted';
  end if;

  select draft_group into v_canonical_group
  from public.ball_knower_fantasy_player_groups
  where player_id = p_player_id;
  if not found then raise exception 'That player is not in the current fantasy player index'; end if;
  if v_canonical_group <> p_group then raise exception 'Player position does not match the submitted draft group'; end if;

  if v_canonical_group not in ('QB','RB','WR','TE','K','DST') then
    raise exception 'Only QB, RB, WR, TE, K and D/ST are valid fantasy positions';
  end if;
  v_group_limit := v_draft.rounds;
  select count(*) into v_group_count from jsonb_array_elements(v_draft.picks) pick
    where pick ->> 'memberId' = v_member_id and pick ->> 'group' = v_canonical_group;
  if v_group_count >= v_group_limit then raise exception '% reached the % roster limit', v_member.user_name, v_canonical_group; end if;

  v_pick := jsonb_build_object('overall',v_draft.pick_index+1,'round',v_round_index+1,'memberId',v_member_id,'playerId',p_player_id,'group',v_canonical_group,'pickedAt',clock_timestamp());
  v_next_index := v_draft.pick_index + 1;
  update public.ball_knower_live_drafts set picks=picks||jsonb_build_array(v_pick),pick_index=v_next_index,
    status=case when v_next_index>=v_total_picks then 'completed' else 'active' end,
    completed_at=case when v_next_index>=v_total_picks then clock_timestamp() else null end,updated_at=clock_timestamp()
    where league_id=p_league_id returning * into v_draft;
  if v_next_index>=v_total_picks and p_final_assignments is not null and v_league.commissioner_auth_id=v_auth then
    perform public.finalize_ball_knower_live_draft_rosters(p_league_id,p_final_assignments);
  end if;
  return to_jsonb(v_draft);
end;
$$;

revoke all on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) from public, anon;
grant execute on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) to authenticated, service_role;
