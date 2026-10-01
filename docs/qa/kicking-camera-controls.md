# Kicking camera and controls

Fixes the special-teams regressions in the September 30 recording and adds the requested touch controls.

- Extra points and field goals have a separate nine-blocker/holder/kicker formation, correct home uniforms, a kneeling holder, and a fixed camera facing the uprights. The kicker is offset from the right-hand UI.
- Kickoff coverage faces the receiving team; kick returns face upfield. Camera facing is established at unit entry, before movement, and flight tracking follows the current ball position rather than jumping to its destination. Live framing stays near the controlled player with limited look-ahead toward the ball.
- Tap a standing defender or coverage teammate on the field to control that player. Hit regions are at least 44 CSS pixels. HUD controls and drags do not trigger selection. Automatic selection on a CPU pass remains available; receiving retains control of the ball carrier.
- An independent analog stick moves the kick target; releasing it preserves aim. Goal kicks aim horizontally and vertically through the uprights. Kickoffs aim across and down the field. Start Kick starts timing; Kick releases. The gold meter zone is 65–90%; mistiming changes the actual trajectory. Scoring uses that trajectory, not a second random roll.
- Correct conversion/possession labels, one touchdown log entry, smaller conversion/result panels, no tackle controls during goal kicks, and no stale offensive down lines over special teams.

Validation:

- `npm run lint`: pass.
- `npm run build`: pass (existing chunk-size warning).
- `node scripts/check-mini-games.mjs`: pass.
- `node scripts/check-five-minute.mjs`: pass, including 90 seeded full games.
- `scripts/check-live-units-browser.mjs`: pass using Chromium with SwiftShader. Tests cover 844x390 and 667x375 layouts, goal-post visibility, analog movement/release, correct uniforms, made/missed kick scoring, camera direction, tap selection, defense, kick return, two-point tries, and returning to the full offensive playbook after a normal down. No page errors.

The earlier suspected offensive playbook regression did not reproduce; the existing return-to-playbook flow is now explicitly tested. Broad defensive coverage tuning and a general graphics overhaul are outside this controls patch. Browser checks emulate phone dimensions; physical iPhone GPU/touch performance still depends on the device.

## October 1 camera, hand grip, and kick protection follow-up

- Lower, closer defense and kickoff cameras; extra-point/field-goal view stays behind the kicker and faces the posts. Flight no longer widens the view to fit the entire field.
- Only Tackle and Hit Stick appear on live defense. Tap selects a defender. Calling a defense starts a 2.5-second positioning window, then an automatic snap. Formation, pressure, line shift, play art and simulation remain on the call sheet.
- The QB pocket ball sits slightly forward of the two wrist joints instead of being pulled into the forearm/chest. CPU pocket animation now uses the same hand pose.
- Goal kicks have a timed snap and approach. Interior rushers engage assigned protectors, edges rush around the formation, and rating-based sheds can create penetration. Early-flight contact with a reachable ball produces a blocked kick and no points.
- Added browser assertions for actual line movement/engagement, a forced penetration blocking the ball, unchanged score after a block, two visible defensive buttons, and the skinned QB hand anchor.

Device limitation: automated checks use Chromium at iPhone-sized landscape viewports; a physical iPhone/Safari check remains useful for feel and performance.

## Contact and kick presentation follow-up

- Defensive calls now allow six seconds to select and position a player. The status displays a countdown; pausing freezes it.
- Tap selection pulses a thicker cyan ring. Live camera focus eases from the previous defender over 0.55 seconds, with the existing camera velocity limit retained.
- Defensive tackles, kickoff tackles and sacks now finish through a short wrap or shoulder-hit sequence before showing the result. The outcome/spot is captured once at contact. Controls and selection are suspended during the finish; the gameplay clock does not charge extra presentation time.
- Live-unit blocking uses stable pairs with a brief settling period, bounded rating-based push, and timed sheds. Run-support blockers cannot all engage the same defender. CPU pass blockers have unique assignments. Stationary block foot resets are smaller and share the same cadence as foot planting.
- Holder uses a grounded rear knee and planted front foot. Kick leg loads before release, reaches the ball at release, then follows through. Goal camera gently pushes toward the posts after launch. Blocking animation roles follow the assignment rather than home/away uniform.

Validation: typecheck/build, five-minute (90 seeded games), mini-game rules, athlete asset/locomotion, special-team joint geometry, and the mobile live-unit browser regression suite. Browser checks include delayed tackle results, continuity of switch-camera movement, six-second setup, made/missed/blocked kicks, score/possession continuation, and controls at 844x390 and 667x375. Physical iPhone performance remains untested.
