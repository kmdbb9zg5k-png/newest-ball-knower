# October 5 phone-recording gameplay fixes

Based on the 07:54 recording and production revision `c513bf8` (PR #442).

| Recording issue | Change |
| --- | --- |
| Stiff snap / read-option | Preserve the center stance through release, remove QB receive bob, use grounded QB exchange motion, and close option controls when the decision locks. |
| Awkward handoff | Shorter exchange, nonzero first step and exit speed, and a shared near-side ball pocket for QB/RB hands. |
| Both players tipping together | Articulate pelvis, knees and feet independently; keep distinct runner/tackler timing and actual rib targets. |
| Rigid blocking | Opponent chest targets, alternating hand resets and footwork, bounded push and rating-based shed windows. |
| Kickoff tackle stalls / skips | Complete contact and landing before returning to the next play; nearby players decelerate through the whistle. |
| Bunched pursuit / selected player runs away | Approach the catch landing point during flight, resume pursuit after stick release, choose an available defender, and separate pursuit lanes. |
| Contact camera swing / zoom | Keep the same chase offset and lens through contact. |
| CPU TD jumps to kickoff with unclear score | Hold at +6, show a real CPU extra-point snap and flight, then apply the result and start kickoff. Includes return touchdowns. |

Rendering work also reuses presentation/physics motion records and per-frame model transforms, avoids redundant arm solves, and draws the obscured playbook background at 8 Hz. Live action still draws on every display callback. Helmet assets and Combine source are unchanged.

## Validation

- `npm run lint`: passed.
- `npm run build`: passed; existing large-chunk warnings remain.
- `node scripts/check-complete-game.mjs`: passed 60 complete interactive-rules games, conversions, clock, final tries and overtime.
- `MODE=two-minute node scripts/check-recording-regressions.mjs`: passed 12 cases, including warmed snapshot reuse, mobile overflow and WebGL checks.
- `MODE=five-minute node scripts/check-recording-regressions.mjs`: passed 11 gameplay cases before the final allocation-only check was added.
- `MODE=five-minute node scripts/check-snap-contact-motion.mjs`: passed on the final rig: QB palms track snap target, tackles maintain rib contact, landings have distinct timing, unchanged HUD does not mutate text, and six jittered live callbacks produce six draws. No page errors.
- `BROWSER_PATH=/tmp/chromium ONLY_CPU=1 node scripts/check-contact-control-handoff.mjs`: passed CPU moving handoff in both modes (minimum exit speed 4.46).
- Reviewed rendered contact, blocking, exchange and CPU extra-point screenshots at mobile landscape sizes (844x390 DPR 2 and 1108x444 DPR 1). The CPU try has no empty kick-control panel.
- `git diff --check`: passed.

The regression fixtures are injected only by the local test HTTP server; no new production debug endpoints are added. Scripts accept `BROWSER_PATH` for a local Chromium installation and `OUT` for artifacts.

## Remaining device check

Software WebGL checks validate poses, continuity, controls and rules; they do not establish a physical iPhone frame rate or prove the recording's network conditions. On an iPhone, play a read-option give/keep, a defensive catch/pursuit, a kickoff tackle and a CPU scoring sequence in both modes. Confirm sustained motion during a longer session and the expected score after the visible try.
