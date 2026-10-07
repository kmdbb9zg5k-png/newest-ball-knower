# Tackle drive and wrap — October 7, 2026

The completed-tackle pose used stationary foot targets and nearly identical fall timing across wrap variants. The defender also used the grounded elbow posture from the first contact frame. This made the contact read as a paired fall rather than an upright wrap and drive.

This change adds staggered drive/recovery steps, distinct defender/runner timing for low wraps and drag-downs, a wider initial reach that closes around the ribs, and a continuous elbow transition as the defender reaches the turf. Final grounded poses and the existing carry anchor are preserved. All runtime import versions are updated together.

Scope: full-game reference rig in two-minute and five-minute modes. Helmets, source running cycle and Combine are unchanged. This is authored procedural motion on the existing rig; no new motion-capture asset is included. The previously identified licensed tackle pack still requires source-file acquisition and retargeting.

## Verification

The actual reference-helmeted-athlete-v1.glb is tested, including 14 contact finishes, 360 carry samples, six visible skinned-hand grip cases, and six contact-step articulation checks. Full gameplay is recorded using normal playbook/snap/movement controls through the next play; no actor positions or outcomes are injected. Real requestAnimationFrame capture is separate from deterministic recordings.

Typecheck, production build, browser results, screenshots and final deployment verification are recorded with this PR. Browser emulation does not establish physical iPhone performance or conclusively reproduce the owner's original Safari missed throw.

## Results

- Typecheck passed; production build passed (53.58 seconds, existing bundle-size warning).
- Both game modes: normal snap, handoff, eight-yard run, diving contact, grounded finish and next-play book; no page/WebGL errors. Full sequence sheets are included.
- Separate normal shoulder-hit play reviewed in close-up through reach, drive and landing. No positions or outcomes injected; the close-up changes only the review camera.
- Normal-control scramble, delayed catch choice, punt and defense passed.
- 120 Hz presentation-clock checks passed both modes with no pose-time rewinds.
- Real CDP multitouch passing passed, including held joystick, bullet/touch/lob, cancellation, receiver-body taps and click fallback.
- Actual RAF: 23 rendered frames, 1.07 simulation seconds over 10.42 wall seconds on SwiftShader; no page/WebGL errors. This is not a phone FPS result.

## Publication blocker

GITHUB HANDOFF BLOCKED: connected GitHub create_blob, fetch and fetch_pr return MCP -32603 Internal error. Direct Git push has no credentials (terminal prompts disabled). This work is not deployed. Base is main c16c60ad2ba82f40619bbd4bfc96a404076128d5; branch codex/tackle-drive-61. Once GitHub recovers, publish the branch, open the PR, check CI against the existing baseline, merge and verify the public deployment.
