\set ON_ERROR_STOP on
begin;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema ball_knower_private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth to authenticated,service_role;
create table public.ball_knower_leagues(id text primary key);
create table public.ball_knower_league_members(
 id text primary key,league_id text references public.ball_knower_leagues(id),
 auth_user_id uuid references auth.users(id) on delete set null,is_ai boolean not null default false,
 user_name text not null,user_avatar text,roster jsonb not null default '[{"id":"existing-player","ovr":90}]'
);
create table public.ball_knower_dm_threads(
 id uuid primary key default gen_random_uuid(),league_id text not null references public.ball_knower_leagues(id),
 participant_a uuid not null,participant_b uuid not null,created_at timestamptz default now(),updated_at timestamptz default now(),
 last_read_a_at timestamptz,last_read_b_at timestamptz,unique(league_id,participant_a,participant_b)
);
create table public.ball_knower_trades(
 id uuid primary key,league_id text not null references public.ball_knower_leagues(id),
 proposer_member_id text references public.ball_knower_league_members(id),recipient_member_id text references public.ball_knower_league_members(id)
);
create table public.ball_knower_league_messages(
 id uuid primary key default gen_random_uuid(),league_id text not null references public.ball_knower_leagues(id),
 auth_user_id uuid,member_name text not null,body text not null,kind text default 'chat',reply_to uuid,created_at timestamptz default now()
);
create table public.ball_knower_dm_messages(
 id uuid primary key default gen_random_uuid(),thread_id uuid references public.ball_knower_dm_threads(id),sender_auth_id uuid not null,body text not null,created_at timestamptz default now()
);
create table public.ball_knower_trade_messages(
 id uuid primary key default gen_random_uuid(),trade_id uuid references public.ball_knower_trades(id),sender_auth_id uuid not null,body text not null,created_at timestamptz default now()
);
create table public.ball_knower_notifications(league_id text,auth_user_id uuid,title text,body text,kind text);
create function public.test_member(league text) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.ball_knower_league_members where league_id=league and auth_user_id=auth.uid() and not is_ai)
$$;
grant select on public.ball_knower_league_members,public.ball_knower_trades,public.ball_knower_dm_threads to authenticated;
grant select,insert on public.ball_knower_league_messages,public.ball_knower_dm_messages,public.ball_knower_trade_messages to authenticated;
grant all on all tables in schema public to service_role;
alter table public.ball_knower_league_messages enable row level security;
alter table public.ball_knower_dm_messages enable row level security;
alter table public.ball_knower_trade_messages enable row level security;
create policy base_league_read on public.ball_knower_league_messages for select to authenticated using(public.test_member(league_id));
create policy base_league_insert on public.ball_knower_league_messages for insert to authenticated with check(public.test_member(league_id) and auth_user_id=auth.uid());
create policy base_dm_read on public.ball_knower_dm_messages for select to authenticated using(exists(select 1 from public.ball_knower_dm_threads t where t.id=thread_id and auth.uid() in(t.participant_a,t.participant_b) and public.test_member(t.league_id)));
create policy base_trade_read on public.ball_knower_trade_messages for select to authenticated using(exists(select 1 from public.ball_knower_trades t join public.ball_knower_league_members p on p.id=t.proposer_member_id join public.ball_knower_league_members r on r.id=t.recipient_member_id where t.id=trade_id and auth.uid() in(p.auth_user_id,r.auth_user_id) and public.test_member(t.league_id)));

\i /tmp/bk-community-rpcs.sql
revoke all on function public.open_ball_knower_dm(text,text),public.send_ball_knower_dm(uuid,text),public.send_ball_knower_trade_message(uuid,text) from public,anon;
grant execute on function public.open_ball_knower_dm(text,text),public.send_ball_knower_dm(uuid,text),public.send_ball_knower_trade_message(uuid,text) to authenticated;

insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
insert into public.ball_knower_leagues values('league-one'),('league-two');
insert into public.ball_knower_league_members(id,league_id,auth_user_id,user_name) values
('a','league-one','11111111-1111-4111-8111-111111111111','Manager A'),
('b','league-one','22222222-2222-4222-8222-222222222222','Manager B'),
('d','league-one','44444444-4444-4444-8444-444444444444','Manager D'),
('c','league-two','33333333-3333-4333-8333-333333333333','Outsider');
insert into public.ball_knower_trades values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','league-one','a','b');
insert into public.ball_knower_dm_threads(id,league_id,participant_a,participant_b) values
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','league-one','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
-- Pre-existing messages, including an old abusive message that must be reportable.
insert into public.ball_knower_league_messages(id,league_id,auth_user_id,member_name,body) values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','league-one','22222222-2222-4222-8222-222222222222','Manager B','existing reported content');
\ir ../migrations/20260907010000_community_safety.sql

create function public.test_expect_denied(command text,expected text) returns void language plpgsql security invoker as $$
begin
 begin execute command;
 exception when others then
  if position(expected in sqlerrm)>0 then return;end if;
  raise exception 'Wrong failure for %: % (expected %)',command,sqlerrm,expected;
 end;
 raise exception 'Unexpected success for %',command;
