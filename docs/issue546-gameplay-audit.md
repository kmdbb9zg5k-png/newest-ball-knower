# Issue 546: gameplay, Combine and athlete audit

Baseline: `b731939175b3ce5c79ad2f627c0c76ff19544546`. Audit date: November 5, 2026.

## Reproduced defects and fixes

1. The Combine appearance cache omitted the immutable identity seed. Two athletes with the same selected hair/skin/ink options could inherit the previously selected athlete's seeded strands. A fresh load of the second athlete then produced different hair. A regression using the actual native mesh and head bones failed on the baseline. Hair now keys on immutable identity, hair style/color and facial hair. Selecting A → B → A, cosmetic identity aliases and fresh loads produce the same geometry for each athlete.
2. Skin and tattoo changes rebuilt the entire unchanged hairstyle. Those edits now update their uniforms while retaining the existing strands. A local CPU comparison of the same 40 alternating skin/ink edits measured 39 hair rebuilds in 418.4 ms before and zero rebuilds in 1.4 ms after. This is a single Node measurement, not an iPhone, GPU or FPS result. The committed regression checks geometry reuse and uniform updates rather than asserting a timing threshold.
3. RB, WR/man-coverage and DB movement matched only lowercase WASD. Shift/Caps Lock could drop movement, and changing a modifier before release could leave the original key held. A release after focus moved into a control was also ignored. The drills now share case-insensitive physical-key normalization and process releases after focus changes. Typing in controls still does not move the athlete. Arrows and RB actions remain supported.
4. The snap/contact browser harness still required the former `balanced` graphics default. Its expectation now matches the approved `high` default. Palm reach, paired contact, landing, HUD mutation and rendering-cadence conditions remain intact. The renderer itself is unchanged.

## Assets and behavior preserved

The current full games select `reference-helmeted-athlete-v1.glb`: 5,143,908 bytes, 45,935 triangles, 27 skin joints and 11 original clips. The Combine uses `combine-native-athlete-v1.glb`: 6,280,512 bytes, 50,000 triangles, 52 skin joints and Run/Walk/Idle clips. This pass changes neither asset, helmet geometry, approved running samples, football motion, team/uniform assignment, scoring nor arena result/exit bridges. It introduces no paid assets, asset-generation calls or database operations.

The current reference-rig contact test passes 14 contact variants/sides, 360 carry samples and six visible skinned-hand grip cases. Maximum measured visible finger-to-ball-tip distance is 0.0933 m; carry clearance remains above 0.1449 m. These are model checks, not a replacement for rendered motion review.

## Local validation

TypeScript and the production build passed. The production build retains the repository's large output chunks. `git diff --check` passed.

New focused checks:

```sh
node scripts/combine-input-check.mjs
node --import tsx scripts/combine-appearance-identity-check.mjs
```

Existing checks passed:

```sh
node --import tsx scripts/control-preferences-check.ts
node scripts/check-combine.mjs
node scripts/check-combine-motion.mjs
node scripts/check-rb-drill.mjs
node scripts/check-db-drill.mjs
node scripts/check-receiver-routes.mjs
node scripts/check-man-coverage.mjs
node scripts/check-route-camera.mjs
node scripts/check-broad-jump.mjs
node scripts/check-agility-strength.mjs
node scripts/combine-startup-check.mjs
node scripts/combine-loading-check.mjs
node scripts/check-football-flow.mjs
node scripts/check-football-foundation.mjs
node scripts/check-football-locomotion.mjs
node scripts/check-football-presentation.mjs
node scripts/check-football-pursuit.mjs
node scripts/check-football-recovery.mjs
node scripts/check-play-moment-motion.mjs
node scripts/check-reference-contact.mjs
node scripts/check-five-minute.mjs
node --import tsx scripts/athlete-build-check.ts
node --import tsx scripts/career-athlete-build-check.ts
node --import tsx scripts/athlete-tattoos-check.ts
node --import tsx scripts/athlete-wardrobe-check.ts
node --import tsx scripts/my-player-shared-renderer-check.ts
node --import tsx scripts/solo-appearance-check.ts
```

This includes 336 RB reps, 120 DB reps, 135 man-coverage reps at multiple tick rates, all eight receiver routes, 75 full-game route paths, 180 seeded complete full games, snap/handoff ownership, throws/catches, sacks, contact/recovery, get-ups, next-down/restart, clock/spot rules and failed-storage/download/context cleanup. Some older motion checks use the legacy Sentinel model; the reference contact test explicitly uses the actual helmeted full-game rig.

## Integrated browser review still required

No browser was launched from this workstream. The integration owner coordinates CUA inspection and remote CI. The following existing scripts cover current rendering and normal controls:

```sh
BROWSER_PATH=/path/to/chromium node scripts/check-combine-appearance.mjs
BROWSER_PATH=/path/to/chromium node scripts/check-rb-browser.mjs
BROWSER_PATH=/path/to/chromium RB_REALTIME=1 node scripts/check-rb-browser.mjs
BROWSER_PATH=/path/to/chromium node scripts/check-receiver-routes-browser.mjs
BROWSER_PATH=/path/to/chromium node scripts/check-man-coverage-browser.mjs
BROWSER_PATH=/path/to/chromium node scripts/check-full-game-appearance.mjs
BROWSER_PATH=/path/to/chromium node scripts/check-presentation-clock.mjs
BROWSER_PATH=/path/to/chromium node scripts/check-snap-contact-motion.mjs
```

Also use `scripts/play-game-review.mjs` for complete normal-control `record` and `realtime` sequences in both full-game modes if the integrated branch changes their motion. Inspect snap, exchange, pass/catch or carry, contact, landing and next-play transition together. Software rendering does not certify physical iPhone/Safari frame rate, memory or thermal performance. The shared native face mesh and its existing likeness limits are unchanged.
