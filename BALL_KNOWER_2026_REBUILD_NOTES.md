# Ball Knower 2026 Rebuild Notes

## Implemented in this rebuild

- Removed the legacy master roster registry from runtime authority so historical 2024/2025 migrations can no longer silently overwrite current team assignments.
- Added `src/data/currentSeasonRoster.ts` as a small, auditable 2026 correction layer.
- Synchronized the 32-team starting-QB table for the current 2026 preseason landscape.
- Added missing young QBs used by the 2026 dataset: Cam Ward, Jaxson Dart, Tyler Shough, Fernando Mendoza and Shedeur Sanders.
- Applied official Madden NFL 27 QB OVR values to the current-season layer.
- Corrected high-impact 2026 team movement for several players represented by current reporting.
- Replaced stale QB validation with the current 2026 starter table.
- Centralized draft position grouping (`LT/RT/LG/RG/C`, `FS/SS`, `NT`, etc.) so every valid positional alias counts correctly.
- Added salary-cap feasibility protection: a pick is rejected if it leaves too little money to complete the cheapest legal 20-man roster.
- Added a Ball Knower Score (0-100) to season standings based on wins, team quality, balance, efficiency and point differential.
- Removed hard-coded validation claims that could say the database passed even when it had not.
- Fixed a strict TypeScript issue in ratings sorting.

## Verification

Data/runtime modules pass strict TypeScript checking.
Database audit: 22/22 checks passing, 658 players, 32/32 teams with QB coverage, 32 starting QBs, every team has all required position groups, and zero duplicate player IDs.

## Recommended next build phase

- Replace browser-only localStorage leagues with a real backend/database.
- Replace simulated Google/Apple sign-in buttons with real OAuth.
- Refresh the full non-QB player pool against a current roster feed/source instead of relying on the legacy team files plus corrections.
- Add commissioner draft timer/settings and multiplayer synchronization.

## Phase 2 — Simulation integrity upgrade (Aug. 16, 2026)

- Replaced weekly random-shuffle scheduling with a round-robin scheduler designed to give each GM exactly 16 played games.
- Added rotating byes for odd-sized leagues instead of creating phantom extra games.
- Repeat matchups reverse home/away to reduce schedule bias.
- Game randomness is now seeded from the matchup + roster fingerprint. The same rosters no longer produce a wildly different champion just because the user clicked simulate again.
- Kept controlled upset variance, home-field advantage, trench matchups, coverage, pass rush, rushing and roster balance as outcome inputs.
- Current 2026 preseason reporting was re-checked before this pass; because NFL rosters are still in preseason cut-down mode, the full non-QB roster should be treated as a preseason snapshot until final 53-man rosters are set.
