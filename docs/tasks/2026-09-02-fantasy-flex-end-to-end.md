# Fantasy FLEX end-to-end correctness pass

## Goal
Make the standard fantasy FLEX slot fully correct from UI through server validation. This is a targeted correctness pass, not a redesign.

## Preserve
- Current black/gold fantasy UI and compact mobile density.
- Standard weekly starters: QB, RB, RB, WR, WR, TE, FLEX, K, D/ST.
- FLEX eligibility: RB/FB, WR, TE only.
- Existing weekly projections, lineup locking, IR exclusions, sticky Save Changes, Lineup Valid/Invalid, Optimize Lineup, and mobile FLEX/WRT containment.
- Existing server RPC authorization and exact lineup-slot contract.
- No Madden OVR as the decision metric for normal fantasy lineup optimization.

## Root gaps to close
1. `FantasyLeaguePostDraft.tsx` currently filters every other starter out of `swapOptions`. That prevents a manager from tapping FLEX and directly choosing an eligible player already starting at RB/WR/TE, or vice versa. A real lineup editor must allow dedicated skill slots and FLEX to exchange players without creating duplicates.
2. Shared lineup optimization in `fantasyLineup.ts` still defaults to `Player.ovr`, even though standard fantasy decisions must be driven by fantasy projections/rank/value. Replace that fallback behavior with a fantasy-safe deterministic comparator or make the optimizer accept a caller-provided fantasy comparator. Do not reintroduce OVR into normal fantasy lineup decisions.
3. Existing tests prove simple FLEX eligibility but do not prove starter-to-starter FLEX swaps, lock safety, no-duplicate behavior, or end-to-end client/server contract parity.

## Required implementation

### A. Centralize safe slot movement
Add a small pure helper in `fantasyLineup.ts` (or another focused fantasy lineup helper) that applies a requested player to a requested starter slot while preserving lineup validity.

Required behavior:
- If the requested player is on the bench and eligible for the target slot, place the player in the target slot. The prior target starter becomes bench/unassigned.
- If the requested player is already starting in another slot, support an atomic starter-to-starter move:
  - First try swapping the target starter into the source slot if the target starter is eligible there.
  - Otherwise, if the target starter cannot legally occupy the source slot, the requested player may move to the target and the displaced player becomes bench/unassigned, but only if this does not move a locked player or create a duplicate.
- Never allow the same player ID in two starter slots.
- Never move a player whose player ID is in `lockedPlayerIds`.
- Never displace a locked target starter.
- Never place QB/K/DST in FLEX.
- RB and FB must remain eligible for RB/FLEX according to the existing rules.
- WR and TE must be able to move between their dedicated eligible slots and FLEX.
- Return a structured result (`starters`, changed/not-changed, reason/error) so the UI can show a useful toast when a move is illegal.
- Keep behavior deterministic.

### B. Fix My Team swap sheet/options
In `FantasyLeaguePostDraft.tsx`:
- `swapOptions` for a selected slot must include eligible bench players AND eligible unlocked starters from other slots.
- Clearly exclude IR players.
- Respect locked player IDs.
- Use the centralized safe slot movement helper when the user chooses an option.
- Do not silently corrupt `starters`.
- Keep the existing mobile bottom-sheet styling and compact controls.
- After a legal swap, the UI should immediately show each player in exactly one place and `lineupChanges`/sticky Save Changes should update correctly.
- Saving must continue to run `validateWeeklyLineup` before RPC submission.

### C. Optimize Lineup must be fantasy-driven
- Preserve locked starters in place.
- Use selected-week fantasy projection first.
- Then use 2026 season fantasy projection/rank as fallback.
- If projections are unavailable, use deterministic non-Madden ordering (position/name/id or another neutral deterministic fallback), not `ovr`.
- The shared optimizer must no longer imply Madden OVR is a fantasy ranking.

### D. Client/server contract parity
Verify the client and `save_my_ball_knower_weekly_lineup` server contract agree exactly on:
- required slot IDs
- unique starters
- roster membership
- RB/FB eligibility
- FLEX = RB/FB/WR/TE
- K and DST restrictions
- bench non-duplication
- locked-lineup behavior

Do not weaken server authorization or validation. If the database contract is already correct, do not add an unnecessary migration; add regression checks against the existing contract instead.

### E. Regression coverage
Extend `scripts/phase2-deterministic-lineup-check.ts` or add a focused check covering at minimum:
1. Bench RB -> FLEX.
2. RB1 starter <-> FLEX starter direct swap.
3. WR starter <-> FLEX starter direct swap.
4. TE starter <-> FLEX starter direct swap.
5. FLEX RB -> RB slot where the displaced RB can legally occupy FLEX.
6. Attempt QB -> FLEX rejected.
7. Attempt K -> FLEX rejected.
8. Attempt DST -> FLEX rejected.
9. Locked source starter cannot move.
10. Locked target starter cannot be displaced.
11. No operation can produce duplicate starter IDs.
12. `validateWeeklyLineup` accepts legal FLEX lineups and rejects illegal ones.
13. Shared optimizer cannot be changed by Madden `ovr` when fantasy comparator/projection data says otherwise.
14. Existing server SQL contract contains FLEX eligibility `RB`,`FB`,`WR`,`TE` and exact standard slots.
15. Mobile UI still contains the FLEX row and the swap sheet remains reachable.

### F. Mobile QA
Run the existing browser/mobile regression at 375, 390/392, and 430 widths. Specifically verify:
- FLEX row label/action do not clip.
- FLEX/WRT matchup center label remains contained.
- swap bottom sheet stays within safe area.
- Save Changes stays reachable.
- no horizontal page overflow.

## Required gates
Run and pass:
- `npm run lint`
- `npm run check:phase2-lineups`
- `npm run check:fantasy-ui`
- `npm run check:fantasy-mobile-browser`
- `npm run check:hardening`
- `npm run build`
- `npm run check:root-bundle` after build so the 700 kB raw / 210 kB gzip initial-entry budget does not regress.

## Review / release
- Address valid Codex review findings.
- Do not merge with a known lineup correctness race or mobile regression.
- PR summary must state precisely which FLEX flows are now supported and what remains physical-device-only.
