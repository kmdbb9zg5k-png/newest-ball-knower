\set ON_ERROR_STOP on
-- Disposable CI PostgreSQL only. This fixture never targets production.
begin;
create extension if not exists pgcrypto;
create schema if not exists auth;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade);
create table public.ball_knower_leagues(id text primary key,settings jsonb not null default '{}');
create table public.ball_knower_league_members(id text primary key,league_id text not null,auth_user_id uuid,is_ai boolean not null default false);
create table public.ball_knower_notifications(id uuid primary key default gen_random_uuid(),auth_user_id uuid not null,league_id text,title text not null default 'Synthetic',body text not null default 'Synthetic',kind text not null default 'league_message',category text not null default 'league',read_at timestamptz,created_at timestamptz not null default clock_timestamp(),in_app_visible boolean not null default true,push_eligible boolean not null default true);
create table public.ball_knower_notification_preferences(auth_user_id uuid,category text,push_enabled boolean not null default true,primary key(auth_user_id,category));
create table public.ball_knower_live_drafts(league_id text primary key,status text not null,order_member_ids jsonb not null,pick_index integer not null default 0,pick_deadline_at timestamptz,started_at timestamptz);
insert into auth.users values('00000000-0000-4000-8000-000000000001',false),('00000000-0000-4000-8000-000000000002',false),('00000000-0000-4000-8000-000000000003',true);
insert into auth.sessions values('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000003');
insert into public.ball_knower_leagues values('league-a','{}'),('league-b','{}');
insert into public.ball_knower_league_members values('member-a','league-a','00000000-0000-4000-8000-000000000001',false),('member-b','league-a','00000000-0000-4000-8000-000000000002',false);
insert into public.ball_knower_notifications(auth_user_id,league_id) values('00000000-0000-4000-8000-000000000001','league-a');
\i supabase/migrations/20261106021520_fantasy_push_delivery.sql
-- Only fixture mutations get broad privileges. The migration itself grants no client auth access.
grant usage on schema auth to service_role;
grant all on public.ball_knower_notifications,public.ball_knower_league_members,public.ball_knower_leagues,public.ball_knower_live_drafts,public.ball_knower_notification_preferences to service_role;
grant delete on auth.sessions to service_role;
set local role service_role;
do $test$
declare
 u1 uuid:='00000000-0000-4000-8000-000000000001'; u2 uuid:='00000000-0000-4000-8000-000000000002'; s1 uuid:='00000000-0000-4000-8000-000000000011'; s2 uuid:='00000000-0000-4000-8000-000000000012';
 install uuid:='00000000-0000-4000-8000-000000000021'; device uuid; n uuid; q record; c record; response jsonb; original_token uuid; original_time timestamptz; data jsonb; instant timestamptz:=clock_timestamp();
