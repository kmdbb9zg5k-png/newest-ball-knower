-- Follow-up for databases where preserve_fantasy_history_snapshots was already applied.
-- Matchup context is part of the immutable pregame projection snapshot.

create or replace function public.preserve_ball_knower_pregame_projection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.pregame_projection_captured_at is not null then
    new.opponent_team := old.opponent_team;
    new.is_home := old.is_home;
    new.pregame_projected_points := old.pregame_projected_points;
    new.pregame_projection_reason := old.pregame_projection_reason;
    new.pregame_projection_source := old.pregame_projection_source;
    new.pregame_projection_captured_at := old.pregame_projection_captured_at;
  end if;
  return new;
end;
$$;

revoke all on function public.preserve_ball_knower_pregame_projection() from public, anon, authenticated;

