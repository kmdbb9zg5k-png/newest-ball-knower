-- Run this against the deployed Supabase project with a privileged connection.
-- Every fixture and mutation is contained in this transaction and rolled back.
-- The smoke deliberately uses the production functions, triggers, canonical
-- player pool, roster guards, schedule builder, and notification fanout.

begin;

do $smoke$
declare
  v_league_id text := 'release-smoke-' || txid_current()::text;
  v_code text := upper(substr(md5(clock_timestamp()::text || random()::text), 1, 8));
  v_auth_ids uuid[];
  v_member_ids text[] := array[
    'release-smoke-human-1',
    'release-smoke-human-2',
    'release-smoke-cpu-1',
    'release-smoke-cpu-2',
    'release-smoke-cpu-3',
    'release-smoke-cpu-4',
    'release-smoke-cpu-5',
    'release-smoke-cpu-6',
    'release-smoke-cpu-7',
    'release-smoke-cpu-8'
  ];
  v_order jsonb;
  v_regular_games jsonb;
  v_starters jsonb;
  v_qbs text[];
  v_rbs text[];
  v_wrs text[];
  v_tes text[];
  v_ks text[];
  v_dsts text[];
  v_flex text;
  v_trade_id uuid;
  v_trade_result jsonb;
  v_offered text;
  v_requested text;
  v_drop_id text;
  v_free_agent_id text;
  v_free_agent jsonb;
  v_claim jsonb;
  v_claim_id uuid;
  v_waiver_result jsonb;
  v_injury_first jsonb;
  v_injury_retry jsonb;
  v_final_notifications integer;
  v_playoff_games jsonb;
  v_standings jsonb;
  v_season_result jsonb;