end $$;
create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',message;end if;end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.send_ball_knower_dm('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Normal fantasy discussion');
select public.send_ball_knower_trade_message('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Normal trade discussion');
select public.test_expect_denied($$select public.set_ball_knower_user_block('22222222-2222-4222-8222-222222222222',true,'22222222-2222-4222-8222-222222222222')$$,'account changed');
select public.test_expect_denied($$select public.set_ball_knower_user_block('33333333-3333-4333-8333-333333333333',true,'11111111-1111-4111-8111-111111111111')$$,'Shared league');
select public.test_expect_denied($$insert into public.ball_knower_user_blocks values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',now())$$,'permission denied');
select public.set_ball_knower_user_block('22222222-2222-4222-8222-222222222222',true,'11111111-1111-4111-8111-111111111111');
select public.test_assert((select count(*)=1 from public.ball_knower_user_blocks),'Owner must see own block');
select public.test_assert((select count(*)=0 from public.ball_knower_league_messages),'Blocked sender must be hidden by database RLS');
select public.test_expect_denied($$select public.send_ball_knower_dm('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Blocked outbound')$$,'not available between');
select public.test_expect_denied($$select public.send_ball_knower_trade_message('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Blocked outbound')$$,'not available between');
select public.report_ball_knower_content('league_message','cccccccc-cccc-4ccc-8ccc-cccccccccccc','harassment','Review requested','11111111-1111-4111-8111-111111111111') as report_id \gset
select public.test_assert(public.report_ball_knower_content('league_message','cccccccc-cccc-4ccc-8ccc-cccccccccccc','harassment','duplicate','11111111-1111-4111-8111-111111111111')=:'report_id'::uuid,'Repeated reports must deduplicate');
select public.test_assert((select evidence='existing reported content' from public.ball_knower_content_reports where id=:'report_id'),'Evidence must come from the server message, not report details');
select public.test_expect_denied($$select public.report_ball_knower_content('profile','22222222-2222-4222-8222-222222222222','other','','22222222-2222-4222-8222-222222222222')$$,'account changed');
select public.report_ball_knower_content('profile','22222222-2222-4222-8222-222222222222','impersonation','','11111111-1111-4111-8111-111111111111') as profile_report_id \gset
select public.test_expect_denied(format('select public.moderate_ball_knower_report(%L,%L,%L)',:'report_id','remove','unauthorized'),'permission denied');
select public.test_expect_denied($$update public.ball_knower_content_reports set status='removed'$$,'permission denied');

-- Incoming messages are rejected too, even through SECURITY DEFINER send RPCs.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.test_assert((select count(*)=0 from public.ball_knower_user_blocks),'Users must not enumerate other users blocks');
select public.test_assert((select count(*)=0 from public.ball_knower_content_reports),'Reported user must not see reporters/private reports');
select public.test_expect_denied($$select public.send_ball_knower_dm('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Blocked inbound')$$,'not available between');
select public.test_expect_denied($$select public.send_ball_knower_trade_message('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Blocked inbound')$$,'not available between');
insert into public.ball_knower_league_messages(league_id,auth_user_id,member_name,body) values('league-one','22222222-2222-4222-8222-222222222222','Manager B','Other managers may still read this');
select public.test_expect_denied($$insert into public.ball_knower_league_messages(league_id,auth_user_id,member_name,body) values('league-one','22222222-2222-4222-8222-222222222222','Manager B','I will kill you')$$,'cannot be posted');

select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
select public.test_assert((select count(*)=2 from public.ball_knower_league_messages),'Blocking must not hide a sender from unrelated managers');
select public.test_assert((select count(*)=0 from public.ball_knower_dm_messages),'League membership alone must not expose other managers private DMs');
select public.test_expect_denied($$select public.report_ball_knower_content('dm_message',(select id from public.ball_knower_dm_messages limit 1),'other','','44444444-4444-4444-8444-444444444444')$$,'unavailable to report');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
select public.test_assert((select count(*)=0 from public.ball_knower_league_messages),'New restrictive policies must never broaden league access');
select public.test_expect_denied($$select public.report_ball_knower_content('league_message','cccccccc-cccc-4ccc-8ccc-cccccccccccc','other','','33333333-3333-4333-8333-333333333333')$$,'unavailable to report');
select public.test_expect_denied($$select public.send_ball_knower_dm('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Outsider')$$,'Private thread');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.set_ball_knower_user_block('22222222-2222-4222-8222-222222222222',false,'11111111-1111-4111-8111-111111111111');
select public.send_ball_knower_dm('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','After unblock');
select public.test_assert((select count(*)=2 from public.ball_knower_league_messages),'Unblock must restore allowed history');

reset role;
select set_config('request.jwt.claim.sub','',true);
-- Server system receipts are untouched; authenticated users cannot spoof them.
insert into public.ball_knower_league_messages(league_id,auth_user_id,member_name,body,kind) values('league-one',null,'System','Waiver receipt','receipt');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select public.test_expect_denied($$insert into public.ball_knower_league_messages(league_id,auth_user_id,member_name,body,kind) values('league-one',null,'System','Fake receipt','receipt')$$,'author does not match');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select public.test_expect_denied($$select public.report_ball_knower_content('profile','22222222-2222-4222-8222-222222222222','other','','11111111-1111-4111-8111-111111111111')$$,'permission denied');
reset role;
set local role service_role;
select public.moderate_ball_knower_report(:'report_id','remove','Reviewed and removed');
select public.test_assert((select count(*)=0 from public.ball_knower_league_messages where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'),'Moderator must actually remove message');
select public.test_expect_denied(format('select public.moderate_ball_knower_report(%L,%L,%L)',:'profile_report_id','remove','Pending profile review'),'Profile reports require');
select public.moderate_ball_knower_report(:'profile_report_id','suspend','Repeated confirmed abuse');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
select public.test_expect_denied($$select public.send_ball_knower_dm('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Suspended')$$,'messaging is suspended');
reset role;
select set_config('request.jwt.claim.sub','',true);
select public.test_assert((select bool_and(roster='[{"id":"existing-player","ovr":90}]'::jsonb) from public.ball_knower_league_members),'Safety changes must not touch rosters');
delete from auth.users where id='22222222-2222-4222-8222-222222222222';
select public.test_assert((select count(*)=0 from public.ball_knower_content_reports),'Account deletion must cascade new reports');
select public.test_assert((select count(*)=2 from public.ball_knower_leagues),'Account deletion must not delete shared leagues');
rollback;
\echo 'Community safety integration passed: existing RPCs, RLS, bilateral blocking, reporting, authority, suspension, account binding and preserved rosters.'
