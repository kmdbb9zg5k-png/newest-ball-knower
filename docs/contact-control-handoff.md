# Contact, defensive controls and moving handoffs

Follow-up to the October 5 01:15 phone recording and PR #439. The improved offensive pocket view remains; this change addresses the remaining tackle, defensive camera, interception and exchange complaints in both full-game modes.

## Root causes and repairs

- **Selected defender:** the AI tackle loop explicitly skipped the controlled defender, so touching a runner did nothing without a button press. The controlled defender now attempts a wrap within 1.22 world units, with rating-based success and the existing cooldown. Manual tackle and hit-stick buttons remain. A failed attempt uses a brief standing reach/recovery, not an immediate fall.
- **Pass defense:** the existing flight actions were mislabeled Tackle/Hit Stick and only resolved at the destination. They now show Swat/Intercept, accept a 0.85-second timing window, and test the current ball position within arm/jump reach. Unreachable high passes cannot be picked. A successful pick assigns possession to the defender; catching still depends on ratings.
- **Contact animation:** immediate whole-body falling and heading changes hid the actual tackle. The new sequence preserves approach facing, closes the gap, reaches around the runner, stays upright for the initial wrap, then turns and falls. Hands target the runner while the carrier tucks the ball. Current skeleton support grounds the landing. The same progression drives body orientation and shadows.
- **Handoffs:** the old eased path stopped at the exchange before restarting in the run phase. A continuous path now meets the quarterback with a nonzero outgoing velocity, then carries that velocity through possession. CPU handoffs use the same path and actual formation positions; snaps reach the actual QB. The reference renderer now honors handoff ball targets, which it previously ignored.
- **Camera direction:** kickoff/punt coverage flips to the receiving side on release, and defense faces from the offensive side. Defense fits the selected defender and the ball actor with a tighter lens. Released quarterbacks do not hold the camera back. Coverage retains a wider returner view until the coverage team closes; the close contact shot follows the tackle.

No Combine files or dependencies changed. Helmets/facemasks, jersey materials, and the offensive pocket camera are preserved. Helmet asset SHA-256: `1cbed522502b54ec2a77a5d219f29e2b5f7f44bfef5950e8f69541eb3fac3eb1`.

## Verification

- [30 targeted checks](qa/contact-control/control-checks.json): both modes, automatic run tackles and sacks, outside-reach/missed attempts, actual Swat/Intercept buttons, high-ball rejection, wrap/landing, CPU handoff, and six offensive concepts including option keep and pitch. Sampled handoff exit speeds stay above 4.50 world units/second; CPU exit minimum is 4.59.
- [38 contact/catch/control regressions](qa/contact-control/contact-checks.json): scoring/whistles settle once, possession transitions, manual defensive takeover, catch styles and camera framing. Wrap landing chest height is approximately 0.35 world units.
- [2,172 transition frames](qa/contact-control/transition-checks.json): left/center/right handoffs and catches, ball/player visibility, bounded camera movement.
- 90 seeded complete games plus 60 interactive-rules games passed. TypeScript and production build passed; existing build chunk-size warning remains.
- The complete-play script checks defense, kickoff coverage and returns. After a flipped kickoff, the returner is the readable foreground subject while coverage is distant; inside six world units the selected defender must meet the same size gate. The controlled player must remain in view throughout measured settled live frames. The minimum readable-height gate is 50 pixels for the wider coverage shot and 55 pixels for regular defense/returns; actual measured values are included in the release results. Complete-sequence results and exact final deployment checks are recorded in the PR release comment.

Checks run in local Chromium with mobile touch emulation, including the recording's 1108×444 gameplay viewport. Rendered sequences are sampled at five frames/second with 60 Hz simulation; they are not physical-iPhone performance certification. Known live-browser proxy/TLS restrictions are handled with Vercel READY status and exact production byte comparisons over verified HTTPS. TLS verification stays enabled. Repository-wide baseline CI failures are compared against PR #439 before merging.

## Rendered evidence

[Kickoff flip](qa/contact-control/kickoff-flip.jpg) · [Defense](qa/contact-control/defense.jpg) · [Upright wrap](qa/contact-control/wrap.jpg) · [Landing](qa/contact-control/landing.jpg) · [Moving handoff](qa/contact-control/handoff.jpg)
