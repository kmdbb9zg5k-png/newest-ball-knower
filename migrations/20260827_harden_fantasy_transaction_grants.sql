-- Supabase projects can explicitly grant new public functions to API roles.
-- Remove every generated grant, then add only the intended RPC entry points.
revoke all on function public.next_ball_knower_waiver_run(jsonb,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.apply_ball_knower_player_move(text,text,jsonb,text,numeric,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.submit_ball_knower_player_move(text,jsonb,text,numeric,integer,uuid) from public,anon,authenticated,service_role;
revoke all on function public.cancel_my_ball_knower_waiver(uuid) from public,anon,authenticated,service_role;
revoke all on function public.process_due_ball_knower_waivers(timestamptz) from public,anon,authenticated,service_role;

grant execute on function public.submit_ball_knower_player_move(text,jsonb,text,numeric,integer,uuid) to authenticated;
grant execute on function public.cancel_my_ball_knower_waiver(uuid) to authenticated;
grant execute on function public.process_due_ball_knower_waivers(timestamptz) to service_role;

drop policy if exists bk_waiver_runs_no_client_access on public.ball_knower_waiver_runs;
create policy bk_waiver_runs_no_client_access on public.ball_knower_waiver_runs for all to authenticated using (false) with check (false);
