# 3D practice: player and motion refinement

This extends draft PR #301 only. It does not replace the production v3 playable moment, merge the pending viewport branch, or read/write career saves.

## Changes
- Eight role-specific body profiles: OL, DL, QB, RB, WR, TE, LB and DB.
- Tapered jersey/pad geometry, smaller shoulder caps, revised helmet proportions, chin straps, position-dependent facemasks and skill-position visors.
- Generated fabric/number textures, articulated pants stripes, sleeves, cuffs, cleats and ball laces. No external images, models or runtime APIs.
- A fixed-step presentation-only motion layer blends stance, running, blocking, turning, catches, throwing and falling. Distance advances the gait. Pausing freezes the pose. Running does not oscillate the whole character vertically.
- A two-bone leg solver preserves segment lengths and clamps unreachable targets rather than stretching limbs.
- Closer ball-carrier camera after possession; dead-ball camera holds the contact location until the next down. The pre-snap/passing fit logic is retained.
- Existing rules, run/pass play lists, save isolation and controls are retained. The gameplay tick is followed by a visual-pose update.

## Validation
Run `node scripts/check-play-moment-motion.mjs` for deterministic pose/geometry checks, then `python scripts/check-play-moment-3d.py 844 334` and `python scripts/check-play-moment-3d.py 932 430` with Playwright and Chromium installed.

The browser harness uses local Blob module URLs and the actual included geometry and textures. It samples 22-player rendering, shader errors, draw-call count, passing movement, QB framing, receiver throw, running handoff/movement, paused-pose freeze, pause/restart, sack/down reset and portrait recovery. It records external requests and screenshots. The headless launch explicitly removes DISPLAY to avoid an invalid X display selecting the wrong graphics backend.

A separate attempted two-contact touch-release test was inconclusive due to harness timeouts and is not part of the passing suite. No hardware multi-touch certification is claimed.

## Remaining limits
This is still a stylized procedural prototype, not photorealism or motion capture. Foot sliding, player intersections and simplified contact/coverage still need refinement. There is no ragdoll physics or new Spin/Stiff Arm system in this pass. Real iPhone/Safari checks and hardware frame-rate, memory and thermal measurements remain outstanding. Browser software rendering is not a phone-performance benchmark.

No Replit jobs, asset purchases or paid generation were used. Keep this work on the preview until review and device testing are accepted.
