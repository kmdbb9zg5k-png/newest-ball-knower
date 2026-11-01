# Free schedules and Picks

This migration removes Tank01 requests from Picks and the deployed fantasy worker. It does not enable complete independent fantasy scoring.

## Picks

`server/nflPredictionFeed.js` reads the fixed nflverse schedules release through the bounded CSV reader. No API key or Tank01/NFLData fallback is used. The feed requires the 2026 schedule, all 32 teams, unique valid game IDs, valid dates and bounded numeric fields. It preserves unknown lines as null. A positive published `spread_line` means the home team is favored, so the board uses its negative for the home selection.

The source publishes game scores, `result` and `total` for played games. We treat a result as complete only when both nonnegative integer scores are present, the published difference and sum match, and kickoff is in the past. Completion also requires the exact game ID in nflverse’s released-game manifest, whose upstream publisher filters for FINAL status. The schedule publication timestamp must be at least as new as the manifest publication timestamp; older cached scores or missing publication metadata remain pending. Elapsed time alone never completes a game. This is a published-result feed with delayed updates, not live play scoring. Missing or inconsistent results remain pending. The manifest comes from the fixed GitHub Contents API using its raw CSV representation and Last-Modified commit timestamp. Its five-minute snapshot cache reduces requests; missing data, rate limits or outages leave results pending while schedule lines remain available. Picks are graded against each user's stored line.

Completion evidence: [publisher FINAL filter](https://github.com/nflverse/nflverse-pbp-internal/blob/main/auto/release_raw.R) and [released-game manifest](https://raw.githubusercontent.com/nflverse/nflverse-pbp-internal/main/released_games.csv).

Source documentation: [dataset definitions](https://github.com/nflverse/nfldata/blob/master/DATASETS.md), [update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html). Source retrieval and HTTP modification timestamps are retained across cache hits. The UI identifies **nflverse published lines**, with attribution; it does not claim live bookmaker prices.

Saved game IDs, pick IDs, original kickoff locks and locked lines are preserved. Explicit provider aliases or a unique saved away/home/Eastern-date match attach historical picks to the new board. Ambiguous or conflicting matches cannot create replacements or grade results. Changing a still-unlocked selection uses the existing stored game ID. Server verification remains authoritative; client-supplied matchup metadata cannot redirect a save.

## Fantasy schedule worker

The existing authenticated `/api/fantasy-live-scoring` route now runs a separate schedule-only handler every five minutes. The previous scoring implementation remains private and unreachable; no environment key activates it.

Before any game-table write, the new handler requires exactly 272 regular-season games, all 18 weeks, all 32 teams with 17 games each, no duplicate team/week or matchup, valid source identities and dates. Unpublished future kickoff times remain unknown. Existing rows match by season/type/week/away/home and retain their canonical IDs.

Only missing games with known kickoffs may be inserted. Existing kickoff times, statuses, finality, polling timestamps and history markers are never changed. A read-only comparison on 2026-11-01 found 272 existing canonical ESPN IDs, no inserts needed, and 24 future kickoff discrepancies (weeks 16–18); all existing values were preserved. These discrepancies remain a separate schedule-reconciliation task. Kickoff discrepancies are reported as `changedKickoffsPreserved`, not silently described as synchronized. This conservative first stage does not automatically apply flexible-scheduling changes to established rows. Insert conflicts are ignored rather than overwriting a concurrently created row.

No player scores, weekly league totals, projections, saved lineups, locked IDs, corrections or league progression are written. The fantasy UI explicitly displays a paused-scoring notice; unfinished totals are labeled Saved score while existing final results retain Final. New past games explicitly say statistics are unavailable and are not marked final. The response reports `scoring.available:false`, with history and progression paused. Calendar context is not an instruction to advance a league week.

Preview/local executions are dry runs; production can also request `dryRun=1` using the existing cron authentication. The source snapshot cache may refresh in previews, but fantasy tables cannot be written by that path. A source/validation/database-read failure preserves all existing scoring data.

## Cache separation

The shared reader keys parsed snapshots, in-flight work and failure backoff by parser namespace plus source URL. Existing public routes keep their default v2 durable key; Picks and the fantasy schedule parser use separate v3 keys. A cached game-display shape cannot be returned as a Picks or fantasy row.

## Remaining work

Complete independent player, kicker and defense statistics and a verified identity alias layer are still required before scoring can resume. Missing statistics must never become zero or allow week finalization. See `BK_LIVE_SCORING_SOURCE_GAPS.md`. Existing Tank01-derived historical provenance remains intact; this migration does not rewrite it or certify previously missing scores.

## Verification

Focused tests cover cache isolation, validated results/line signs, saved-pick identity/locking, schedule completeness, no-score-write behavior and emitted Node ESM imports. CI runs the Picks mobile browser harness and existing hardening checks. Deployment and route smoke evidence belong in the PR handoff; this document alone does not establish production status.