begin
  -- Borrow two real auth identities only as principals for auth.uid() checks.
  -- No rows belonging to those users are changed outside this transaction.
  select array_agg(auth_user_id order by auth_user_id)
  into v_auth_ids
  from (
    select distinct member.auth_user_id
    from public.ball_knower_league_members member
    where member.auth_user_id is not null
      and coalesce(member.is_ai, false) = false
    limit 2
  ) humans;

  if coalesce(array_length(v_auth_ids, 1), 0) <> 2 then
    raise exception 'Production smoke requires two existing authenticated principals';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'pickNumber', slot,
      'memberId', v_member_ids[slot],
      'memberName', case when slot <= 2 then 'Smoke Human ' || slot else 'Smoke CPU ' || (slot - 2) end
    )
    order by slot
  )
  into v_order
  from generate_series(1, 10) slot;

  insert into public.ball_knower_leagues(
    id,
    code,
    name,
    max_members,
    commissioner_auth_id,
    commissioner_name,
    status,
    season_result,
    settings,
    draft_countdown_started_at
  ) values (
    v_league_id,
    v_code,
    'Production Release Smoke',
    10,
    v_auth_ids[1],
    'Smoke Human 1',
    'completed',
    jsonb_build_object('draftOrder', v_order, 'games', '[]'::jsonb),
    jsonb_build_object(
      'nflSeason', 2026,
      'draftFormat', 'autopick',
      'scoringFormat', 'ppr',
      'tradeReview', 'none',
      'waiverType', 'priority',
      'freeAgentMode', 'continuous',
      'regularSeasonWeeks', 15,
      'seasonGames', 17,
      'playoffTeams', 6,
      'benchSlots', 6,
      'rosterSize', 15,
      'tradeDeadlineWeek', 11,
      'currentWeek', 1
    ),
    clock_timestamp() - interval '1 minute'
  );

  insert into public.ball_knower_league_members(
    id,
    league_id,
    auth_user_id,
    user_name,
    is_commissioner,
    is_ai,
    ai_archetype,
    status,
    roster,
    live_draft_ready,
    waiver_priority
  )
  select
    v_member_ids[slot],
    v_league_id,
    case when slot <= 2 then v_auth_ids[slot] else null end,
    case when slot <= 2 then 'Smoke Human ' || slot else 'Smoke CPU ' || (slot - 2) end,
    slot = 1,
    slot > 2,
    case when slot > 2 then 'balanced' else null end,
    'building',
    null,
    true,
    slot
  from generate_series(1, 10) slot;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_auth_ids[1]::text)::text,
    true
  );
  perform public.start_ball_knower_live_draft(v_league_id);

  -- Isolate the production worker to this fixture. Existing active rooms are
  -- restored automatically by the outer rollback.
  update public.ball_knower_live_drafts
  set recovery_enabled = false
  where league_id <> v_league_id
    and status = 'active';

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role', 'sub', v_auth_ids[1]::text)::text,
    true
  );
  perform public.process_due_ball_knower_draft_picks(clock_timestamp());
  perform public.process_due_ball_knower_draft_picks(clock_timestamp());
  perform public.process_due_ball_knower_draft_picks(clock_timestamp());
  perform public.process_due_ball_knower_draft_picks(clock_timestamp());

  if not exists (
    select 1
    from public.ball_knower_live_drafts draft
    where draft.league_id = v_league_id
      and draft.status = 'completed'
      and draft.pick_index = 150
      and jsonb_array_length(draft.picks) = 150
      and (select count(*) from jsonb_array_elements(draft.picks) pick where pick->>'source' = 'autopick') = 30
      and (select count(*) from jsonb_array_elements(draft.picks) pick where pick->>'source' = 'cpu') = 120
  ) then
    raise exception '10-team CPU/autopick draft did not complete exactly 150 picks';
  end if;

  if (select count(*) from public.ball_knower_league_members member
      where member.league_id = v_league_id
        and member.status = 'ready'
        and jsonb_array_length(member.roster) = 15) <> 10
     or not (select rosters_locked from public.ball_knower_leagues where id = v_league_id)
  then
    raise exception 'Completed draft did not finalize ten legal 15-player rosters';
  end if;

  select ball_knower_private.build_fantasy_regular_schedule(
    to_jsonb(v_member_ids),
    15
  ) into v_regular_games;

  update public.ball_knower_leagues
  set season_result = jsonb_set(season_result, '{games}', v_regular_games, true)
  where id = v_league_id;

  if jsonb_array_length(v_regular_games) <> 75 then
    raise exception '10-team regular-season schedule is not 75 matchups';
  end if;

  select
    array_agg(player->>'id' order by player->>'id') filter (where player->>'position' = 'QB'),
    array_agg(player->>'id' order by player->>'id') filter (where player->>'position' in ('RB', 'FB')),
    array_agg(player->>'id' order by player->>'id') filter (where player->>'position' = 'WR'),
    array_agg(player->>'id' order by player->>'id') filter (where player->>'position' = 'TE'),
    array_agg(player->>'id' order by player->>'id') filter (where player->>'position' = 'K'),
    array_agg(player->>'id' order by player->>'id') filter (where player->>'position' = 'DST')
  into v_qbs, v_rbs, v_wrs, v_tes, v_ks, v_dsts
  from public.ball_knower_league_members member
  cross join lateral jsonb_array_elements(member.roster) player
  where member.id = v_member_ids[1];

  v_flex := coalesce(v_rbs[3], v_wrs[3], v_tes[2]);
  if v_qbs[1] is null or v_rbs[2] is null or v_wrs[2] is null
     or v_tes[1] is null or v_ks[1] is null or v_dsts[1] is null
     or v_flex is null
  then
    raise exception 'Autopick roster cannot fill every weekly lineup slot';
  end if;

  v_starters := jsonb_build_object(
    'QB', v_qbs[1],
    'RB1', v_rbs[1],
    'RB2', v_rbs[2],
    'WR1', v_wrs[1],
    'WR2', v_wrs[2],
    'TE', v_tes[1],
    'FLEX', v_flex,
    'K', v_ks[1],
    'DST', v_dsts[1]
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_auth_ids[1]::text)::text,
    true
  );
  perform public.save_my_ball_knower_weekly_lineup(v_league_id, 1, v_starters, '[]'::jsonb);

  if not exists (
    select 1 from public.ball_knower_weekly_lineups lineup
    where lineup.league_id = v_league_id
      and lineup.member_id = v_member_ids[1]
      and lineup.week_number = 1
      and (select count(*) from jsonb_object_keys(lineup.starters)) = 9
  ) then
    raise exception 'Weekly lineup save did not persist nine starters';
  end if;

  update public.ball_knower_leagues
  set settings = settings || jsonb_build_object('injuriesEnabled', true)
  where id = v_league_id;
  v_injury_first := public.generate_ball_knower_weekly_injuries(v_league_id, 1);
  v_injury_retry := public.generate_ball_knower_weekly_injuries(v_league_id, 1);

  if coalesce((v_injury_first->>'reused')::boolean, true)
     or not coalesce((v_injury_retry->>'reused')::boolean, false)
     or (select count(*) from public.ball_knower_injury_rolls
         where league_id = v_league_id and week_number = 1) <> 1
  then
    raise exception 'Weekly injury generation is not idempotent';
  end if;

  select player->>'id'
  into v_offered
  from public.ball_knower_league_members member
  cross join lateral jsonb_array_elements(member.roster) player
  where member.id = v_member_ids[1]
  order by player->>'id'
  limit 1;

  select player->>'id'
  into v_requested
  from public.ball_knower_league_members member
  cross join lateral jsonb_array_elements(member.roster) player
  where member.id = v_member_ids[2]
  order by player->>'id'
  limit 1;

  v_trade_id := public.propose_ball_knower_trade_v2(
    v_league_id,
    v_member_ids[2],
    array[v_offered],
    array[v_requested],
    array[]::text[],
    'Production release smoke'
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_auth_ids[2]::text)::text,
    true
  );
  v_trade_result := public.resolve_ball_knower_trade_v2(
    v_trade_id,
    'accepted',
    array[]::text[]
  );

  if v_trade_result->>'status' <> 'accepted'
     or not exists (
       select 1 from public.ball_knower_league_members member
       cross join lateral jsonb_array_elements(member.roster) player
       where member.id = v_member_ids[1] and player->>'id' = v_requested
     )
     or not exists (
       select 1 from public.ball_knower_league_members member
       cross join lateral jsonb_array_elements(member.roster) player
       where member.id = v_member_ids[2] and player->>'id' = v_offered
     )
  then
    raise exception 'Accepted trade did not atomically swap both players';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_auth_ids[1]::text)::text,
    true
  );

  select player->>'id'
  into v_drop_id
  from public.ball_knower_league_members member
  cross join lateral jsonb_array_elements(member.roster) player
  where member.id = v_member_ids[1]
    and not exists (
      select 1
      from jsonb_each_text(v_starters) starter
      where starter.value = player->>'id'
    )
  order by player->>'id'
  limit 1;

  select candidate.player_id,
         ball_knower_private.fantasy_player_payload(candidate.player_id)
  into v_free_agent_id, v_free_agent
  from public.ball_knower_fantasy_player_groups candidate
  where not exists (
    select 1
    from public.ball_knower_league_members member
    cross join lateral jsonb_array_elements(member.roster) player
    where member.league_id = v_league_id
      and player->>'id' = candidate.player_id
  )
  order by candidate.player_id
  limit 1;

  if v_drop_id is null or v_free_agent_id is null or v_free_agent is null then
    raise exception 'Could not build waiver fixture from canonical players';
  end if;

  v_claim := public.submit_ball_knower_player_move(
    v_league_id,
    v_free_agent,
    v_drop_id,
    0,
    1,
    null
  );
  v_claim_id := (v_claim->>'claimId')::uuid;

  if v_claim->>'status' <> 'pending' or v_claim_id is null then
    raise exception 'Continuous-waiver submission did not create a pending claim';
  end if;

  -- Prevent unrelated due claims from entering this bounded test transaction.
  update public.ball_knower_waiver_claims
  set process_at = clock_timestamp() + interval '1 day'
  where status = 'pending'
    and id <> v_claim_id;
  update public.ball_knower_waiver_claims
  set process_at = clock_timestamp() - interval '1 second'
  where id = v_claim_id;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'service_role', 'sub', v_auth_ids[1]::text)::text,
    true
  );
  v_waiver_result := public.process_due_ball_knower_waivers(clock_timestamp());

  if coalesce((v_waiver_result->>'won')::integer, 0) <> 1
     or not exists (
       select 1 from public.ball_knower_waiver_claims claim
       where claim.id = v_claim_id and claim.status = 'won'
     )
     or not exists (
       select 1 from public.ball_knower_league_members member
       cross join lateral jsonb_array_elements(member.roster) player
       where member.id = v_member_ids[1] and player->>'id' = v_free_agent_id
     )
     or exists (
       select 1 from public.ball_knower_league_members member
       cross join lateral jsonb_array_elements(member.roster) player
       where member.id = v_member_ids[1] and player->>'id' = v_drop_id
     )
  then
    raise exception 'Waiver worker did not atomically add and drop the expected players';
  end if;

  insert into public.ball_knower_weekly_scores(
    league_id, member_id, week_number, live_points, projected_points, source, is_final
  ) values (
    v_league_id, v_member_ids[1], 1, 123.45, 118.20, 'production_smoke', false
  );
  update public.ball_knower_weekly_scores
  set is_final = true, finalized_at = clock_timestamp()
  where league_id = v_league_id
    and member_id = v_member_ids[1]
    and week_number = 1;
  update public.ball_knower_weekly_scores
  set is_final = true
  where league_id = v_league_id
    and member_id = v_member_ids[1]
    and week_number = 1;

  select count(*)
  into v_final_notifications
  from public.ball_knower_notifications notification
  where notification.league_id = v_league_id
    and notification.auth_user_id = v_auth_ids[1]
    and notification.kind = 'matchup_final';

  if v_final_notifications <> 1 then
    raise exception 'Weekly finalization emitted % notifications instead of exactly one', v_final_notifications;
  end if;

  insert into public.ball_knower_weekly_scores(
    league_id, member_id, week_number, live_points, projected_points, source, is_final, finalized_at
  ) values
    (v_league_id, v_member_ids[1], 16, 111, 105, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[2], 16, 91, 100, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[3], 16, 109, 102, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[4], 16, 89, 99, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[1], 17, 121, 110, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[5], 17, 101, 106, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[3], 17, 119, 108, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[6], 17, 99, 104, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[1], 18, 131, 115, 'production_smoke', true, clock_timestamp()),
    (v_league_id, v_member_ids[3], 18, 129, 114, 'production_smoke', true, clock_timestamp());

  v_playoff_games := jsonb_build_array(
    jsonb_build_object('id','smoke-qf-1','week',16,'playoffRound','quarterfinal','homeMemberId',v_member_ids[1],'awayMemberId',v_member_ids[2],'homeScore',111,'awayScore',91,'winnerId',v_member_ids[1]),
    jsonb_build_object('id','smoke-qf-2','week',16,'playoffRound','quarterfinal','homeMemberId',v_member_ids[3],'awayMemberId',v_member_ids[4],'homeScore',109,'awayScore',89,'winnerId',v_member_ids[3]),
    jsonb_build_object('id','smoke-sf-1','week',17,'playoffRound','semifinal','homeMemberId',v_member_ids[1],'awayMemberId',v_member_ids[5],'homeScore',121,'awayScore',101,'winnerId',v_member_ids[1]),
    jsonb_build_object('id','smoke-sf-2','week',17,'playoffRound','semifinal','homeMemberId',v_member_ids[3],'awayMemberId',v_member_ids[6],'homeScore',119,'awayScore',99,'winnerId',v_member_ids[3]),
    jsonb_build_object('id','smoke-final','week',18,'playoffRound','championship','homeMemberId',v_member_ids[1],'awayMemberId',v_member_ids[3],'homeScore',131,'awayScore',129,'winnerId',v_member_ids[1])
  );

  select jsonb_agg(
    jsonb_build_object(
      'memberId', v_member_ids[slot],
      'memberName', case when slot <= 2 then 'Smoke Human ' || slot else 'Smoke CPU ' || (slot - 2) end,
      'wins', 11 - slot,
      'losses', slot - 1,
      'ties', 0,
      'pointsFor', 1800 - slot
    ) order by slot
  )
  into v_standings
  from generate_series(1, 10) slot;

  v_season_result := jsonb_build_object(
    'draftOrder', v_order,
    'games', v_regular_games || v_playoff_games,
    'playoffGames', v_playoff_games,
    'standings', v_standings,
    'championMemberId', v_member_ids[1]
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated', 'sub', v_auth_ids[1]::text)::text,
    true
  );
  v_season_result := public.finalize_ball_knower_fantasy_season(v_league_id, v_season_result);

  if not exists (
    select 1 from public.ball_knower_leagues league
    where league.id = v_league_id
      and league.status = 'completed'
      and (league.settings->>'fantasySeasonComplete')::boolean
      and league.season_result->>'championMemberId' = v_member_ids[1]
      and league.season_result ? 'completedAt'
  ) then
    raise exception 'Verified playoff result did not finalize the fantasy season';
  end if;

  insert into public.ball_knower_season_archive(
    league_id, season_number, result, settings
  )
  select id, 1, season_result, settings
  from public.ball_knower_leagues
  where id = v_league_id;

  if not exists (
    select 1 from public.ball_knower_season_archive archive
    where archive.league_id = v_league_id
      and archive.season_number = 1
      and archive.result->>'championMemberId' = v_member_ids[1]
  ) then
    raise exception 'Completed fantasy season was not archived';
  end if;

  perform public.reset_ball_knower_league_for_next_season(v_league_id);

  if not exists (
    select 1 from public.ball_knower_leagues league
    where league.id = v_league_id
      and league.status = 'drafting'
      and league.season_result is null
      and not league.rosters_locked
      and league.settings ? 'fantasySeasonResetAt'
  )
  or exists (
    select 1 from public.ball_knower_live_drafts draft
    where draft.league_id = v_league_id
  )
  or not exists (
    select 1 from public.ball_knower_season_archive archive
    where archive.league_id = v_league_id and archive.season_number = 1
  ) then
    raise exception 'Archive-and-reset did not preserve history and reopen the league';
  end if;
end;
$smoke$;

rollback;

select 'production fantasy smoke passed and rolled back' as result;
