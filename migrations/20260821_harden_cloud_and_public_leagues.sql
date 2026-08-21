-- Final hardening for cross-device state and recoverable public matchmaking.

create or replace function public.touch_ball_knower_user_state_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.touch_ball_knower_user_state_updated_at() from public, anon, authenticated;

drop trigger if exists touch_ball_knower_user_state_updated_at on public.ball_knower_user_state;
create trigger touch_ball_knower_user_state_updated_at
before insert or update on public.ball_knower_user_state
for each row execute function public.touch_ball_knower_user_state_updated_at();

drop function if exists public.join_ball_knower_league(text, text, text);
create function public.join_ball_knower_league(
  p_code text,
  p_user_name text,
  p_user_avatar text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := (select auth.uid());
  v_league public.ball_knower_leagues%rowtype;
  v_existing text;
  v_member_count integer;
  v_name text := left(coalesce(nullif(btrim(p_user_name), ''), 'Ball Knower'), 60);
begin
  if v_auth is null then raise exception 'Authentication required'; end if;

  select *
  into v_league
  from public.ball_knower_leagues
  where upper(code) = upper(btrim(p_code))
  for update;

  if not found then raise exception 'League not found'; end if;
  if v_league.invite_enabled is false then raise exception 'League invite disabled'; end if;
  if v_league.paused is true then raise exception 'League is paused'; end if;
  if v_league.status <> 'drafting' then raise exception 'League is no longer accepting members'; end if;

  select id
  into v_existing
  from public.ball_knower_league_members
  where league_id = v_league.id and auth_user_id = v_auth
  limit 1;

  if v_existing is not null then return v_league.id; end if;

  select count(*)
  into v_member_count
  from public.ball_knower_league_members
  where league_id = v_league.id;

  if v_member_count >= v_league.max_members then raise exception 'League is full'; end if;

  insert into public.ball_knower_league_members(
    id, league_id, auth_user_id, app_user_id, user_name, user_avatar,
    is_commissioner, is_ai, status
  ) values (
    'member-' || v_auth::text || '-' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
    v_league.id, v_auth, v_auth::text, v_name, left(p_user_avatar, 1000), false, false, 'building'
  )
  on conflict (league_id, auth_user_id) where auth_user_id is not null do nothing;

  return v_league.id;
end;
$$;

revoke all on function public.join_ball_knower_league(text, text, text) from public, anon;
grant execute on function public.join_ball_knower_league(text, text, text) to authenticated, service_role;

create or replace function public.reopen_ball_knower_public_league_matchmaking(p_league_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := (select auth.uid());
  v_league public.ball_knower_leagues%rowtype;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;

  select *
  into v_league
  from public.ball_knower_leagues
  where id = p_league_id
  for update;

  if not found then raise exception 'League not found'; end if;
  if v_league.commissioner_auth_id <> v_auth then raise exception 'Only the league starter can reopen matchmaking'; end if;
  if v_league.status <> 'drafting' then return false; end if;
  if (v_league.settings ->> 'leagueType') <> 'public_free' then return false; end if;
  if exists (
    select 1 from public.ball_knower_league_members
    where league_id = p_league_id and is_ai = true
  ) then return false; end if;
  if (
    select count(*) from public.ball_knower_league_members
    where league_id = p_league_id
  ) >= v_league.max_members then return false; end if;

  update public.ball_knower_leagues
  set invite_enabled = true,
      settings = jsonb_set(
        coalesce(settings, '{}'::jsonb),
        '{matchmakingOpen}',
        'true'::jsonb,
        true
      ),
      updated_at = now()
  where id = p_league_id;

  return true;
end;
$$;

revoke all on function public.reopen_ball_knower_public_league_matchmaking(text) from public, anon;
grant execute on function public.reopen_ball_knower_public_league_matchmaking(text) to authenticated, service_role;
