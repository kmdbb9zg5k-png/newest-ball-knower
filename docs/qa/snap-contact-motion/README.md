# Mobile motion review — 2026-10-05

The reported problems were uneven motion, a quarterback snap that lacked a receiving stance, and tackles that looked like two synchronized falls. This change applies to the two-minute and five-minute games. Combine and the helmeted athlete asset are unchanged.

## Changes

- Follow display callbacks in full games. The previous near-60 Hz gate dropped slightly early callbacks, producing an alternating cadence even when the browser supplied 60 callbacks per second.
- Use the existing balanced graphics tier on touch devices: 1.5 maximum pixel ratio and a 1024 shadow map. Detailed player meshes, textures, helmets, antialiasing, and dynamic shadows remain enabled. Desktop quality stays high.
- Retain HUD text nodes when their values have not changed. Solve each inverse-kinematics ancestor chain once instead of traversing it three times.
- Give the center a release pose and the QB planted feet, waiting palms, and a short two-handed gather. Shotgun and under-center snaps have different flight times. Offense and CPU defense use the same exchange function.
- Separate runner and tackler landing timing, maintain the defender's facing toward the runner, bend the defender's knees, and target the runner's actual rendered ribs during the wrap.

## Reproduction and checks

`scripts/check-snap-contact-motion.mjs` serves local-only scenario controls and exercises the real controller, skinned athlete, and render loop. It checks shotgun/under-center snaps, offense/defense wraps and big hits, ball/hand proximity, distinct landing timing, sustained wrap contact, HUD mutations, display cadence, and WebGL errors in both modes.

The before/after cadence probe supplies six alternating 16 / 17.333 ms callbacks. The old controller draws three; the revised controller draws six. Across 45 unchanged HUD updates, text replacements drop from 450 to zero. At an 844×390 CSS viewport and device pixel ratio 2, canvas pixels drop from 1,316,640 to 740,610 (43.75% less); the shadow map has 75% fewer texels. These are workload measurements, not a physical iPhone frame-rate claim.

Commands:

```sh
OUT=/tmp/bk-motion-review/verified node scripts/check-snap-contact-motion.mjs
FPS=5 KIND=run,pass,defense,return,field-goal OUT=/tmp/bk-motion-review/possessions node scripts/check-full-possession-presentation.mjs
npm run lint
npm run build
```

`performance-before.json` and `performance-after.json` record the reproducible workload checks. `motion-results.json` and `possession-results.json` record the browser checks. Review images are captures of the local game, not the user's recording.

## Limits

The browser checks use mobile Chromium with software WebGL. They do not establish a sustained frame rate on a physical iPhone or diagnose its connection. Production verification and repository CI status are recorded in the pull request. Existing unrelated repository workflow failures are reported separately from these focused checks.
