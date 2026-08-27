-- Cover the stat-correction game foreign key for correction cleanup and joins.
create index if not exists ball_knower_stat_corrections_game_idx
  on public.ball_knower_stat_corrections(provider_game_id);
