# PLAY MOMENT: isolated 3D practice preview

## Status and scope
Development preview, not a production replacement. Main gameplay, pending framing work,
Franchise results, existing saves, authentication, fantasy and the native build are untouched.
Open `/play-moment-3d-preview.html` on the preview deployment. This page is not linked from
production navigation. Practice results are held in memory only.

This replaces the visual technique, not just the CSS: a self-contained WebGL2 renderer,
22 original procedurally constructed helmeted bodies, articulated arms and legs, leg IK,
real ground-space field markings, a stadium bowl, camera-follow, and dark/light fictional kits.
It is a stylized 3D prototype, NOT photorealistic player art, motion capture, a Madden-quality
release, or a finished 22-player football simulation. Geometry/animation assets still need
an art-quality pass before replacing the live mode.

## Playable
Four run concepts (Inside Zone, HB Stretch, Counter, HB Toss), four passing concepts
(Mesh, Verticals, Flood, Dagger), touch steering and keyboard arrows/WASD, Sprint, Juke,
Manual/Assist running, X/Y/Z throws (keyboard X/Y/Z or 1/2/3), basic pursuit/blocking, handoff,
catch-and-run, bounds/tackles, sacks, down progression, pause, restart and a practice-drive end.
Space snaps; Escape pauses. No Stiff Arm/Spin, official players, career stats, save transfer,
replays, audio, advanced football rules, or multiplayer are claimed for this preview.

Gameplay balance now makes coverage readable instead of resolving every target with the same
coin flip: tight-window throws have a higher breakup chance, contested completions are called
out, engaged defenders cannot tackle through their blocker, pass pursuit contains automatic
catch-and-run touchdowns, and the Juke window/cooldown freezes when the game is paused.

## Resources and budget
All art geometry and textures are constructed on-device from the included source. No
CDN/library imports, model purchases, remote images, paid generation, or Replit jobs were used.
There is an initial same-origin page/module/CSS download. Gameplay requires no network
calls. Device CPU/GPU, battery and memory costs still exist. The 1.5x pixel-ratio limit,
instanced geometry and 1024x2048 field texture are initial limits, not performance certification.

## Validation
Local Chromium with actual WebGL2 (software SwiftShader) rendered the complete scene,
including the generated character geometry and field textures, at 844x334 and 932x430.
Passed: 22 players/11 per side, zero WebGL errors, 33 draw calls in sampled scenes,
passing positional movement, QB in frame at sampled pass time, target throw, run handoff
and movement, pause/restart, sack/next-down reset, portrait rotation pause/recovery,
receiver-key parity, coverage windows, pursuit balance, tackle grace and simulation-time jukes.
No outbound HTTP requests from the offline test harness. JS module imports were loaded as
local blobs because this environment disallows local HTTP browser navigation. Scripts passed
`node --check`. There is no real-iPhone/Safari certification or measured hardware frame-rate.

Reproduce after installing Python Playwright and an available Chromium build:
`python scripts/check-play-moment-3d.py 844 334`
`python scripts/check-play-moment-3d.py 932 430`
`node scripts/check-play-moment-gameplay.mjs`

## Gameplay controls

- Before a pass, use the left stick or WASD/arrow keys to climb, drift or escape the pocket.
- Tap a receiver badge for a bullet, hold briefly for touch, or hold longer for a lob.
- On a keyboard, use X/Y/Z (or 1/2/3); hold Shift for touch or Alt for a lob.
- The center bar becomes a live pocket-pressure meter during pass plays. Sacks are caused by rusher proximity and a collapsing pocket rather than a fixed timer.
- The four pass concepts face man, quarters, zone and robber behavior respectively. Defenders can undercut inaccurate, pressured or late throws for interceptions.
Set CHROMIUM_PATH/DISPLAY as required for your environment. Screenshot/check JSON results
are written outside the repository to /tmp/bk-3d-checks by default. The harness uses explicit
QA stepping for repeatable simulation checks; actual touch controls still require phone QA.

## Remaining release gates
Real iPhone WebGL testing, multi-touch behavior, thermal/frame-rate/memory profiling,
complete pass/run scenario coverage, proper game-quality rigs and animation, camera/icon
occlusion review, improved defensive realism, and a separate audited Franchise-result adapter.
Do not merge as a replacement for v3 until those gates and the visual review pass.
