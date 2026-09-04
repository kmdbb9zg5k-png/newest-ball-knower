\set ON_ERROR_STOP on
begin;

create extension if not exists pgcrypto;
create schema if not exists auth;
do $$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;

drop table if exists public.ball_knower_waiver_runs cascade;
drop table if exists public.ball_knower_player_waivers cascade;
drop table if exists public.ball_knower_waiver_claims cascade;
drop table if exists public.ball_knower_league_members cascade;
drop table if exists public.ball_knower_leagues cascade;
drop function if exists auth.uid() cascade;

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;

create table public.ball_knower_leagues(id text primary key,settings jsonb not null default '{}'::jsonb);
create table public.ball_knower_league_members(
  id text primary key,league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  auth_user_id uuid not null,user_name text not null,roster jsonb not null default '[]'::jsonb,
  status text not null default 'building',faab_balance numeric not null default 100,waiver_priority integer not null default 999
);
create table public.ball_knower_waiver_claims(
  id uuid primary key default gen_random_uuid(),league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  member_id text not null references public.ball_knower_league_members(id) on delete cascade,player_id text not null,
  player_snapshot jsonb not null,drop_player_id text,priority integer not null default 1,faab_bid numeric not null default 0,
  status text not null default 'pending',created_at timestamptz not null default now(),processed_at timestamptz,
  claim_group_id uuid not null default gen_random_uuid(),claim_order integer not null default 1,process_at timestamptz not null default now(),failure_reason text
);
create table public.ball_knower_player_waivers(
  id uuid primary key default gen_random_uuid(),league_id text not null references public.ball_knower_leagues(id) on delete cascade,
  player_id text not null,player_snapshot jsonb not null,dropped_by_member_id text references public.ball_knower_league_members(id) on delete set null,
  clears_at timestamptz not null,created_at timestamptz not null default now(),unique(league_id,player_id)
);
create table public.ball_knower_waiver_runs(
  id uuid primary key default gen_random_uuid(),processed_at timestamptz not null default now(),won_count integer not null default 0,
  lost_count integer not null default 0,metadata jsonb not null default '{}'::jsonb
);

create or replace function public.next_ball_knower_waiver_run(p_settings jsonb,p_from timestamptz default now())
returns timestamptz language plpgsql stable set search_path to 'public' as $$
declare v_hour integer:=greatest(0,least(23,coalesce(nullif(p_settings->>'waiverProcessHourUtc','')::integer,9)));v_days jsonb:=coalesce(p_settings->'waiverRunDays','[0,1,2,3,4,5,6]'::jsonb);v_candidate timestamptz;v_offset integer;
begin
  for v_offset in 0..7 loop
    v_candidate:=date_trunc('day',p_from)+(v_offset||' days')::interval+(v_hour||' hours')::interval;
    if v_candidate>p_from and exists(select 1 from jsonb_array_elements_text(v_days)d(value) where d.value=extract(dow from v_candidate)::integer::text) then return v_candidate; end if;
  end loop;
  return date_trunc('day',p_from)+interval '1 day'+(v_hour||' hours')::interval;
end;$$;

create or replace function public.apply_ball_knower_player_move(
  p_league_id text,p_member_id text,p_player_snapshot jsonb,p_drop_player_id text,p_faab_bid numeric,p_kind text,p_claim_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_player_id text:=p_player_snapshot->>'id';v_roster jsonb;v_drop jsonb;v_days integer;v_settings jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('bk-acquire-'||p_league_id||'-'||v_player_id));
  if exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(coalesce(m.roster,'[]'::jsonb))e where m.league_id=p_league_id and e->>'id'=v_player_id) then raise exception 'Player is no longer available'; end if;
  select roster into v_roster from public.ball_knower_league_members where id=p_member_id and league_id=p_league_id for update;
  if not found then raise exception 'League member not found'; end if;
  if p_drop_player_id is not null then
    select e into v_drop from jsonb_array_elements(v_roster)e where e->>'id'=p_drop_player_id limit 1;
    if v_drop is null then raise exception 'Drop player is no longer on this roster'; end if;
    select coalesce(jsonb_agg(e),'[]'::jsonb) into v_roster from jsonb_array_elements(v_roster)e where e->>'id'<>p_drop_player_id;
  end if;
  update public.ball_knower_league_members set roster=coalesce(v_roster,'[]'::jsonb)||jsonb_build_array(p_player_snapshot),faab_balance=faab_balance-p_faab_bid where id=p_member_id;
  delete from public.ball_knower_player_waivers where league_id=p_league_id and player_id=v_player_id;
  if v_drop is not null then
    select settings into v_settings from public.ball_knower_leagues where id=p_league_id;
    v_days:=greatest(0,least(7,coalesce(nullif(v_settings->>'waiverDays','')::integer,2)));
    insert into public.ball_knower_player_waivers(league_id,player_id,player_snapshot,dropped_by_member_id,clears_at)
    values(p_league_id,p_drop_player_id,v_drop,p_member_id,now()+make_interval(days=>v_days))
    on conflict(league_id,player_id) do update set player_snapshot=excluded.player_snapshot,dropped_by_member_id=excluded.dropped_by_member_id,clears_at=excluded.clears_at,created_at=now();
  end if;
  return jsonb_build_object('playerId',v_player_id,'memberId',p_member_id,'kind',p_kind,'claimId',p_claim_id);
