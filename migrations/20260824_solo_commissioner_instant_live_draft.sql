-- A commissioner who is the league's only human should not have to leave the
-- locked-order screen just to ready up and wait through a multiplayer timer.
-- Multiplayer leagues retain the existing unanimous-ready + 30-second flow.
create or replace function public.start_ball_knower_live_draft(p_league_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_auth uuid := (select auth.uid());
  v_league public.ball_knower_leagues%rowtype;
  v_order jsonb;
  v_member_count integer;
  v_human_count integer;
  v_ready_count integer;
  v_draft public.ball_knower_live_drafts%rowtype;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;

  select * into v_league from public.ball_knower_leagues where id = p_league_id for update;
  if not found then raise exception 'League not found'; end if;
  if not exists (select 1 from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth and is_ai=false) then raise exception 'Only league members can start the fantasy draft'; end if;
  if v_league.status <> 'completed' or v_league.season_result is null then raise exception 'Lock the official draft order before starting the fantasy draft'; end if;

  select count(*) filter (where is_ai=false), count(*) filter (where is_ai=false and live_draft_ready=true), count(*)
  into v_human_count, v_ready_count, v_member_count
  from public.ball_knower_league_members
  where league_id = p_league_id;

  if v_human_count = 1 and v_league.commissioner_auth_id = v_auth then
    update public.ball_knower_league_members
    set live_draft_ready = true
    where league_id = p_league_id and auth_user_id = v_auth and is_ai = false;
    v_ready_count := 1;
    update public.ball_knower_leagues
    set draft_countdown_started_at = coalesce(draft_countdown_started_at, now() - interval '30 seconds'), updated_at = now()
    where id = p_league_id
    returning * into v_league;
  end if;

  if v_human_count < 1 or v_ready_count <> v_human_count then raise exception 'Every human manager must be ready before the fantasy draft starts'; end if;
  if v_league.draft_countdown_started_at is null then raise exception 'The 30-second draft countdown has not started'; end if;
  if now() < v_league.draft_countdown_started_at + interval '30 seconds' then raise exception 'The 30-second draft countdown is still running'; end if;

  select jsonb_agg(to_jsonb(pick ->> 'memberId') order by (pick ->> 'pickNumber')::integer)
  into v_order
  from jsonb_array_elements(coalesce(v_league.season_result -> 'draftOrder', '[]'::jsonb)) pick;

  if v_order is null or jsonb_array_length(v_order) <> v_member_count or v_member_count < 2 then raise exception 'The locked draft order does not match the league members'; end if;

  insert into public.ball_knower_live_drafts(league_id, status, order_member_ids, rounds, pick_index, picks)
  values (p_league_id, 'active', v_order, 20, 0, '[]'::jsonb)
  on conflict (league_id) do nothing
  returning * into v_draft;

  if not found then select * into v_draft from public.ball_knower_live_drafts where league_id = p_league_id; end if;
  return to_jsonb(v_draft);
end;
$function$;

revoke all on function public.start_ball_knower_live_draft(text) from public, anon;
grant execute on function public.start_ball_knower_live_draft(text) to authenticated, service_role;
