# QB throwing, rated movement and scrambling

Baseline: `23c9f745a5d7e75f3c85a67db131283c4f5ee3dc`. Release asset key: `football-finish-21`.

## Changes

- The old ball flight began before the arm moved, and the throw pose used flight time plus a high-point-catch clip. A separate delivery clock now controls a planted windup, shoulder turn, hand release and follow-through. The ball stays in the right hand until release. Bullet, touch and lob use 0.50, 0.56 and 0.62 second deliveries. A sack cancels the pending throw; pause freezes it.
- One speed-rating curve sets each player's maximum movement speed. Acceleration still controls time to reach it; cuts, stamina and football assignments affect how much of that maximum is used. Running animation remains tied to distance traveled. No roster or career ratings changed.
- SCRAMBLE, or keyboard G, tucks the QB's ball and activates runner controls, including sprint and slide. It preserves the selected automatic/manual running setting. Crossing the line of scrimmage still enters the existing manual-run behavior. A tucked QB cannot throw.
- A carry continues beyond the first-down marker, the former 16-second cutoff and clock zero until the play actually ends. The final spot determines the next first down; touchdowns still score normally. A scramble tackle behind the line is recorded as a sack.

## Speed model

Game balance values, in field yards per second; these are not claims about measured NFL player speeds. Ratings clamp to 35–99. Normal running uses 80% of the sprint ceiling, with common caps across positions and defensive pursuit.

| Speed rating | Normal run | Sprint ceiling |
| --- | ---: | ---: |
| 35 | 4.16 | 5.20 |
| 55 | 5.66 | 7.08 |
| 75 | 7.16 | 8.95 |
| 95 | 8.66 | 10.83 |
| 99 | 8.96 | 11.20 |

## Verification

Local checks passed: type check, production build, locomotion, real-asset presentation, controller/recovery, pursuit, camera framing, replay contract and diff whitespace checks.

The controller checks exercise all three throws, pause/sack during windup, five speed ratings in normal/sprint running, keyboard/button/line-triggered scrambles, a gain more than 12 yards beyond the marker, correct next-down spotting, a carry longer than 16 seconds, and a touchdown after clock zero. Existing handoff, pitch, successful catch, contact, recovery and camera checks remain active.

The real GLB pose sweep covers 2,787 poses. Across all three throws, maximum hand displacement is 0.133 model units per sampled step and release is at least 0.332 above the chest. Feet remain planted. [Throw poses](throw-poses.png) use the production athlete mesh and shader rendered with Mesa; zero GL errors.

Actual Chromium WebGL2 verification runs four separate scenarios in CI: automatic running, manual running, passing, and QB scramble. The scramble scenario uses a 667×290 touch viewport and checks that all three pocket buttons are visible, inside the viewport and at least 44×44. Passing checks windup ownership and release before continuing through catch controls. Browser results will be attached to the PR after capture review.

## References and limits

- [NFL FLAG throwing mechanics](https://nflflag.com/coaches/default/football-drills/how-to-throw-a-football): over-shoulder delivery, opposite-foot step, rotation and follow-through.
- [NFL FLAG quarterback drills](https://nflflag.com/coaches/default/football-drills/quarterback-drills): setting the feet and shoulders for pocket/rollout throws.

Physical iPhone frame pacing and touch feel remain unverified. Deterministic software-rendered browser captures establish game behavior and visual state, not device FPS. Previously documented legacy CI failures in old goal-line/gameplay/model fixtures and unrelated app-navigation tests are not treated as passes.