end;$$;

\i migrations/20260903_build7_waiver_defaults.sql
\i migrations/20260903_build7_waiver_deadline_hardening.sql

insert into public.ball_knower_leagues(id,settings) values('standard','{}'::jsonb);
insert into public.ball_knower_leagues(id,settings) values('custom','{"waiverType":"faab","freeAgentMode":"continuous","waiverDays":1,"waiverProcessHourUtc":13,"waiverRunDays":[1,3,5]}'::jsonb);
do $$
declare s jsonb;c jsonb;
begin
  select settings into s from public.ball_knower_leagues where id='standard';
  if s->>'waiverType'<>'priority' or s->>'freeAgentMode'<>'instant' or (s->>'waiverDays')::integer<>2 or (s->>'waiverProcessHourUtc')::integer<>9 or s->'waiverRunDays'<>'[0,1,2,3,4,5,6]'::jsonb then raise exception 'standard defaults missing'; end if;
  select settings into c from public.ball_knower_leagues where id='custom';
  if c->>'waiverType'<>'faab' or c->>'freeAgentMode'<>'continuous' or (c->>'waiverDays')::integer<>1 or (c->>'waiverProcessHourUtc')::integer<>13 or c->'waiverRunDays'<>'[1,3,5]'::jsonb then raise exception 'custom settings overwritten'; end if;
end $$;

insert into public.ball_knower_league_members(id,league_id,auth_user_id,user_name,waiver_priority) values
 ('priority-a','standard','00000000-0000-0000-0000-000000000001','A',1),
 ('priority-b','standard','00000000-0000-0000-0000-000000000002','B',2);
insert into public.ball_knower_player_waivers(league_id,player_id,player_snapshot,clears_at) values('standard','P1','{"id":"P1","name":"Priority Player"}',now()+interval '1 hour');
do $$ begin if extract(hour from (select clears_at from public.ball_knower_player_waivers where league_id='standard' and player_id='P1') at time zone 'UTC')<>9 then raise exception 'deadline not normalized'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.submit_ball_knower_player_move('standard','{"id":"P1","name":"Priority Player"}',null,0,1,null);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select public.submit_ball_knower_player_move('standard','{"id":"P1","name":"Priority Player"}',null,0,1,null);
select public.process_due_ball_knower_waivers((select max(process_at)+interval '1 second' from public.ball_knower_waiver_claims where league_id='standard'));
do $$
begin
  if not exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(m.roster)e where m.id='priority-a' and e->>'id'='P1') then raise exception 'priority winner failed'; end if;
  if (select count(*) from public.ball_knower_waiver_claims where league_id='standard' and player_id='P1' and status='won')<>1 then raise exception 'priority winner count wrong'; end if;
  if (select count(*) from public.ball_knower_waiver_claims where league_id='standard' and player_id='P1' and status='lost')<>1 then raise exception 'priority loser count wrong'; end if;
  if (select waiver_priority from public.ball_knower_league_members where id='priority-a')<>2 then raise exception 'rolling priority failed'; end if;
end $$;

insert into public.ball_knower_league_members(id,league_id,auth_user_id,user_name,waiver_priority) values
 ('faab-a','custom','00000000-0000-0000-0000-000000000003','FAAB A',1),
 ('faab-b','custom','00000000-0000-0000-0000-000000000004','FAAB B',2);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select public.submit_ball_knower_player_move('custom','{"id":"P2","name":"FAAB Player"}',null,5,1,null);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',false);
