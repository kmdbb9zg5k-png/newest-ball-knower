# My Player — living career

## Player experience

- Recurring agent Jordan Ellis, position coach Marcus Reed, rival Dante Cross and
  captain Andre Brooks appear in illustrated/photo dialogue cards. Their messages
  reference trust, chemistry, agent confidence, previous performance and choices.
- The existing Combine story now introduces those relationships. Draft night adds
  agent updates, a shifting estimated pick range, notices when visited clubs pick
  other prospects, and a team-specific incoming call with camp expectations.
- Drafted and undrafted new-story careers enter training camp. Three locked
  evaluations combine an actual existing 3D position drill, a first-team audition,
  and a preseason spotlight. The latter two are new tactical field mini games.
  A fixed seeded rival benchmark and a published 80% performance / 15% trust / 5%
  chemistry formula decide the opening starter, rotation or development role.
- Camp and each regular-season/playoff game require a preparation choice and a
  conversation. Extra reps, film study and recovery trade immediate preparation
  against persistent fatigue. Replies balance the locker room, coach trust,
  agent confidence and exposure. Asking for the hardest assignment carries an
  additional trust loss if the player fails to deliver.
- Each weekly assignment has five timing-and-lane reps: QB pocket read, WR/TE
  reception, RB crease, EDGE/LB protection gap, or CB/S coverage. Touch and keyboard
  controls, coverage changes, wrong-lane misses, pause, background pause and optional
  short sound effects are supported. Effects default off and never replace music.
- Played performance adjusts team simulation ratings by at most three points and
  earns XP. The full game remains simulated. This is not a controllable 11-on-11
  career match or a voiced/animated 3D cutscene system.
- After the game, persistent coach feedback, reputation and recent tape can promote
  or demote the player. The role reaches actual roster flags and stat opportunities.
  Depth-chart swaps preserve roster size and position groups. A lone position slot
  updates its role flag without inserting or deleting players.
- The player card evolves with role, overall, reputation and relationships. The last
  twelve game evaluations are retained as a journal; total games/relationships persist.

## Compatibility and boundaries

No migration or service setup. New `careerLife` data is optional and versioned within
the existing My Player save, with a new `camp` stage. Legacy drafted careers without
a journey keep their original season entry. Existing seasons keep their current
behavior until the player explicitly enables Living Career; opt-in preserves the
season and earned role and skips camp. Old completed draft choices retain their
original scoring and IDs. No NFL data, full-game motion or Community scoring changes.

Career evaluations lock after the first complete session. Partial sessions may be
restarted, and no score/reward is posted by closing them. Game results consume their
prepared career turn once. Weekly keys include season, regular/playoff phase and
match index. This is local single-player progression, not server-verified competition.
Dante's camp benchmark is fictional and deterministic, not a second human/AI-controlled
athlete playing simultaneously. Player portraits use existing original Ball Knower
art; staff portraits are lightweight vector illustrations.

## Verification

- TypeScript and production build; existing chunk-size warnings only.
- Pure career checks: ordered/locked camp, tradeoffs, fatigue timing tolerance,
  promotion/demotion, duplicate reward rejection, save sanitation, opt-in, 63 games
  over regular seasons/playoffs/new years, bounded simulation effects, and roster
  slot preservation. A deterministic game counterfactual verifies the effect reaches
  the actual simulation, rather than only changing UI labels.
- Existing 96-case draft journey model, Solo full flow, franchise interactions,
  player-render preservation, Combine scoring, NFL data integrity and Community checks.
- Browser journey: 320/390/1280, saved draft cursor, drafted/undrafted paths, signed
  offer lock, progression into camp with season entry blocked until evaluations finish.
- Full actual 3D QB Combine: dash, jump, shuttle, bench, draft-story choices and
  saved outcome, older drafted save compatibility.
- Living-career browser: WR at 320px, EDGE at 390px, QB at 1280px; real EDGE bench
  session; two playable camp moments, weekly moment, wrong-lane failure, pause/resume,
  save/reload, first real team simulation, coach feedback and legacy opt-in. Additional
  complete tactical sessions cover RB, TE, LB, CB and S.

Browser coverage uses software-rendered Chromium, not physical iPhone FPS certification.
The tactical field is deliberately presented as a mini game; it does not claim that
its five reps constitute the full team game's individual stat line.

The compatibility browser also verifies the compact portrait at 320/390/1280,
legacy earned-role and roster-membership preservation, Selection Sunday into the
playoff career gate, a real playoff simulation and once-only callback, and keyboard
lane selection with a timed defensive swat. Role changes retain stable My Player
roster membership; the career-only synchronization preserves existing coached players
when only their order changes. Optional camp modal labels are correct on loading and
error screens as well as normal play.
