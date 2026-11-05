# Issue 546 — fantasy state and data reliability

Base: `b731939175b3ce5c79ad2f627c0c76ff19544546`. The #544 full-team-name Picks fix is preserved.

## Fixed behavior

- A realtime lineup refresh previously replaced local starter choices. Unsubmitted edits now survive while untouched slots receive the latest server assignments. Newly locked server assignments take priority, removed players are rejected, and reconciliation cannot duplicate starters. A different league, manager or selected week starts a separate draft.
- Kickoff locks now include bench players and are checked at the actual swap/optimize/save click, rather than depending only on the worker's last saved starter locks. Bench Start buttons explain their locked state. Existing started-bench drop rules are preserved.
- Null/blank/invalid projection and score values remain unavailable. Actual zero scores and explicitly available zero projections remain visible. Projection-only matchup fallbacks display a dash for actual points and require all nine starter slots before advertising a complete projected total or win chance.
- Fantasy standings and playoff readers reject explicitly unavailable/nonfinite totals instead of treating them as final zero-point results. Existing numeric aggregate totals remain usable when legacy per-player details are absent.
- The paused-scoring notice shows the latest stored score timestamp. A page refresh does not renew that timestamp. Partial sync failures identify the unavailable league datasets while keeping cached data readable.
- Picks identifies source publication separately from retrieval. A snapshot held open longer than fifteen minutes must refresh before another selection/submission; chosen picks remain intact. Click guards also evaluate the actual current time. Confirmed partial-submission receipts survive a later failed mutation and failed recovery read.
- Shared final-status handling recognizes overtime finals. The unreachable legacy scorer now rejects nonfinal box scores after a final snapshot, preserves final schedule labels, and does not synthesize a missing D/ST projection as zero. These fixes do not enable that scorer.
- A realtime channel rejoin now reloads authoritative league state. A pick made while a phone was disconnected no longer requires a subsequent row event to reach that phone. Removed subscriptions ignore late statuses and callbacks.
- Post-draft notifications open their draft, roster, matchup, results, trade, waiver or message destination inside the selected joined league. Owner-scoped read receipts cannot block navigation; another league's alerts remain hidden and late reads cannot populate a changed account/league.

## Scoring is a launch blocker

The deployed `/api/fantasy-live-scoring` entry point deliberately calls `createFantasyScheduleHandler`. Its only fantasy-table action is inserting missing schedule rows without overwriting existing rows. It cannot write player scores, weekly totals, projections, corrections, lineups or league progression. Its response reports `mode:schedule_only` and `scoring.available:false`.

The private `legacyTank01ScoringHandler` is unreachable: there is no environment switch that activates it. A retained RapidAPI key, a successful schedule request, or a successful build is not proof that current live player/kicker/DST statistics are available. The previous migration intentionally removed Tank01 calls; see `BK_FREE_SCHEDULES_PICKS.md`, `BK_SPORTS_API_INTEGRATION.md` and `BK_LIVE_SCORING_SOURCE_GAPS.md`.

No provider is enabled by this change. No provider account, subscription, credentials, production schema or league data was modified.

## Read-only postgame diagnostic

Run fixtures without network access:

```sh
node --import tsx scripts/fantasy-postgame-shadow-check.ts
npm run check:fantasy-live-scoring
```

Inspect the existing free sources, without credentials or database access:

```sh
node --import tsx scripts/fantasy-postgame-shadow-report.ts --fetch --out /tmp/fantasy-postgame-shadow.json
```

To reproduce from captured inputs, pass `--input saved-sources.json` instead. Its object has `players`, `teams`, `schedule` and `completion`, each containing CSV-parsed `rows`, an ISO `fetchedAt`, and nullable HTTP `sourceUpdatedAt`.

The diagnostic requests exactly four fixed public URLs with bounded bodies/deadlines. The player allowance is deliberately 16 MB, covering the previously recorded 2025 file that exceeds 8 MB. It checks GSIS/app identity collisions, active identity and position compatibility, canonical game/team joins, explicit completion evidence, source publication ordering, paired team coverage, and missing/invalid scoring fields. It computes candidate player arithmetic with existing app scoring rules. All outputs permanently retain `mode:read_only_shadow`, `scoringAvailable:false`, `live:false` and `writes:0`. Candidate arithmetic is not an activation certification. D/ST never receives candidate points while its policy remains undefined. Absent player rows never become zero scores. The command exposes no new web route, storage cache, provider switch or database writer.

### Observed public-source result

Read-only run at **2026-11-05 22:20:59 UTC**:

