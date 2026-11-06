-- subscribeToCloudLeague uses one Postgres Changes subscription for the league,
-- members, live draft and event feed. Every binding must be in the publication;
-- an unpublished event feed rejects the complete application subscription.
-- Existing SELECT grants and member RLS continue to authorize event delivery.
begin;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'The Supabase Realtime publication must exist';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'ball_knower_league_events' and c.relrowsecurity
  ) or not has_table_privilege('authenticated', 'public.ball_knower_league_events', 'SELECT') then
    raise exception 'League event member read protections must exist before Realtime publication';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ball_knower_league_events'
  ) then
    alter publication supabase_realtime add table public.ball_knower_league_events;
  end if;
end
$$;
commit;
