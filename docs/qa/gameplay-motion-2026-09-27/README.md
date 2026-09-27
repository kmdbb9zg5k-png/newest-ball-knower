# Gameplay motion repair

Baseline: `4afd606ed720b2e4cf872f8ea1b618c1b385ac42`. Release asset key: `football-finish-20`.

## Evidence

- [Continuous before/after comparison](comparison.mp4): the same shipped player, shader, speed (8.8 yards/sec), and view. Left runs baseline code; right runs the repaired code. These are isolated model renders, not an iPhone gameplay capture.
- [Stride sequence](stride-sequence.png)
- [Contact and recovery](contact-sequence.png): actors and ball positions exported from the actual game controller.
- [Snap, handoff and pitch](exchange-sequence.png): controller output rendered with the shipped skeleton and shaders.

## Root causes and repairs

1. GLB rotation samples begin at 66.7 ms and translations at 41.7 ms. Playing every loop from zero held the first pose. Normalize the moving sampler interval and remove endpoint drift, then cache 64 cyclic poses per clip. Use interpolated samples at runtime.
2. Resetting the sprint pelvis to its bind rotation while retaining its child leg rotations caused the high forward kicks. Preserve the lower-body coordinate frame; stabilize the spine in its parent's frame.
3. Arms, run, sprint, cut and procedural footwork had different phase clocks. Integrate one distance-driven stride phase, align left-foot contacts, blend gait by speed, and continuously warp turns. Skill states keep the same moving legs. Preserve hurdle tuck and stiff-arm reach.
4. Whole-pose transitions repeatedly froze the previous stride whenever a locomotion state changed. Locomotion now blends inside the shared phase. Non-locomotion/contact transitions retain their existing blend.
5. Ground correction forced the lowest foot onto the field every frame, erasing the flight phase. Keep collision correction while allowing bounded airborne motion.
6. The 60 Hz simulation was displayed without render interpolation. Interpolate position, heading, stride and ball presentation between ticks, using simulation time for animation. Restore authoritative actor references after drawing.
7. Handoffs fit unrelated receivers before a rapid zoom to the runner; tackles triggered a second backward zoom. Begin the tracking transition during the exchange and hold the shot through contact.

No changes to ratings, scoring, movement speed, pursuit outcomes, controls or other app destinations. Automatic running remains the default; manual mode remains available.

## Verification

Passed:

- `npm run lint` (`tsc --noEmit`)
- `npm run build`
- `node scripts/check-play-moment-athlete-v3.mjs`
- `node scripts/check-play-moment-replay.mjs`
- `node scripts/check-football-locomotion.mjs`
- `node scripts/check-football-presentation.mjs`: 2,676 real-asset poses; full two-stride sweeps across roles; ground, ball, contact and recovery checks.
- `node scripts/check-football-recovery.mjs`: four run concepts, sacks at three mobile viewport sizes, flipped exchanges, sideline finishes, successful catches, recovery, exhausted sprint, and the actual render-interpolation path without simulation mutation.
- `node scripts/check-football-pursuit.mjs`
- Mesa renders with production athlete shaders: zero GL errors.
- `git diff --check`

Measured gait sweep: maximum ankle travel 0.136 model units per 60 Hz frame, maximum forward ankle reach 0.293, maximum flight clearance 0.187, lowest support point 0.020. The test checks immediate loop motion, continuous wrap, acceleration, and the former 14.5-degree turn discontinuity.

Local CPU comparison, 120 frames with 22 moving athletes: baseline 3.63 ms/frame; repaired 3.02 ms/frame. This is a CPU pose-generation comparison on the execution host, not a phone FPS claim. An initial uncached implementation was rejected after it measured 17.74 ms/frame.

Handoff/pitch maximum ball travel: 0.262 yards/frame. Maximum nearest wrap-hand gap: 0.286 yards (run tackle), 0.356 (QB sack). Successful catch projection moved at most 1.07 px at the catch in the tested flows.

## Reproduce visual comparison

Use a separate checkout of the baseline so its relative module imports resolve:

```sh
git worktree add --detach /tmp/bk-motion-before 4afd606ed720b2e4cf872f8ea1b618c1b385ac42
node scripts/check-football-locomotion.mjs --render-dir /tmp/bk-motion-render --compare /tmp/bk-motion-before/public/play-moment-3d/meshy-athlete.js
python scripts/render-football-athlete.py /tmp/bk-motion-render
ffmpeg -framerate 30 -i /tmp/bk-motion-render/frames/%04d.png -c:v libx264 -crf 20 -pix_fmt yuv420p /tmp/bk-motion-render/comparison.mp4
```

## Research used

- [Khronos glTF 2.0 animation specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html): sampler intervals and quaternion interpolation.
- [Epic animation sync groups](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-sync-groups-in-unreal-engine): matching foot-contact phases when blending locomotion.
- [Epic pose warping](https://dev.epicgames.com/documentation/en-us/unreal-engine/pose-warping-in-unreal-engine): orientation and stride adjustment.
- [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/): fixed simulation with interpolated rendering.
- [Daniel Holden, Dead Blending](https://theorangeduck.com/page/dead-blending): transition continuity and why holding the outgoing pose can look frozen.

## Limits

Chromium downloaded successfully, but this execution environment rejects its process socket creation (`Operation not permitted`), preventing a full browser playthrough. The rendered evidence uses the real GLB, skinning, shaders and controller exports through Mesa; browser DOM/GPU integration and physical iPhone frame pacing remain unverified. Viewport/controller tests do not replace that device check. No claim of photorealistic or AAA animation is made.
