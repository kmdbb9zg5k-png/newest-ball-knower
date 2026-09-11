-- Ball Knower ratings represent earned, server-verified progress. New profiles
-- start at zero, and existing profiles are rebuilt from their immutable event ledger.
alter table public.ball_knower_progress_profiles
  alter column bk_rating set default 0,
  alter column football_iq set default 0,
  alter column gm_rating set default 0,
  alter column prediction_rating set default 0,
  alter column trivia_rating set default 0,
  alter column agent_rating set default 0,
  alter column owner_rating set default 0;

create or replace function ball_knower_private.rebuild_progress_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event public.ball_knower_progress_events%rowtype;
  v_display_name text;
  v_xp bigint := 0;
  v_football_iq integer := 0;
  v_gm integer := 0;
  v_prediction integer := 0;
  v_trivia integer := 0;
  v_agent integer := 0;
  v_owner integer := 0;
  v_championships integer := 0;
  v_current_streak integer := 0;
  v_longest_streak integer := 0;
begin
  select profile.display_name
  into v_display_name
  from public.ball_knower_progress_profiles profile
  where profile.user_id = p_user_id;

  for v_event in
    select event.*
    from public.ball_knower_progress_events event
    where event.user_id = p_user_id
    order by event.occurred_at, event.id
  loop
    v_xp := v_xp + greatest(0, v_event.xp_awarded);
    if v_event.category = 'football_iq' then v_football_iq := greatest(0, least(99, v_football_iq + v_event.rating_delta)); end if;
    if v_event.category = 'gm' then v_gm := greatest(0, least(99, v_gm + v_event.rating_delta)); end if;
    if v_event.category = 'prediction' then v_prediction := greatest(0, least(99, v_prediction + v_event.rating_delta)); end if;
    if v_event.category = 'trivia' then v_trivia := greatest(0, least(99, v_trivia + v_event.rating_delta)); end if;
    if v_event.category = 'agent' then v_agent := greatest(0, least(99, v_agent + v_event.rating_delta)); end if;
    if v_event.category = 'owner' then v_owner := greatest(0, least(99, v_owner + v_event.rating_delta)); end if;
    if v_event.event_type = 'league_championship' then v_championships := v_championships + 1; end if;
    if v_event.event_type in ('trivia_correct', 'trivia_hof_correct', 'prediction_correct', 'league_win') then
      v_current_streak := v_current_streak + 1;
      v_longest_streak := greatest(v_longest_streak, v_current_streak);
    elsif v_event.event_type in ('trivia_wrong', 'prediction_wrong', 'league_loss') then
      v_current_streak := 0;
    end if;
  end loop;

  insert into public.ball_knower_progress_profiles (
    user_id, display_name, bk_rating, xp, level, football_iq, gm_rating, prediction_rating,
    trivia_rating, agent_rating, owner_rating, championships, current_streak, longest_streak, updated_at
  ) values (
    p_user_id, coalesce(v_display_name, 'Ball Knower'),
    round((v_football_iq + v_gm + v_prediction + v_trivia + v_agent + v_owner) / 6.0)::integer,
    v_xp, greatest(1, 1 + floor(v_xp / 1000.0)::integer), v_football_iq, v_gm, v_prediction,
    v_trivia, v_agent, v_owner, v_championships, v_current_streak, v_longest_streak, clock_timestamp()
  )
  on conflict (user_id) do update set
    bk_rating = excluded.bk_rating,
    xp = excluded.xp,
    level = excluded.level,
    football_iq = excluded.football_iq,
    gm_rating = excluded.gm_rating,
    prediction_rating = excluded.prediction_rating,
    trivia_rating = excluded.trivia_rating,
    agent_rating = excluded.agent_rating,
    owner_rating = excluded.owner_rating,
    championships = excluded.championships,
    current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak,
    updated_at = excluded.updated_at;
end;
$function$;

revoke all on function ball_knower_private.rebuild_progress_profile(uuid) from public, anon, authenticated;

do $backfill$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select profile.user_id
    from public.ball_knower_progress_profiles profile
    order by profile.user_id
  loop
    perform ball_knower_private.rebuild_progress_profile(v_user_id);
  end loop;
end;
$backfill$;

create or replace function public.get_ball_knower_public_locker_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_profile jsonb;
  v_display_name text;
