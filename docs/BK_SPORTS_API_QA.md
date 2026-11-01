# Sports API independent QA — PR #522 / issue #527

## Verified in this checkout

- `node --import tsx scripts/bk-sports-api-security-check.ts`: passed 33 independent assertion groups. Covers invalid configured upstreams, literal/private IP targets, credentials and alternate ports, manual redirect refusal and approved GitHub release redirects, redirect loops, streaming byte caps/cancellation, a stalled response-body deadline, mutation-method rejection, client query isolation, uncached error responses, cache timestamp stability, and provider-secret redaction from responses/logging.
- `node --import tsx scripts/bk-free-upstream-smoke.mjs`: passed against the actual public upstreams using the production route handlers. It checks response metadata, source attribution, season, schedule/roster coverage, identities, kickoff offsets, scores and latest-week injury scope.
- The real-source run returned **272 games, 3,062 players covering all 32 teams, and 320 latest-week injury reports**. The respective source modification times were `2026-11-01T00:38:58Z`, `2026-10-31T13:38:13Z`, and `2026-10-31T13:34:02Z`. These describe the tested snapshots, not a promise about future updates.
- Raw roster inspection found 3,063 rows, 3,062 populated unique GSIS identifiers, no duplicate populated identifiers and no conflicting multi-team identifiers. One row without an identifier was excluded by normalization.

## Defects found and addressed during this pass

- The original schedule fetch rejected the redirect required by GitHub release downloads. Downloads now manually follow a bounded, explicit host allowlist.
- The original shared CSV reader followed arbitrary redirects and checked payload size only after buffering it. The shared downloader now rejects unapproved redirect targets, bounds decompressed bytes while reading, and uses one deadline across redirects and body consumption.
- Kickoff times originally omitted their timezone even though the upstream dictionary defines Eastern time. The schedule adapter now emits explicit UTC instants.
- The newly tightened injury parser initially required `date_modified`, which the actual 2026 CSV does not supply. The real-handler smoke caught its HTTP 503 response; that field is now optional, and the source's HTTP Last-Modified timestamp remains separate from retrieval time.
- Historical injury weeks were mixed with the latest report. The route now explicitly scopes results to the latest reported week and retains `live:false`.
- Errors originally inherited public response-cache headers. Failed/unavailable and rejected-method responses now use `no-store`.

- The baseline preview exposed API helper files as standalone routes returning HTTP 500. Helpers were moved to `server/bk/` so only intended handlers remain under `api/bk/`.

## Release boundaries

- This is local handler/network verification, **not a Vercel deployment verification**. A deployed preview must separately return the intended API response (not an SPA HTML fallback), then production must be checked after any merge/deploy. `vite build` does not execute serverless routes.
- News needs an authorized, configured JSON source. No current-news entitlement or license is established by these tests. The guarded news migration should remain disabled until its configured upstream and fallback are verified.
- The published CSVs are periodic data. A successful new download does not prove that the publisher updated every row recently. They do not replace live fantasy scoring or prove current player availability.
- Obvious local URL targets are rejected, and request data cannot choose the source. Configured provider hosts remain trusted configuration: this test does not certify DNS-rebinding resistance or arbitrary untrusted-host fetching.
- Durable database caching is opt-in and disabled during the network smoke so a cached snapshot cannot mask an unreachable upstream. Database migration/RLS execution requires a separate database validation; it is not established by mocked HTTP tests.
- This work does not change fantasy saved identities, league rosters, scoring receipts, or Tank01-backed fantasy/Ask BK paths. Mobile UI checks are reported separately by the application-integration workstream.

## Primary source checks

- [nflverse data update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html): schedules are periodically updated, rosters and injuries have their own update schedules.
- [nflverse schedule data dictionary](https://nflreadr.nflverse.com/articles/dictionary_schedules.html): source gametime uses Eastern time.
- Runtime smoke uses the same fixed nflverse release URLs as the production adapters. Source reachability is measured at execution time rather than inferred from old missing-file reports.

GitHub handoff: the coordinating engineer should include this report and both scripts in the existing PR #522 update and record the final repository/build checks there.
