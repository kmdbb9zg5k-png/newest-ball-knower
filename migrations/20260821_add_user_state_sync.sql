create table if not exists public.ball_knower_user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null check (state_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key),
  constraint ball_knower_user_state_value_size check (octet_length(value::text) <= 262144)
);

alter table public.ball_knower_user_state enable row level security;

revoke all on table public.ball_knower_user_state from public, anon;
grant select, insert, update, delete on table public.ball_knower_user_state to authenticated;

drop policy if exists "Users read their own Ball Knower state" on public.ball_knower_user_state;
create policy "Users read their own Ball Knower state"
on public.ball_knower_user_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert their own Ball Knower state" on public.ball_knower_user_state;
create policy "Users insert their own Ball Knower state"
on public.ball_knower_user_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update their own Ball Knower state" on public.ball_knower_user_state;
create policy "Users update their own Ball Knower state"
on public.ball_knower_user_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete their own Ball Knower state" on public.ball_knower_user_state;
create policy "Users delete their own Ball Knower state"
on public.ball_knower_user_state
for delete
to authenticated
using ((select auth.uid()) = user_id);
