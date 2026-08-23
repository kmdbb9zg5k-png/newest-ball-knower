alter table public.ball_knower_league_members add column if not exists live_draft_ready boolean not null default false;
alter table public.ball_knower_leagues add column if not exists draft_countdown_started_at timestamptz;

create or replace function public.set_my_ball_knower_live_draft_ready(p_league_id text, p_ready boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_auth uuid := (select auth.uid());
  v_member public.ball_knower_league_members%rowtype;
  v_league public.ball_knower_leagues%rowtype;
  v_humans integer;
  v_ready integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;

  select * into v_league from public.ball_knower_leagues where id = p_league_id for update;
  if not found then raise exception 'League not found'; end if;
  if v_league.season_result is null or v_league.status <> 'completed' then raise exception 'Lock the official draft order first'; end if;
  if exists (select 1 from public.ball_knower_live_drafts where league_id=p_league_id and status in ('active','completed')) then raise exception 'The fantasy draft has already started'; end if;
  if v_league.draft_countdown_started_at is not null then raise exception 'The draft countdown has already started'; end if;

  update public.ball_knower_league_members
  set live_draft_ready = p_ready
  where league_id = p_league_id and auth_user_id = v_auth and is_ai = false
  returning * into v_member;
  if not found then raise exception 'You are not a human member of this league'; end if;

  select count(*) filter (where is_ai=false), count(*) filter (where is_ai=false and live_draft_ready=true)
  into v_humans, v_ready
  from public.ball_knower_league_members
  where league_id = p_league_id;

  if v_humans > 0 and v_ready = v_humans then
    update public.ball_knower_leagues set draft_countdown_started_at = now(), updated_at = now()
    where id = p_league_id and draft_countdown_started_at is null;
  end if;

  select * into v_league from public.ball_knower_leagues where id = p_league_id;
  return jsonb_build_object('ready', p_ready, 'humanCount', v_humans, 'readyCount', v_ready, 'countdownStartedAt', v_league.draft_countdown_started_at);
end;
$function$;

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

grant execute on function public.set_my_ball_knower_live_draft_ready(text, boolean) to authenticated;
grant execute on function public.start_ball_knower_live_draft(text) to authenticated;
