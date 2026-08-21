-- Keep public matchmaking pools isolated by league size. The UI currently
-- requests 10-team leagues, while the RPC intentionally supports more sizes.

create or replace function public.join_or_create_ball_knower_public_league(
  p_user_name text,
  p_user_avatar text default null,
  p_max_members integer default 10
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := (select auth.uid());
  v_league_id text;
  v_code text;
  v_name text := left(coalesce(nullif(btrim(p_user_name), ''), 'Ball Knower'), 60);
  v_max integer := case when p_max_members in (6, 8, 10, 12, 14, 16) then p_max_members else 10 end;
  v_member_count integer;
  v_attempt integer := 0;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('bk-public-' || v_max::text));

  select l.id
  into v_league_id
  from public.ball_knower_leagues l
  join public.ball_knower_league_members m on m.league_id = l.id
  where m.auth_user_id = v_auth
    and l.status = 'drafting'
    and (l.settings ->> 'leagueType') = 'public_free'
  order by l.created_at desc
  limit 1;

  if v_league_id is not null then return v_league_id; end if;

  select l.id
  into v_league_id
  from public.ball_knower_leagues l
  where l.status = 'drafting'
    and l.invite_enabled = true
    and l.paused = false
    and l.max_members = v_max
    and (l.settings ->> 'leagueType') = 'public_free'
    and not exists (
      select 1 from public.ball_knower_league_members ai
      where ai.league_id = l.id and ai.is_ai = true
    )
    and (
      select count(*) from public.ball_knower_league_members member_count
      where member_count.league_id = l.id
    ) < l.max_members
  order by l.created_at
  for update
  limit 1;

  if v_league_id is null then
    v_league_id := gen_random_uuid()::text;
    loop
      v_attempt := v_attempt + 1;
      v_code := 'BK-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (
        select 1 from public.ball_knower_leagues where code = v_code
      );
      if v_attempt >= 8 then raise exception 'Could not create a public league code'; end if;
    end loop;

    insert into public.ball_knower_leagues(
      id, code, name, max_members, salary_cap, commissioner_auth_id,
      commissioner_name, status, settings, invite_enabled
    ) values (
      v_league_id,
      v_code,
      'Open Ball Knower ' || right(v_code, 3),
      v_max,
      301.2,
      v_auth,
      v_name,
      'drafting',
      jsonb_build_object(
        'seasonGames', 17,
        'simulationStyle', 'realistic',
        'playoffTeams', 6,
        'injuriesEnabled', false,
        'aiDifficulty', 'all_pro',
        'leagueType', 'public_free',
        'autoFillCpu', true,
        'matchmakingOpen', true
      ),
      true
    );
  else
    select count(*)
    into v_member_count
    from public.ball_knower_league_members
    where league_id = v_league_id;

    if v_member_count >= v_max then raise exception 'Public league filled while joining; try again'; end if;
  end if;

  insert into public.ball_knower_league_members(
    id, league_id, auth_user_id, app_user_id, user_name, user_avatar,
    is_commissioner, is_ai, status
  ) values (
    'member-' || v_auth::text || '-' || substr(md5(v_league_id), 1, 10),
    v_league_id,
    v_auth,
    v_auth::text,
    v_name,
    left(p_user_avatar, 1000),
    not exists (
      select 1 from public.ball_knower_league_members where league_id = v_league_id
    ),
    false,
    'building'
  )
  on conflict (league_id, auth_user_id) where auth_user_id is not null do nothing;

  return v_league_id;
end;
$$;

revoke all on function public.join_or_create_ball_knower_public_league(text, text, integer) from public, anon;
grant execute on function public.join_or_create_ball_knower_public_league(text, text, integer) to authenticated, service_role;
