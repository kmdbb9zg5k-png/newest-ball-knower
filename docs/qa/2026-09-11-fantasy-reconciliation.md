# Fantasy reconciliation and reliability — 2026-09-11

## Preservation baseline

Source snapshot: main `303f33f7c0e2d7a631ab2aeac1211d4b4ebe694c`. Old work was examined at #187 `3db2f4cfe07dbdcd6f4342e448ef23130d2d6356` and #188 `520726327485d556a3fa2ccc4ef6efdb198266ea`. Reconciliation is applied to current main after the separate worker-reliability PR, not by replacing main with either old branch.

## Changes

- Worker requests retain the timeout through response-body consumption. A new private database receipt and nonblocking per-worker lock make one bounded retry safe after an unknown/lost response. Mutation and completion receipt commit atomically. Unauthorized calls remain rejected; permanent/exhausted errors still return 503; logs include timing, attempts and a safe error code, not raw upstream details.
- The old draft-report engine is reconciled into the unchanged current base engine. Newer draft recovery, avatars, navigation and roster handoff are preserved. Reports explain strengths, risks, bench quality, pick value and projection confidence. Tiny projection differences no longer cause disproportionate grade/W-L swings.
- Shared and self-contained server scoring retain canonical usage metrics. Missing or invalid optional stats stay missing; kicking attempts require an explicit count or BOTH known made/missed counts. Existing scoring arithmetic is preserved.
- Current player details retain photos/credits, injury badges, ownership actions and 30-second updates. Position-first game logs no longer truncate at six arbitrary metrics. Canonical and legacy aliases do not double-count; actual zeros remain visible; 2025 history, verified 2026 schedules and captured pregame projections remain intact.

## Test evidence

Before changes, the local full `npm run check:hardening` gate passed on the pinned source snapshot.
After changes, `npm run check:hardening`, `npm run build`, and `npm run check:root-bundle` passed locally. Initial bundle: 680.96 kB raw / 201.88 kB gzip (limits: 700 / 210 kB).

New executable tests:
- `check:transaction-worker`: authentication/config/method guards, worker isolation, receipt-key preservation, lost-response recovery, bounded retry exhaustion, permanent failures, busy recovery, redacted diagnostics, and the actual Supabase response parser with a stalled response body.
- `check:fantasy-draft-report`: edge cases plus 36 combinations of six league sizes and six roster sizes, deterministic output, coherent projected wins, lineup/bench construction, value/reach evidence and rendered disclosure.
- `check:fantasy-player-data-completeness`: executes exact server/shared normalizers, legacy/canonical aliases, explicit zero and missing values, kicking attempts, position columns, complete/incomplete/conflicting schedule fixtures, D/ST, and preserved provenance/photo/action contracts.
- `scripts/postgres-transaction-worker-integration.sql`: disposable PostgreSQL test of receipt atomicity, rollback, permission boundaries, stale keys and cross-session advisory locking. Never run the stub-installing integration fixture in production.
- `check:fantasy-reconciliation-browser`: real completed-draft and player-detail components at 320/390/430 pixels, six manager cards plus summary, retained avatars, disclosures, season handoff, all six positions, 18 schedule slots/bye, 2025 history, trade actions and a live correction preserving pregame projections. All backend requests are mocked; no test-only route is included in production.

The existing full-app mobile browser gate remains in CI. Local Chromium navigation was denied by the container policy; it is not claimed as a local browser pass. CI and deployment results must be recorded on the PR before release sign-off.

## Deployment order and boundaries

1. Pass the new SQL/route tests and existing regression/build/mobile gates.
2. Apply `migrations/20260911_transaction_worker_receipts.sql` to the linked Supabase project BEFORE deploying the route that calls it. The migration is additive and does not change existing worker functions or user league data.
3. Merge the reviewed current-main PR, confirm its exact Vercel production SHA/alias, and inspect subsequent cron results and live endpoint responses.
4. The original source of sporadic transport/gateway timeouts has not been conclusively attributed. This change makes those failures bounded, diagnosable and safe to retry; a finite observation window is not proof that external outages can never recur.
5. Browser fixtures are not authenticated multi-user production tests, physical-iPhone/TestFlight tests, or a real NFL live/final/correction cycle. Keep those distinctions explicit in the release report.
