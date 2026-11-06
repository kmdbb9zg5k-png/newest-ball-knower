# Isolated two-account service validation

This harness runs actual GoTrue Auth, PostgREST, Realtime and PostgreSQL services in a disposable Supabase Docker stack on GitHub Actions. It creates two labelled users through the Admin API and signs each into a separate real password session. The application cloud adapters are bundled independently for each manager. HTTP responses and realtime statuses are never mocked.

Remote run `42156354021` restored the complete scoped schema, passed production-schema parity, applied all three final feature migrations to actual Supabase PostgreSQL 17, signed in both Admin-created accounts through separate real password sessions, and passed private league access checks. Run `42158054465` then showed the draft-only observer becoming ready while both actual application channels reported backend subscription errors. The production snapshot omits `ball_knower_league_events` from the publication even though `subscribeToCloudLeague` binds that table; a reviewed idempotent publication overlay now adds it without changing SELECT grants or member RLS. The harness waits for all backend `postgres_changes` system-ready confirmations and drains initial reads before testing missed-pick recovery. Scoped cleanup and complete stack teardown passed. The actual Auth settings check confirmed the email/password provider enabled and global public signup disabled. Full scenario evidence remains **pending a passing CI receipt**. Local checks cover isolation guards, ownership checks, schema rendering/parity detection, module syntax and bundling. This workspace has no Docker or Podman. A passing remote `result.json`, matching exact PR source SHA, running-service image receipts, schema parity receipt and successful cleanup are the evidence gate.

## Scenarios

| Check | Service boundary exercised |
| --- | --- |
| Two accounts | Admin `createUser` with explicit UUIDs, confirmed password sign-in, separate SDK instances and `getUser` |
| Private league | Actual create/join adapters, nonmember read denial, duplicate join and noncommissioner update denial |
| Draft reconnect | Backend replication readiness, actual postgres-change delivery, real WebSocket disconnect/connect, initial-read drain, adapter rejoin reload with a missed pick, duplicate-pick rejection |
| Draft persistence | Fresh password session reads the saved ledger; two managers complete 30 server-owned picks and receive canonical 15-player rosters |
| Lineups | Both owners save Week 18 starters; another manager's players are rejected and both saved rows remain correct |
| Protected lineup overlay | Actual authenticated INSERT/UPDATE/UPSERT/DELETE denied for both managers; pregame RPC works, started starter/bench swaps fail, an unstarted receiver can change, and an explicit full lock survives identical saves |
| Atomic scoring overlay | Real user RPC calls fail and an unapproved service contract fails; transactional fixture uses the real legacy identity trigger/FK, two real managers' submitted lineups, a synthetic approved contract, incomplete-nine/nonfinal guards, final corrections/retries, preserved forecasts including zero, and forced receipt failure rollback |
| Transactions | Two simultaneous acquisitions of one free agent have one winner, one transaction and an unchanged losing roster |
| Private challenge | Accepted friendship, private bench challenge, server result comparison and immutable retry |
| Football result | Private invite, six real attempt tokens, invalid-token rejection, immutable result retries, server-computed final score/winner/standings |
| Push session overlay | Actual HTTP API worker verifies GoTrue JWTs and service RPCs; cross-account targets fail, intent revisions/epochs reject delayed actions, global sign-out removes two sessions plus intent/device/queue without unsubscribe, and sixteen stale-JWT actions fail while the other account still works |
| Cleanup | Transport quiescence, server metadata ownership checks, session revocation, scoped deletion, and exact owned-row counts including private tables |

Football inputs are synthetic **device-reported** stats. Server ownership of stored results and winner calculation is tested; authoritative gameplay replay is not. The draft-order prerequisite is a labelled commissioner fixture, and the schedule is synthetic. The scoring overlay exercises the transaction pipeline with synthetic approved mappings and data; it does not certify a real provider contract or current NFL output. Push API execution uses real HTTP to the actual handler in an ephemeral loopback worker with real Auth/PostgREST calls; no delivery sender is invoked. These checks do not prove physical-device behavior, real human opposition, production auth configuration, current NFL scoring, push provider acceptance or physical delivery. Previous intercepted browser tests remain separate evidence.

