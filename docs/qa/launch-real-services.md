# Isolated two-account service validation

This harness runs actual GoTrue Auth, PostgREST, Realtime and PostgreSQL services in a disposable Supabase Docker stack on GitHub Actions. It creates two labelled users through the Admin API and signs each into a separate real password session. The application cloud adapters are bundled independently for each manager. HTTP responses and realtime statuses are never mocked.

The new workflow has **not been executed** at this commit. Local checks cover isolation guards, ownership checks, schema rendering/parity detection, module syntax and bundling. This workspace has no Docker or Podman. A passing remote `result.json`, matching source SHA, running-service image receipts, schema parity receipt and successful cleanup are the evidence gate.

## Scenarios

| Check | Service boundary exercised |
| --- | --- |
| Two accounts | Admin `createUser` with explicit UUIDs, confirmed password sign-in, separate SDK instances and `getUser` |
| Private league | Actual create/join adapters, nonmember read denial, duplicate join and noncommissioner update denial |
| Draft reconnect | Actual postgres-change delivery, real WebSocket disconnect/connect, adapter rejoin reload with a missed pick, duplicate-pick rejection |
| Draft persistence | Fresh password session reads the saved ledger; two managers complete 30 server-owned picks and receive canonical 15-player rosters |
| Lineups | Both owners save Week 18 starters; another manager's players are rejected and both saved rows remain correct |
| Transactions | Two simultaneous acquisitions of one free agent have one winner, one transaction and an unchanged losing roster |
| Private challenge | Accepted friendship, private bench challenge, server result comparison and immutable retry |
| Football result | Private invite, six real attempt tokens, invalid-token rejection, immutable result retries, server-computed final score/winner/standings |
| Cleanup | Transport quiescence, server metadata ownership checks, session revocation, scoped deletion, and exact owned-row counts including private tables |

Football inputs are synthetic **device-reported** stats. Server ownership of stored results and winner calculation is tested; authoritative gameplay replay is not. The draft-order prerequisite is a labelled commissioner fixture, and the schedule is a synthetic future fixture. These checks do not prove physical-device behavior, real human opposition, production auth configuration, current NFL scoring, kickoff-to-final/correction processing, push delivery or provider availability. Previous intercepted browser tests remain separate evidence.

## Schema provenance

`scripts/qa/production-schema.snapshot.json` contains a scoped read-only production schema export: 35 tables and 55 functions in the exercised call graph and scoring identity/correction dependencies, plus their constraints, indexes, triggers, RLS policies and grants. It records all 196 applied migration versions, names and SHA256 hashes. It contains no account, league, provider or other application rows, no sequence values, no migration statement bodies, no URLs, network/cron/vault functions, JWTs, API keys or private keys.

`scripts/qa/production-schema-export.sql` is the read-only metadata query used for the export. The renderer fails closed on credential/network material. The isolated installer compares complete scoped table/function metadata after restoration and writes `schema-parity.json`; differences fail the run. This is **production-schema parity**, not a replay of all historical migrations: original baseline objects and some historical migrations are absent from the repository. The snapshot excludes unrelated application surfaces and does not certify them. Refresh and review the snapshot after relevant production DDL changes.

Reviewed feature migrations can be applied after base parity with the workflow's `extra_migrations` input. Supply comma-separated paths under `migrations/` or `supabase/migrations/`. `feature-overlays.json` records their hashes and makes the overlay explicit; an overlay does not claim production parity for the changed definitions. Network jobs and embedded credentials are refused.

## Run in CI

Root/maintainer publishes the branch and dispatches **Isolated real Supabase launch validation** at the intended source SHA. No Supabase access token, production API key, database password, hosted project or paid branch is required. The job uses the repository's existing GitHub Actions runner allowance. CLI `2.122.1` is pinned, and its command interfaces are inspected before use. `local_smtp` is configured; normal email/anonymous signup is disabled. Admin creation requests no confirmation email.

The upload contains sanitized direct-child JSON files only. Status credentials, compiled per-manager adapters, raw service output and container environment values are excluded. `service-images.json` records image identities without environment variables. `result.json` records exact source commit, immutable run UUID, check results and evidence limits.

For an already running isolated stack, reproduce with:

```sh
export BK_QA_LOCAL_STATUS=/absolute/path/to/local-supabase-status.json
export BK_QA_OUTPUT=artifacts/launch-real-services
node scripts/qa/real-service-guards-check.mjs
node --import tsx scripts/qa/bootstrap-real-services.ts
node --import tsx scripts/qa/run-real-services.mjs
```

The status JSON is produced by `supabase status --output json` in the dedicated workdir. Both the API URL and privileged SQL connection independently require loopback. There is no production/hosted override; `gpnboygoosrmeydwjpvk` cannot be used as a run target.

## Fixture ownership and recovery

Before any account is created, a write-ahead manifest fixes the immutable run UUID, two user UUIDs, owner marker, expiry and source commit. Passwords and JWTs exist only in process memory. Admin-owned `app_metadata.bk_launch_qa` is checked before account cleanup; user-editable metadata cannot authorize deletion. The actual league-create payload is observed and persisted before forwarding so a lost create response does not lose its resource ID. All league operations carry a matching `settings.launchQa` marker. No public matchmaking or global message is used.

Cleanup stops subscriptions and auto-refresh, waits for outstanding HTTP transports, bans the two owned users, revokes their sessions, deletes only the matching private league and deletes users through the Admin API. Exact scoped counts verify auth users/sessions, league/members, notifications, friendships, mini attempts/challenges and football drives/matches are gone. Existing access JWTs are not assumed invalidated by sign-out; they are never exported, and no scenario work resumes after the barrier.

If execution stops before cleanup, the always-run recovery step uses the same manifest; it never searches all users or deletes by an email prefix. Manual retry is:

```sh
BK_QA_CLEANUP_MANIFEST=artifacts/launch-real-services/run-manifest.json \
BK_QA_OUTPUT=artifacts/launch-real-services-cleanup \
node --import tsx scripts/qa/run-real-services.mjs
```

The workflow always destroys the complete disposable stack with `supabase stop --no-backup`, removing baseline synthetic catalog/schedule fixtures as well. An aborted runner is not a passing cleanup receipt.

## Why full production validation remains gated

The current football `home` RPC settles expired matches globally, and its standings include every completed friend/private match. A synthetic completed match on production could therefore change real global activity even if its fixture is later deleted. No production run, auth user creation, migration, provider call, config change or deployment was performed by this workstream. Hosted staging requires an existing isolated project or an owner-approved paid branch; neither is provisioned here.

Primary implementation references checked: [Supabase local/CI stack](https://supabase.com/docs/guides/local-development/cli/getting-started), [CLI v3 change notice](https://supabase.com/changelog/supabase-cli-v3), [Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [Admin signOut](https://supabase.com/docs/reference/javascript/auth-admin-signout), [Admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).
