# October 6 gameplay recording follow-up

Both Two-Minute Warning and Five-Minute Game use these fixes. The starting production commit was c2aba48 (PR #444); Combine, helmet geometry, uniforms and the normal running cycle are unchanged.

## Findings and changes

- Shoulder-to-shoulder defenders were rejected by the convergence check even within wrapping distance. Close body contact now allows an attempt; longer parallel approaches still require convergence. Ratings and failed tackles remain.
- Pass blocks continued after the QB escaped, and support blocks could hold indefinitely. Escaped rushers now pursue the carrier, support engagements have rating-dependent release times, and CPU run blocks release when beaten or left behind. A missed CPU defender no longer gives the runner a global tackle-immunity window against every other defender.
- Wrap, drag-down, low-wrap and shoulder-hit finishes now use distinct pelvis rotation, body lowering, leg placement and hand targets. Tackler and carrier have separate poses and timing. The landing test measures the actual rendered skeleton, not an action label.
- CPU throw follow-through was only advanced during the flight stage. Short completions could leave the QB in a throwing pose through the next stage. Follow-through now finishes regardless of stage, each catch explicitly clears previous ball owners/reach targets, and a released QB settles behind the play instead of joining the blocking scrum.
- Recording correction: Omaha's number 1 is its RB; number 9 is its QB. Number 1 receiving the handoff was correct. The regression test verifies that transfer rather than assuming an incorrect identity from the recording.
- The defensive camera now has more height, setback and a wider lens. Contact keeps that same defensive framing rather than switching to the close carry camera. Offensive-side orientation and kickoff flips remain.
- A trailing CPU uses final-drive play selection inside two minutes and keeps possession on fourth down outside field-goal range. Field goals that tie/win remain available. The same policy drives interactive and simulated games, with overtime handled separately.
- Landscape playbooks fit complete rows between the formation tabs and footer. Short phones show one complete row; taller landscape screens show two. The final row remains reachable by touch scrolling.
- Changed module URLs and HUD styles are versioned `contact-possession-57` to invalidate cached code.

## Verification

- `npm run lint` and `npm run build` passed.
- `check-oct6-gameplay.mjs`: both game modes; real snap/handoff possession, short-pass release/completion, exclusive ball ownership, Swat/Tackle stage labels, grounded contact variants, and fully reachable playbooks at 1108×512, 1108×444, 844×390 and 667×320.
- `check-full-game-transitions.mjs`: 2,172 transition frames across left/center/right handoffs and catches; ball/player visibility and bounded camera travel passed.
- `check-complete-game.mjs`: 60 complete interactive-rules games passed.
- `check-football-pursuit.mjs` and `check-football-flow.mjs`: pursuit, routes, blocking leverage, contact momentum and clock checks passed.
- Screenshots and the measured contact/layout report are in [qa/oct6-gameplay](qa/oct6-gameplay).

Browser checks use Chromium with mobile touch emulation and the shipped WebGL athlete. They do not certify physical iPhone/Safari performance. These remain authored contact animations rather than a physics/ragdoll engine.
