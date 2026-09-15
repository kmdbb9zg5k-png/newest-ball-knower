# 3D practice: players and night lighting

## Scope
Continue draft PR #301 from d653050. Implement the approved players/lighting direction in the actual WebGL practice scene, not as a background picture. Do not replace production v3, merge the pending viewport branch, or touch career saves, fantasy, authentication or native release files.

## Implemented
- Material-aware, warm/cool stadium lighting, clearcoat-style helmet/visor highlights, matte cloth/skin treatment and a tone-mapped night palette.
- One actor-only depth shadow map with a 3x3 PCF filter, plus contact shadows. 1024-square in Balanced, 2048-square in High; Low Power disables the depth pass. This is not ray tracing, full PBR, screen-space AO or cinematic bloom.
- Tapered limb geometry, smaller helmet proportions, face contours and 256-square generated number textures. Existing role profiles and stance/arm/leg solvers are retained.
- Dark stadium surroundings, sky gradient, light-bank halos, rails, ribbon lighting and corner pylons. Turf markings and the 22-player formation are retained.
- Lower presentation camera with the existing pocket-fit safety checks. No changes to play routes, movement/collision rules, scoring or controls.
- Pause > Graphics: Low Power / Balanced / High, with bounded pixel ratio, resource cleanup on switches and a contact-shadow fallback when a depth framebuffer is unsupported. Settings remain in memory.
- Optional `?scenario=redzone` starts practice at OPP 15 with 1:03; the default two-minute starting situation remains unchanged. High graphics are always active with no player-facing selector. Restart restores the selected practice situation.
- QA manual stepping now cancels the automatic render loop on explicitly requested QA URLs, avoiding simultaneous automatic/manual frames in software-rendered tests. Normal play still uses the animation loop.

## Verification performed
- `node scripts/check-play-moment-night.mjs`: PASS. Finite normalized geometry, valid indices, eight-role pose/limb invariants, bounded quality tiers, matrix API, and no network/storage calls in the practice modules.
- JavaScript syntax checks: PASS for all practice JavaScript modules.
- `python scripts/check-play-moment-night.py 932 430` and `844 334`: PASS using the actual renderer, shaders, geometry and generated textures in Chromium/SwiftShader. Both cover 22 actors, four pass concepts, receiver throws, QB framing, handoff/manual/assisted running, emulated simultaneous stick+sprint and release, pause/quality changes, sack/next-down recovery, portrait recovery, and simulated depth-framebuffer failure.
- Same-frame, same-resolution shadow-on/off comparison: 1,828 changed pixels above threshold at 932x430. This verifies that the depth pass changes the rendered scene, not just a UI label.
- 43 main-scene draw calls plus 10 actor shadow calls in the sampled High/Balanced scenes, zero WebGL/JavaScript errors, zero instance-buffer overflow. Low Power has zero shadow draws.
- No external HTTP requests in the offline Blob-module test harness. These tests do not verify deployed browser network/cache behavior; verify the deployed route/modules separately.
- Baseline game, athlete, motion, geometry, stadium, HTML and HUD copies were matched against the repository's Git blob hashes before editing.

## Limits and budget
This remains a stylized procedural preview and is not pixel-identical to the generated reference or photorealistic character art. Rigged artist-made meshes, contact animation and deeper physics are separate work. iPhone/Safari hardware frame rate, thermals and real two-thumb input have not been certified. Software rendering and Chrome touch emulation are not substitutes for those measurements. The first local HTTP navigation was blocked by the container's browser policy; tests use local Blob modules without changing that policy. No Replit jobs, asset purchases, paid generation or runtime AI services were used.
