# Gridiron Sentinel rig integration

The uploaded Meshy model had textures and 31,070 triangles but no skeleton,
weights, tangents, or animation. It could not be used by the skinned renderer.

## Result

- `public/play-moment-3d/assets/ball-knower-gridiron-sentinel-v4.glb`: 6,472,636 bytes,
  39,761 vertices, 31,070 triangles, 28 joints, three 2K material maps.
- Retains the working player's run, walk, juke, stiff-arm, wrap-tackle,
  high-point-catch, sprint, and rest clips. The game supplies its existing
  procedural throwing, blocking, contact, and recovery layers.
- The renderer now loads Sentinel by default. Existing v3 asset is preserved.
- Keeps the new helmet geometry; smooths shared surface normals without the
  previous model's helmet reshaping. Team colors, roster numbers and role-based
  body sizes remain driven by the game.
- Entry and module cache versions advanced to `sentinel-rig-33`.

## Reproducible preparation

Run `scripts/rig-gridiron-sentinel.py SOURCE DONOR OUTPUT` with the uploaded
`Meshy_AI_Gridiron_Sentinel_0928064652_texture.glb`, the preserved v3 GLB, and the
v4 output path. Requires numpy, scipy and Pillow. The source SHA-256 is embedded
in the output provenance. No original input is modified.

This is a local skin transfer, not a Meshy auto-rig result. The donor is posed
into the new mesh's A-pose. Twelve nearest donor surface samples interpolate
four normalized bone weights per vertex. Inverse skinning brings the mesh into
the existing bind pose, preserving the original skeleton and animation data.
Helmet and face cage are rigidly assigned to the head. UV-derived tangents are
generated. Maps are capped at 2K and compressed for the mobile payload budget.
The 95th percentile surface correspondence distance is 4.0 cm.

## Verification

- Asset validation: normalized weights, valid joint indices, required vertex
  streams, feet at zero, 1.7 m bind height, eight clips, 2K maps, under 8 MB.
- Skeleton nodes, inverse bind matrices and every animation sampler compared
  exactly against the donor; unchanged.
- 2,787 presentation poses passed with the actual replacement mesh. Lowest
  measured body point -0.0088 m; all contact, running, recovery and throw gates
  passed. New surface refinement changes positions by exactly zero.
- Locomotion gate passed: loop seams, immediate motion, interpolation,
  acceleration and turning with the new asset.
- Recovery/simulation gate passed, including three mobile sizes and 32 plays.
- Actual shader render using Mesa completed with no GL errors. Throw sequence
  visually inspected in `docs/qa/sentinel-rig/throw-poses.png`.
- Existing v3 asset validation still passes.
- `npm run lint` and `npm run build` pass. Vite retains its existing large-chunk
  warning; there are no new build errors.

The mesh uses four-weight linear skinning without finger articulation or
corrective shoulder shapes. Extreme poses may need later weight touch-ups.
The standalone GLB contains the original eight clips; game-specific throws
are still computed by the game rather than baked into a new GLB animation.
This pass has not been verified on a physical iPhone or a deployed build.

## Publication

Prepared on `codex/gridiron-sentinel-rig`. Not deployed. An earlier automatic
approval review rejected GitHub publication pending explicit current-chat
approval. Do not describe this local result as live or GitHub-visible.

Publication update (2026-09-28): the user explicitly approved pushing this
update. The previous approval blocker is resolved. Direct Git has no credential;
publication is proceeding through the authenticated GitHub connector.