begin
 data:=jsonb_build_object('sessionId',s1,'installationId',install,'installationSecretHash',repeat('a',64),'transport','web','payload',jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/synthetic-token','keys',jsonb_build_object('p256dh','synthetic','auth','synthetic')),'label','Synthetic browser');
 device:=(public.manage_ball_knower_push(u1,'subscribe',data)->>'id')::uuid;
 if (select count(*) from ball_knower_private.push_deliveries)<>0 then raise exception 'registering blasted old history'; end if;
 if (public.manage_ball_knower_push(u1,'subscribe',data)->>'id')::uuid<>device then raise exception 'registration not idempotent'; end if;
 begin perform public.manage_ball_knower_push(u1,'subscribe',data||jsonb_build_object('installationSecretHash',repeat('b',64)));raise exception 'guessed installation secret accepted';exception when insufficient_privilege then null;end;
 begin perform public.manage_ball_knower_push(u2,'subscribe',data||jsonb_build_object('sessionId',s2,'installationId',gen_random_uuid()));raise exception 'same endpoint registered to unrelated installation';exception when unique_violation then null;end;
 begin perform public.manage_ball_knower_push(u2,'settings',jsonb_build_object('sessionId',s1));raise exception 'cross-owner session accepted';exception when invalid_authorization_specification then null;end;
 begin perform public.manage_ball_knower_push(u1,'settings',jsonb_build_object('sessionId',gen_random_uuid()));raise exception 'deleted session accepted';exception when invalid_authorization_specification then null;end;
 begin perform public.manage_ball_knower_push('00000000-0000-4000-8000-000000000003','settings',jsonb_build_object('sessionId','00000000-0000-4000-8000-000000000013'));raise exception 'anonymous push account accepted';exception when insufficient_privilege then null;end;
 insert into public.ball_knower_notifications(auth_user_id,league_id) values(u1,'league-a') returning id into n;
 if (select count(*) from ball_knower_private.push_deliveries where notification_id=n)<>1 then raise exception 'missing unique queued event'; end if;
 select * into q from public.claim_ball_knower_push(12,array['web'],instant+interval '1 second');
 if q.id is null then raise exception 'queue not claimed'; end if;
 if exists(select 1 from public.claim_ball_knower_push(12,array['web'],instant+interval '1 second')) then raise exception 'concurrent lease reclaimed'; end if;
 response:=public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '2 seconds');
 if response->>'state'<>'ready' then raise exception 'eligible event not prepared: %',response; end if;
 perform public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '2 seconds');
 if (select attempts from ball_knower_private.push_deliveries where id=q.id)<>1 then raise exception 'repeated prepare burned attempt'; end if;
 if public.finish_ball_knower_push(q.id,gen_random_uuid(),'{"state":"accepted","code":"provider_accepted"}',instant+interval '3 seconds') then raise exception 'stale completion accepted'; end if;
 if not public.finish_ball_knower_push(q.id,q.claim_token,'{"state":"retry","code":"provider_rate_limited","retryAfterSeconds":600}',instant+interval '3 seconds') then raise exception 'retry not recorded'; end if;
 select available_at into original_time from ball_knower_private.push_deliveries where id=q.id;
 perform public.manage_ball_knower_push(u1,'save-settings',jsonb_build_object('sessionId',s1,'quietEnabled',true,'timeZone','America/Vancouver','startMinute',1320,'endMinute',420));
 if (select available_at from ball_knower_private.push_deliveries where id=q.id)<>original_time then raise exception 'saving quiet settings bypassed provider Retry-After'; end if;
 update ball_knower_private.push_deliveries set state='suppressed' where id=q.id;

 -- Deferral does not burn retries; only actual quiet deferrals are unblocked by settings changes.
 insert into public.ball_knower_notifications(auth_user_id,league_id) values(u1,'league-a') returning id into n;
 select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '4 seconds');
 response:=public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '5 seconds');
 if response->'quietHours'->>'timeZone'<>'America/Vancouver' then raise exception 'account timezone missing from server-only prepare'; end if;
 perform public.finish_ball_knower_push(q.id,q.claim_token,jsonb_build_object('state','deferred','code','quiet_hours','availableAt',instant+interval '8 hours'),instant+interval '6 seconds');
 if (select attempts from ball_knower_private.push_deliveries where id=q.id)<>0 then raise exception 'quiet deferral burned attempt'; end if;
 perform public.manage_ball_knower_push(u1,'save-settings',jsonb_build_object('sessionId',s1,'quietEnabled',false,'timeZone','UTC','startMinute',1320,'endMinute',420));
 if (select available_at from ball_knower_private.push_deliveries where id=q.id)>clock_timestamp()+interval '1 second' then raise exception 'quiet deferral not unblocked'; end if;
 update ball_knower_private.push_deliveries set state='suppressed' where id=q.id;

 -- Preferences, receipts and current membership must all be evaluated after enqueue.
 foreach response in array array['{"test":"preference"}'::jsonb,'{"test":"read"}'::jsonb,'{"test":"membership"}'::jsonb] loop
   insert into public.ball_knower_notifications(auth_user_id,league_id) values(u1,'league-a') returning id into n;
   select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '7 seconds');
   if response->>'test'='preference' then insert into public.ball_knower_notification_preferences values(u1,'league',false) on conflict(auth_user_id,category) do update set push_enabled=false;
   elsif response->>'test'='read' then update public.ball_knower_notifications set read_at=clock_timestamp() where id=n;
   else delete from public.ball_knower_league_members where id='member-a';end if;
   if public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '8 seconds')->>'state'<>'suppressed' then raise exception 'post-enqueue % did not suppress',response; end if;
   delete from public.ball_knower_notification_preferences where auth_user_id=u1;
   insert into public.ball_knower_league_members values('member-a','league-a',u1,false) on conflict(id) do nothing;
 end loop;

 -- The same physical installation may explicitly change owner, but old leases cannot follow it.
 insert into public.ball_knower_notifications(auth_user_id,league_id) values(u1,'league-a');
 select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '9 seconds');
 perform public.manage_ball_knower_push(u2,'subscribe',data||jsonb_build_object('sessionId',s2));
 if public.finish_ball_knower_push(q.id,q.claim_token,'{"state":"accepted","code":"provider_accepted"}',instant+interval '10 seconds') then raise exception 'owner-rebound lease accepted'; end if;
 if (select state from ball_knower_private.push_deliveries where id=q.id)<>'suppressed' then raise exception 'rebound old queue not suppressed'; end if;
 perform public.manage_ball_knower_push(u1,'revoke-device',jsonb_build_object('sessionId',s1,'deviceId',device));
 if (select revoked_at from ball_knower_private.push_devices where id=device) is not null then raise exception 'another owner revoked device'; end if;
 perform public.manage_ball_knower_push(u2,'revoke-device',jsonb_build_object('sessionId',s2,'deviceId',device));
 begin perform public.manage_ball_knower_push(u2,'subscribe',data||jsonb_build_object('sessionId',s2,'restore',true));raise exception 'automatic restore undid remote revocation';exception when sqlstate 'BK001' then null;end;
 perform public.manage_ball_knower_push(u1,'subscribe',data);

 -- Draft state and schedule changes invalidate pending reminders and turns.
 update public.ball_knower_leagues set settings=jsonb_build_object('draftScheduledAt',instant+interval '10 minutes') where id='league-a';
 insert into public.ball_knower_notifications(auth_user_id,league_id,kind) values(u1,'league-a','draft_reminder') returning id into n;
 if (select expires_at from ball_knower_private.push_deliveries where notification_id=n)>instant+interval '10 minutes' then raise exception 'countdown survives draft start'; end if;
 select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '11 seconds');
 update public.ball_knower_leagues set settings=jsonb_build_object('draftScheduledAt',instant+interval '20 minutes') where id='league-a';
 if public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '12 seconds')->>'state'<>'suppressed' then raise exception 'rescheduled countdown delivered'; end if;
 insert into public.ball_knower_live_drafts values('league-a','active','["member-a","member-b"]',0,instant+interval '90 seconds',instant);
 insert into public.ball_knower_notifications(auth_user_id,league_id,kind) values(u1,'league-a','draft_on_clock');
 select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '13 seconds');
 update public.ball_knower_live_drafts set pick_index=1 where league_id='league-a';
 if public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '14 seconds')->>'code'<>'draft_turn_ended' then raise exception 'old draft turn delivered'; end if;
 insert into public.ball_knower_notifications(auth_user_id,league_id,kind) values(u1,'league-a','draft_started');
 select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '15 seconds');
 update public.ball_knower_live_drafts set status='completed' where league_id='league-a';
 if public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '16 seconds')->>'code'<>'draft_turn_ended' then raise exception 'completed draft start delivered'; end if;

 -- A restarted draft with the same pick index is a different turn identity.
 update public.ball_knower_live_drafts set status='active',pick_index=0,started_at=instant where league_id='league-a';
 insert into public.ball_knower_notifications(auth_user_id,league_id,kind) values(u1,'league-a','draft_on_clock');
 select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '17 seconds');
 update public.ball_knower_live_drafts set started_at=instant+interval '1 second' where league_id='league-a';
 if public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '18 seconds')->>'code'<>'draft_turn_ended' then raise exception 'restarted same-index turn delivered'; end if;

 -- Recovered claims fence the abandoned worker, and accepted receipts never retry.
 insert into public.ball_knower_notifications(auth_user_id,league_id) values(u1,'league-a');
 select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '17 seconds');original_token:=q.claim_token;
 select * into c from public.claim_ball_knower_push(1,array['web'],instant+interval '3 minutes');
 if c.id<>q.id or c.claim_token=original_token then raise exception 'abandoned lease not recovered with new fence'; end if;
 if public.finish_ball_knower_push(q.id,original_token,'{"state":"accepted","code":"provider_accepted"}',instant+interval '3 minutes') then raise exception 'abandoned worker completed reclaimed lease'; end if;
 perform public.prepare_ball_knower_push(c.id,c.claim_token,instant+interval '3 minutes');
 perform public.finish_ball_knower_push(c.id,c.claim_token,'{"state":"accepted","code":"provider_accepted","providerId":"synthetic-receipt"}',instant+interval '3 minutes');
 if exists(select 1 from public.claim_ball_knower_push(24,array['web'],instant+interval '4 minutes')) then raise exception 'accepted row retried'; end if;
 if not exists(select 1 from ball_knower_private.push_deliveries where id=c.id and state='accepted' and accepted_at is not null) then raise exception 'acceptance receipt missing'; end if;

 -- Expired source events and persisted push opt-out never dispatch.
 insert into public.ball_knower_notifications(auth_user_id,league_id,created_at) values(u1,'league-a',instant-interval '25 hours') returning id into n;
 perform public.claim_ball_knower_push(12,array['web'],instant+interval '5 minutes');
 if (select outcome_code from ball_knower_private.push_deliveries where notification_id=n)<>'expired' then raise exception 'expired source remained eligible'; end if;
 insert into public.ball_knower_notifications(auth_user_id,league_id,push_eligible) values(u1,'league-a',false) returning id into n;
 if exists(select 1 from ball_knower_private.push_deliveries where notification_id=n) then raise exception 'persisted push opt-out queued'; end if;

 -- Invalid providers revoke devices; sign-out removes device and pending queue via active session FK.
 insert into public.ball_knower_notifications(auth_user_id,league_id) values(u1,'league-a');
 select * into q from public.claim_ball_knower_push(1,array['web'],instant+interval '18 seconds');
 perform public.prepare_ball_knower_push(q.id,q.claim_token,instant+interval '19 seconds');
 perform public.finish_ball_knower_push(q.id,q.claim_token,'{"state":"invalid","code":"subscription_invalid"}',instant+interval '20 seconds');
 if (select revoked_at from ball_knower_private.push_devices where id=device) is null then raise exception 'invalid endpoint not revoked'; end if;
 perform public.manage_ball_knower_push(u1,'subscribe',data);
 delete from auth.sessions where id=s1;
 if exists(select 1 from ball_knower_private.push_devices where id=device) then raise exception 'signed-out device survived'; end if;
 begin perform public.manage_ball_knower_push(u1,'subscribe',data);raise exception 'old JWT session re-registered after sign-out';exception when invalid_authorization_specification then null;end;
 if has_function_privilege('anon','public.manage_ball_knower_push(uuid,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.claim_ball_knower_push(integer,text[],timestamptz)','EXECUTE') or has_function_privilege('authenticated','public.prepare_ball_knower_push(uuid,uuid,timestamptz)','EXECUTE') or has_function_privilege('authenticated','public.finish_ball_knower_push(uuid,uuid,jsonb,timestamptz)','EXECUTE') then raise exception 'service-only RPC exposed'; end if;
 if has_table_privilege('anon','ball_knower_private.push_devices','SELECT') or has_table_privilege('authenticated','ball_knower_private.push_deliveries','SELECT') then raise exception 'raw device/queue table exposed'; end if;
end $test$;
rollback;
select 'Push PostgreSQL integration passed: permanent owner/session binding, registration uniqueness, restore/revocation, delivery fences, current-access and draft suppression, backoff, quiet deferral, acceptance receipts and sign-out cascade.' as result;
