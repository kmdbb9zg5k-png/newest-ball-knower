-- Legacy device-id Fantasy RPCs trust a caller-supplied UUID instead of auth.uid().
-- The current Ball Knower client does not call these functions. Remove browser
-- execution so an authenticated or unauthenticated caller cannot spoof another
-- device identity, while preserving service-role access for controlled internal use.

revoke execute on function public.fantasy_create_league(uuid,text,text,text,text,text,text,integer,integer,boolean,text,jsonb) from public, anon, authenticated;
revoke execute on function public.fantasy_get_league(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.fantasy_join_league_by_code(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.fantasy_list_my_leagues(uuid) from public, anon, authenticated;

grant execute on function public.fantasy_create_league(uuid,text,text,text,text,text,text,integer,integer,boolean,text,jsonb) to service_role;
grant execute on function public.fantasy_get_league(uuid,uuid) to service_role;
grant execute on function public.fantasy_join_league_by_code(uuid,text,text) to service_role;
grant execute on function public.fantasy_list_my_leagues(uuid) to service_role;
