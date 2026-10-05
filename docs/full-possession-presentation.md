# Full-possession presentation repair

Follow-up to PRs #437 and #438, based on the October 4 recording at 23:53. The previous checks established functional behavior, but missed the miniature pocket view, incorrect ready poses, delayed scramble zoom, disconnected receiver controls and suspended contact bodies visible in a complete play.

## Root causes and changes

- **Player scale:** the old pocket fit expanded as receivers ran downfield. Scrambling then required a long camera recovery. The default shot now follows the quarterback at a fixed readable distance. Show Play and Adjust retain a wider formation overview. Carrying, catching and returning share a close follow distance; the independently bounded camera boom preserves the previous 7-unit/second zoom limit while position tracking can keep up with a long pass.
- **Ready poses and foot contact:** the generated idle clips contain raised arms and leg lifts even near their first frame. Ready stances now start from the neutral rig, with position-specific crouch, stagger, knee bending and planted feet. Engaged blockers use the same stable foundation. Idle quarterbacks no longer loop the unrelated generated gesture.
- **Motion roles:** live defense and special teams previously passed the outer `unit` phase into the shadow/pose pass and a different phase into drawing. A single semantic phase now reaches motion, pose, shadows and drawing. CPU offense also receives the correct blocking/route roles after possession switches.
- **Tackles:** the source tackle clip and whole-model fall previously compounded rotations. Authored contact now owns the fall, uses impact heading, separates tacklers beside the runner, and computes ground support from the current skeleton. A contact-length shadow and gentle three-quarter finish make the landing readable. Get-up motion eases back to standing.
- **Frame consistency:** current bones, hands, head and ground support are prepared even when mobile shadow maps are disabled. Previously, drawing could position the model using the preceding pose while diagnostics measured the newly calculated skeleton. This is why the earlier chest-height assertion was insufficient visual evidence.
- **Controls:** receiver badges use the actual animated helmet anchor. Clamped receivers show directional edge indicators rather than long detached tethers, and the 44-pixel buttons stay clear of the lower controls. Kick return follows the returner. Defense and home coverage follow the controlled defender facing the offense/return, preserving control without fitting an entire play into one miniature shot.
- **Coverage spacing:** live units now apply player separation every simulation step, with explicit block/tackle-pair exemptions and space around the prone body. This prevents trailing teammates from stacking on the same spot. The existing offensive and drill spacing behavior is retained.
- **Defensive participation:** an untouched selected defender previously stopped moving, causing repeated automatic switches as the runner passed each frozen player. The selected defender now continues pursuit until the user steers; manual steering takes over immediately and suppresses subsequent automatic run-phase reselection.
- **Special motions:** handoff, truck, spin, hurdle and free-rusher recipes avoid the same inappropriate idle/sprint flourishes. Kicking and holding have explicit poses.

Helmet/facemask geometry, team materials and skinned jersey printing are preserved. Combine and its dependencies are outside the diff. Simulation scoring, clocks, ratings, playbooks and career state are unchanged.

## Verification

Local verification completed on October 5, 2026:

| Check | Result |
| --- | --- |
| Complete rendered sequences | 14 scenarios passed: run, scramble, pass, defense, return, coverage and legal field goal in both modes |
| Camera transitions | 2,172 frames passed across left/center/right handoffs and catches; camera-boom movement remains bounded to 7 world units/second |
| Contact, catches and defensive control | 38 cases passed, including terminal tackles, manual pursuit takeover, three catch choices and eased kick-camera FOV |
| Rules simulation | 90 seeded complete games passed, plus 60 complete-game rule scenarios |
| Helmet equipment | Geometry, skeleton, all 11 clips and browser rendering passed; helmet GLB unchanged |
| TypeScript and production build | Passed with a 4 GB Node heap; existing chunk-size warning remains |

The 12 non-kicking sequences kept the controlled player in the usable view in all measured settled live frames. Minimum measured height ranged from 61.7 to 94.8 pixels at the tested viewports. Scale measurements exclude the first second of a scenario and the first 0.3 seconds after a control selection change. The final defense/return/coverage runs also enforce more than one meter of separation between standing teammates during settled contact.

The helmet asset SHA-256 is `1cbed522502b54ec2a77a5d219f29e2b5f7f44bfef5950e8f69541eb3fac3eb1`. No Combine files or dependencies changed. Deployment status and exact production byte comparisons are recorded in the release comment on PR #439.

Repository-wide CI is **not green**. [Baseline comparison](qa/full-possession/ci-baseline.json) records the existing failures against PR #438, including the failing assertions and workflow/job IDs. Both actionable PR review threads were fixed and resolved. The final head is checked again before merge.

The new `scripts/check-full-possession-presentation.mjs` drives the actual simulation through run, scramble, pass, defense, return, coverage and field-goal sequences in both modes. It checks readable scale, usable framing, receiver hit areas and WebGL errors, and captures the complete sequence plus phase/contact frames for visual review. Scenario setup is injected by a local test server, never shipped.

Browser checks use local Chromium with mobile touch emulation, not a physical iPhone. The known live-browser proxy/TLS limitation is handled with Vercel READY status and exact trusted-HTTPS comparisons against the tested production build. TLS verification remains enabled.

## Rendered evidence

- [Pre-snap before and after](qa/full-possession/pre-snap-comparison.jpg)
- [Two-minute pre-snap](qa/full-possession/pre-snap-two-minute.jpg) and [five-minute pre-snap](qa/full-possession/pre-snap-five-minute.jpg)
- [Run](qa/full-possession/run-two-minute.jpg), [pass](qa/full-possession/pass-two-minute.jpg), [contact](qa/full-possession/contact-two-minute.jpg)
- [Defense](qa/full-possession/defense-two-minute.jpg), [return](qa/full-possession/return-two-minute.jpg), [coverage](qa/full-possession/coverage-two-minute.jpg), [coverage contact spacing](qa/full-possession/coverage-contact.jpg)
- [Legal field-goal formation](qa/full-possession/field-goal-five-minute.jpg)
- [Complete-play review montage](qa/full-possession/two-minute-plays.mp4)
- [Full-play results](qa/full-possession/review-results.json), [contact/control results](qa/full-possession/contact-checks.json), [transition results](qa/full-possession/transition-checks.json)

The simulation advances at 60 Hz; the software-GPU review samples renders at 5 or 10 Hz. The montage contains five distinct frames per second (encoded at 10 fps with duplicate frames). It documents framing, poses and play progression, not native phone frame-rate performance.
