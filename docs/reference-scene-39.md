# Reference scene pass — 39

Target: the owner's navy/gold stadium reference, with large readable athletes, a low view behind the quarterback, natural turf and compact controls. The September 28 16:32 recording showed distant running and touchdown shots despite the previous short fixtures passing.

Changes:
- Reduce the lens's vertical field of view from 62 to 52 degrees in landscape. Keep the pocket lower while fitting the actual formation horizontally.
- Remove the running-camera rule that repeatedly increased distance to reserve a full-width 90px HUD strip. Fit pitch instead, with the player centered between the controls; retain actual control-rectangle collision checks.
- Bring the pass destination and touchdown framing closer, with faster settling for the end-zone shot.
- Give linemen a broader base and deeper crouch; receivers and backs lean into more deliberate ready stances. Keep the approved Sentinel model and material maps.
- Integrate fine paint breakup and subtle central wear into turf shading, and slightly lift field illumination.
- Enlarge the navy/gold score strip on roomy landscape displays. Keep the existing playbook and pre-snap controls.

Validation includes controller regressions, rendered mobile formations and art fallback, an actual before/after scene at the opponent 15-yard line, and a moving 26-yard carry into a touchdown at the recording's viewport. Camera size targets apply during sustained movement, not only stationary fixtures. The field location and camera translation for that test are setup only; the carry and touchdown use the normal controller. Test outcomes and the reviewed render evidence are recorded on the PR.

Limits: this is an incremental in-engine match using the existing authored assets, not a claim of pixel-identical reference fidelity. No new collision physics, model-generation purchase, or physical iPhone frame-rate verification is included. The fantasy app and career saves are untouched.
