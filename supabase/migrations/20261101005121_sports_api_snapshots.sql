-- Optional server-only cache; no changes to fantasy tables or existing provider feeds.
create table public.bk_sports_api_snapshots (
  kind text not null check (kind ~ '^[a-z][a-z0-9_-]{0,63}$'),
  provider_key text not null check (provider_key ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) is not distinct from 'object'
    and jsonb_typeof(snapshot -> 'items') is not distinct from 'array'
    and jsonb_array_length(snapshot -> 'items') between 1 and 50000
    and octet_length(snapshot::text) <= 8000000
  ),
  request_started_at timestamptz not null,
  fetched_at timestamptz not null,
  stored_at timestamptz not null default clock_timestamp(),
  primary key (kind, provider_key),
  check (fetched_at >= request_started_at)
);

alter table public.bk_sports_api_snapshots enable row level security;
revoke all on public.bk_sports_api_snapshots from public, anon, authenticated;
grant select, insert, update on public.bk_sports_api_snapshots to service_role;
-- No anon/authenticated policies: access stays closed even if a grant is added accidentally.

create function public.store_bk_sports_api_snapshot(
  p_kind text,
  p_provider_key text,
  p_snapshot jsonb,
  p_request_started_at timestamptz
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fetched_at timestamptz;
  v_source_updated_at timestamptz;
  v_count integer;
begin
  if p_snapshot is null
    or jsonb_typeof(p_snapshot) <> 'object'
    or jsonb_typeof(p_snapshot -> 'updatedAt') is distinct from 'string'
    or not (p_snapshot ? 'sourceUpdatedAt')
    or jsonb_typeof(p_snapshot -> 'sourceUpdatedAt') not in ('null', 'string')
    or (p_snapshot ? 'source' and (jsonb_typeof(p_snapshot -> 'source') <> 'string' or length(p_snapshot ->> 'source') > 500))
    or p_request_started_at is null
  then raise exception 'invalid sports snapshot' using errcode = '22023'; end if;
  v_fetched_at := (p_snapshot ->> 'updatedAt')::timestamptz;
  v_source_updated_at := (p_snapshot ->> 'sourceUpdatedAt')::timestamptz;
  if not isfinite(v_fetched_at)
    or (v_source_updated_at is not null and not isfinite(v_source_updated_at))
    or not isfinite(p_request_started_at)
    or v_fetched_at > clock_timestamp() + interval '5 minutes'
    or p_request_started_at < clock_timestamp() - interval '24 hours'
  then raise exception 'invalid sports snapshot timestamp' using errcode = '22023'; end if;

  insert into public.bk_sports_api_snapshots as existing
    (kind, provider_key, snapshot, request_started_at, fetched_at)
  values (p_kind, p_provider_key, p_snapshot, p_request_started_at, v_fetched_at)
  on conflict (kind, provider_key) do update
    set snapshot = excluded.snapshot,
        request_started_at = excluded.request_started_at,
        fetched_at = excluded.fetched_at,
        stored_at = clock_timestamp()
    -- An earlier request finishing late must not replace a newer request's snapshot.
    -- Equal request timestamps are idempotent no-ops, including unknown-commit retries.
    where excluded.request_started_at > existing.request_started_at;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

revoke all on function public.store_bk_sports_api_snapshot(text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.store_bk_sports_api_snapshot(text, text, jsonb, timestamptz) to service_role;
comment on table public.bk_sports_api_snapshots is 'Optional server-only sports snapshots; fetched_at is transport freshness, not source event freshness. No public API access.';
