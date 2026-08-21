-- Persistent, turn-safe fantasy drafts that begin after draft order is locked.

create table if not exists public.ball_knower_live_drafts (
  league_id text primary key references public.ball_knower_leagues(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed')),
  order_member_ids jsonb not null check (jsonb_typeof(order_member_ids) = 'array'),
  rounds integer not null default 20 check (rounds = 20),
  pick_index integer not null default 0 check (pick_index >= 0),
  picks jsonb not null default '[]'::jsonb check (jsonb_typeof(picks) = 'array'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.ball_knower_live_drafts enable row level security;

drop policy if exists bk_live_drafts_member_read on public.ball_knower_live_drafts;
create policy bk_live_drafts_member_read
on public.ball_knower_live_drafts
for select
to authenticated
using (
  exists (
    select 1
    from public.ball_knower_league_members member
    where member.league_id = ball_knower_live_drafts.league_id
      and member.auth_user_id = (select auth.uid())
  )
);

revoke all on table public.ball_knower_live_drafts from public, anon, authenticated;
grant select on table public.ball_knower_live_drafts to authenticated;

create or replace function public.start_ball_knower_live_draft(p_league_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := (select auth.uid());
  v_league public.ball_knower_leagues%rowtype;
  v_order jsonb;
  v_member_count integer;
  v_draft public.ball_knower_live_drafts%rowtype;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;

  select * into v_league
  from public.ball_knower_leagues
  where id = p_league_id
  for update;

  if not found then raise exception 'League not found'; end if;
  if v_league.commissioner_auth_id <> v_auth then
    raise exception 'Only the commissioner can start the fantasy draft';
  end if;
  if v_league.status <> 'completed' or v_league.season_result is null then
    raise exception 'Lock the official draft order before starting the fantasy draft';
  end if;

  select jsonb_agg(to_jsonb(pick ->> 'memberId') order by (pick ->> 'pickNumber')::integer)
  into v_order
  from jsonb_array_elements(coalesce(v_league.season_result -> 'draftOrder', '[]'::jsonb)) pick;

  select count(*) into v_member_count
  from public.ball_knower_league_members
  where league_id = p_league_id;

  if v_order is null
    or jsonb_array_length(v_order) <> v_member_count
    or v_member_count < 2 then
    raise exception 'The locked draft order does not match the league members';
  end if;

  insert into public.ball_knower_live_drafts(
    league_id, status, order_member_ids, rounds, pick_index, picks
  ) values (
    p_league_id, 'active', v_order, 20, 0, '[]'::jsonb
  )
  on conflict (league_id) do nothing
  returning * into v_draft;

  if not found then
    select * into v_draft
    from public.ball_knower_live_drafts
    where league_id = p_league_id;
  end if;

  return to_jsonb(v_draft);
end;
$$;

revoke all on function public.start_ball_knower_live_draft(text) from public, anon;
grant execute on function public.start_ball_knower_live_draft(text) to authenticated, service_role;

create or replace function public.make_ball_knower_live_draft_pick(
  p_league_id text,
  p_player_id text,
  p_group text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := (select auth.uid());
  v_league public.ball_knower_leagues%rowtype;
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_team_count integer;
  v_total_picks integer;
  v_round_index integer;
  v_slot integer;
  v_order_index integer;
  v_member_id text;
  v_group_limit integer;
  v_group_count integer;
  v_pick jsonb;
  v_next_index integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_player_id), '') is null then raise exception 'Player id is required'; end if;

  select * into v_league
  from public.ball_knower_leagues
  where id = p_league_id;
  if not found then raise exception 'League not found'; end if;

  select * into v_draft
  from public.ball_knower_live_drafts
  where league_id = p_league_id
  for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;
  if v_draft.status <> 'active' then raise exception 'Fantasy draft is already complete'; end if;

  v_team_count := jsonb_array_length(v_draft.order_member_ids);
  v_total_picks := v_team_count * v_draft.rounds;
  if v_draft.pick_index >= v_total_picks then raise exception 'Fantasy draft is already complete'; end if;

  v_round_index := v_draft.pick_index / v_team_count;
  v_slot := mod(v_draft.pick_index, v_team_count);
  v_order_index := case when mod(v_round_index, 2) = 0 then v_slot else v_team_count - 1 - v_slot end;
  v_member_id := v_draft.order_member_ids ->> v_order_index;

  select * into v_member
  from public.ball_knower_league_members
  where league_id = p_league_id and id = v_member_id;
  if not found then raise exception 'The manager on the clock is no longer in the league'; end if;

  if coalesce(v_member.is_ai, false) then
    if v_league.commissioner_auth_id <> v_auth then
      raise exception 'Waiting for the commissioner to complete the CPU pick';
    end if;
  elsif v_member.auth_user_id <> v_auth then
    raise exception '% is on the clock', v_member.user_name;
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_draft.picks) pick
    where pick ->> 'playerId' = p_player_id
  ) then
    raise exception 'That player was already drafted';
  end if;

  v_group_limit := case p_group
    when 'QB' then 1 when 'RB' then 1 when 'WR' then 2 when 'TE' then 1
    when 'OL' then 4 when 'DL_EDGE' then 3 when 'LB' then 2 when 'CB' then 2
    when 'S' then 2 when 'K' then 1 when 'P' then 1 else 0 end;
  if v_group_limit = 0 then raise exception 'That player does not fit a fantasy roster position'; end if;

  select count(*) into v_group_count
  from jsonb_array_elements(v_draft.picks) pick
  where pick ->> 'memberId' = v_member_id
    and pick ->> 'group' = p_group;
  if v_group_count >= v_group_limit then
    raise exception '% already filled every % roster slot', v_member.user_name, p_group;
  end if;

  v_pick := jsonb_build_object(
    'overall', v_draft.pick_index + 1,
    'round', v_round_index + 1,
    'memberId', v_member_id,
    'playerId', p_player_id,
    'group', p_group,
    'pickedAt', clock_timestamp()
  );
  v_next_index := v_draft.pick_index + 1;

  update public.ball_knower_live_drafts
  set picks = picks || jsonb_build_array(v_pick),
      pick_index = v_next_index,
      status = case when v_next_index >= v_total_picks then 'completed' else 'active' end,
      completed_at = case when v_next_index >= v_total_picks then clock_timestamp() else null end,
      updated_at = clock_timestamp()
  where league_id = p_league_id
  returning * into v_draft;

  return to_jsonb(v_draft);
end;
$$;

revoke all on function public.make_ball_knower_live_draft_pick(text,text,text) from public, anon;
grant execute on function public.make_ball_knower_live_draft_pick(text,text,text) to authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.ball_knower_live_drafts;
exception when duplicate_object then null;
end;
$$;
