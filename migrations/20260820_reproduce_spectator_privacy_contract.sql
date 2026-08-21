-- Reproduce the spectator-mode RPC contract that is already deployed in Supabase.
-- Public spectator reads are intentionally sanitized: no auth_user_id, app_user_id,
-- roster, submitted_at, invite controls, or commissioner auth id are returned.

create or replace function public.get_ball_knower_spectator_league(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league record;
  v_members jsonb;
begin
  select *
  into v_league
  from public.ball_knower_leagues
  where public_slug = p_slug
    and spectator_enabled = true
  limit 1;

  if v_league.id is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'userName', m.user_name,
        'userAvatar', m.user_avatar,
        'isCommissioner', m.is_commissioner,
        'isAi', m.is_ai,
        'teamRatings', m.team_ratings
      )
      order by m.created_at, m.id
    ),
    '[]'::jsonb
  )
  into v_members
  from public.ball_knower_league_members m
  where m.league_id = v_league.id;

  return jsonb_build_object(
    'id', v_league.id,
    'code', v_league.code,
    'name', v_league.name,
    'maxMembers', v_league.max_members,
    'salaryCap', v_league.salary_cap,
    'commissionerName', v_league.commissioner_name,
    'status', v_league.status,
    'seasonResult', v_league.season_result,
    'createdAt', v_league.created_at,
    'settings', v_league.settings,
    'members', v_members,
    'spectatorEnabled', v_league.spectator_enabled,
    'publicSlug', v_league.public_slug
  );
end;
$$;

revoke all on function public.get_ball_knower_spectator_league(text) from public;
revoke all on function public.get_ball_knower_spectator_league(text) from anon, authenticated;
grant execute on function public.get_ball_knower_spectator_league(text) to anon, authenticated, service_role;

create or replace function public.set_ball_knower_spectator_mode(
  p_league_id text,
  p_enabled boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.ball_knower_leagues
    where id = p_league_id
      and commissioner_auth_id = (select auth.uid())
  ) then
    raise exception 'Commissioner only';
  end if;

  select public_slug
  into v_slug
  from public.ball_knower_leagues
  where id = p_league_id;

  if p_enabled and v_slug is null then
    v_slug = 'watch-' || lower(substr(md5(p_league_id || clock_timestamp()::text), 1, 10));
  end if;

  update public.ball_knower_leagues
  set spectator_enabled = p_enabled,
      public_slug = case when p_enabled then v_slug else public_slug end
  where id = p_league_id;

  return v_slug;
end;
$$;

revoke all on function public.set_ball_knower_spectator_mode(text, boolean) from public;
revoke all on function public.set_ball_knower_spectator_mode(text, boolean) from anon, authenticated;
grant execute on function public.set_ball_knower_spectator_mode(text, boolean) to authenticated, service_role;

comment on function public.get_ball_knower_spectator_league(text) is
  'Public spectator contract. Returns only sanitized league/member fields and never roster or authentication identifiers.';
comment on function public.set_ball_knower_spectator_mode(text, boolean) is
  'Commissioner-only spectator toggle. Authorization is derived from auth.uid() server-side.';
