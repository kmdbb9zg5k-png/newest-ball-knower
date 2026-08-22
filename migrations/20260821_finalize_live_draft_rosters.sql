-- Turn a completed live snake draft into the league rosters used by simulation.
-- The payload is computed by the app from the canonical player database, then
-- checked against every saved draft pick before any league member is updated.

create or replace function public.finalize_ball_knower_live_draft_rosters(
  p_league_id text,
  p_assignments jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := (select auth.uid());
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_assignment jsonb;
  v_roster jsonb;
  v_member_count integer;
  v_assignment_count integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Completed roster assignments must be an array';
  end if;
  if not exists (
    select 1
    from public.ball_knower_leagues league
    where league.id = p_league_id
      and league.commissioner_auth_id = v_auth
  ) then
    raise exception 'Only the commissioner can finalize completed fantasy rosters';
  end if;

  select * into v_draft
  from public.ball_knower_live_drafts
  where league_id = p_league_id
  for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;
  if v_draft.status <> 'completed'
    or v_draft.pick_index <> jsonb_array_length(v_draft.order_member_ids) * v_draft.rounds
    or jsonb_array_length(v_draft.picks) <> v_draft.pick_index then
    raise exception 'Fantasy draft is not complete';
  end if;

  select count(*) into v_member_count
  from public.ball_knower_league_members
  where league_id = p_league_id;
  if jsonb_array_length(p_assignments) <> v_member_count then
    raise exception 'Every league member must receive one completed roster';
  end if;

  for v_member in
    select *
    from public.ball_knower_league_members
    where league_id = p_league_id
    for update
  loop
    select count(*), min(assignment.value::text)::jsonb
      into v_assignment_count, v_assignment
    from jsonb_array_elements(p_assignments) assignment(value)
    where assignment.value ->> 'memberId' = v_member.id;

    if v_assignment_count <> 1 then
      raise exception 'Every league member must appear exactly once in completed roster assignments';
    end if;
    v_roster := v_assignment -> 'roster';
    if jsonb_typeof(v_roster) <> 'array' or jsonb_array_length(v_roster) <> v_draft.rounds then
      raise exception 'Every completed fantasy roster must contain exactly % players', v_draft.rounds;
    end if;
    if jsonb_typeof(v_assignment -> 'teamRatings') <> 'object' then
      raise exception 'Every completed fantasy roster must include team ratings';
    end if;
    if exists (
      select 1
      from (
        select player ->> 'id' as player_id
        from jsonb_array_elements(v_roster) player
        except
        select pick ->> 'playerId'
        from jsonb_array_elements(v_draft.picks) pick
        where pick ->> 'memberId' = v_member.id
      ) mismatch
    ) or exists (
      select 1
      from (
        select pick ->> 'playerId' as player_id
        from jsonb_array_elements(v_draft.picks) pick
        where pick ->> 'memberId' = v_member.id
        except
        select player ->> 'id'
        from jsonb_array_elements(v_roster) player
      ) mismatch
    ) then
      raise exception 'A completed roster does not match its locked fantasy draft picks';
    end if;
    if (
      select count(distinct player ->> 'id')
      from jsonb_array_elements(v_roster) player
    ) <> v_draft.rounds then
      raise exception 'A completed fantasy roster contains duplicate players';
    end if;

    update public.ball_knower_league_members
    set roster = v_roster,
        team_ratings = v_assignment -> 'teamRatings',
        status = 'ready',
        submitted_at = coalesce(v_draft.completed_at, clock_timestamp())
    where league_id = p_league_id and id = v_member.id;
  end loop;

  update public.ball_knower_leagues
  set status = 'drafting',
      rosters_locked = true
  where id = p_league_id;

  return true;
end;
$$;

revoke all on function public.finalize_ball_knower_live_draft_rosters(text,jsonb) from public, anon;
grant execute on function public.finalize_ball_knower_live_draft_rosters(text,jsonb) to authenticated, service_role;

drop function if exists public.make_ball_knower_live_draft_pick(text,text,text);

create or replace function public.make_ball_knower_live_draft_pick(
  p_league_id text,
  p_player_id text,
  p_group text,
  p_final_assignments jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := (select auth.uid());
  v_league public.ball_knower_leagues%rowtype;
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_team_count integer;
  v_total_picks integer;
  v_round_index integer;
  v_slot integer;
  v_order_index integer;
  v_member_id text;
  v_group_limit integer;
  v_group_count integer;
  v_pick jsonb;
  v_next_index integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_player_id), '') is null then raise exception 'Player id is required'; end if;

  select * into v_league
  from public.ball_knower_leagues
  where id = p_league_id;
  if not found then raise exception 'League not found'; end if;

  select * into v_draft
  from public.ball_knower_live_drafts
  where league_id = p_league_id
  for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;
  if v_draft.status <> 'active' then raise exception 'Fantasy draft is already complete'; end if;

  v_team_count := jsonb_array_length(v_draft.order_member_ids);
  v_total_picks := v_team_count * v_draft.rounds;
  if v_draft.pick_index >= v_total_picks then raise exception 'Fantasy draft is already complete'; end if;

  v_round_index := v_draft.pick_index / v_team_count;
  v_slot := mod(v_draft.pick_index, v_team_count);
  v_order_index := case when mod(v_round_index, 2) = 0 then v_slot else v_team_count - 1 - v_slot end;
  v_member_id := v_draft.order_member_ids ->> v_order_index;

  select * into v_member
  from public.ball_knower_league_members
  where league_id = p_league_id and id = v_member_id;
  if not found then raise exception 'The manager on the clock is no longer in the league'; end if;

  if coalesce(v_member.is_ai, false) then
    if v_league.commissioner_auth_id <> v_auth then
      raise exception 'Waiting for the commissioner to complete the CPU pick';
    end if;
  elsif v_member.auth_user_id <> v_auth then
    raise exception '% is on the clock', v_member.user_name;
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_draft.picks) pick
    where pick ->> 'playerId' = p_player_id
  ) then
    raise exception 'That player was already drafted';
  end if;

  v_group_limit := case p_group
    when 'QB' then 1 when 'RB' then 1 when 'WR' then 2 when 'TE' then 1
    when 'OL' then 4 when 'DL_EDGE' then 3 when 'LB' then 2 when 'CB' then 2
    when 'S' then 2 when 'K' then 1 when 'P' then 1 else 0 end;
  if v_group_limit = 0 then raise exception 'That player does not fit a fantasy roster position'; end if;

  select count(*) into v_group_count
  from jsonb_array_elements(v_draft.picks) pick
  where pick ->> 'memberId' = v_member_id
    and pick ->> 'group' = p_group;
  if v_group_count >= v_group_limit then
    raise exception '% already filled every % roster slot', v_member.user_name, p_group;
  end if;

  v_pick := jsonb_build_object(
    'overall', v_draft.pick_index + 1,
    'round', v_round_index + 1,
    'memberId', v_member_id,
    'playerId', p_player_id,
    'group', p_group,
    'pickedAt', clock_timestamp()
  );
  v_next_index := v_draft.pick_index + 1;

  update public.ball_knower_live_drafts
  set picks = picks || jsonb_build_array(v_pick),
      pick_index = v_next_index,
      status = case when v_next_index >= v_total_picks then 'completed' else 'active' end,
      completed_at = case when v_next_index >= v_total_picks then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where league_id = p_league_id
  returning * into v_draft;

  if v_next_index >= v_total_picks
    and p_final_assignments is not null
    and v_league.commissioner_auth_id = v_auth then
    perform public.finalize_ball_knower_live_draft_rosters(p_league_id, p_final_assignments);
  end if;

  return to_jsonb(v_draft);
