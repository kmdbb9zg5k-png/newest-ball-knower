# Validated scoring foundation and activation gate

The deployed `/api/fantasy-live-scoring` remains schedule-only. Neither an
environment flag nor this migration can invoke the retained legacy scorer.
No contract approvals, provider identities, production schema or production
scores are created by this workstream.

## Implemented contracts

`fantasy-canonical-scoring.ts` validates every required player/kicker/DST field,
retains true zero, rejects unavailable or inconsistent fields, and calculates
standard/half-PPR/PPR/custom scoring. Exact decimal arithmetic matches PostgreSQL
numeric rounding, including negative half-cent custom weights. Missing D/ST
points allowed cannot become a shutout. Unknown raw provider fields are excluded.

`tank01-scoring-adapter.ts` rejects conflicting game/player/team/position aliases,
name joins, ambiguous stat aliases and conflicting total/component two-point
counts. Fumbles lost cannot be replaced with total fumbles. Kicker made/missed
counts are explicit and available attempts must reconcile. No omitted category,
absent player or total fumbles field implies zero. Explicit nonparticipation is
accepted only in a final snapshot with an entirely zero canonical line.

A source contract must declare one verified publication timestamp basis. A
configured payload publication field that disappears cannot silently fall back
to an HTTP timestamp. Response Date and retrieval time never become publication
time. Active snapshots require publication within five minutes of retrieval;
final corrections retain their actual source publication timestamp.

The private identity registry requires source evidence, a bounded verification
expiry (at most seven days), and effective-dated team assignments. Former-team
and new-team evidence can coexist across a trade. Overlapping effective evidence
fails closed. These are explicit reviewed mappings, not a claim that an existing
public roster or similarly named player proves a Tank01 identity. Historical
saved app IDs are preserved; a conflicting existing identity trigger aborts the
whole write.

## Atomic database boundary

Migration `20261106021753_atomic_validated_fantasy_scoring.sql` adds private,
RLS-enabled source contracts, identities, poll attempts, state and receipts. It
inserts no approved rows. Only service_role can execute the invoker RPCs.

One commit RPC serializes the NFL week, locks the existing canonical game,
recalculates points in SQL, and writes player rows, corrections, complete weekly
totals, source state and a completion receipt in one transaction. A receipt
failure rolls back all those writes. Identical publications are idempotent;
changed data at the same source time is rejected; older data and nonfinal data
after a final are ignored. Repeated later publications with unchanged content do
not create stat revisions or duplicate correction audit rows. Names and mapping
metadata are excluded from content fingerprints.

Weekly totals require all nine valid, unique, owned starters and matching
position/team evidence. A bye zero requires the full 272-game/32-team/17-games-
per-team schedule. Final weekly totals additionally require verified final state
for every game in that week. Partial totals cannot finalize. Submitted lineups,
player projections and existing same-slot/player projection metadata (including
zero forecasts) are preserved. This worker does not assign default starters,
advance league weeks or alter playoff progression.

The prepared worker claims at most two boxes per run with separate private
attempt/backoff metadata, so an unavailable or unchanged game cannot permanently
starve later games. Claiming work never fabricates score/source freshness.
Provider reads have eight-second deadlines, 4 MB caps, no redirects/retries and
safe error codes; unknown-commit database failures are never retried.

**This two-box cap is deliberately conservative, and is insufficient for a
five-minute full-slate live promise.** The allowed subscription/request budget,
provider latency and observed slate throughput must determine an approved
polling configuration before connection to a production route. At a five-minute
cron, the absolute bound is 576 box requests/day, excluding the diagnostic.

## Separate lineup security fix

Migration `20261106023523_secure_fantasy_lineup_writes.sql` can be reviewed and
applied independently. It removes authenticated direct lineup DML while keeping
SELECT and the authenticated SECURITY DEFINER save RPC. The save RPC retains
per-player kickoff and same-slot locks, preserves an explicit full-lineup lock,
checks exact nine slots and typed/owned/unique bench entries, and permits
unstarted Sunday swaps after Thursday players lock. It does not require the
bench to include IR players or partition the entire roster.

## Evidence still required before scoring activation

The read-only readiness diagnostic is distinct from this writer. Primary Tank01
endpoint documentation confirms current-season live box scores, but public docs
do not establish sparse-category zero semantics, return/defensive TD separation,
complete fumble-loss/two-point coverage or the required D/ST points-allowed rule.
Provider default fantasy weights also differ from Ball Knower's defaults; they
are never treated as authoritative point totals here.

Activation still needs actual 2026 provider fixtures proving the identity
namespace and every scoring field; explicit D/ST exclusion/return/blocked-kick/
safety conventions; approved source publication basis; rare-event parity; live
cadence and request budget; an observed pregame → live → final → correction
lifecycle; and isolated real-service, real-schema two-manager validation. The
existing public-source 15-unmapped/4-FB-TE findings are not automatically repaired
by name matching. Projections need independently verified inputs.

A schema migration or successful fixture is not provider activation evidence.
Keep the public paused notice until those factual gates are met.

Primary references checked November 6, 2026:

- https://rapidapi.com/tank01/api/tank01-nfl-live-in-game-real-time-statistics-nfl/playground/apiendpoint_2b51b742-93f5-4185-ac4c-81729bf096c2
- https://www.tank01.com/Guides_Teams_NFL.html
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/reference/javascript/rpc
- https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes

## Validation

- `node --import tsx scripts/fantasy-scoring-readiness-check.ts`
- `node --import tsx scripts/fantasy-canonical-scoring-check.ts`
- `npm run check:fantasy-live-scoring`
- `psql -f scripts/postgres-fantasy-scoring-integration.sql`
- `psql -f scripts/postgres-fantasy-lineup-writes-integration.sql`

The standalone SQL fixtures use synthetic rows and roll back. They passed in
actual embedded PostgreSQL 18.6 via pinned `@electric-sql/pglite@0.5.15`.
`.github/workflows/fantasy-scoring-postgres.yml` separately targets stock
PostgreSQL 17; its remote result must be observed before claiming that platform
passed. Standalone fixtures do not certify the complete deployed triggers,
Supabase Auth/realtime, actual users or provider responses; the production-schema
real-services overlay is a separate integration gate.
