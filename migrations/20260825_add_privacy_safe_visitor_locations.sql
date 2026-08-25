create table if not exists public.ball_knower_visit_locations (
  id bigint generated always as identity primary key,
  visitor_key text not null unique
    check (visitor_key ~ '^[0-9a-f]{64}$'),
  country_code text
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  region_code text
    check (region_code is null or region_code ~ '^[A-Z0-9]{1,3}$'),
  city text
    check (city is null or char_length(city) between 1 and 120),
  timezone text
    check (timezone is null or char_length(timezone) between 1 and 80),
  path text not null default '/'
    check (char_length(path) between 1 and 200 and left(path, 1) = '/'),
  occurred_at timestamptz not null default now()
);

alter table public.ball_knower_visit_locations enable row level security;

revoke all on table public.ball_knower_visit_locations from anon, authenticated;
grant insert on table public.ball_knower_visit_locations to anon, authenticated;
grant usage, select on sequence public.ball_knower_visit_locations_id_seq to anon, authenticated;

drop policy if exists "location endpoint may insert anonymous aggregates"
  on public.ball_knower_visit_locations;
create policy "location endpoint may insert anonymous aggregates"
  on public.ball_knower_visit_locations
  for insert
  to anon, authenticated
  with check (
    visitor_key ~ '^[0-9a-f]{64}$'
    and (country_code is null or country_code ~ '^[A-Z]{2}$')
    and (region_code is null or region_code ~ '^[A-Z0-9]{1,3}$')
    and char_length(path) between 1 and 200
    and left(path, 1) = '/'
  );

create index if not exists ball_knower_visit_locations_occurred_at_idx
  on public.ball_knower_visit_locations (occurred_at desc);
create index if not exists ball_knower_visit_locations_region_idx
  on public.ball_knower_visit_locations (country_code, region_code, city);

comment on table public.ball_knower_visit_locations is
  'Daily rotating anonymous visitor location aggregates from trusted Vercel geo headers. Raw IP addresses are never stored.';
