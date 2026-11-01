# Combine drill audit — 2026-11-01

## Completed rule and presentation coverage

These checks execute the production drill simulation/presentation modules. They establish bounded outcomes and session rules, not completed browser playthroughs or physical-device frame rates.

| Check | Result and coverage |
| --- | --- |
| `check-combine.mjs` | PASS: natural alternation, speed loss/recovery, idle/spam penalties, exact finish/splits, refresh-rate stability, ratings and storage isolation. |
| `check-agility-strength.mjs` | PASS: complete shuttle distance/cuts and bench reps, partial lifts/recovery, 30-second finish, corrupt/blocked storage. |
| `check-broad-jump.mjs` | PASS: full jump, missed launch/landing, exact timing boundaries, frozen results, two-input controls and persistence. |
| `check-receiver-routes.mjs` | PASS: all eight routes at 15–120 Hz, preview, manual motion, catch gating, complete session persistence, wrong/no input, delayed runners, guaranteed passes and frame-stall catch window. |
| `check-man-coverage.mjs` | PASS: 135 completed reps; clean catches, interceptions, breakups, bounded movement, no route mind-reading and isolated storage. |
| `check-db-drill.mjs` | PASS: 120 completed reps across all eight routes and 15/60/120 Hz; allowed catches, swats, picks, wrong/no input, preview and storage. |
| `check-rb-drill.mjs` | PASS: 336 completed reps across 15/60/120 Hz; timing, contact, handoff, cooldown, boundaries and storage. Outcomes: 172 tackles, 122 touchdowns, 42 out of bounds. |
| `check-db-swat.mjs` | PASS: native left/right/low swat windup, strike, follow-through, recovery and moving legs. |
| `check-rb-presentation.mjs` | PASS: native handoff/carry/juke/spin/stiff-arm/wrap/down, continuous ball grip, distinct linebacker and shaders. |

## Browser automation repairs

The older browser scripts assumed drills opened immediately and exposed a selectable athlete carousel. The current product opens saved-athlete setup and uses one My Player identity. Updated six scripts (bench/shuttle, broad jump, receiver routes, one-on-one, DB and RB) to click the real **Save & start** action and verify a nonempty athlete identity. Reload checks also re-enter through setup. DB/RB/one-on-one accept `BROWSER_PATH` consistently. Shared helper: `scripts/combine-browser-entry.mjs`.

All modified scripts passed `node --check`; `git diff --check` passed. These edits are test compatibility fixes. Completed browser runs are recorded separately below.

## Completed browser playthrough

`BK_DRILL_DIST=dist BROWSER_PATH=/tmp/chromium node scripts/check-rb-browser.mjs` passed on the static production build: all five reps through SESSION COMPLETE, scores persisted, New Session reset, 320/390/844 layouts, touch cancellation, simultaneous movement/actions, handoff and zero page errors. Contact and move screenshots were reviewed. Outcomes included tackles, spin/stiff-arm touchdowns and out-of-bounds. Controlled animation timing is used; physical-device FPS remains unverified.

A visible result-copy error (`1 broken tackles`) was corrected in `combine/RBExperience.tsx` for both rep and session summaries; gameplay and motion remain unchanged.

`BK_DRILL_DIST=dist BROWSER_PATH=/tmp/chromium node scripts/check-db-browser.mjs` also passed: five touch-controlled reps through SESSION COMPLETE, including swat and interception, saved result and reset, mobile layouts, pause/preview, pointer fallback, gating and zero page errors. Reviewed actual coverage screenshots. Fixed the observed `1 picks` session-summary typo in `combine/DBExperience.tsx`.

`check-dash-session-browser.mjs` passed two stride-control attempts through the full 3.8-second finish celebration, recap, saved splits and reset at three mobile sizes. The harness explicitly advances its virtual clock through the celebration; a prior result-selector timeout was a harness timing error. Recap screenshot reviewed.

`check-broad-jump-browser.mjs` passed using the actual realtime animation loop: one complete timed jump, one missed-launch attempt, landing colors, mobile layouts, pause, reset, persisted best after reload, and expected asset-failure exit. Landing screenshot reviewed.

`DRILL_FILTER=bench ... check-agility-strength-browser.mjs` passed two complete realtime 30-second bench sets (control-driven 8 reps, then no-input), pause, mobile layouts, reset, persisted best, asset-failure exit and zero errors. Result screenshot reviewed.

`DRILL_FILTER=shuttle ... check-agility-strength-browser.mjs` passed both complete realtime shuttle attempts, perfect/clean cuts (5.80s observed), no-input run, pause, mobile layouts, reset, saved best and asset-failure exit. Result screenshot reviewed.

`check-receiver-routes-browser.mjs` passed the entire eight-route session with 8/8 catches, actual joystick/catch controls, early buffered catch, delayed start, preview/pause, mobile bounds and zero errors. Final session recap screenshot reviewed.

`check-man-coverage-browser.mjs` passed the full five-rep one-on-one session on the final rebuilt production artifacts: four catches and one interception, actual touch movement/catch, preview/pause, mobile layouts, saved session, reset and zero errors. Final recap screenshot reviewed.

All eight drill modes reached their normal session end in browser runs: dash, broad jump, bench, shuttle, receiver routes, one-on-one routes, DB and RB.

## Validation limits and earlier harness failures

- The initial dash browser suite failed before gameplay because of outdated setup assumptions. It also still expects the old Meshy rig and athlete carousel; it is not repaired in this patch.
- An initial repaired RB run was killed with exit 137 during concurrent software-renderer/Vite resource contention. The later static-build five-rep run passed, as recorded above.
- `check-broad-jump-input.mjs` requires an independently running server on port 3000; that invocation failed with connection refused and does not count as passed.
- This covers complete representative sessions, not every combination of athlete, input and outcome. Dash/routes/one-on-one/DB/RB use controlled animation time; jump/bench/shuttle use the realtime loop. No claim of physical iPhone performance or flawless animation across all devices is made.
- Only RB and DB result pluralization changed in production; no purchased assets or motion code changed in this subtask. Existing gameplay checks found no confirmed regression requiring speculative motion changes.

Detailed execution logs are temporary at `/tmp/drills-audit/`; the coverage above is the durable handoff.
