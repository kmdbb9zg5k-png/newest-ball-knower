# Metal defensive playbook

Implements the approved dark steel and cyan defensive-call reference as responsive HTML/CSS and crisp SVG art. The reference's reversed Cover 2 Man/Cloud coverage labels are corrected; only one card can be selected. Existing formations, simulation, adjustment actions and live two-button defense are retained.

A card tap previews a call without leaving the menu. Call Defense confirms it, closes panels and starts a fresh six-second positioning interval. Adjustments groups Press, Back Off and Shift Line, with persistent selected states. Show Play opens a larger diagram with a coverage/rush legend and a close control. Escape closes either panel.

Validation:
- TypeScript lint and production build passed.
- Live-unit browser suite passed, including conversion kick/fakes, defense selection, adjustments, enlarged preview, manual call, auto-switching, tackling, kicks and returns.
- Inspected screenshots at 844x390, 667x375 and 667x320. Fixed scoreboard overlap discovered in the first visual pass.
- Follow-up focused browser check passed all three sizes: scoreboard clearance, contained cards, 44px or larger primary/secondary touch targets, single selection, no automatic countdown before confirmation, preview and adjustment operation; no page errors.
- No migrations or manual setup required.

Production smoke checks the deployed source bytes and loads them through a Node fetch relay because this environment's Chromium cannot directly reach the public origin. The relay does not substitute local game source. Existing QA touchdown/manual-frame hooks prepare the defensive possession.