begin
  if v_viewer_id is null then
    raise exception 'Sign in to view manager lockers.' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'Manager profile is required.' using errcode = '22023';
  end if;

  if v_viewer_id <> p_user_id and not exists (
    select 1
    from public.ball_knower_league_members viewer
    join public.ball_knower_league_members target on target.league_id = viewer.league_id
    where viewer.auth_user_id = v_viewer_id
      and target.auth_user_id = p_user_id
      and coalesce(viewer.is_ai, false) = false
      and coalesce(target.is_ai, false) = false
  ) then
    raise exception 'You can only view lockers for managers in your leagues.' using errcode = '42501';
  end if;

  select target.user_name
  into v_display_name
  from public.ball_knower_league_members viewer
  join public.ball_knower_league_members target on target.league_id = viewer.league_id
  where viewer.auth_user_id = v_viewer_id
    and target.auth_user_id = p_user_id
    and coalesce(viewer.is_ai, false) = false
    and coalesce(target.is_ai, false) = false
  order by target.created_at desc
  limit 1;

  select jsonb_build_object(
    'user_id', profile.user_id,
    'display_name', profile.display_name,
    'bk_rating', profile.bk_rating,
    'xp', profile.xp,
    'level', profile.level,
    'football_iq', profile.football_iq,
    'gm_rating', profile.gm_rating,
    'prediction_rating', profile.prediction_rating,
    'trivia_rating', profile.trivia_rating,
    'agent_rating', profile.agent_rating,
    'owner_rating', profile.owner_rating,
    'championships', profile.championships,
    'current_streak', profile.current_streak,
    'longest_streak', profile.longest_streak,
    'updated_at', profile.updated_at
  )
  into v_profile
  from public.ball_knower_progress_profiles profile
  where profile.user_id = p_user_id;

  if v_profile is null then
    v_profile := jsonb_build_object(
      'user_id', p_user_id,
      'display_name', coalesce(nullif(trim(v_display_name), ''), 'Ball Knower'),
      'bk_rating', 0,
      'xp', 0,
      'level', 1,
      'football_iq', 0,
      'gm_rating', 0,
      'prediction_rating', 0,
      'trivia_rating', 0,
      'agent_rating', 0,
      'owner_rating', 0,
      'championships', 0,
      'current_streak', 0,
      'longest_streak', 0,
      'updated_at', null
    );
  end if;

  return jsonb_build_object(
    'profile', v_profile,
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', event.id,
        'event_type', event.event_type,
        'category', event.category,
        'xp_awarded', event.xp_awarded,
        'rating_delta', event.rating_delta,
        'occurred_at', event.occurred_at,
        'metadata', '{}'::jsonb
      ) order by event.occurred_at desc), '[]'::jsonb)
      from (
        select id, event_type, category, xp_awarded, rating_delta, occurred_at
        from public.ball_knower_progress_events
        where user_id = p_user_id
        order by occurred_at desc
        limit 12
      ) event
    ),
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'achievement_key', catalog.achievement_key,
        'title', catalog.title,
        'description', catalog.description,
        'category', catalog.category,
        'tier', catalog.tier,
        'xp_reward', catalog.xp_reward,
        'unlocked_at', unlocked.unlocked_at
      ) order by catalog.xp_reward desc), '[]'::jsonb)
      from public.ball_knower_achievement_catalog catalog
      left join public.ball_knower_user_achievements unlocked
        on unlocked.achievement_key = catalog.achievement_key
       and unlocked.user_id = p_user_id
      where coalesce(catalog.hidden, false) = false
         or unlocked.unlocked_at is not null
    ),
    'prediction_picks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pick.game_id,
        'game_id', pick.game_id,
        'pick_id', pick.pick_id,
        'market', pick.market,
        'selection', pick.selection,
        'locked_line', pick.locked_line,
        'label', pick.label,
        'kickoff_at', pick.kickoff_at,
        'away_team', pick.away_team,
        'home_team', pick.home_team,
        'locked_at', pick.locked_at,
        'result', pick.result,
        'graded_at', pick.graded_at
      ) order by pick.locked_at desc), '[]'::jsonb)
      from ball_knower_private.verified_prediction_picks pick
      where pick.user_id = p_user_id
        and pick.result is not null
    )
  );
end;
$$;

revoke all on function public.get_ball_knower_public_locker_profile(uuid) from public, anon, authenticated;
grant execute on function public.get_ball_knower_public_locker_profile(uuid) to authenticated;

comment on function public.get_ball_knower_public_locker_profile(uuid) is
  'Returns a privacy-filtered public locker for a human manager who shares a fantasy league with the authenticated viewer.';
