# My Player: Road to Draft Night

The playable Combine now sits inside an interactive, saved career story. The seven
committed decisions cover college origin, training camp, agent strategy, recovery
versus publicity, film accountability, an offensive/defensive interview, and a
private team visit. Three preparation decisions open the existing playable drills;
completed workouts open the remaining meetings. Scout responses, a chapter timeline,
coach trust, preparation, exposure, recovery, team-interest cards and a journal give
feedback. On phones, the story appears before the optional player identity panel.
The next chapter receives focus after a decision or after leaving a finished drill.

Decisions change actual mechanics:

- Training changes speed/power/awareness once. Speed reaches the playable dash;
  career power scales bench lifting/energy use. Other standalone/Community athletes
  have no career-strength value and retain the existing bench behavior.
- Workouts remain the main evaluation. The bounded story adjustment (−12 to +12)
  reflects preparation, trust, recovery risk and whether a publicity pitch is
  supported by the tape. Workouts cannot be replaced by choosing dialogue.
- Teams value different positions and strategies. A private visit increases that
  team's interest. Relationships can change the actual landing spot and pick.
- A stable seeded board runs 32 fictional clubs through seven rounds/224 selections,
  with a weighted 256-prospect pool covering skill positions, offensive/defensive
  lines and specialists. Team needs and repeated-position penalties influence picks.
- Draft night advances one pick, sixteen picks, or to the player's outcome. The
  evaluation freezes on entry; reloads restore the cursor without rerolling.
- Low stock can leave the player undrafted. Three camp offers permit a real team
  choice. Signing locks the choice and gates the rookie season.
- Preparation earns initial development points. Trust/fit/grade determine a starter,
  rotation or development path. These roles affect actual generated stat opportunities:
  starters every week, rotation in odd weeks, development every fourth week. Existing
  coach promises can create additional opportunities. Profile growth promotes roles
  at the displayed thresholds and reaches the live simulation; coaching gains sync
  back to new-story profiles after games without discarding development.

These are deterministic, local single-player game systems, not real NFL scouting,
contracts or probabilities. Team interest is explicitly a fit estimate. Fictional
clubs and created players remain separate from NFL data. New story careers use the
new opportunity rules; old drafted/season saves with no journey continue through
legacy presentation and simulation behavior. Existing saved workout marks are kept
when an unfinished Combine career enters the story. No database migration is needed.

## Verification

- TypeScript and production build passed.
- `node --import tsx scripts/my-player-journey-check.ts`: 96 position/seed scenarios,
  ordered choices, no duplicate rewards, completed-workout gating, actual team/pick
  counterfactuals, stable unique 224-pick boards, seven selections per club, frozen
  grades, undrafted offers, corrupt-save sanitation, role promotions, real defensive
  player stat inclusion, strength's bench effect and live rating merge behavior.
  In the final controlled fixture, identical 75-point workouts yielded pick 17 versus
  pick 86 under different decisions. This is a test example, not a guaranteed outcome.
- Updated `my-player-draft-combine-browser.mjs`: four actual 3D drills through normal
  controls, story choices, reload persistence, actual draft grade/round/OVR, draft
  outcome, older drafted save, and 320/390/1280 layouts. Passed with no page errors.
- `my-player-journey-browser.mjs`: actual MyPlayerStory at 320/390/1280, irreversible
  choices, once-only training, resumed draft cursor, drafted/undrafted branches,
  locked offer, rookie gate, earned development points, a coach decision and a real
  first-week simulation. Marks are seeded in this focused story fixture; the separate
  complete-workout browser test plays the drills.
- Existing Solo fictional-universe/full-flow, franchise interactions, integrity,
  shared My Player render, draft-Combine scoring, Community challenge logic/state,
  and default agility/strength checks passed. Non-career stat generation retains
  the original path when no career role/focus is provided.

Browser tests use software graphics, not physical iPhone FPS certification. The
complete workout playthrough uses QB; all eight supported positions have model
coverage, with offensive/defensive interview branches. Native 3D rigs and the existing
creator remain in use; no custom-face mesh or voiced cutscenes are introduced.

Screenshots: `origin-390.webp` is a fresh, unscouted career; `ready-390.webp` shows
committed choices and team interest; `outcome-1280.webp` shows the undrafted signing
branch. Player identity controls remain accessible below the story on small screens.
