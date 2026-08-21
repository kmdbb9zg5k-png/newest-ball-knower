-- The browser always upgrades guests to a Supabase authenticated anonymous user.
-- Keep the unauthenticated Postgres role away from private game tables.
revoke all on table public.ball_knower_leagues from anon;
revoke all on table public.ball_knower_league_members from anon;
revoke all on table public.ball_knower_leaderboard from anon;
revoke all on table public.ball_knower_user_state from anon;

-- Explicit Data API grants for the operations the browser client performs.
revoke all on table public.ball_knower_leagues from authenticated;
grant select, insert, update, delete on table public.ball_knower_leagues to authenticated;

revoke all on table public.ball_knower_league_members from authenticated;
grant select, insert, update, delete on table public.ball_knower_league_members to authenticated;

revoke all on table public.ball_knower_leaderboard from authenticated;
grant select, insert, update on table public.ball_knower_leaderboard to authenticated;

revoke all on table public.ball_knower_user_state from authenticated;
grant select, insert, update, delete on table public.ball_knower_user_state to authenticated;

-- Lobby and draft clients subscribe to both shared league tables.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ball_knower_leagues'
  ) then
    alter publication supabase_realtime add table public.ball_knower_leagues;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ball_knower_league_members'
  ) then
    alter publication supabase_realtime add table public.ball_knower_league_members;
  end if;
end
$$;
