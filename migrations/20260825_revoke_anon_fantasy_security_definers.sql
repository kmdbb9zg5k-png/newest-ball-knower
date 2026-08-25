-- Anonymous Supabase Auth users receive the authenticated Postgres role after a
-- session is established. These legacy fantasy helpers all depend on requester
-- identity and do not need to be callable by the unauthenticated `anon` role.
-- Keep the explicit spectator RPC public; it intentionally exposes a sanitized view.
--
-- Some legacy helpers exist in the long-lived production database but are absent
-- from a clean install of the checked-in baseline. Guard each ACL change so a fresh
-- migration run does not abort before later fantasy migrations can execute.
do $$
begin
  if to_regprocedure('public.can_access_fantasy_league(uuid)') is not null then
    execute 'revoke all on function public.can_access_fantasy_league(uuid) from public, anon';
    execute 'grant execute on function public.can_access_fantasy_league(uuid) to authenticated, service_role';
  end if;

  if to_regprocedure('public.is_fantasy_commissioner(uuid)') is not null then
    execute 'revoke all on function public.is_fantasy_commissioner(uuid) from public, anon';
    execute 'grant execute on function public.is_fantasy_commissioner(uuid) to authenticated, service_role';
  end if;

  if to_regprocedure('public.join_fantasy_league_by_code(text,text)') is not null then
    execute 'revoke all on function public.join_fantasy_league_by_code(text,text) from public, anon';
    execute 'grant execute on function public.join_fantasy_league_by_code(text,text) to authenticated, service_role';
  end if;

  if to_regprocedure('public.set_my_ball_knower_live_draft_ready(text,boolean)') is not null then
    execute 'revoke all on function public.set_my_ball_knower_live_draft_ready(text,boolean) from public, anon';
    execute 'grant execute on function public.set_my_ball_knower_live_draft_ready(text,boolean) to authenticated, service_role';
  end if;
end;
$$;
