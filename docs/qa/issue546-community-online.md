# Issue 546 — Community and online football

## Changes

- Public Community reads remain on the narrow preview RPC. Anonymous accounts no longer query block records or expose report/block actions; permanent accounts retain those controls, with account checks before and after moderation writes.
- Refreshes report busy state while retaining existing messages. People-search errors and selected-event errors have inline retries; failed event reads no longer remain labelled as loading. Competition deadlines update while the screen stays open.
- Quick match preserves the automatic 30-second fallback. Guests see an automated-practice countdown because the online football RPC requires a permanent account. Search, introduction, score strip and final screen label CPU practice; simulated scores no longer use human-style handles. Search failures offer retry or early CPU practice after the pending online queue is confirmed closed.
- Finished football drives, competition drills and mini-game challenge results retain the original token and exact received stats in account-scoped session storage until the server confirms them. Reopening retries the same result without replaying the game. An expired attempt deadline never changes a failed `submit` retry into a different `forfeit` action. Unfinished drives still cannot restart.
- Completed online scorecards stay intact when starting a new match. Friend rematches create a separate challenge; CPU rematches start a new practice scorecard. Pending opponent scorecards are reachable from the lobby and offer a refresh retry.
- Community and Football open the shared on-demand mode help.

## Verification performed

Passed locally:

```sh
node --import tsx scripts/community-session-recovery-check.ts
node --import tsx scripts/community-state-check.ts
node --import tsx scripts/competition-rules-check.ts
node --import tsx scripts/community-arena-check.ts
node --check scripts/community-reliability-fixture.mjs
node --check scripts/community-session-reliability-browser.mjs
node --check scripts/football-arena-browser.mjs
git diff --check
```

Changed TSX files were also parsed with esbuild. One initial `npm run lint` passed before the final changes; subsequent full checks were deferred to the integrated checkout to avoid concurrent heavy compiler processes.

## Browser proof to run centrally

For CUA inspection, start:

```sh
node scripts/community-reliability-fixture.mjs
```

Open `http://127.0.0.1:3066/community-reliability-qa.html` at 320 and 390 pixels. The default fixture has an active match and fails the first score save. Complete the fixture attempt, exit, then use **Retry saved drive 1** to recover the exact result. Other scenarios:

| URL query | Coverage |
| --- | --- |
| `?guest` | 30-second countdown, automatic CPU fallback, disclosure, three drives, practice rematch |
| `?scenario=search-error` | Failed online search, retry and safe early practice |
| `?scenario=late-cancel` | Cancel while queue creation is still pending |
| `?scenario=human` | Mock online player matched; no real player is connected |
| `?mode=competition&scenario=load-error` | Competition home/event retries, failed drill save, reopen and exact retry |

The approved remote browser runner can run:

```sh
node scripts/community-session-reliability-browser.mjs
node scripts/football-arena-browser.mjs
node scripts/competition-arena-browser.mjs
node scripts/community-arena-browser.mjs
```

The new reliability harness uses mocked APIs and iframe controls, writes screenshots plus `artifacts/community-session-reliability/report.json`, and covers 320/390 layouts. The existing football harness also exercises real football controls when run centrally. Neither this patch nor the fixtures prove two real users played, deployed Supabase permissions, physical iPhone performance, or a live deployment. No live data, invites, messages, schemas or secrets were changed.

Session recovery is limited to the same browser tab/session and account. If browser storage is unavailable, the result remains retryable while its dialog is open and leaving shows an explicit discard warning. The server continues to enforce immutable results, authorization and deadlines; local cache contents never grant online credit.
