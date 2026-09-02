-- A live provider can use a different game identifier than the authoritative
-- full-season schedule. Keep one canonical row per real matchup so player
-- cards and live scoring never see the same game twice.

create temporary table ball_knower_duplicate_games_to_remove
on commit drop
as
select provider_game_id, canonical_provider_game_id
from (
  select
    game.provider_game_id,
    first_value(game.provider_game_id) over (
      partition by
        game.season,
        game.season_type,
        game.week_number,
        game.away_team,
        game.home_team
      order by
        (game.provider_game_id like 'espn-%') desc,
        game.updated_at asc nulls last,
        game.provider_game_id
    ) as canonical_provider_game_id,
    row_number() over (
      partition by
        game.season,
        game.season_type,
        game.week_number,
        game.away_team,
        game.home_team
      order by
        (game.provider_game_id like 'espn-%') desc,
        game.updated_at asc nulls last,
        game.provider_game_id
    ) as copy_number
  from public.ball_knower_nfl_games game
) ranked
where copy_number > 1;

do $dependent_rows$
begin
  if exists (
    select 1
    from ball_knower_duplicate_games_to_remove duplicate
    join public.ball_knower_player_week_scores duplicate_score
      on duplicate_score.provider_game_id = duplicate.provider_game_id
    join public.ball_knower_player_week_scores canonical_score
      on canonical_score.provider_game_id = duplicate.canonical_provider_game_id
     and canonical_score.provider_player_id = duplicate_score.provider_player_id
  ) then
    raise exception
      'Duplicate NFL games have conflicting player scoring rows; refusing automatic consolidation';
  end if;
end;
$dependent_rows$;

update public.ball_knower_player_week_scores score
set provider_game_id = duplicate.canonical_provider_game_id
from ball_knower_duplicate_games_to_remove duplicate
where score.provider_game_id = duplicate.provider_game_id;

update public.ball_knower_stat_corrections correction
set provider_game_id = duplicate.canonical_provider_game_id
from ball_knower_duplicate_games_to_remove duplicate
where correction.provider_game_id = duplicate.provider_game_id;

delete from public.ball_knower_nfl_games game
using ball_knower_duplicate_games_to_remove duplicate
where game.provider_game_id = duplicate.provider_game_id;

create unique index if not exists
  ball_knower_nfl_games_one_real_matchup_idx
on public.ball_knower_nfl_games(
  season,
  season_type,
  week_number,
  away_team,
  home_team
);
