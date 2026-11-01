# nflverse postgame scoring feasibility

Audit: 2026-11-01. Read-only provider investigation; this document does not enable scoring. Free delayed scoring is feasible, but the two statistics tables alone do not establish exact parity with the existing Tank01 normalization contract. No live scoring guarantee is available.

## Verified sources and coverage

- Player CSV: https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv — HTTP 200; 7,521 rows; 3,347,923 bytes.
- Team CSV: https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_2026.csv — HTTP 200; 216 rows; 88,483 bytes.
- Schedule CSV: https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv

Both statistics tables cover 108 games: weeks 1–7 and one game in week 8. All game IDs join to schedule rows with both scores populated. There were no duplicate game/player or game/team keys, and no blank values in the scoring columns below. Populated schedule scores alone are not proof of finality.

The [published update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html) describes nightly statistics updates after game days, with additional scheduled updates. Reingest corrections through Thursday. The [nflverse licensing statement](https://github.com/nflverse#licensing) identifies these non-FTN releases as CC BY 4.0, permitting commercial reuse with attribution. Retain nflverse attribution and identify Ball Knower modifications; do not import player artwork under the data license.

## Mapping to `api/fantasy-live-scoring.ts`

| App input | Current source field |
|---|---|
| Passing attempts / completions | `attempts` / `completions` |
| Passing yards / TDs / interceptions | `passing_yards` / `passing_tds` / `passing_interceptions` |
| Rushing attempts / yards / TDs | `carries` / `rushing_yards` / `rushing_tds` |
| Targets / receptions / yards / TDs | `targets` / `receptions` / `receiving_yards` / `receiving_tds` |
| Two-point conversions | Sum `passing_2pt_conversions`, `rushing_2pt_conversions`, `receiving_2pt_conversions` |
| Fumbles lost | `fumbles_lost_total` |
| Player return TD candidate | `special_teams_tds` |
| FG made / attempted | `fg_made` / `fg_att` |
| FG misses / blocked | `fg_missed` / `fg_blocked` |
| PAT made / attempted | `pat_made` / `pat_att` |
| PAT misses / blocked | `pat_missed` / `pat_blocked` |
| DST sacks / interceptions | `def_sacks` / `def_interceptions` |
| DST fumble-recovery candidate | `fumble_recovery_opp` |
| DST defensive / special-teams TDs | `def_tds` / `special_teams_tds` |
| DST safeties | `def_safeties` |
| DST blocked kicks | Sum `def_punt_blocks`, `def_pat_blocks`, `def_fg_blocks` |
| DST points allowed | Absent; requires a defined policy and additional data |

Primary semantics: [nflfastR calculation source](https://github.com/nflverse/nflfastR/blob/master/R/calculate_stats.R), [player dictionary](https://nflreadr.nflverse.com/articles/dictionary_player_stats.html), [team dictionary](https://nflreadr.nflverse.com/articles/dictionary_team_stats.html).

Before implementation, define these cases:

- `fg_missed` and `pat_missed` exclude blocked attempts. Penalizing every unsuccessful kick requires adding the corresponding blocked count.
- `special_teams_tds` includes special-teams touchdowns broadly, not exclusively kick/punt returns. `def_tds` excludes special-teams TDs. Do not add `fumble_recovery_tds` again to DST TDs.
- `fumble_recovery_opp` includes recoveries across units, so it is not intrinsically a pure defensive-unit statistic.
- For total points allowed, join the opponent's final score by `game_id`. Excluding opponent defensive scores and associated conversions requires play-level classification. The old adapter accepts `ptsAllowed` without defining that convention.
- Recalculate app scores from raw inputs; supplied `fantasy_points` does not include all app kicker/custom rules. Do not add component fumbles to `fumbles_lost_total`.
- Missing rows mean unavailable until participation/completeness is established; they must not silently become zero-point games.

## Identity crosswalk

Join source `player_id` (GSIS ID) to `gsisId` in `data/independent-football-inputs.json`; retain that record's existing app `id`. This file has 2,915 unique non-null GSIS IDs with no duplicates. For current QB/RB/FB/WR/TE/K statistics, it maps 553 of 564 unique players and 2,642 of 2,663 rows. None of those mapped players is inactive.

| Unmapped GSIS ID | Player | Exact-name legacy record, if present |
|---|---|---|
| `00-0030061` | Zach Ertz | None |
| `00-0032385` | Sterling Shepard | None |
| `00-0034272` | Marquez Valdes-Scantling | `ea-13366`, inactive |
| `00-0031236` | Brandin Cooks | None |
| `00-0033699` | Austin Ekeler | None |
| `00-0029822` | Brandon McManus | None |
| `00-0031763` | DeAndre Carter | None |
| `00-0033862` | Zane Gonzalez | `ea-12821`, inactive |
| `00-0034386` | Justin Watson | `ea-13322`, inactive |
| `00-0036567` | Elijah Mitchell | `ea-21629`, inactive |
| `00-0036906` | Khalil Herbert | `ea-21628`, inactive |

These require verified identity reconciliation, not automatic name matching. Preserve existing saved-roster IDs. DST uses normalized team abbreviations and existing `dst-${team.toLowerCase()}` IDs; normalize `LA` to `LAR`, `JAC` to `JAX`, and `WSH` to `WAS`. Preserve source `game_id` and the existing `nflverse:` game namespace.

## Finality and implementation limits

Paired team-stat rows corroborate coverage, but do not themselves encode final status. `calculate_stats()` can aggregate a custom PBP subset into the same schema and does not itself enforce a final-game filter. Do not treat row pairs or numeric schedule scores as an independent finality assertion.

The upstream [raw-release pipeline](https://github.com/nflverse/nflverse-pbp-internal/blob/main/auto/release_raw.R) and its [released-game manifest](https://raw.githubusercontent.com/nflverse/nflverse-pbp-internal/main/released_games.csv) are the explicit finality evidence to evaluate: the release filter requires a score and status matching `FINAL`. A runtime adapter should require matching explicit completion evidence before settling Picks or declaring fantasy games final, fail closed when that evidence is unavailable, and retain correction handling. This audit does not enable or certify that adapter.

The [team-stat publisher](https://github.com/nflverse/nflverse-pbp/blob/master/R/update_stats.R) calls `calculate_stats()` with the default published PBP input; the [PBP publisher](https://github.com/nflverse/nflverse-pbp/blob/master/R/update_pbp.R) verifies expected game counts before publishing. This supports the postgame provenance, but the team table still contains no final scoreboard. Completion evidence must not be combined with an older cached partial schedule score: refetching the schedule removes the local-cache race but does not, by itself, prove that the upstream schedule has caught up. Prefer scores from a completed-game artifact or explicit verified publication ordering before settlement.

`server/bk/nflverse-csv.ts` currently rejects both statistics URLs. Its 8 MB limit is also too small for the repository's recorded 2025 weekly-player file (8,656,387 bytes); use a deliberate bounded allowance and cache parsed results once per refresh. Implement delayed availability labels, schema/identity checks, idempotent correction-aware upserts, and regression tests before replacing the schedule-only route.