select public.submit_ball_knower_player_move('custom','{"id":"P2","name":"FAAB Player"}',null,10,1,null);
select public.process_due_ball_knower_waivers((select max(process_at)+interval '1 second' from public.ball_knower_waiver_claims where league_id='custom'));
do $$
begin
  if not exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(m.roster)e where m.id='faab-b' and e->>'id'='P2') then raise exception 'FAAB high bid failed'; end if;
  if (select faab_balance from public.ball_knower_league_members where id='faab-b')<>90 then raise exception 'FAAB winner budget wrong'; end if;
  if (select faab_balance from public.ball_knower_league_members where id='faab-a')<>100 then raise exception 'FAAB loser budget changed'; end if;
end $$;

insert into public.ball_knower_leagues(id,settings) values('drop-test','{}');
insert into public.ball_knower_league_members(id,league_id,auth_user_id,user_name,roster,waiver_priority) values
 ('drop-owner','drop-test','00000000-0000-0000-0000-000000000005','Drop Owner','[{"id":"DROP","name":"Dropped Player"}]',1),
 ('drop-claimer','drop-test','00000000-0000-0000-0000-000000000006','Drop Claimer','[]',2);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',false);
select public.submit_ball_knower_player_move('drop-test','{"id":"P6","name":"Replacement"}','DROP',0,1,null);
do $$ begin if not exists(select 1 from public.ball_knower_player_waivers where league_id='drop-test' and player_id='DROP') then raise exception 'drop did not create waiver'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',false);
select public.submit_ball_knower_player_move('drop-test','{"id":"DROP","name":"Dropped Player"}',null,0,1,null);
do $$
begin
  if not exists(select 1 from public.ball_knower_waiver_claims where league_id='drop-test' and player_id='DROP' and member_id='drop-claimer' and status='pending') then raise exception 'active waiver claim missing'; end if;
  if exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(m.roster)e where m.id='drop-claimer' and e->>'id'='DROP') then raise exception 'active waiver instant-added'; end if;
end $$;

insert into public.ball_knower_leagues(id,settings) values('unclaimed','{}');
insert into public.ball_knower_league_members(id,league_id,auth_user_id,user_name,waiver_priority) values('free-agent-manager','unclaimed','00000000-0000-0000-0000-000000000007','FA Manager',1);
insert into public.ball_knower_player_waivers(league_id,player_id,player_snapshot,clears_at) values('unclaimed','P3','{"id":"P3","name":"Unclaimed Player"}',now()+interval '1 hour');
select public.process_due_ball_knower_waivers((select clears_at+interval '1 second' from public.ball_knower_player_waivers where league_id='unclaimed' and player_id='P3'));
do $$ begin if exists(select 1 from public.ball_knower_player_waivers where league_id='unclaimed' and player_id='P3') then raise exception 'unclaimed player stayed on waivers'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',false);
select public.submit_ball_knower_player_move('unclaimed','{"id":"P3","name":"Unclaimed Player"}',null,0,1,null);
do $$ begin if not exists(select 1 from public.ball_knower_league_members m,jsonb_array_elements(m.roster)e where m.id='free-agent-manager' and e->>'id'='P3') then raise exception 'instant add after clear failed'; end if; end $$;

insert into public.ball_knower_leagues(id,settings) values('duplicate','{}');
insert into public.ball_knower_league_members(id,league_id,auth_user_id,user_name,waiver_priority) values
 ('dup-a','duplicate','00000000-0000-0000-0000-000000000008','Dup A',1),
 ('dup-b','duplicate','00000000-0000-0000-0000-000000000009','Dup B',2);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',false);
select public.submit_ball_knower_player_move('duplicate','{"id":"DUP","name":"Duplicate Player"}',null,0,1,null);
do $$
declare blocked boolean:=false;owned integer;
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',false);
  begin
    perform public.submit_ball_knower_player_move('duplicate','{"id":"DUP","name":"Duplicate Player"}',null,0,1,null);
  exception when others then
    if sqlerrm like '%Player is no longer available%' then blocked:=true; else raise; end if;
  end;
  if not blocked then raise exception 'duplicate acquisition was not rejected'; end if;
  select count(*) into owned from public.ball_knower_league_members m,jsonb_array_elements(m.roster)e where m.league_id='duplicate' and e->>'id'='DUP';
  if owned<>1 then raise exception 'duplicate acquisition produced % owners',owned; end if;
end $$;

rollback;
select 'Build 7 waiver PostgreSQL integration passed' as result;