## Schema provenance

`scripts/qa/production-schema.snapshot.json` contains a scoped read-only production schema export: 35 tables and 55 functions in the exercised call graph and scoring identity/correction dependencies, plus their constraints, indexes, triggers, RLS policies and grants. It records all 196 applied migration versions, names and SHA256 hashes. It contains no account, league, provider or other application rows, no sequence values, no migration statement bodies, no URLs, network/cron/vault functions, JWTs, API keys or private keys.

`scripts/qa/production-schema-export.sql` is the read-only metadata query used for the export. The renderer fails closed on credential/network material. The isolated installer compares complete scoped table/function metadata after restoration and writes `schema-parity.json`; differences fail the run. This is **production-schema parity**, not a replay of all historical migrations: original baseline objects and some historical migrations are absent from the repository. The snapshot excludes unrelated application surfaces and does not certify them. Refresh and review the snapshot after relevant production DDL changes.

Reviewed feature migrations apply after base parity. The current workflow defaults to the atomic scoring, secure lineup-write, push-delivery and league-event publication migrations. A manual `extra_migrations` input can supply comma-separated paths under `migrations/` or `supabase/migrations/`, or `none` for the base schema. `feature-overlays.json` records every applied file hash; the transactional scoring helper also receives its own hash in `result.json`. An overlay does not claim production parity for the changed definitions. Network jobs and embedded credentials are refused. The local metadata comparison excludes historical migration-ledger contents instead of fabricating a replay.

## Run in CI

Opening or updating the focused PR triggers **Isolated real Supabase launch validation** on its exact head SHA. After the workflow is registered on the default branch, maintainers can also dispatch it manually. No Supabase access token, production API key, database password, hosted project or paid branch is required. The job uses the repository's existing GitHub Actions runner allowance. CLI `2.122.1` is pinned, and its command interfaces are inspected before use. `local_smtp` is configured; global public and anonymous signup are disabled while the email/password provider remains enabled for Admin-created fixtures. Admin creation requests no confirmation email.

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

Cleanup stops subscriptions and auto-refresh, closes the HTTP worker, denies further scenario HTTP requests, waits for reconnect reads and outstanding transports, revokes existing sessions, bans the two owned users, deletes only the matching private league and deletes users through the Admin API. Exact scoped counts verify auth users/sessions, league/members, notifications, friendships, mini attempts/challenges, football drives/matches and overlaid push settings/intents/devices/deliveries are gone. Existing access JWTs are not assumed invalidated by sign-out; they are never exported, and no scenario work resumes after the barrier.

If execution stops before cleanup, the always-run recovery step uses the same manifest; it never searches all users or deletes by an email prefix. Manual retry is:

```sh
BK_QA_CLEANUP_MANIFEST=artifacts/launch-real-services/run-manifest.json \
BK_QA_OUTPUT=artifacts/launch-real-services-cleanup \
node --import tsx scripts/qa/run-real-services.mjs
```

The workflow always destroys the complete disposable stack with `supabase stop --no-backup`, removing baseline synthetic catalog/schedule fixtures as well. An aborted runner is not a passing cleanup receipt.

## Why full production validation remains gated

The current football `home` RPC settles expired matches globally, and its standings include every completed friend/private match. A synthetic completed match on production could therefore change real global activity even if its fixture is later deleted. No production run, auth user creation, migration, provider call, config change or deployment was performed by this workstream. Hosted staging requires an existing isolated project or an owner-approved paid branch; neither is provisioned here.

Primary implementation references checked: [Supabase local/CI stack](https://supabase.com/docs/guides/local-development/cli/getting-started), [Postgres Changes readiness troubleshooting](https://supabase.com/kb/troubleshooting/realtime-postgres-changes-troubleshooting), [CLI v3 change notice](https://supabase.com/changelog/supabase-cli-v3), [Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [Admin signOut](https://supabase.com/docs/reference/javascript/auth-admin-signout), [Admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).
