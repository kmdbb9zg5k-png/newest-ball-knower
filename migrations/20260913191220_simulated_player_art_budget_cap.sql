-- Hard budget accounting and asynchronous batch jobs for the production
-- simulated-player artwork catalog. Monetary values use micro-US dollars so
-- the fixed per-image reservation remains exact without floating point math.

alter table public.ball_knower_simulated_player_art
  add column if not exists source_sheet_path text,
  add column if not exists generation_model text,
  add column if not exists generation_id uuid,
  add column if not exists estimated_cost_microusd bigint
    check (estimated_cost_microusd is null or estimated_cost_microusd >= 0);

create table if not exists public.ball_knower_simulated_art_budgets (
  budget_scope text primary key,
  budget_microusd bigint not null check (budget_microusd between 0 and 35000000),
  reserved_microusd bigint not null default 0 check (reserved_microusd >= 0),
  spent_microusd bigint not null default 0 check (spent_microusd >= 0),
  updated_at timestamptz not null default now(),
  constraint ball_knower_simulated_art_budget_total
    check (reserved_microusd + spent_microusd <= budget_microusd)
);

insert into public.ball_knower_simulated_art_budgets(
  budget_scope,budget_microusd,reserved_microusd,spent_microusd
)
values ('production-v4',35000000,0,0)
on conflict (budget_scope) do update set
  budget_microusd=least(public.ball_knower_simulated_art_budgets.budget_microusd,excluded.budget_microusd),
  updated_at=now();

