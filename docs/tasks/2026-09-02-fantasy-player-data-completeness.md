# 2026 fantasy player data completeness pass

## Goal
Verify and harden the entire standard-fantasy player-data path so every draftable fantasy player has a trustworthy 2026 schedule/game-log experience and the log fills with useful position-specific actual statistics as NFL weeks are played.

This is an end-to-end data correctness pass: provider ingestion -> normalized stored weekly row -> permanent Ball Knower identity -> player detail -> mobile game-log table.

## Important existing architecture to preserve
- `ball_knower_nfl_games` is the authoritative saved schedule.
- A valid NFL regular-season schedule is 272 unique games and 17 games per team across Weeks 1-18.
- `fantasyPlayerDetailsCloud.ts` may synthesize schedule-only player rows only from a complete 17-game team schedule; otherwise it must fail closed/use the last complete cached schedule.
- 2026 player detail may show 18 week rows: 17 scheduled games plus one verified bye.
- `ball_knower_player_week_scores` is the weekly player history/scoring source of truth.
- Permanent `ball_knower_player_id` identity must win; bounded name variants are discovery only and must fail closed when provider identity is ambiguous.
- Pregame weekly projections must remain immutable snapshots with provenance once kickoff occurs.
- Missing stats/points must remain unavailable rather than being fabricated as zero.
- D/ST identity is team-based (`dst-<abbr>`) and must use team defense stats, not fake player rows.

## Gap already identified in current main
The current Tank01 normalization in `api/fantasy-live-scoring.ts` stores mostly scoring-only fields. It does not retain several usage/game-log stats the UI is designed to show, such as passing attempts/completions, rushing attempts, and targets. Also, `FantasyPlayerDetail.tsx` currently mixes legacy/default stat-key names (`passYards`, `passTd`, etc.) with the canonical normalized keys (`passingYards`, `passingTouchdowns`, etc.).

Fix this so the player log is a real fantasy research surface, not merely a points table.

## Required canonical weekly stat model
Expand the normalized weekly player stats while keeping the scoring engine backward-compatible.

### QB
Store when provider data exists:
- passingAttempts
- passingCompletions
- passingYards
- passingTouchdowns
- interceptionsThrown
- rushingAttempts
- rushingYards
- rushingTouchdowns
- fumblesLost when available

### RB
Store when provider data exists:
- rushingAttempts
- rushingYards
- rushingTouchdowns
- targets
- receptions
- receivingYards
- receivingTouchdowns
- fumblesLost when available

### WR / TE
Store when provider data exists:
- targets
- receptions
- receivingYards
- receivingTouchdowns
- rushingAttempts
- rushingYards
- rushingTouchdowns when applicable
- fumblesLost when available

### K
Store when provider data exists:
- fieldGoalsMade
- fieldGoalsMissed
- fieldGoalsAttempted (derive as made + missed only when those source fields are known)
- extraPointsMade
- extraPointsMissed
- extraPointsAttempted (same rule)

### D/ST
Store when provider data exists:
- sacks
- interceptions
- fumbleRecoveries
- defensiveTouchdowns
- returnTouchdowns
- safeties
- blockedKicks
- pointsAllowed

Do not invent provider metrics that are absent. Preserve scoring behavior exactly unless a correctness bug is discovered.

## Provider normalization
Update both shared/browser scoring normalization and the self-contained Vercel scoring route where necessary so they do not drift.

Tank01 naming can vary. Support the existing aliases plus reasonable known alternatives already present in payloads. Examples to account for when available:
- passAttempts / passingAttempts / att
- completions / passCompletions / cmp
- rushAttempts / rushingAttempts / carries
- targets
- fgMade / fgMissed
- xpMade / xpMissed

Do not use a generic `att` field without category context if it could be ambiguous.

Historical backfill and live materialization must store the same canonical stat-key names.

