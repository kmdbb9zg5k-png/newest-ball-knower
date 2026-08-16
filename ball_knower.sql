-- BALL KNOWER 2026 — Online League Backend
-- Run once in the Supabase SQL editor.
-- Also enable Auth > Providers > Anonymous Sign-Ins and Realtime for both tables.

create table if not exists public.ball_knower_leagues (
  id text primary key,
  code text not null unique,
  name text not null,
  max_members int not null check (max_members between 2 and 32),
  salary_cap numeric not null default 301.2,
  commissioner_auth_id uuid not null,
  commissioner_name text not null,
  status text not null default 'drafting' check (status in ('drafting','simulating','completed')),
  season_result jsonb,
  settings jsonb not null default '{"seasonGames":16,"simulationStyle":"realistic","playoffTeams":6,"injuriesEnabled":false,"aiDifficulty":"all_pro"}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ball_knower_league_members (
  id text primary key,
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  auth_user_id uuid,
  app_user_id text,
  user_name text not null,
  user_avatar text,
  is_commissioner boolean not null default false,
  is_ai boolean not null default false,
  ai_archetype text,
  status text not null default 'building' check (status in ('not_started','building','ready')),
  roster jsonb,
  team_ratings jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists bk_one_human_membership
  on public.ball_knower_league_members(league_id, auth_user_id)
  where auth_user_id is not null;

create index if not exists bk_members_league_idx on public.ball_knower_league_members(league_id);
create index if not exists bk_leagues_code_idx on public.ball_knower_leagues(code);

-- Prevent race-condition overfilling.
create or replace function public.bk_enforce_capacity()
returns trigger language plpgsql security definer set search_path=public as $$
declare max_count int; current_count int;
begin
  if new.is_ai then return new; end if;
  select max_members into max_count from public.ball_knower_leagues where id=new.league_id;
  select count(*) into current_count from public.ball_knower_league_members where league_id=new.league_id;
  if current_count >= max_count then raise exception 'League is full'; end if;
  return new;
end $$;

drop trigger if exists bk_capacity_trigger on public.ball_knower_league_members;
create trigger bk_capacity_trigger before insert on public.ball_knower_league_members
for each row execute function public.bk_enforce_capacity();

alter table public.ball_knower_leagues enable row level security;
alter table public.ball_knower_league_members enable row level security;

-- Any signed-in (including anonymous) player may look up a league by invite code
-- and see its lobby. Writes remain ownership-restricted.
drop policy if exists "bk leagues readable" on public.ball_knower_leagues;
create policy "bk leagues readable" on public.ball_knower_leagues
for select to authenticated using (true);

drop policy if exists "bk commissioner creates league" on public.ball_knower_leagues;
create policy "bk commissioner creates league" on public.ball_knower_leagues
for insert to authenticated with check (commissioner_auth_id = auth.uid());

drop policy if exists "bk commissioner updates league" on public.ball_knower_leagues;
create policy "bk commissioner updates league" on public.ball_knower_leagues
for update to authenticated using (commissioner_auth_id = auth.uid())
with check (commissioner_auth_id = auth.uid());

drop policy if exists "bk members readable" on public.ball_knower_league_members;
create policy "bk members readable" on public.ball_knower_league_members
for select to authenticated using (true);

drop policy if exists "bk player joins or commissioner adds ai" on public.ball_knower_league_members;
create policy "bk player joins or commissioner adds ai" on public.ball_knower_league_members
for insert to authenticated with check (
  (auth_user_id = auth.uid() and is_ai = false)
  or
  (is_ai = true and exists (
    select 1 from public.ball_knower_leagues l
    where l.id = league_id and l.commissioner_auth_id = auth.uid()
  ))
);

drop policy if exists "bk player updates self" on public.ball_knower_league_members;
create policy "bk player updates self" on public.ball_knower_league_members
for update to authenticated using (
  auth_user_id = auth.uid()
  or exists (
    select 1 from public.ball_knower_leagues l
    where l.id = league_id and l.commissioner_auth_id = auth.uid()
  )
) with check (
  auth_user_id = auth.uid()
  or exists (
    select 1 from public.ball_knower_leagues l
    where l.id = league_id and l.commissioner_auth_id = auth.uid()
  )
);

drop policy if exists "bk commissioner removes member" on public.ball_knower_league_members;
create policy "bk commissioner removes member" on public.ball_knower_league_members
for delete to authenticated using (
  exists (
    select 1 from public.ball_knower_leagues l
    where l.id = league_id and l.commissioner_auth_id = auth.uid()
  )
);

grant select, insert, update on public.ball_knower_leagues to authenticated;
grant select, insert, update, delete on public.ball_knower_league_members to authenticated;

-- Realtime multiplayer lobby updates.
do $$ begin
  alter publication supabase_realtime add table public.ball_knower_leagues;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.ball_knower_league_members;
exception when duplicate_object then null;
end $$;


create table if not exists public.ball_knower_leaderboard (
  auth_user_id uuid primary key,
  display_name text not null,
  championships int not null default 0,
  career_wins int not null default 0,
  career_losses int not null default 0,
  playoff_wins int not null default 0,
  best_ball_knower_score int not null default 0,
  best_record text not null default '0-0',
  perfect_seasons int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.ball_knower_leaderboard enable row level security;
drop policy if exists "bk leaderboard readable" on public.ball_knower_leaderboard;
create policy "bk leaderboard readable" on public.ball_knower_leaderboard for select to authenticated using (true);
drop policy if exists "bk leaderboard self insert" on public.ball_knower_leaderboard;
create policy "bk leaderboard self insert" on public.ball_knower_leaderboard for insert to authenticated with check (auth_user_id=auth.uid());
drop policy if exists "bk leaderboard self update" on public.ball_knower_leaderboard;
create policy "bk leaderboard self update" on public.ball_knower_leaderboard for update to authenticated using (auth_user_id=auth.uid()) with check (auth_user_id=auth.uid());
grant select,insert,update on public.ball_knower_leaderboard to authenticated;