end;
$$;

revoke all on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) from public, anon;
grant execute on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) to authenticated, service_role;

create or replace function public.enforce_ball_knower_member_update()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare
  v_requester uuid := public.fantasy_requester_id();
  v_is_commissioner boolean := public.is_ball_knower_commissioner(new.league_id);
  v_paused boolean;
  v_rosters_locked boolean;
  v_salary_cap numeric;
  v_roster_count integer;
  v_spent numeric;
  v_matches_completed_live_draft boolean := false;
begin
  if v_requester is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_commissioner and old.auth_user_id = v_requester then
    if new.id is distinct from old.id
       or new.league_id is distinct from old.league_id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.app_user_id is distinct from old.app_user_id
       or new.is_commissioner is distinct from old.is_commissioner
       or new.is_ai is distinct from old.is_ai then
      raise exception 'League membership identity fields cannot be changed by members';
    end if;
  end if;

  select l.paused, l.rosters_locked, l.salary_cap
    into v_paused, v_rosters_locked, v_salary_cap
  from public.ball_knower_leagues l
  where l.id = new.league_id;

  if not found then
    raise exception 'League not found';
  end if;

  if not v_is_commissioner
     and old.auth_user_id = v_requester
     and (new.roster is distinct from old.roster
          or new.team_ratings is distinct from old.team_ratings
          or new.status is distinct from old.status
          or new.submitted_at is distinct from old.submitted_at) then
    if v_paused then raise exception 'This league is paused by the commissioner'; end if;
    if v_rosters_locked then raise exception 'Roster submissions are currently locked by the commissioner'; end if;
  end if;

  if new.status = 'ready'
     and (new.status is distinct from old.status or new.roster is distinct from old.roster) then
    v_roster_count := jsonb_array_length(coalesce(new.roster, '[]'::jsonb));
    if v_roster_count <> 20 then
      raise exception 'A ready roster must contain exactly 20 players';
    end if;

    if v_is_commissioner then
      select exists (
        select 1
        from public.ball_knower_live_drafts draft
        where draft.league_id = new.league_id
          and draft.status = 'completed'
          and draft.pick_index = jsonb_array_length(draft.order_member_ids) * draft.rounds
          and not exists (
            select 1 from (
              select player ->> 'id' as player_id
              from jsonb_array_elements(coalesce(new.roster, '[]'::jsonb)) player
              except
              select pick ->> 'playerId'
              from jsonb_array_elements(draft.picks) pick
              where pick ->> 'memberId' = new.id
            ) roster_only
          )
          and not exists (
            select 1 from (
              select pick ->> 'playerId' as player_id
              from jsonb_array_elements(draft.picks) pick
              where pick ->> 'memberId' = new.id
              except
              select player ->> 'id'
              from jsonb_array_elements(coalesce(new.roster, '[]'::jsonb)) player
            ) picks_only
          )
      ) into v_matches_completed_live_draft;
    end if;

    if not v_matches_completed_live_draft then
      select coalesce(sum(coalesce(nullif(player->>'salary','')::numeric, 0)), 0)
        into v_spent
      from jsonb_array_elements(coalesce(new.roster, '[]'::jsonb)) as player;

      if v_spent > v_salary_cap then
        raise exception 'Roster exceeds the league salary cap';
      end if;
    end if;
  end if;

  return new;
end;
$$;