## Player detail / game-log presentation
In `FantasyPlayerDetail.tsx`:
- Make `STAT_LABELS` explicitly understand the canonical keys above.
- Make default position-specific game-log columns use the canonical keys actually stored by the scorer.
- Keep the table horizontally scrollable on mobile; fixed app navigation must not move with it.
- Prefer a stable, position-aware column order over choosing arbitrary top six numeric fields.
- It is acceptable to show a compact subset by default, but the user must be able to horizontally scroll to all required relevant columns for that position. Do not permanently throw away columns just because the table is narrow.
- Continue showing opponent/home-away, game status/result context where available, actual fantasy points, and projected fantasy points.
- A future scheduled game with no actual stats must show `—`, not 0.
- A verified bye must say `Bye` and must not look like a missing schedule.

## 2026 schedule guarantees
Add executable regression coverage around the existing schedule-selection/sync contracts:
1. Full provider schedule validation requires 272 unique regular-season games.
2. Every NFL team must have exactly 17 regular-season games.
3. A player's team schedule must have 17 non-conflicting unique weeks before synthetic 2026 rows are created.
4. The player detail representation may produce exactly 18 week slots only when one week is a verified bye.
5. Duplicate provider IDs for the same matchup must not create duplicate player schedule weeks.
6. Conflicting matchups in the same team/week must fail closed.
7. Team aliases LA/LAR, WSH/WAS, and JAC/JAX must remain canonical.

If the current code already satisfies these, strengthen tests rather than rewriting working schedule logic.

## Weekly projections and actual points
Verify:
- provider weekly projection snapshot wins when available pre-kickoff
- projection provenance/source is retained
- a derived season-projection pace is used only when the 17-game schedule is verified and no provider weekly projection exists
- bye projects 0 only when the bye is verified
- actual fantasy points are stored from actual stat rows and replace schedule-only placeholders
- final/corrected scoring can update the actual weekly row without overwriting the pregame projection snapshot
- open player detail refreshes and reflects live/final/correction changes

## Identity / trades
Player history must remain attached to the player across an NFL team change. Do not filter historical discovery by current team. Exact/permanent identity rules in `fantasyPlayerIdentity.ts` must remain fail-closed.

## D/ST
Explicitly verify 2026 D/ST rows for all 32 teams:
- correct team logo/identity
- opponent from team schedule
- weekly projection when available
- actual D/ST scoring stats
- points allowed
- actual fantasy points

## Tests / gates
Extend `scripts/phase2-player-detail-check.ts`, `scripts/player-history-identity-check.ts`, and/or `scripts/fantasy-live-scoring-reliability-check.ts` with executable assertions for the canonical stat model and schedule contracts.

At minimum test:
- QB attempts/completions are normalized and rendered
- RB carries/targets are normalized and rendered
- WR/TE targets are normalized and rendered
- K attempts can be derived without fabricating missing source data
- D/ST pointsAllowed and fumbleRecoveries are normalized/rendered
- canonical stat keys match the player-detail defaults
- 17-game team schedule -> one verified bye across Weeks 1-18
- incomplete/conflicting schedule -> no synthetic current-season log
- actual 0-point performance remains distinguishable from unavailable data
- no `ovr` is used to populate player game-log stats or fantasy points

Run:
- `npm run lint`
- `npm run check:phase2-player-details`
- `npm run check:player-history-identity`
- `npm run check:fantasy-live-scoring`
- `npm run check:fantasy-ui`
- `npm run check:hardening`
- `npm run build`
- `npm run check:root-bundle` after build
- mobile browser QA if player-detail markup changes materially

## Production verification
After merge/deploy, inspect production runtime errors. A full real NFL live -> final -> correction cycle remains a real-world verification gate and must not be falsely marked complete before an actual game provides that evidence.

## Completion standard
Every draftable player should have a useful 2026 schedule immediately when the complete NFL schedule exists, one verified bye, weekly projections where legitimately available, and a game log that fills with the correct position-specific actual stats and fantasy points as games are played. Missing provider data must remain visibly missing rather than being invented.
