# Kicking camera and controls

Fixes the special-teams regressions in the September 30 recording and adds the requested touch controls.

- Extra points and field goals have a separate nine-blocker/holder/kicker formation, correct home uniforms, a kneeling holder, and a fixed camera facing the uprights. The kicker is offset from the right-hand UI.
- Kickoff coverage faces the receiving team; kick returns face upfield. Camera facing is established at unit entry, before movement, and flight tracking follows the current ball position rather than jumping to its destination. Live framing includes the controlled player and ball carrier.
- Tap a standing defender or coverage teammate on the field to control that player. Hit regions are at least 44 CSS pixels. HUD controls and drags do not trigger selection. Existing Switch and automatic selection on a CPU pass remain available; receiving retains control of the ball carrier.
- An independent analog stick moves the kick target; releasing it preserves aim. Goal kicks aim horizontally and vertically through the uprights. Kickoffs aim across and down the field. Start Kick starts timing; Kick releases. The gold meter zone is 65–90%; mistiming changes the actual trajectory. Scoring uses that trajectory, not a second random roll.
- Correct conversion/possession labels, one touchdown log entry, smaller conversion/result panels, no tackle controls during goal kicks, and no stale offensive down lines over special teams.

Validation:

- `npm run lint`: pass.
- `npm run build`: pass (existing chunk-size warning).
- `node scripts/check-mini-games.mjs`: pass.
- `node scripts/check-five-minute.mjs`: pass, including 90 seeded full games.
- `scripts/check-live-units-browser.mjs`: pass using Chromium with SwiftShader. Tests cover 844x390 and 667x375 layouts, goal-post visibility, analog movement/release, correct uniforms, made/missed kick scoring, camera direction, tap selection, defense, kick return, two-point tries, and returning to the full offensive playbook after a normal down. No page errors.

The earlier suspected offensive playbook regression did not reproduce; the existing return-to-playbook flow is now explicitly tested. Broad defensive coverage tuning and a general graphics overhaul are outside this controls patch. Browser checks emulate phone dimensions; physical iPhone GPU/touch performance still depends on the device.
