# Game mode audit — November 1, 2026

This audit uses rule simulations, browser interaction checks, and screenshots. These are distinct: a completed simulation is not a completed rendered match. Continuing careers have season rollovers rather than a finite ending.

## Fixes
- Agent calendar now skips the condensed offseason to September of the next season; final offseason action says Begin next season.
- Franchise conference playoff home field follows seed. Malformed saved brackets are validated and can be rebuilt without dropping completed games or roster progress.
- My Player relationship metrics follow the content instead of intercepting weekly choice taps on narrow phones.
- Trivia now honors explicit zero-XP receipts and suppresses the perfect-round bonus for offline practice while preserving scores/accuracy. Verified rewards retain their existing behavior.
- Community minigame unsaved results require intentional discard; retries preserve the attempt and recap controls scroll on short screens.
- Older drill setup and formation exchange tests are being aligned with current behavior.

## Completed checks
- `npm run check:hardening-core`: passed, covering draft, fantasy, trivia, identity, community-related rules, careers, and release integrity.
- TypeScript and production build passed. Generated dist/artifacts output is excluded from source type checks to avoid scanning bundled test fixtures. Final TypeScript, trivia regression, and production build passed (22.84s); post-build all-four-tier trivia zero-XP and final one-on-one session also passed.
- Owner: normal UI completed creation, GM/coach hiring, 21 decisions, 17 regular games (9–8), Wild Card win, divisional elimination, 2027 rollover and reload/history. Auth and revisioned saves were mocked; no live account writes or verified reward claim.
- Agent: five full calendar cycles in regression checks; 28 real UI advance actions reached next preseason with corrected date, then reload/reopen restored the new season with no 390px overflow.
- My Player: post-fix built-app browser check at 320px passed recovery choice, commitment, persisted progress, no page errors and no overflow. Eight logic suites, including 96 draft scenarios, 63 game transitions, five seasons/85 games, decisions, contracts, transfers and Combine records. Browser reached rookie season after camp and preseason and reproduced the covered-choice defect.
- Franchise: browser completed 17 weeks (4–13), seven-round rookie draft and 2027 rollover with no page errors. Seeded qualifying-save browser checks also verified first-round bye, broken-bracket rebuild, real postseason game to elimination, and real championship game to final/offseason. Full roster/draft/17-game engine checks, interactions, save/navigation and seeded playoff hosting validation. See accompanying franchise notes.
- Football browser: fresh two-minute (23–34, 29 actions) and five-minute (0–21, 54 actions) games completed through normal controls, with live and user-selected simulated defense; no injected score/clock/outcomes in complete runs. Separate fixtures verified manual PAT/kickoff, FG/downs/safety, overtime, finals and rematch. Rules: 180 complete simulated two-/five-minute games, 75 flow paths, arena scoring, reference helmeted rig contact and ball-grip checks.
- Drills browser: dash, broad jump, bench, shuttle, eight receiving routes, RB and DB completed their full sessions with mobile controls, save/reset and failure-exit checks. All eight Combine drill sessions passed. Nine module suites, including 135 man-coverage reps, 120 DB reps and 336 RB reps. See accompanying drill notes.
- H2H browser: 390px complete official three-drive sequence passed: all 32 team selection, kickoff each drive, automatic transitions, source/token guards, exact retry, final comparison, history/standings, pending-result/cancel fixtures and 30-second guest matchmaking.
- Trivia browser: all four tiers completed 40 answers against the actual offline question bank after the fix; every round retained score/accuracy and awarded zero XP. Rookie reset returned to Question 1/Score 0; Back/Home worked with no page errors.
- Community: actual UI with mocked iframe completion passed failed save, retry, locked result, sharing, comparison and rematch. Trivia completion/idempotence and picks grading/locks passed.
- Narrow-screen tour captured Home/Fantasy/News/Picks/Community/Trivia/Profile/Solo/Agent/Owner at 320px before a later screenshot timeout.

## Limits
Concurrent 3D browser processes exhausted the test environment; runs were stopped and rescheduled sequentially. All eight Combine drill sessions passed. Continuing careers have no finite final endpoint, and every possible narrative branch is not certified. There is no physical iPhone performance certification. Dash and broad-jump browsers passed complete two-attempt sessions, saved results and reset, mobile layouts and failure exits. RB and DB browsers: five real-touch reps each through completion, saved results/reset and mobile layouts passed. DB includes swat and interception outcomes. No paid assets purchased and no Meshy changes made. Follow-up results will be recorded in this file or the pull request; this report does not certify that every mode is perfect.
