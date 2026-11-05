# Fantasy release audit — November 5, 2026

This is a source-code and local regression audit. It does not certify production
provider coverage, live scoring, authenticated league writes, or physical iPhone
performance. Browser evidence and deployment status belong in the parent PR.

## Changes

- League cards use the available phone width instead of squeezing the controls
  into approximately 60% of a narrow carousel card. Draft/roster statistics remain
  available in a compact strip below; join codes and every destination remain.
- Readable fantasy metadata, 44px navigation/filter targets, visible keyboard
  focus and a 16px search input improve phone and keyboard use.
- Cheat Sheet provides a My Guys filter, clear empty-results recovery and a retry
  after a ranking request fails. Filter selections have accessible state.
- Malformed stored watchlists cannot crash rendering or star toggling. Duplicate,
  blank and non-string values are removed when restoring preferences.
- Watchlists now have account-scoped local caches, expected-account cloud reads
  and writes, serialized saves, and replay of edits made during restore. Account
  changes remount the fantasy session; late restores cannot replace the new
  account's state. The unowned legacy local cache is not imported into accounts;
  existing cloud watchlists still restore normally. Guest choices stay local.
- The create-league close control is labeled and sized for touch; the name field
  is explicitly associated with its label. Offline copy explains the user impact.
- Matchup Analyzer now explicitly identifies the scoring pause and saved totals,
  consistent with the post-draft league page.

## Blocking: real NFL fantasy scoring

The October 31 migration in commit `257995b` deliberately replaced the deployed
scorer with a schedule-only worker. This is not a disabled environment flag:

| Code | Current responsibility |
| --- | --- |
| `api/fantasy-live-scoring.ts` default export | Calls `createFantasyScheduleHandler`; legacy Tank01 ingestion is private/unreachable |
| `server/bk/fantasy-schedule-sync.ts` | Validates a 272-game schedule; only inserts missing games; preserves established game IDs, kickoffs and scores |
| `server/bk/nflverse-csv.ts` | Accepts schedule, roster, injury and finality-manifest URLs; no player/team statistics adapter |
| `fantasyLiveScoring.ts` | Existing scoring math and Tank01 normalization; not independent postgame ingestion |
| `scripts/fantasy-live-scoring-reliability-check.ts` | Tests scoring math and legacy normalization; a pass does not prove production scoring is active |

There is **no mostly completed independent scoring pipeline to turn on**. The
existing fixtures verify preservation, schedule completeness, legacy scoring
math and read recovery. They do not establish independent player/DST semantics,
identity coverage or complete final-game scoring. No scoring-provider calls or
production scoring writes were enabled by this pass.

The earlier feasibility audit in `BK_NFLVERSE_POSTGAME_SCORING.md` describes
nightly/delayed nflverse player and team statistics. Its recorded coverage and
unmapped-player counts are historical observations, not newly verified counts.
Required work before activation:

1. A bounded player/team statistics reader with a distinct cache namespace,
   schema validation and adequate deliberate size limits.
2. An explicit GSIS-to-existing-player-ID crosswalk. Conflicts and missing IDs
   must block the affected reconciliation; saved roster identities must survive.
3. A defined D/ST points-allowed policy, special-team/fumble TD accounting and
   blocked-kick handling validated against actual completed fixtures.
4. Final-game evidence joined to a sufficiently recent complete stats snapshot;
   missing player rows or fields must not be converted into zero scores.
5. Idempotent correction-aware writes and a shadow comparison over complete
   games across QB/RB/WR/TE/K/DST before any league is advanced or finalized.
6. Accurate delayed-score labels and a verified update/correction schedule.

A live provider is an alternative, but entitlement, budget, current-season
coverage and all required statistics must be verified before activation. The
existing free schedules feed cannot supply live player fantasy scores.

## Local checks

Passed: fantasy HQ gold/schedule regressions, fantasy UI system, fantasy
transactions, live-scoring math/read-recovery, scoring presentation and malformed
watchlist restore cases. Schedule-only worker checks cover fail-closed behavior
and preservation of score/lineup tables. The parent integration runs the final
typecheck/build and browser review; an overlapping standalone typecheck was
terminated by the environment with exit 137, without compiler diagnostics.

`scripts/fantasy-watchlist-session-check.ts` exercises delayed restore, concurrent
edits, ordered saves, account-isolated caches, abandoned responses, unavailable
cloud reads and guest-only storage using the actual hook with controlled promises.