| Measurement | Result |
| --- | --- |
| Regular-season games represented | 121 |
| Relevant QB/RB/FB/WR/TE/K rows | 2,978 |
| Rows with mapped candidate arithmetic | 2,943 |
| Unmapped unique GSIS players / rows | 15 / 31 |
| Position-crosswalk conflict rows | 4 |
| Team-stat rows | 242 |
| Safe D/ST candidates | 0 |
| Player / team publication | Nov 5 17:23:44 / 17:23:48 UTC |
| Schedule / completion publication | Nov 5 22:16:30 / Nov 3 04:31:33 UTC |

Publication ordering was verified for this snapshot. Coverage is delayed/postgame; this observation is not live/final/correction proof for an active NFL game or a two-user league.

The unmapped GSIS IDs were `00-0030061`, `00-0032385`, `00-0034272`, `00-0031236`, `00-0033699`, `00-0029822`, `00-0031763`, `00-0033862`, `00-0034386`, `00-0036567`, `00-0036906`, `00-0036415`, `00-0036510`, `00-0037282`, and `00-0039750`. Riley Nowakowski (`00-0041398`, existing `ea-1845`) has four FB source rows while the app crosswalk lists TE. These are reconciliation findings; this change does not guess replacement identities or edit saved rosters.

## Concrete gate before scoring activation

1. Choose and verify either a supported current-season live source or an explicitly delayed postgame product. Public nflverse player/team statistics update after game days; they cannot support a continuous live-scoring promise. Confirm the permitted display/derived-output scope and request budget for any different provider.
2. Resolve D/ST points allowed and special-teams/recovery conventions. The existing `ptsAllowed` contract does not say whether opponent defensive scores and related conversions are excluded. Team CSVs do not supply that policy. Verify return TDs, blocked kicks, safeties, two-point plays and fumble recoveries against real event fixtures. Do not add total and component fumbles together. The shadow kicker candidate includes blocked attempts once among unsuccessful kicks; validate intended parity before using it for league scores.
3. Reconcile every GSIS/app identity exception without name-only fallback, retain historical saved IDs, and define how verified nonparticipation becomes a true zero. Resolve all missing required fields before a game/week can finalize. Projections need a separate supported source, or must remain unavailable.
4. Implement correction-aware, idempotent writes and atomic completion receipts in an isolated test database. Repeated snapshots must not duplicate corrections or finalize incomplete lineups; late nonfinal data must not replace a final snapshot. Compare default and custom scoring across every position, including D/ST, and preserve canonical game IDs and saved pregame projections.
5. Run an observed current-source pregame → active game → final → correction lifecycle plus an authenticated two-manager draft/lineup/transaction scenario. Record the exact deployment SHA and source timestamps. Keep the UI paused until those capabilities exist and the explicitly selected adapter is reviewed.

Primary references checked for this work: [nflverse update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html), [current calculation source](https://github.com/nflverse/nflfastR/blob/master/R/calculate_stats.R), [player dictionary](https://nflreadr.nflverse.com/articles/dictionary_player_stats.html), [team dictionary](https://nflreadr.nflverse.com/articles/dictionary_team_stats.html). The calculation source separates missed and blocked kick events and identifies special-teams TDs broadly; the diagnostic retains that remaining semantic uncertainty.

## Validation and limits

Passed: the expanded live-scoring reliability suite (includes both new executable diagnostics), phase-2 lineups, head-to-head matchup contracts, transaction correctness, Picks correctness, Picks screen/review contracts, schedule independence, and paused-scoring presentation checks. The actual SDK request/retry fixture remains included. An earlier TypeScript run passed; the root workstream will run the final integrated type/build gates to avoid concurrent build memory contention.

This child workstream did not run a local Playwright browser or claim physical-iPhone, authenticated multi-user, live-database, native notification or deployed scoring verification. The diagnostic's public-source read is distinct from fixture checks and live league testing. Final integrated mobile rendering and notification navigation require the root browser/CI pass.

The existing remote browser suites now include the expanded paused-scoring notice, notification destination/failed-receipt cases, and Picks stale-snapshot recovery/held-open expiration. Their JavaScript parses locally; execution remains a CI gate. The new reconnect callback fixture exercises the actual subscription adapter with a synthetic transport, not a real Supabase outage or two real users.

`scripts/fantasy-draft-reconnect-browser.mjs` is wired into the remote reconciliation workflow. It opens two isolated manager contexts around the actual draft UI, context provider and Supabase HTTP adapters, backed by one shared in-memory fixture authority. It tests a missed pick recovered from a rejoin status without a later event, rapid duplicate-click suppression, a rejected stale pick, refresh preserving the ledger, and two simultaneous expected-index timeout claims. Every HTTP call is intercepted and realtime statuses are controlled fixtures. Results explicitly label `realAccounts:false` and `productionWrites:0`. This harness was authored and syntax-checked here; its browser execution and the separate real-account integration gate remain outstanding.
