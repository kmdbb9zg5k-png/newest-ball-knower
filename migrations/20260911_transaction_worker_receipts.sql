-- Additive wrapper: existing cron callers/delegate signatures keep working.
-- Mutation and receipt commit in ONE transaction. Retries never guess whether
-- a timed-out request committed. Per-worker try-locks avoid overlapping runs.
create schema if not exists ball_knower_private;
create table if not exists ball_knower_private.transaction_job_receipts (
  job text not null,
  run_id uuid not null,
  checked_at timestamptz not null,
  completed_at timestamptz not null default clock_timestamp(),
  result jsonb,
  primary key (job, run_id)
);
alter table ball_knower_private.transaction_job_receipts enable row level security;
revoke all on ball_knower_private.transaction_job_receipts from public, anon, authenticated;
create index if not exists transaction_job_receipts_expiry_idx
  on ball_knower_private.transaction_job_receipts(job, completed_at);

create or replace function public.run_ball_knower_transaction_job(p_job text, p_run_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_receipt ball_knower_private.transaction_job_receipts%rowtype;
  v_result jsonb;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_job is null or p_job not in (
    'process_due_ball_knower_scheduled_drafts', 'process_due_ball_knower_waivers',
    'process_due_ball_knower_draft_picks', 'process_due_ball_knower_matchup_notifications'
  ) or p_run_id is null or p_now is null then
    raise exception 'Invalid transaction job' using errcode = '22023';
  end if;
  select * into v_receipt from ball_knower_private.transaction_job_receipts
    where job = p_job and run_id = p_run_id;
  if found then
    if v_receipt.checked_at is distinct from p_now then
      raise exception 'Receipt timestamp mismatch' using errcode = '22023';
    end if;
    return jsonb_build_object('state', 'completed', 'replayed', true, 'result', v_receipt.result);
  end if;
  -- Receipts expire after seven days, so reject stale keys before they can run
  -- again after expiry. Clock skew is tolerated, future processing is not.
  if p_now < clock_timestamp() - interval '10 minutes' or p_now > clock_timestamp() + interval '1 minute' then
    raise exception 'Transaction job timestamp outside permitted window' using errcode = '22023';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('bk-transaction-job:' || p_job, 0)) then
    return jsonb_build_object('state', 'busy');
  end if;
  -- Another invocation may have committed between the initial lookup and lock.
  select * into v_receipt from ball_knower_private.transaction_job_receipts
    where job = p_job and run_id = p_run_id;
  if found then
    if v_receipt.checked_at is distinct from p_now then
      raise exception 'Receipt timestamp mismatch' using errcode = '22023';
    end if;
    return jsonb_build_object('state', 'completed', 'replayed', true, 'result', v_receipt.result);
  end if;
  case p_job
    when 'process_due_ball_knower_scheduled_drafts' then v_result := public.process_due_ball_knower_scheduled_drafts(p_now);
    when 'process_due_ball_knower_waivers' then v_result := public.process_due_ball_knower_waivers(p_now);
    when 'process_due_ball_knower_draft_picks' then v_result := public.process_due_ball_knower_draft_picks(p_now);
    when 'process_due_ball_knower_matchup_notifications' then v_result := public.process_due_ball_knower_matchup_notifications(p_now);
  end case;
  insert into ball_knower_private.transaction_job_receipts(job, run_id, checked_at, result)
    values (p_job, p_run_id, p_now, v_result);
  delete from ball_knower_private.transaction_job_receipts
    where (job, run_id) in (
      select r.job, r.run_id from ball_knower_private.transaction_job_receipts r
      where r.job = p_job and r.completed_at < clock_timestamp() - interval '7 days'
      order by r.completed_at limit 64
    );
  return jsonb_build_object('state', 'completed', 'replayed', false, 'result', v_result);
end;
$function$;
revoke all on function public.run_ball_knower_transaction_job(text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.run_ball_knower_transaction_job(text, uuid, timestamptz) to service_role;
notify pgrst, 'reload schema';
