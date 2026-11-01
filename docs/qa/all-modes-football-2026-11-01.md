# Football audit — November 1, 2026

## Shipped full-game browser coverage

`BROWSER_PATH=/tmp/chromium OUT=/tmp/full-game-audit-final node scripts/check-five-minute-browser.mjs` passed against the actual public game source and reference athlete assets.

| Fresh game | Final | Normal-control actions | Opposing plays | Live defensive snaps |
| --- | --- | --- | --- | --- |
| Two-minute | 23–34 | 29 | 9 | 2 |
| Five-minute | 0–21 | 54 | 18 | 2 |

Both games reached the final recap with offensive statistics. These fresh-game loops used ordinary punt/kick controls, actual defensive snaps, and the visible optional **Simulate Play** button for remaining defense. They did not inject scores, clocks, positions, or outcomes. The QA driver advances the ordinary simulation clock deterministically, so this is not a physical-device real-time frame-rate benchmark.

Separately labeled situational fixtures verified a touchdown awards six, opens the conversion playbook, and awards the seventh point only after a successful manual kick; the following kickoff and actual defensive snap completed. Further coverage passed field goals, turnover on downs, safety, pause/resume, winning final recap, rematch reset, paired-possession overtime through a final, small landscape controls, and portrait rotation. Those situational cases explicitly use local test-server setup; they are not claimed as organically earned touchdowns or victories.

Artifacts: `/tmp/full-game-audit-final/report.json`, `two-minute-complete-final.png`, `five-minute-complete-final.png`, `defense-play.png`, `final-score.png`, and `small-punt.png` in that directory.

## Rules and rig checks

- `check-five-minute.mjs`: 180 seeded complete games across both full-game modes and all three difficulties; scoring, possession, timeouts, overtime, punts/field goals, and statistics.
- `check-football-flow.mjs`: 75 route, pursuit, protection, contact, pocket/camera, and render-cadence paths.
- `football-arena-check.mjs`: three-drive scoring, conversions, kickoffs, and arena/full-game separation.
- `check-reference-contact.mjs`: actual reference helmeted athlete tackle geometry, 360 carry samples, and six grip cases.

## Changes

- Replaced obsolete immediate-seven-point/automatic-defense browser assumptions with the current manual conversion and interactive defense flow. The old checker failed at a correct six-point touchdown.
- Formation exchange checker now inspects ownership when the exchange completes, rather than after a defender can already legitimately tackle the runner. Startup uses manual frames to avoid a free-running render loop during setup.
- Arena pause copy now says “Three offensive drives against your rival” without the leftover CPU label. Refreshed the HTML game-entry cache key. No gameplay or movement logic was changed.

## Formation, recap, and H2H browser checks

`check-formation-playbook.mjs` passed all 32 plays, four option branches, and three mobile viewports with no page errors. The final recap scroll check passed at 844×390 and 667×320: the last offensive-stat row and Rematch are both reachable, with the panel scrolling 196px. H2H browser verification also passed, as detailed below. Prior concurrent runs hit asset-readiness timeouts under resource pressure; successful full-game results above were rerun with a single renderer. No paid assets, new Meshy model, or physical iPhone performance certification.


`BROWSER_PATH=/tmp/chromium WIDTHS='[390]' node scripts/football-arena-browser.mjs` passed. The entry/results layout used 390px; the official gameplay viewport was 1000×500 landscape. All three official game iframes visibly completed their opening kickoffs and four normal Break Huddle/Spike plays, automatically advancing to the next drive and then the final 0–9 result with 12 offensive plays and three turnovers. QA game controls were absent from official frames. Wrong-source/token/drive messages were rejected; a failed save retried identical statistics/token. History, standings and side-by-side offensive comparison passed, including unavailable legacy opponent statistics shown as dashes.

Additional orchestration cases used lightweight iframe result fixtures and mocked RPC responses: pending-opponent completion, exit/pause during transition, cancellation races, the full 30-second guest search, a selected handle from the 50-name pool, and guest final recap. These do not certify production multiplayer transport or a real human opponent. This invocation did not rerun the 320/1280 entry-page variants; its output now reports the actual widths instead of overstating coverage.

H2H screenshots are in `artifacts/football-arena/`: `results.png`, `opponent-pending.png`, `guest-results.png`, `teams-390.png` and `lobby-390.png`. The kickoff-ready wait was increased from 45 to a bounded 120 wall seconds for software rendering; product timers, kickoff simulation, and scoring were not changed. The full official sequence completed successfully with one renderer.