create table if not exists public.ball_knower_simulated_art_batches (
  id uuid primary key,
  budget_scope text not null references public.ball_knower_simulated_art_budgets(budget_scope),
  provider_job_name text unique,
  model text not null,
  quality_tier text not null check (quality_tier in ('economy','review')),
  status text not null default 'reserving'
    check (status in ('reserving','submitted','running','processing','succeeded','failed','expired','cancelled')),
  jobs jsonb not null check (jsonb_typeof(jobs)='array'),
  expected_items integer not null check (expected_items between 1 and 32),
  processed_items integer not null default 0 check (processed_items >= 0),
  expected_cost_microusd bigint not null check (expected_cost_microusd >= 0),
  provider_state text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ball_knower_simulated_art_generation_ledger (
  generation_id uuid primary key,
  dedupe_key text not null unique check (length(dedupe_key) between 32 and 128),
  budget_scope text not null references public.ball_knower_simulated_art_budgets(budget_scope),
  batch_id uuid references public.ball_knower_simulated_art_batches(id),
  player_id text not null,
  team_abbr text not null,
  model text not null,
  quality_tier text not null check (quality_tier in ('economy','review')),
  estimated_cost_microusd bigint not null check (estimated_cost_microusd > 0),
  status text not null default 'reserved'
    check (status in ('reserved','submitted','succeeded','failed','cancelled')),
  provider_job_name text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ball_knower_simulated_art_batches_status_idx
  on public.ball_knower_simulated_art_batches(status,created_at);
create index if not exists ball_knower_simulated_art_ledger_batch_idx
  on public.ball_knower_simulated_art_generation_ledger(batch_id,status);

alter table public.ball_knower_simulated_art_budgets enable row level security;
alter table public.ball_knower_simulated_art_batches enable row level security;
alter table public.ball_knower_simulated_art_generation_ledger enable row level security;

revoke all on table public.ball_knower_simulated_art_budgets from public,anon,authenticated;
revoke all on table public.ball_knower_simulated_art_batches from public,anon,authenticated;
revoke all on table public.ball_knower_simulated_art_generation_ledger from public,anon,authenticated;
grant all on table public.ball_knower_simulated_art_budgets to service_role;
grant all on table public.ball_knower_simulated_art_batches to service_role;
grant all on table public.ball_knower_simulated_art_generation_ledger to service_role;

create or replace function public.reserve_simulated_art_generation(
  p_generation_id uuid,
  p_dedupe_key text,
  p_budget_scope text,
  p_budget_limit_microusd bigint,
  p_batch_id uuid,
  p_player_id text,
  p_team_abbr text,
  p_model text,
  p_quality_tier text,
  p_estimated_cost_microusd bigint
)
returns table(accepted boolean,generation_id uuid,reason text,remaining_microusd bigint)
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  existing_id uuid;
  current_budget public.ball_knower_simulated_art_budgets%rowtype;
  effective_limit bigint;
begin
  if p_budget_limit_microusd < 0 or p_budget_limit_microusd > 35000000 then
    raise exception 'Artwork budget limit must be between zero and 35 USD';
  end if;
  if p_estimated_cost_microusd <= 0 then
    raise exception 'Artwork generation cost must be positive';
  end if;

  select ledger.generation_id into existing_id
  from public.ball_knower_simulated_art_generation_ledger ledger
  where ledger.dedupe_key=p_dedupe_key;
  if existing_id is not null then
    return query select false,existing_id,'duplicate'::text,0::bigint;
    return;
  end if;

  select * into current_budget
  from public.ball_knower_simulated_art_budgets
  where budget_scope=p_budget_scope
  for update;
  if not found then
    raise exception 'Unknown artwork budget scope';
  end if;

  effective_limit=least(current_budget.budget_microusd,p_budget_limit_microusd,35000000);
  if current_budget.spent_microusd + current_budget.reserved_microusd + p_estimated_cost_microusd > effective_limit then
    return query select false,p_generation_id,'budget_exhausted'::text,
      greatest(0,effective_limit-current_budget.spent_microusd-current_budget.reserved_microusd);
    return;
  end if;

  insert into public.ball_knower_simulated_art_generation_ledger(
    generation_id,dedupe_key,budget_scope,batch_id,player_id,team_abbr,model,
    quality_tier,estimated_cost_microusd,status
  ) values (
    p_generation_id,p_dedupe_key,p_budget_scope,p_batch_id,p_player_id,p_team_abbr,p_model,
    p_quality_tier,p_estimated_cost_microusd,'reserved'
  );
  update public.ball_knower_simulated_art_budgets set
    budget_microusd=effective_limit,
    reserved_microusd=reserved_microusd+p_estimated_cost_microusd,
    updated_at=now()
  where budget_scope=p_budget_scope;
  return query select true,p_generation_id,null::text,
    effective_limit-current_budget.spent_microusd-current_budget.reserved_microusd-p_estimated_cost_microusd;
end;
$$;

create or replace function public.finish_simulated_art_generation(
  p_generation_id uuid,
  p_succeeded boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  ledger_row public.ball_knower_simulated_art_generation_ledger%rowtype;
begin
  select * into ledger_row
  from public.ball_knower_simulated_art_generation_ledger
  where generation_id=p_generation_id
  for update;
  if not found or ledger_row.status in ('succeeded','failed','cancelled') then return; end if;

  update public.ball_knower_simulated_art_budgets set
    reserved_microusd=greatest(0,reserved_microusd-ledger_row.estimated_cost_microusd),
    spent_microusd=spent_microusd + case when p_succeeded then ledger_row.estimated_cost_microusd else 0 end,
    updated_at=now()
  where budget_scope=ledger_row.budget_scope;

  update public.ball_knower_simulated_art_generation_ledger set
    status=case when p_succeeded then 'succeeded' else 'failed' end,
    error=case when p_succeeded then null else left(coalesce(p_error,'Generation failed'),1000) end,
    updated_at=now(),completed_at=now()
  where generation_id=p_generation_id;
end;
$$;

revoke all on function public.reserve_simulated_art_generation(uuid,text,text,bigint,uuid,text,text,text,text,bigint) from public,anon,authenticated;
revoke all on function public.finish_simulated_art_generation(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.reserve_simulated_art_generation(uuid,text,text,bigint,uuid,text,text,text,text,bigint) to service_role;
grant execute on function public.finish_simulated_art_generation(uuid,boolean,text) to service_role;

comment on table public.ball_knower_simulated_art_budgets is
  'Server-only hard spending cap for fictional player artwork generation.';
comment on table public.ball_knower_simulated_art_generation_ledger is
  'Write-once cost ledger that prevents duplicate paid image generation.';
