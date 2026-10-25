# Combine field and football polish — October 25, 2026

Baseline: `cb13bd2fb48c1a66d9394a78efe01499c7b2a931` (PR #474).

## Changes

- Turf repeats now scale with field dimensions so the wide receiver/DB/RB fields retain the same grass density as the smaller sprint venue. Anisotropic filtering is capped to the renderer's supported limit.
- Yard striping uses yard spacing. Skill fields have brighter lines, yard numbers and NFL-width hash positions. All 192 hash marks share one instanced draw call.
- The 40-yard finish label is only shown in the dash, not unrelated drills.
- RB, WR and DB use the same detailed football: pebble-grain leather bump mapping, four panel seams and eight curved raised stitches. The original grip-space size and long axis are unchanged. Stitches and seams each merge into one mesh, adding two draw calls per ball rather than one per stitch.
- The existing background browser check accepts `BROWSER_PATH` so it can use an available Chromium installation.

Approved athlete assets, identities, rigs, motion, scoring, camera controls and full-game rendering are unchanged.

## Validation

- TypeScript and production build passed. Existing large-chunk warnings remain.
- 591 simulated reps: RB 336, DB 120, WR/man coverage 135.
- Native RB presentation checks passed for handoff, carry, juke, spin, stiff-arm, wrap and landing, including grip continuity and opponent identity.
- Receiver presentation checks passed for QB palm grip, stationary held ball, fixed flight path, continuous catch contact, stable carry and camera bounds.
- Five-rep RB browser session passed at 320px/390px portrait and 844px landscape: athlete selection, preview/pause, held touch, interrupted pointer capture, simultaneous action touch, completion, storage and reset.
- Real-time RB browser run passed using requestAnimationFrame and real touch events; five-rep WR/man-coverage session passed with catches, continued movement, pause, save/reset and no runtime errors.
- Shared dash/background test passed: 27 scouts, three waiting athletes, note-taking animation, independent appearances and graceful asset-load failure.

Actual browser renders: [RB field](qa/combine-polish-oct25/rb-field-phone.png), [WR catch](qa/combine-polish-oct25/wr-catch-phone.png).

These renders use headless Chromium and software WebGL; they are not physical iPhone FPS measurements. This is a focused Combine graphics release, not a claim of a completed full-app redesign or exhaustive device QA.
