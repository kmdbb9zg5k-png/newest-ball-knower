-- These helpers answer questions about the current authenticated Ball Knower user.
-- Supabase anonymous-auth users still run as the authenticated database role, so
-- unauthenticated `anon`/PUBLIC callers do not need direct EXECUTE access.
-- Keep authenticated/service access for the existing browser RPC flow and internal callers.

revoke execute on function public.can_access_ball_knower_league(text) from public, anon;
revoke execute on function public.is_ball_knower_commissioner(text) from public, anon;

grant execute on function public.can_access_ball_knower_league(text) to authenticated, service_role;
grant execute on function public.is_ball_knower_commissioner(text) to authenticated, service_role;
