\set ON_ERROR_STOP on

-- Exercise the real league RLS migrations on PostgreSQL 17. In particular,
-- INSERT ... RETURNING must work for the new commissioner while unrelated
-- authenticated and anonymous users still cannot enumerate league rows.
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

create schema auth;
create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $function$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
$function$;

-- Match the Supabase role bootstrap: API roles can resolve auth.uid(), but
-- they cannot inspect or mutate the auth schema itself.
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create table public.ball_knower_leagues (
  id text primary key,
  code text not null unique,
  name text not null,
  commissioner_auth_id uuid not null
);

create table public.ball_knower_league_members (
  id text primary key,
  league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  auth_user_id uuid,
  user_name text not null
);

alter table public.ball_knower_leagues enable row level security;
grant insert, update, delete on public.ball_knower_leagues to authenticated, service_role;
grant select, insert, update, delete on public.ball_knower_league_members to authenticated, service_role;

\ir ../migrations/20260902152435_harden_ball_knower_league_privacy.sql
\ir ../migrations/20260902164240_allow_commissioner_insert_returning.sql

create policy ball_knower_leagues_insert
on public.ball_knower_leagues
for insert
to authenticated
with check (commissioner_auth_id = public.fantasy_requester_id());

insert into public.ball_knower_leagues(id, code, name, commissioner_auth_id) values
  ('privacy-a', 'BK-PRIVA', 'Commissioner A', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('privacy-b', 'BK-PRIVB', 'Commissioner B', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.ball_knower_league_members(id, league_id, auth_user_id, user_name) values
  ('member-a', 'privacy-a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A'),
  ('member-b-in-a', 'privacy-a', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B');

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',
  true
);
do $commissioner$
begin
  if (select count(*) from public.ball_knower_leagues where id in ('privacy-a', 'privacy-b')) <> 1
     or not exists (select 1 from public.ball_knower_leagues where id = 'privacy-a') then
    raise exception 'Commissioner could read an unrelated private league or lost access to their own';
  end if;
end;
$commissioner$;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',
  true
);
do $member$
begin
  if (select count(*) from public.ball_knower_leagues where id in ('privacy-a', 'privacy-b')) <> 2 then
    raise exception 'Member/commissioner access matrix is incorrect';
  end if;
end;
$member$;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}',
  true
);
do $outsider$
declare
  returned_id text;
begin
  if exists (select 1 from public.ball_knower_leagues where id in ('privacy-a', 'privacy-b')) then
    raise exception 'Authenticated non-member enumerated a private league';
  end if;

  insert into public.ball_knower_leagues(id, code, name, commissioner_auth_id)
  values ('privacy-c', 'BK-PRIVC', 'Fresh guest league', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  returning id into returned_id;

  if returned_id <> 'privacy-c'
     or not exists (select 1 from public.ball_knower_leagues where id = 'privacy-c') then
    raise exception 'Secure league creation did not return the commissioner row';
  end if;
end;
$outsider$;

reset role;
set local role anon;
do $guest$
begin
  begin
    perform id from public.ball_knower_leagues limit 1;
    raise exception 'Anonymous role unexpectedly enumerated league rows';
  exception
    when insufficient_privilege then null;
  end;
end;
$guest$;

reset role;
rollback;

select 'league privacy integration passed' as result;
