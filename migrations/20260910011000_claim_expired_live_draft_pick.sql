-- Let an authenticated league member immediately claim the single pick whose
-- persisted draft clock has expired. The minute worker remains the fallback,
-- while the expected pick index and row lock make concurrent phone/cron calls
-- idempotent.

create or replace function public.claim_ball_knower_expired_draft_pick(
  p_league_id text,
  p_expected_pick_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := (select auth.uid());
  v_now timestamptz := clock_timestamp();
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_draft_format text;
  v_team_count integer;
  v_total integer;
  v_round_index integer;
  v_slot integer;
  v_order_index integer;
  v_member_id text;
  v_member_pick_count integer;
  v_picks_remaining integer;
  v_missing integer;
  v_required_now boolean;
  v_player_id text;
  v_group text;
  v_next integer;
  v_pick jsonb;
begin
  if v_auth is null then
    raise exception 'Authentication required';
  end if;
  if p_expected_pick_index is null or p_expected_pick_index < 0 then
    raise exception 'Expected draft pick is required';
  end if;
  if not exists (
    select 1
    from public.ball_knower_league_members requester
    where requester.league_id = p_league_id
      and requester.auth_user_id = v_auth
  ) then
    raise exception 'League membership required';
  end if;

  select *
  into v_draft
  from public.ball_knower_live_drafts draft
  where draft.league_id = p_league_id
  for update;
  if not found then
    raise exception 'Fantasy draft has not started';
  end if;

  -- A second phone, realtime retry, or the cron worker may have won the race.
  -- Returning the current row refreshes the stale caller without making a
  -- second selection.
  if v_draft.status = 'completed'
     or v_draft.pick_index <> p_expected_pick_index
  then
    return to_jsonb(v_draft);
  end if;
  if v_draft.status <> 'active' then
    raise exception 'Fantasy draft is not active';
  end if;
  if v_draft.recovery_enabled is not true then
    raise exception 'Fantasy draft recovery must be restored first';
  end if;

  select coalesce(league.settings->>'draftFormat', 'live_snake')
  into v_draft_format
  from public.ball_knower_leagues league
  where league.id = p_league_id;

  v_team_count := jsonb_array_length(v_draft.order_member_ids);
  v_total := v_team_count * v_draft.rounds;
  if v_team_count < 1
     or v_draft.pick_index >= v_total
     or jsonb_array_length(v_draft.picks) <> v_draft.pick_index
  then
    raise exception 'Saved fantasy draft ledger is invalid';
  end if;

  v_round_index := v_draft.pick_index / v_team_count;
  v_slot := mod(v_draft.pick_index, v_team_count);
  v_order_index := case
    when mod(v_round_index, 2) = 0 then v_slot
    else v_team_count - 1 - v_slot
  end;
  v_member_id := v_draft.order_member_ids->>v_order_index;

  select *
  into v_member
  from public.ball_knower_league_members member
  where member.league_id = p_league_id
    and member.id = v_member_id;
  if not found then
    raise exception 'Manager on the clock is unavailable';
  end if;

  -- CPU turns and autopick-only rooms are due immediately. A normal human
  -- turn is claimable only after the authoritative database deadline.
  if not coalesce(v_member.is_ai, false)
     and v_draft_format <> 'autopick'
     and v_draft.pick_deadline_at is not null
     and v_draft.pick_deadline_at > v_now
  then
    return to_jsonb(v_draft);
  end if;

  select count(*)
  into v_member_pick_count
  from jsonb_array_elements(v_draft.picks) pick
  where pick->>'memberId' = v_member_id;
  v_picks_remaining := v_draft.rounds - v_member_pick_count;

  with counts as (
    select pick->>'group' draft_group, count(*)::integer amount
    from jsonb_array_elements(v_draft.picks) pick
    where pick->>'memberId' = v_member_id
    group by pick->>'group'
  )
  select sum(greatest(required.minimum - coalesce(counts.amount, 0), 0))::integer
  into v_missing
  from (values
    ('QB', 1), ('RB', 2), ('WR', 2), ('TE', 1), ('K', 1), ('DST', 1)
  ) required(draft_group, minimum)
  left join counts using (draft_group);
  v_required_now := v_picks_remaining <= coalesce(v_missing, 0);

  with position_counts as materialized (
    select pick->>'group' draft_group, count(*)::integer amount
    from jsonb_array_elements(v_draft.picks) pick
    where pick->>'memberId' = v_member_id
    group by pick->>'group'
  ), preference as materialized (
    select
      coalesce(pref.queue, '[]'::jsonb) queue,
      coalesce(pref.pre_rankings, '[]'::jsonb) pre_rankings,
      coalesce(pref.favorites, '[]'::jsonb) favorites,
      coalesce(pref.do_not_draft, '[]'::jsonb) do_not_draft
    from (select 1) seed
    left join public.ball_knower_draft_preferences pref
      on pref.league_id = p_league_id
     and pref.member_id = v_member_id
  ), candidates as (
    select
      player.player_id,
      player.draft_group,
      coalesce(position_counts.amount, 0) position_count,
      case player.draft_group
        when 'QB' then 2 when 'RB' then 5 when 'WR' then 7
        when 'TE' then 2 when 'K' then 2 when 'DST' then 2
      end position_limit,
      case player.draft_group
        when 'QB' then 1 when 'RB' then 2 when 'WR' then 2
        when 'TE' then 1 when 'K' then 1 when 'DST' then 1
      end starter_minimum,
      case player.draft_group
        when 'QB' then 75 when 'TE' then 62 when 'K' then 45
        when 'DST' then 45 when 'RB' then 14 else 10
      end depth_penalty,
      coalesce(ranking.overall_rank, 9999) overall_rank,
      coalesce(
        case
          when (catalog.player_json->>'ovr') ~ '^[0-9]+([.][0-9]+)?$'
            then (catalog.player_json->>'ovr')::numeric
        end,
        0
      ) ovr,
      coalesce((
        select ordinality
        from jsonb_array_elements_text(preference.queue) with ordinality
        where value = player.player_id
        limit 1
      ), 1000000) queue_ord,
      coalesce((
        select ordinality
        from jsonb_array_elements_text(preference.pre_rankings) with ordinality
        where value = player.player_id
        limit 1
      ), 1000000) pre_rank_ord,
      preference.favorites ? player.player_id as is_favorite,
      preference.do_not_draft ? player.player_id as is_dnd
    from public.ball_knower_fantasy_player_groups player
    left join ball_knower_private.draft_order_game_players catalog
      on catalog.player_id = player.player_id
    left join ball_knower_private.live_draft_recovery_rankings ranking
      on ranking.player_id = player.player_id
    left join position_counts
      on position_counts.draft_group = player.draft_group
    cross join preference
    where player.draft_group in ('QB', 'RB', 'WR', 'TE', 'K', 'DST')
      and (catalog.player_id is not null or player.draft_group = 'DST')
      and not exists (
        select 1
        from jsonb_array_elements(v_draft.picks) picked
        where picked->>'playerId' = player.player_id
      )
  )
  select candidate.player_id, candidate.draft_group
  into v_player_id, v_group
  from candidates candidate
  where candidate.position_count < candidate.position_limit
    and not candidate.is_dnd
    and (not v_required_now or candidate.position_count < candidate.starter_minimum)
  order by
    case
      when candidate.queue_ord < 1000000 then 0
      when candidate.pre_rank_ord < 1000000 then 1
      when candidate.is_favorite then 2
      else 3
    end,
    candidate.queue_ord,
    candidate.pre_rank_ord,
    case when candidate.position_count < candidate.starter_minimum then 0 else 1 end,
    candidate.overall_rank
      + candidate.position_count * candidate.depth_penalty
      + case
          when candidate.draft_group in ('K', 'DST') and v_member_pick_count < 13 then 500
          else 0
        end,
    candidate.ovr desc,
    candidate.player_id
  limit 1;

  if v_player_id is null then
    raise exception 'No legal automatic fantasy pick remains for %', v_member.user_name;
  end if;

  v_pick := jsonb_build_object(
    'overall', v_draft.pick_index + 1,
    'round', v_round_index + 1,
    'memberId', v_member_id,
    'playerId', v_player_id,
    'group', v_group,
    'pickedAt', v_now,
    'source', case when coalesce(v_member.is_ai, false) then 'cpu' else 'autopick' end
  );
  v_next := v_draft.pick_index + 1;

  update public.ball_knower_live_drafts
  set picks = picks || jsonb_build_array(v_pick),
      pick_index = v_next,
      status = case when v_next >= v_total then 'completed' else 'active' end,
      completed_at = case when v_next >= v_total then v_now else null end,
      updated_at = v_now
  where league_id = p_league_id
    and pick_index = p_expected_pick_index
  returning * into v_draft;

  return to_jsonb(v_draft);
end;
$function$;

revoke all on function public.claim_ball_knower_expired_draft_pick(text, integer)
from public, anon;
grant execute on function public.claim_ball_knower_expired_draft_pick(text, integer)
to authenticated, service_role;

comment on function public.claim_ball_knower_expired_draft_pick(text, integer) is
  'Allows a league member to atomically advance one due live-draft pick; expected index makes retries idempotent.';
