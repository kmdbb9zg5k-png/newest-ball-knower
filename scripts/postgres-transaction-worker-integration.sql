\set ON_ERROR_STOP on
-- Disposable local CI PostgreSQL ONLY. All stubs, effects and receipts roll back.
begin;
create extension if not exists pgcrypto;
create extension if not exists dblink;
create schema if not exists auth;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create or replace function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claim.role', true)
$$;
create table public.worker_test_effects(job text primary key, mutations integer not null);
do $setup$
declare name text;
begin
  foreach name in array array['process_due_ball_knower_scheduled_drafts','process_due_ball_knower_waivers','process_due_ball_knower_draft_picks','process_due_ball_knower_matchup_notifications'] loop
    execute format($stub$
      create or replace function public.%I(p_now timestamptz) returns jsonb language plpgsql as $body$
      begin
        insert into public.worker_test_effects(job, mutations) values (%L, 1)
          on conflict(job) do update set mutations=worker_test_effects.mutations+1;
        if current_setting('bk.test.failure', true)='on' then
          raise exception 'controlled delegate failure' using errcode='23514';
        end if;
        return jsonb_build_object('processed', 1);
      end; $body$;
    $stub$, name, name);
  end loop;
end $setup$;
\i migrations/20260911_transaction_worker_receipts.sql
select set_config('request.jwt.claim.role','service_role',true);
do $test$
declare name text; token uuid; instant timestamptz := clock_timestamp(); first_result jsonb; replay_result jsonb;
begin
  foreach name in array array['process_due_ball_knower_scheduled_drafts','process_due_ball_knower_waivers','process_due_ball_knower_draft_picks','process_due_ball_knower_matchup_notifications'] loop
    token := gen_random_uuid();
    first_result := public.run_ball_knower_transaction_job(name, token, instant);
    replay_result := public.run_ball_knower_transaction_job(name, token, instant);
    if first_result->>'state'<>'completed' or (first_result->>'replayed')::boolean then raise exception 'first invocation was not performed'; end if;
    if not (replay_result->>'replayed')::boolean or replay_result->'result' is distinct from first_result->'result' then raise exception 'receipt replay changed result'; end if;
    if (select mutations from public.worker_test_effects where job=name)<>1 then raise exception 'duplicate mutation'; end if;
    begin
      perform public.run_ball_knower_transaction_job(name,token,instant+interval '1 second');
      raise exception 'mismatched receipt timestamp accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  if (select count(*) from ball_knower_private.transaction_job_receipts)<>4 then raise exception 'missing receipts'; end if;
  token := gen_random_uuid();
  perform set_config('bk.test.failure','on',true);
  begin
    perform public.run_ball_knower_transaction_job('process_due_ball_knower_waivers',token,instant);
    raise exception 'delegate failure was swallowed';
  exception when check_violation then null; end;
  perform set_config('bk.test.failure','off',true);
  if exists(select 1 from ball_knower_private.transaction_job_receipts where run_id=token) then raise exception 'failed mutation left successful receipt'; end if;
  if (select mutations from public.worker_test_effects where job='process_due_ball_knower_waivers')<>1 then raise exception 'failed delegate mutation not rolled back'; end if;
  perform public.run_ball_knower_transaction_job('process_due_ball_knower_waivers',token,instant);
  if (select mutations from public.worker_test_effects where job='process_due_ball_knower_waivers')<>2 then raise exception 'rolled-back work did not recover once'; end if;
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform public.run_ball_knower_transaction_job('process_due_ball_knower_waivers',gen_random_uuid(),instant);
    raise exception 'non-service caller accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.role','service_role',true);
  begin
    perform public.run_ball_knower_transaction_job('not_an_allowed_function',gen_random_uuid(),instant);
    raise exception 'arbitrary RPC dispatch accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.run_ball_knower_transaction_job('process_due_ball_knower_waivers',gen_random_uuid(),instant-interval '8 days');
    raise exception 'expired unrecorded key could run again';
  exception when invalid_parameter_value then null; end;
  if has_function_privilege('anon','public.run_ball_knower_transaction_job(text,uuid,timestamptz)','EXECUTE') or has_function_privilege('authenticated','public.run_ball_knower_transaction_job(text,uuid,timestamptz)','EXECUTE') then raise exception 'public wrapper execute exposed'; end if;
  if has_table_privilege('anon','ball_knower_private.transaction_job_receipts','SELECT') or has_table_privilege('authenticated','ball_knower_private.transaction_job_receipts','SELECT') then raise exception 'private receipt table exposed'; end if;
end $test$;
-- A second DB connection owns a real transaction-level worker lock. The busy
-- invocation must neither wait indefinitely nor claim successful processing.
-- Prior calls in this transaction already hold locks: use a SAVEPOINT rollback
-- boundary for a separate key by resetting all transaction-scoped test state.
rollback;
begin;
create extension if not exists dblink;
create schema if not exists auth;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create or replace function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
create or replace function public.process_due_ball_knower_draft_picks(p_now timestamptz) returns jsonb language sql as $$ select '{"processed":1}'::jsonb $$;
\i migrations/20260911_transaction_worker_receipts.sql
select set_config('request.jwt.claim.role','service_role',true);
select dblink_connect('worker_lock','host=127.0.0.1 port=5432 user=postgres password=postgres dbname=postgres');
select dblink_exec('worker_lock','begin');
select * from dblink('worker_lock', 'select pg_advisory_xact_lock(hashtextextended(''bk-transaction-job:process_due_ball_knower_draft_picks'',0))::text') as lock_result(value text);
do $$
declare token uuid:=gen_random_uuid(); result jsonb;
begin
  result:=public.run_ball_knower_transaction_job('process_due_ball_knower_draft_picks',token,clock_timestamp());
  if result->>'state'<>'busy' then raise exception 'overlapping worker did not yield'; end if;
  if exists(select 1 from ball_knower_private.transaction_job_receipts where run_id=token) then raise exception 'busy worker wrote a completion receipt'; end if;
end $$;
select dblink_exec('worker_lock','commit');
select dblink_disconnect('worker_lock');
do $$
declare result jsonb;
begin
  result:=public.run_ball_knower_transaction_job('process_due_ball_knower_draft_picks',gen_random_uuid(),clock_timestamp());
  if result->>'state'<>'completed' then raise exception 'worker failed after lock release'; end if;
end $$;
rollback;
select 'Transaction worker PostgreSQL integration passed: atomic receipts, replay, failure rollback, expiry, permissions, and real cross-session lock contention.' as result;
