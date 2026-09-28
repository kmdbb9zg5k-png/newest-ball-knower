# Phone composition follow-up — 38

The second September 28 phone recording showed that keeping a receiver technically on-screen was insufficient. Rollout quarterbacks could overlap controls, the joystick was still hidden by CSS during flight, distant catches were hard to read, blockers looked static, and touchdown presentation stayed distant.

## Changes

- Live pocket framing follows the quarterback laterally, prioritizes his readable body size, and protects the lower control area. After camera damping, the projected player is checked against the actual joystick/move rectangles. Pre-snap formation framing remains unchanged.
- Flight moves toward a single closer receiving shot. Run framing settles sooner after possession transfer. Manual steering remains continuous.
- Keep the joystick visible during flight. Move the run/handoff instruction strip below the action, between thumb controls.
- Stagger the pocket into an arc, add bounded pair footwork and hand pressure, and keep shed/recovery logic from the previous pass.
- Preserve the initial catch pose against cut-animation replacement. A broken tackle briefly reduces running speed throughout its animation while preserving steering.
- Ease toward a close touchdown shot, extend the scorer's salute, and let nearby teammates react before the result dialog.

## Verification

Controller regressions now measure six left/right phone rollouts against control rectangles, require more than 10% viewport height for rollout quarterbacks and seeded catches, and require a readable celebrating touchdown scorer. Existing recovery, possession, throw, pursuit and framing checks remain. Real WebGL coverage includes visible joystick input in flight, catches, small-screen rollouts, blocking/contact sequences and a touchdown finish. The touchdown fixture relocates the field/camera together to represent reaching the goal line rather than teleporting the scorer away from the camera.

Build/type results, actual render review, and production verification are recorded in the PR. These are authored game motions, not a full physical blocking simulation. Physical iPhone/Safari performance still requires device observation; the tests cover specific scenarios rather than proving every possible play is visually correct.
