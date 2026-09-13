# Solo player artwork audit and first repair

Baseline: main `71ac875c07b3901879ae1512bc6faa844ee0857f`.

**Not a completed visual overhaul. Do not merge this as reference-quality artwork.**

## Source inspection, one mode at a time

| Mode | Inspected implementation | Finding |
| --- | --- | --- |
| Cap Challenge | SoloMode.tsx, shared presentation/profile | Shared portraits and profile links exist. Hero still uses low-resolution face/body templates. Week-list names are plain text, not universally linked profiles. |
| Fantasy Draft / Solo Fantasy franchise | FantasyFranchise.tsx, soloFranchiseEngine.ts, FranchiseSeason.tsx | Draft rows and quick views use shared presentation. Season rosters/upgrades use the same unresolved artwork. Rookie IDs are stable, but that alone does not prove detailed or unique faces. |
| Franchise Command | RealTeamFranchise.tsx, FranchiseSeason.tsx | Shared roster and trade profile access exists. Uniform data is team-aware. Material quality and complete trade/season browser walkthrough remain open. |
| Agent Mode | PlayerAgentMode.tsx | Client labels used currentTeam, but portraits/profile links received the original database player. Repair now supplies a view-only copy with the current fictional team, keeping ID and ratings unchanged. Recruiting and negotiating views still need full visual review. |
| Owner Office | OwnerBusinessMode.tsx | Staff portraits use shared SoloPortrait. A narrative trade scene uses its own illustration. This is not a complete 53-player roster screen and must not be falsely counted as one. |
| My Player | MyPlayerStory.tsx | Still has a separate CSS-built body/face preview, optional selfie and optional AI-generated render. Not integrated into shared player artwork. Existing customizations must be preserved when replaced. |

## First repair scope

- Remove geometric hair/beard/eye-black overlays from the shared canvas and list portraits. Preserve saved style fields. Select photographic facial features together instead of covering them with shapes.
- Include every appearance field in shared dirty checking and render invalidation, including tattoo coverage, style and seed.
- Add working tattoo coverage/style controls and persistence checks.
- Mask tattoo ink to exposed skin using the existing material mask and body alpha; layer equipment afterward.
- Give creator portrait loading an image error fallback and lazy loading.
- Correct the Agent client profile's displayed team after trades without changing player identity or database objects.
- Extract production combine/trade-rule functions into browser-independent modules. The Node tests now import production logic instead of testing copied implementations.

## Checks

Local typecheck and production build passed. Ten focused checks passed: repair invariants, appearance, fictional universe, Solo Fantasy, Franchise interactions, trade rules, Agent recruiting/careers/growth, and Owner postseason.

The new repair invariant test exercises 1,696 players against 32 fictional team assignments, tattoo-only saves, material-mask pixels, and two rookie classes. These are functional/configuration checks, **not proof of 1,696 distinct realistic faces**.

The new browser test is intended to capture six entry screens and shared profile tabs at 320, 390 and 1280 CSS pixels, plus tattoo pixel changes and save/reopen. It does not assert that every career flow was traversed. Results and screenshots are uploaded by CI. Physical iPhone testing remains unverified.

The local managed Chromium denied navigation to the local preview (`ERR_BLOCKED_BY_ADMINISTRATOR`). No browser policy was changed; browser testing runs in the repository's isolated CI environment instead.

## Open visual release blockers

1. The shipped manifest still describes nine 96x120 face crops and one 149x448 body as an unapproved prototype. Replace these with suitable detailed artwork, not larger canvas dimensions.
2. There is no verified distinct-face library for the entire league. Preserve stable IDs; do not count hidden settings or gloves as unique faces.
3. My Player still requires migration to the shared system without losing saved selfies, body choices or career progress.
4. Numbers, uniform materials, tattoos, gear and body proportions still need a reference-quality rendering/asset pass.
5. Recheck profiles, drafts, rosters, upgrades, trades, game logs, generated rookies and Eli against actual rendered screenshots. Entry-page screenshots are not end-to-end signoff.
6. Verify Eli's requested height, explicit forty time and durability in production fields. Earlier descriptions are not evidence of implementation.
7. Replace the unrealistic total-art budget with separate thumbnail/profile budgets and measured lazy-load/caching checks, while retaining no runtime AI requirement for normal Solo viewing.

`solo-art-quality-gate.mjs` deliberately fails while the known prototype and separate My Player preview remain. A successful build or a nonempty canvas cannot override this release gate.
