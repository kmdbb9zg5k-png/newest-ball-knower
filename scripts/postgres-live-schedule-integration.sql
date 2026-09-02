\set ON_ERROR_STOP on

-- Reproduce the production case where the full-season schedule used an ESPN
-- game ID and the live provider later supplied a second ID for the same game.
begin;

create table public.ball_knower_nfl_games (
  provider_game_id text primary key,
  season integer not null,
  season_type text not null,
  week_number integer not null,
  away_team text not null,
  home_team text not null,
  updated_at timestamptz
);

create table public.ball_knower_player_week_scores (
  provider_game_id text not null references public.ball_knower_nfl_games(provider_game_id),
  provider_player_id text not null,
  primary key (provider_game_id, provider_player_id)
);

create table public.ball_knower_stat_corrections (
  id bigint generated always as identity primary key,
  provider_game_id text not null references public.ball_knower_nfl_games(provider_game_id)
);

insert into public.ball_knower_nfl_games values
  ('espn-game-1', 2026, 'reg', 1, 'NE', 'SEA', '2026-08-01T00:00:00Z'),
  ('tank-game-1', 2026, 'reg', 1, 'NE', 'SEA', '2026-09-01T00:00:00Z');
insert into public.ball_knower_player_week_scores values
  ('tank-game-1', 'tank-player-1');
insert into public.ball_knower_stat_corrections(provider_game_id) values
  ('tank-game-1');

\ir ../migrations/20260902171900_prevent_duplicate_live_schedule_games.sql

do $schedule$
begin
  if (select count(*) from public.ball_knower_nfl_games) <> 1
     or not exists (
       select 1 from public.ball_knower_nfl_games
       where provider_game_id = 'espn-game-1'
     ) then
    raise exception 'Canonical game consolidation failed';
  end if;

  if not exists (
    select 1 from public.ball_knower_player_week_scores
    where provider_game_id = 'espn-game-1'
      and provider_player_id = 'tank-player-1'
  ) or not exists (
    select 1 from public.ball_knower_stat_corrections
    where provider_game_id = 'espn-game-1'
  ) then
    raise exception 'Dependent scoring history was not preserved';
  end if;

  begin
    insert into public.ball_knower_nfl_games values
      ('third-game-id', 2026, 'reg', 1, 'NE', 'SEA', now());
    raise exception 'Duplicate matchup constraint was not enforced';
  exception
    when unique_violation then null;
  end;
end;
$schedule$;

rollback;

select 'live schedule integration passed' as result;
