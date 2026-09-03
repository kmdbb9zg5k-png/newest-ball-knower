\set ON_ERROR_STOP on

begin;

-- Earlier database integration checks intentionally share this PostgreSQL service.
-- Rebuild only the tables needed by this test inside a transaction, then roll back so
-- the account-deletion fixture cannot collide with or permanently mutate those fixtures.
drop table if exists public.ball_knower_roster_revisions cascade;
drop table if exists public.ball_knower_owner_profiles cascade;
drop table if exists public.ball_knower_notifications cascade;
drop table if exists public.ball_knower_league_messages cascade;
drop table if exists public.ball_knower_league_members cascade;
drop table if exists public.ball_knower_leagues cascade;
drop table if exists auth.users cascade;

create schema if not exists auth;
create table auth.users(id uuid primary key);

create table public.ball_knower_leagues(
  id uuid primary key,
  commissioner_auth_id uuid,
  commissioner_name text,
  updated_at timestamptz default now()
);
create table public.ball_knower_league_members(
  id uuid primary key,
  league_id uuid not null references public.ball_knower_leagues(id) on delete cascade,
  auth_user_id uuid,
  user_name text,
  is_ai boolean default false,
  is_commissioner boolean default false,
  created_at timestamptz default now()
);
create table public.ball_knower_league_messages(id uuid primary key, auth_user_id uuid);
create table public.ball_knower_notifications(id uuid primary key, auth_user_id uuid);
create table public.ball_knower_owner_profiles(auth_user_id uuid primary key);
create table public.ball_knower_roster_revisions(id uuid primary key, auth_user_id uuid);

\i migrations/20260903_account_deletion_cleanup.sql

insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
insert into public.ball_knower_leagues(id,commissioner_auth_id,commissioner_name) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Owner');
insert into public.ball_knower_league_members(id,league_id,auth_user_id,user_name,is_commissioner,created_at) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Owner',true,'2026-01-01'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Successor',false,'2026-01-02');
insert into public.ball_knower_league_messages values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
insert into public.ball_knower_notifications values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
insert into public.ball_knower_owner_profiles values ('00000000-0000-0000-0000-000000000001');
insert into public.ball_knower_roster_revisions values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');

delete from auth.users where id='00000000-0000-0000-0000-000000000001';

do $$
begin
  if exists(select 1 from public.ball_knower_league_members where auth_user_id='00000000-0000-0000-0000-000000000001') then raise exception 'deleted member survived'; end if;
  if exists(select 1 from public.ball_knower_league_messages where auth_user_id='00000000-0000-0000-0000-000000000001') then raise exception 'deleted messages survived'; end if;
  if exists(select 1 from public.ball_knower_notifications where auth_user_id='00000000-0000-0000-0000-000000000001') then raise exception 'deleted notifications survived'; end if;
  if exists(select 1 from public.ball_knower_owner_profiles where auth_user_id='00000000-0000-0000-0000-000000000001') then raise exception 'deleted owner profile survived'; end if;
  if exists(select 1 from public.ball_knower_roster_revisions where auth_user_id='00000000-0000-0000-0000-000000000001') then raise exception 'deleted revisions survived'; end if;
  if not exists(select 1 from public.ball_knower_leagues where id='10000000-0000-0000-0000-000000000001' and commissioner_auth_id='00000000-0000-0000-0000-000000000002') then raise exception 'commissioner was not transferred'; end if;
  if not exists(select 1 from public.ball_knower_league_members where auth_user_id='00000000-0000-0000-0000-000000000002' and is_commissioner=true) then raise exception 'successor was not promoted'; end if;
end $$;

rollback;
select 'account deletion integration passed' as result;
