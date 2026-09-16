# 3D preview: stance and player presentation review

## Scope
Continue draft PR #301 from 5c0d863. Only athlete.js and motion.js runtime files change. The game simulation, field, camera, HUD, controls, main branch, v3, career storage and native release configuration are unchanged. This is a preview-only refinement, not production approval.

## Changes
- Replace the shared upright ready pose with role-specific hip/torso angles. OL/DL use a hand-to-turf three-point stance; receivers, backs and secondary have different ready hand targets.
- Solve the ready arms with fixed upper/lower lengths and blend back to the existing action poses. Slow the release blend to avoid an abrupt hand jump after snap.
- Refine arm/sleeve continuity, knee proportions, sock cuffs and cleat sizing. Head orientation compensates for the deeper torso angle.
- Fix number panels: rear numbers were mirrored; front numbers were upside down. Correct UV viewing orientation and outward-facing cloth normals without changing jersey identity or shared texture uploads.

## Verification on this pass
- node scripts/check-play-moment-motion.mjs: PASS, existing eight-role motion regression.
- node scripts/check-play-moment-stance.mjs: PASS, 1920 sampled arm poses, eight ready stances, fixed limb lengths, grounded line hand targets, finite blends, coordinate isolation and front/rear jersey orientation.
- python scripts/check-play-moment-stance-browser.py: PASS at 844x334 and 932x430. Actual included WebGL2 renderer/geometry in isolated character fixtures, 22 actors, 28 draw calls, zero JavaScript/WebGL errors and no external requests. Before/after images inspected for the ready poses and number orientation.
- Renderer fixture matrices and actor positions checked. JavaScript syntax checks passed.
- Local copied baseline renderer/motion/geometry/athlete hashes match the repository blobs. New runtime blob hashes: athlete fd76b61b6e47b32cbf1358264b29e2a412d75450; motion 9017c9d947628d1eff182b8b998f50e2459f9973.

## Limits
These are isolated character/pose checks, not a fresh full-game or iPhone/Safari certification. Existing gameplay checks from the previous pass are not represented as newly rerun. Multitouch, phone FPS/thermals, collisions, foot sliding and the simplified football engine still need work. The procedural models remain stylized, not photorealistic or motion-captured. No assets were purchased, no paid generation was requested, and no Replit jobs were used.
