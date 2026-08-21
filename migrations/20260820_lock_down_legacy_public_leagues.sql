-- Lock down the unused legacy public.leagues table.
-- The live table is empty and the current app has no direct public.leagues access.
-- Keep the table for compatibility/history, but remove browser-accessible policies and grants.

drop policy if exists "Allow anyone to create leagues" on public.leagues;
drop policy if exists "Enable read access for all users" on public.leagues;

revoke select, insert, update, delete on table public.leagues from anon, authenticated;
grant select, insert, update, delete on table public.leagues to service_role;
