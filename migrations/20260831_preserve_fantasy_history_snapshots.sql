-- Preserve the projection users saw before kickoff and track bounded history backfill.

alter table public.ball_knower_nfl_games
  add column if not exists history_backfilled_at timestamptz;

alter table public.ball_knower_player_week_scores
  add column if not exists opponent_team text,
  add column if not exists is_home boolean,
  add column if not exists pregame_projected_points jsonb not null default '{}'::jsonb,
  add column if not exists pregame_projection_reason text,
  add column if not exists pregame_projection_source text,
  add column if not exists pregame_projection_captured_at timestamptz,
  add column if not exists history_source text not null default 'tank01';

create index if not exists ball_knower_player_week_scores_provider_history_idx
  on public.ball_knower_player_week_scores(provider_player_id, season, week_number);

create index if not exists ball_knower_nfl_games_history_backfill_idx
  on public.ball_knower_nfl_games(season, season_type, week_number, kickoff_at)
  where history_backfilled_at is null;

create table if not exists public.ball_knower_fantasy_history_backfill (
  season integer not null,
  season_type text not null default 'reg',
  week_number integer not null check (week_number between 1 and 22),
  schedule_loaded_at timestamptz,
  completed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (season, season_type, week_number)
);

insert into public.ball_knower_fantasy_history_backfill(season, season_type, week_number)
select 2025, 'reg', week_number
from generate_series(1, 18) as week_number
on conflict do nothing;

create index if not exists ball_knower_fantasy_history_pending_idx
  on public.ball_knower_fantasy_history_backfill(season, week_number)
  where completed_at is null;

alter table public.ball_knower_fantasy_history_backfill enable row level security;
revoke all on public.ball_knower_fantasy_history_backfill from public, anon, authenticated;

create or replace function public.preserve_ball_knower_pregame_projection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.pregame_projection_captured_at is not null then
    new.pregame_projected_points := old.pregame_projected_points;
    new.pregame_projection_reason := old.pregame_projection_reason;
    new.pregame_projection_source := old.pregame_projection_source;
    new.pregame_projection_captured_at := old.pregame_projection_captured_at;
  end if;
  return new;
end;
$$;

revoke all on function public.preserve_ball_knower_pregame_projection() from public, anon, authenticated;

drop trigger if exists preserve_ball_knower_pregame_projection
  on public.ball_knower_player_week_scores;
create trigger preserve_ball_knower_pregame_projection
before update on public.ball_knower_player_week_scores
for each row execute function public.preserve_ball_knower_pregame_projection();
