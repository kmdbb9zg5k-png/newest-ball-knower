-- Spectator links are intentionally public, but league join codes are invitation
-- credentials and are not needed by the spectator UI. Keep the sanitized broadcast
-- contract while omitting the private join code.

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

comment on function public.get_ball_knower_spectator_league(text) is
  'Public spectator contract. Returns sanitized league/member broadcast fields only; never returns join codes, rosters, invite controls, or authentication identifiers.';
