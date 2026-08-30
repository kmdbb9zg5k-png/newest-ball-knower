# Phase 0/1 implementation matrix

Baseline frozen on 2026-08-30.

- `main`: `6bc0dfa8450ac49fa3a6d307bba7c0f33dad4d6c`
- Vercel production: `6bc0dfa8450ac49fa3a6d307bba7c0f33dad4d6c` (`READY`)
- TypeScript, full hardening, Yahoo parity, and production build: passed
- Vercel runtime errors, previous 24 hours: none
- Physical-device-only checks remain excluded as listed in issue #151.

| Requirement | Current behavior | Target behavior | Files/systems affected | Database impact | Planned PR | Tests required | Risk |
|---|---|---|---|---|---|---|---|
| Franchise draft-pick ownership | Four local round numbers are removed after a trade, but offseason always gives seven picks and later years are not scoped | Year-aware pick assets determine which offseason selections each team owns and roll into later seasons | `RealTeamFranchise.tsx`, `FranchiseSeason.tsx`, solo save normalization | None; local save migration | Phase 1A | Save normalization, traded-away first, future-year rollover | High |
| Agent trade deadline | An open request can resolve after Week 9 | Mutation refuses work outside regular season Weeks 1-9; history remains visible | `PlayerAgentMode.tsx` | None | Phase 1A | Mutation and UI deadline regression | Medium |
| Picks spread sides/lock/grading/history | Raw spread is attached to home; one side; editable after kickoff; no grading | Canonical home/away lines, lock at kickoff, immutable locked line, idempotent W/L/push grading and history | `SportsbookHub.tsx`, picks helpers/save normalizer | None initially; local v3 save | Phase 1B | Home favorite, away favorite, pick'em, kickoff lock, repeat grading | High |
| Remove standard-fantasy salary checks | FA/waiver/trade RPCs still compare NFL salaries to league cap | Standard fantasy transactions ignore NFL salary fields | New append-only migration; transaction RPCs | New migration | Phase 1C | Migration markers, RPC auth/RLS, over-cap roster move | High |
| Trade deadline | Setting is cosmetic in server mutations | Proposal and resolution reject after configured week; pending deals cannot complete late | New append-only migration; trade RPCs | New migration | Phase 1C | Before/at/after deadline and pending trade | High |
| Acquisition limits | Settings are cosmetic | Count only successful adds transactionally by fantasy week and season | New append-only migration; transaction metadata | New migration | Phase 1C | Weekly/season boundary; failed claim excluded | High |
| IR capacity/cleanup | IR IDs do not free active capacity and can become ghosts | Active roster size excludes valid IR; activation needs room; outgoing IDs reconcile atomically | New append-only migration; fantasy roster UI calculations | New migration | Phase 1C | Full roster replacement, activation, drop/trade cleanup | High |
| Started-player scoring protection | Dropping/trading a started starter removes the player from live-score lookup | Current-week locked lineup snapshot remains authoritative while future ownership may change safely | New append-only migration; live scoring lookup | New migration | Phase 1C | Attempted drop/trade plus retained weekly points | Critical |
| Conditional waivers | Global `claim_order` can override FAAB/waiver priority | Compete per player using league rules while advancing each manager's conditional chain | New append-only migration; waiver processor | New migration | Phase 1C | Cross-manager fallback competition for priority and FAAB | Critical |
| D/ST Cheat Sheet | No D/ST ranking rows/filter; alphabetical fallback | 32 projection-aware team D/ST entries and D/ST filter | ranking API/data, `FantasyCheatSheet.tsx`, lineup intelligence | Likely seed/backfill migration or provider-derived rows | Phase 1D | 32-team coverage, filter, non-alphabetical projection ordering | Medium |

Phase 2 player detail, matchup pregame lineups, and projection rationale are intentionally not included until every Phase 1 PR is merged and production-verified.
