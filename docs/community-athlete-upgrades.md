# Athlete and Community upgrades

## Where to find them

- **Community → Mini Games → My athlete & trophy room** shows the existing MyPlayer athlete, recorded combine marks, earned career trophies and a downloadable player card. The same locker is available from MyPlayer. Profile and season state use the existing cloud-state service; private uploaded portraits stay on the device.
- **Community → Mini Games → Crews, events & challenge nights** offers crew emblems/colors, captain controls, weekly three-drill cups, private captain-hosted nights, individual/crew standings and earned cosmetic badges.
- **40-yard dash practice → Ghost race** imports a friend's recorded input replay or races a saved personal best. Export from the result panel. After loading the game, racing the imported replay needs no network connection. Imported replays are casual, user-provided performances; they never submit official competition results.
- **Pause → Customize controls** changes movement-stick side, target size, vertical placement, optional vibration and visual frame rate in supported drills and two-/five-minute games. Preferences stay on the device. Vibration availability depends on the browser.
- Career position assignments now explain the actual result, scoring formula and next-session coaching cue. Existing replay, stadium audio and touchdown celebrations remain in use.
- Mini Games retain guest practice, saved-result cards, coaching cues, loaded-history rivalry records and accepted-friend rematches.

## Competition rules

Weekly events start Monday 00:00 UTC and finish seven days later. Captains choose exactly three distinct drills for a private event lasting 1, 3, 24 or 72 hours. Every drill contributes 0–100 points; higher totals win. Complete all three before the deadline to qualify for a finisher badge; tied first-place totals earn champion badges. Crew points use the top five contributions divided by five. Crew membership at entry is retained for that event.

The server checks permanent accounts, membership, supported result fields, deadlines and attempt tokens, calculates points and locks the first submitted result. Retrying the same saved result is idempotent. These are casual device-reported competitions, not server-simulated or independently verified esports results. All competitive athletes start with equal ratings; career upgrades only supply cosmetic identity.

## Verification and delivery

The PR contains dedicated logic and browser suites plus an additive Supabase migration. Browser coverage uses 320, 390 and 1280-pixel layouts, real WebGL where appropriate, and controlled API fixtures for UI retry/error cases. SQL integration fixtures run inside a rolled-back transaction. The workflow retains screenshots for review.

Physical iPhone frame-rate certification is outside software-rendered browser testing. Deploying the web branch and deploying an iOS binary are separate release steps; a passing build alone does not establish either is live.
