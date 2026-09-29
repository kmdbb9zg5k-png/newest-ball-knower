# Football presentation foundation — September 29, 2026

This pass addresses the complete-play critique after PR #383. The runtime keeps the existing gameplay rules and approved Sentinel geometry, and changes how that geometry moves, is shaded, and is framed.

## Changes

- Restore reciprocal source arm/shoulder movement; match stride cadence to ground speed and anchor stance feet in world space. Blocking uses the same planted-foot layer.
- Replace model-level tipping for completed tackles with articulated pelvis, spine and limb targets. Recovery keeps limb targets above the turf throughout the roll, brace and rise.
- Reduce the second layer of mesh inflation. Use stable skeletal garment regions to prevent the fragmented source texture atlas from producing flashing material boundaries at gameplay distance.
- Use a closer elevated running composition with velocity anticipation, a faster completion of the pass camera move, and a short scoring move within the same rear quarter.
- Balance textured turf, mowing bands, crowd contrast and ground shadows; increase the smallest action/play-call labels.

## Review evidence

`review-football-foundation.mjs` captures complete HB Draw and Verticals plays through their return to the playbook, using the actual WebGL renderer and a 12 fps capture cadence over the 60 Hz simulation. The captures do not force tackles or replace players. They use deterministic random seeds and normal gameplay controls. CI retains the full image sequences and state traces as the `football-foundation-44-webgl` artifact.

`check-football-foundation.mjs` measures world-space foot anchoring at walking/running/sprinting speeds, preserved arm swing, a grounded contact finish, and continuity through recovery on the shipped skeleton. These checks complement visual review; they do not certify that the product meets the user's overall graphics target.

Local validation: type check and production build passed; controller/recovery, framing, scoring-camera and foundation-skeleton checks passed. Actual WebGL mobile/contact/material verification is recorded in the PR and CI.

The current asset and eight source clips remain in use. This is a substantial presentation change, not a new football motion-capture library or a claim of Madden-quality realism. Mobile device performance still needs observation on hardware; software-rendered captures do not measure iPhone frame rate.
