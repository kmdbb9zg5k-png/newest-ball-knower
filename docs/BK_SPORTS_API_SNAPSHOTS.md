# Optional sports snapshots

The snapshot cache is **off by default**. It is a server-only optimization for approved data feeds, not a replacement data license or a live-scoring source. No production migration or configuration is performed by this change.

After reviewing and applying `supabase/migrations/20261101005121_sports_api_snapshots.sql` in a test environment, set these server environment variables:

- `BK_SPORTS_SNAPSHOT_CACHE=true`
- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Never prefix these keys with `VITE_` or put them in frontend configuration. The helper intentionally requires an explicitly configured hosted Supabase URL (no implicit project, custom domain, local URL, credentials in URL, or redirects). A missing migration/key, disabled flag, timeout, malformed row, or database failure becomes a cache miss; fresh authorized upstream fetches remain available. The two-second database budget includes response streaming and cancellation, with an eight-megabyte response cap. No automatic retry is performed.

The provider passes a stable configuration string including a schema version. Only its SHA-256 hash is stored; source URL query credentials are not stored or logged. The cache key combines this hash with the dataset kind. Changing a provider URL or adapter version creates a different key and cannot retrieve an old provider's snapshot. Providers must pass only already-normalized public fields to persistence.

`updatedAt` is the original **fetch time**, not the time underlying scores, player assignments, or injury reports changed. `sourceUpdatedAt` is retained when the provider supplies it, otherwise null; an upstream HTTP last-modified timestamp alone is not proof of current sports facts. Reading/persisting a snapshot never resets these timestamps. The caller's TTL applies, capped at 24 hours. Expired, future, malformed and empty snapshots are rejected; there is no stale-on-error fallback. Each provider must independently enforce source age and availability. These constraints preserve honest freshness labels but do not certify real-time data.

Successful refreshes use a service-only `SECURITY INVOKER` RPC. The atomic upsert accepts only a later request start timestamp for the same key. An earlier fetch that finishes late cannot overwrite a newer request; replaying an unknown-commit write is an idempotent no-op. Request timestamps use application time; instances require synchronized clocks. RLS is enabled with no client policies, public/anon/authenticated table and RPC privileges revoked, and service-role-only grants. No user/league/progression tables are touched.

Refresh is demand-driven on cache misses and retains existing per-instance request coalescing. This change does not claim a distributed lock or scheduled ingestion worker: simultaneous cold instances can still fetch the upstream concurrently. A production scheduler/lease and dataset-specific retention policy should be evaluated against provider quotas before enabling at scale. Old provider-key rows do not affect reads; review retention when provider configuration changes frequently.

## Verification

Run the transport and cache contracts:

```sh
node --import tsx scripts/bk-sports-snapshot-check.ts
```

The SQL test creates isolated roles and an in-memory PostgreSQL engine and never connects to production. Its separate test-only dependency can be installed outside the repository:

```sh
npm install --prefix /tmp/bk-snapshot-sql --no-save @electric-sql/pglite@0.3.14
BK_PGLITE_MODULE=/tmp/bk-snapshot-sql/node_modules/@electric-sql/pglite/dist/index.js node scripts/bk-sports-snapshot-sql-check.mjs
```

It verifies migration execution, service-role writes, denied anon/authenticated access (including RLS under accidental grants), invoker security, invalid payload rejection, provider isolation, retry idempotency, and out-of-order refreshes. A real Supabase/PostgREST staging smoke test and advisors check remain necessary before production activation; an isolated SQL-engine pass does not verify remote credentials or Data API schema cache exposure.
