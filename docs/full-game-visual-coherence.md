# Full-game player and camera corrections

The October 4 iPhone recording showed four visual regressions in the two-minute and five-minute games: pursuing defenders moved with a stiff, forward-held arm pose; white kits looked cracked; jersey numbers separated from bending torsos; and possession changes produced abrupt camera zooms.

## Changes

- Pursuit and running coverage use the reference asset's verified run cycle. Its phase follows the existing distance-integrated stride rather than an independent wall clock. Contact, blocking, throwing and ball-carrying poses remain.
- Jersey and pants colors use stable regions derived from the mesh's bone weights, with smooth surface normals and restrained fabric detail. This replaces classification from noisy source texture colors. Helmet geometry, facemasks, team colors and the source asset remain intact.
- Numbers are sampled on the actual jersey triangles in bind space, so they follow the torso's skinning. The separate floating number planes were removed.
- The camera tracks play position separately from camera distance. Handoffs start the follow transition earlier; flight and catch share one shot; zoom travel is bounded independently of ball travel.

The changes are confined to the full-game reference renderer and its camera. Combine, the separate drill renderer, simulation rules, playbooks and other app destinations are unchanged.

## Verification

- `npm run lint` and `npm run build` passed. The existing build chunk-size warning remains.
- `node scripts/check-five-minute.mjs` passed regulation, scoring, possession spots, kicks, clock/overtime rules and 90 seeded complete games.
- `node scripts/check-reference-visuals.mjs` passed both modes: pre-snap, center/sideline runs, pass arrival, whistle and own-goal-line framing.
- `node scripts/check-camera-contact-polish.mjs` passed goal-line visibility, rear tackle eligibility, monotonic return clock, fair-catch controls, edge protection and mobile playbook readability.
- `node scripts/check-full-game-appearance.mjs` passed both mobile routes and four close-up poses, with no page/WebGL errors. The 27-joint rig, all 11 source clips, body geometry and helmet/facemask asset are preserved. Pursuit speeds 3, 6, 9 and 11 use run clip 0; measured hand swing spans 0.57–0.62 meters.
- `node scripts/check-full-game-transitions.mjs` passed 2,172 frames across left, center and right handoffs/catches in both modes at 844 × 390. The ball stays visible throughout; player head/feet remain visible after possession. Camera boom travel is capped at 7 world units/second; observed yaw changes stay below 0.0014 radians/frame.

Browser verification uses local Chromium/WebGL with mobile touch emulation. It is not a physical iPhone Safari test. Live Chromium access is blocked by this environment's proxy/TLS path; production verification uses successful Vercel deployment status and trusted-HTTPS byte comparisons against the tested build. No TLS verification is disabled.

Repository-wide CI has known failures outside these changed paths; the PR records the observed CI results separately rather than claiming every workflow is green.

## Review images

| View | Screenshot |
| --- | --- |
| Front: home and away materials/numbers | [Front](qa/coherent-players/front.jpg) |
| Back: home and away materials/numbers | [Rear](qa/coherent-players/rear.jpg) |
| Running arm swing | [Running](qa/coherent-players/running.jpg) |
| Torso bend and skinned numbers | [Contact](qa/coherent-players/contact.jpg) |
| Two-minute mobile game | [Two-minute](qa/coherent-players/two-minute.jpg) |
| Five-minute mobile game | [Five-minute](qa/coherent-players/five-minute.jpg) |
| Two-minute possession transition | [Two-minute transition](qa/coherent-players/transition-two-minute.jpg) |
| Five-minute possession transition | [Five-minute transition](qa/coherent-players/transition-five-minute.jpg) |

Earlier helmet-restoration screenshots are in [reference-helmets](qa/reference-helmets/) for comparison.
