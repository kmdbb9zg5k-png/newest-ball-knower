-- Anonymous Supabase Auth users receive the authenticated Postgres role after a
-- session is established. These legacy fantasy helpers all depend on requester
-- identity and do not need to be callable by the unauthenticated `anon` role.
-- Keep the explicit spectator RPC public; it intentionally exposes a sanitized view.

revoke all on function public.can_access_fantasy_league(uuid) from public, anon;
grant execute on function public.can_access_fantasy_league(uuid) to authenticated, service_role;

revoke all on function public.is_fantasy_commissioner(uuid) from public, anon;
grant execute on function public.is_fantasy_commissioner(uuid) to authenticated, service_role;

revoke all on function public.join_fantasy_league_by_code(text,text) from public, anon;
grant execute on function public.join_fantasy_league_by_code(text,text) to authenticated, service_role;

revoke all on function public.set_my_ball_knower_live_draft_ready(text,boolean) from public, anon;
grant execute on function public.set_my_ball_knower_live_draft_ready(text,boolean) to authenticated, service_role;
