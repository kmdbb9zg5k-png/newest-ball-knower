-- Immutable, idempotent progression events prevent concurrent/offline devices
-- from overwriting one another's Gauntlet answers and run completions.
create table if not exists public.ball_knower_gauntlet_progress_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (char_length(event_id) between 8 and 160),
  occurred_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id,event_id),
  constraint gauntlet_progress_event_payload_shape check (
    jsonb_typeof(payload)='object'
    and coalesce(payload->>'id'=event_id,false)
    and coalesce(payload->>'kind' in ('answer','run'),false)
    and jsonb_typeof(payload->'occurredAt')='number'
    and (
      (payload->>'kind'='answer' and jsonb_typeof(payload->'correct')='boolean' and jsonb_typeof(payload->'xp')='number')
      or (payload->>'kind'='run' and jsonb_typeof(payload->'score')='number' and jsonb_typeof(payload->'total')='number' and jsonb_typeof(payload->'bonusXp')='number')
    )
    and octet_length(payload::text)<=4096
  )
);

alter table public.ball_knower_gauntlet_progress_events enable row level security;
revoke all on table public.ball_knower_gauntlet_progress_events from public,anon;
revoke update,delete,truncate,references,trigger on table public.ball_knower_gauntlet_progress_events from authenticated;
grant select,insert on table public.ball_knower_gauntlet_progress_events to authenticated;

drop policy if exists "Users read their own Gauntlet events" on public.ball_knower_gauntlet_progress_events;
create policy "Users read their own Gauntlet events" on public.ball_knower_gauntlet_progress_events
for select to authenticated using ((select auth.uid())=user_id);

drop policy if exists "Users insert their own Gauntlet events" on public.ball_knower_gauntlet_progress_events;
create policy "Users insert their own Gauntlet events" on public.ball_knower_gauntlet_progress_events
for insert to authenticated with check ((select auth.uid())=user_id);

create index if not exists gauntlet_progress_events_user_time_idx
on public.ball_knower_gauntlet_progress_events(user_id,occurred_at,event_id);
