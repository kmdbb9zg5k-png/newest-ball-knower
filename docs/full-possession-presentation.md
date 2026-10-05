# Full-possession presentation repair

Follow-up to PRs #437 and #438, based on the October 4 recording at 23:53. The previous checks established functional behavior, but missed the miniature pocket view, incorrect ready poses, delayed scramble zoom, disconnected receiver controls and suspended contact bodies visible in a complete play.

## Root causes and changes

- **Player scale:** the old pocket fit expanded as receivers ran downfield. Scrambling then required a long camera recovery. The default shot now follows the quarterback at a fixed readable distance. Show Play and Adjust retain a wider formation overview. Carrying, catching and returning share a close follow distance; the independently bounded camera boom preserves the previous 7-unit/second zoom limit while position tracking can keep up with a long pass.
- **Ready poses and foot contact:** the generated idle clips contain raised arms and leg lifts even near their first frame. Ready stances now start from the neutral rig, with position-specific crouch, stagger, knee bending and planted feet. Engaged blockers use the same stable foundation. Idle quarterbacks no longer loop the unrelated generated gesture.
- **Motion roles:** live defense and special teams previously passed the outer `unit` phase into the shadow/pose pass and a different phase into drawing. A single semantic phase now reaches motion, pose, shadows and drawing. CPU offense also receives the correct blocking/route roles after possession switches.
- **Tackles:** the source tackle clip and whole-model fall previously compounded rotations. Authored contact now owns the fall, uses impact heading, separates tacklers beside the runner, and computes ground support from the current skeleton. Get-up motion eases back to standing.
- **Frame consistency:** current bones, hands, head and ground support are prepared even when mobile shadow maps are disabled. Previously, drawing could position the model using the preceding pose while diagnostics measured the newly calculated skeleton. This is why the earlier chest-height assertion was insufficient visual evidence.
- **Controls:** receiver badges use the actual animated helmet anchor. Clamped receivers show directional edge indicators rather than long detached tethers, and the 44-pixel buttons stay clear of the lower controls. Kick return follows the returner; home coverage follows the controlled defender facing the return, preserving control without fitting a whole kick into one miniature shot.
- **Special motions:** handoff, truck, spin, hurdle and free-rusher recipes avoid the same inappropriate idle/sprint flourishes. Kicking and holding have explicit poses.

Helmet/facemask geometry, team materials and skinned jersey printing are preserved. Combine and its dependencies are outside the diff. Simulation scoring, clocks, ratings, playbooks and career state are unchanged.

## Verification

Verification is in progress on this branch. Final results, rendered evidence and the production deployment/byte verification will be recorded here and on the PR before completion.

The new `scripts/check-full-possession-presentation.mjs` drives the actual simulation through run, scramble, pass, defense, return, coverage and field-goal sequences in both modes. It checks readable scale, usable framing, receiver hit areas and WebGL errors, and captures the complete sequence plus phase/contact frames for visual review. Scenario setup is injected by a local test server, never shipped.

Browser checks use local Chromium with mobile touch emulation, not a physical iPhone. The known live-browser proxy/TLS limitation is handled with Vercel READY status and exact trusted-HTTPS comparisons against the tested production build. TLS verification remains enabled.
