# Recording fixes — gameplay 37

Addresses the September 28 recording: clustered pass protection, early sack text, flight camera swing, default automatic running, and late pressure feedback.

- Manual running now defaults on; assistance remains an explicit pause setting or `assist=1` launch option. The joystick accepts input during ball flight and retains it at possession transfer.
- Pass protection pairs blockers/rushers by field alignment, spreads rating-dependent shed times, routes sheds around a blocker, and keeps beaten protectors in recovery lanes. Already-updated blitzers are excluded from a second pursuit update after a catch.
- Three small separation sweeps keep unrelated bodies apart. Prone/contact actors anchor their animation while nearby standing players move out of their space.
- Contact starts immediately but the sack/tackle result appears at the animation finish.
- Eye and target use the same camera interpolation. The flight shot follows ball progress while retaining the field direction; catch starts from the current shot. Flight tracking has a higher bounded travel speed so it can keep up with the pass.
- Pressure includes collapsing blocks and closing speed. Grass microcontrast is reduced; the approved athlete material remains unchanged.

## Verification

Production build and TypeScript checks pass. Camera/marker and pursuit checks pass. Real-controller regression tests cover sacks at three viewport sizes, run exchanges, contact recovery, manual steering held through catches to three receivers, on-screen receiver flight framing, camera yaw bounds, early pressure, and delayed sack text. Real WebGL renders/mobile formation checks run in the graphics workflow; final results and deployment verification are recorded in the pull request.

Existing assisted-run scenarios explicitly opt into assistance in the test fixture. The pass-block movement check separately measures locomotion distance and bounded collision correction. The flight camera's bound is now 65 yards/second (1.084 yards per 60 Hz step); live-run tracking remains 24 yards/second. Successful catch transitions remain below one pixel in the three regression cases.

## Limits

These remain lightweight authored contacts and atlas spectators, not a full physics football engine. Rendered Chromium checks do not certify physical iPhone/Safari frame rate. Existing unrelated repository-wide CI failures remain separate from these gates.
