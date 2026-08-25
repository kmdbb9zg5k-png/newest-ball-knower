-- These SECURITY DEFINER RPCs already reject calls when auth.uid() is null.
-- Remove both direct anon EXECUTE and PostgreSQL's default PUBLIC EXECUTE so the
-- database privilege boundary matches the functions' authenticated-only contract.
revoke execute on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb) from public, anon;
revoke execute on function public.set_my_ball_knower_ir(text,text,boolean) from public, anon;
revoke execute on function public.set_my_ball_knower_live_draft_ready(text,boolean) from public, anon;

-- Keep authenticated and service-role behavior unchanged.
grant execute on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb) to authenticated, service_role;
grant execute on function public.set_my_ball_knower_ir(text,text,boolean) to authenticated, service_role;
grant execute on function public.set_my_ball_knower_live_draft_ready(text,boolean) to authenticated, service_role;
