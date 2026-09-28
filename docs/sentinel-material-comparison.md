# Stationary Sentinel material comparison

## Findings and changes

The legacy shader was designed to conceal lettering on the previous Meshy
model. Applying it to the clean Sentinel texture erased jersey seams and
contrast, painted over glove cuffs and skin detail, and imposed an incorrectly
shaped visor over the face opening. Its uniform colors also flattened the
different surfaces into a similar painted appearance.

The v4 rendering path now preserves authored base-color detail. It keeps the
live jersey number and team recoloring, uses rougher cloth/skin, moderates
normal-map strength, and tints the gold helmet while retaining its texture.
Away recoloring limits gold replacement by both position and hue to avoid
turning brown skin red. Older model versions retain the previous shader path.

The controls, rig, weights, geometry, animation, and GLB are unchanged in this
pass. Cache keys advanced to `sentinel-materials-34`. Material variation remains
available across player seeds. No external generation credits were spent.

## What the comparison shows

Columns: source maps, previous game shader, revised game shader. Rows: close-up,
full player, and gameplay-size player. All columns use identical geometry,
A-pose reconstruction, camera, and lighting, with role-based bulking disabled
to isolate materials. The source column uses the prepared GLB's maps under our
lighting; it is **not** Meshy's viewer or the supplied aspirational reference.

`scripts/compare-sentinel-materials.mjs OUTPUT [--away]` exports the scene;
`python scripts/render-football-athlete.py OUTPUT` renders it with Mesa using
the actual shader. PNGs are in `docs/qa/sentinel-materials/`.

Home and away renders compile and draw without GL errors. Visual review
confirmed recovered glove cuffs and face detail, more jersey texture, and
readable roster numbers at gameplay size. TypeScript and production builds
pass, with the existing Vite large-chunk warning. Physical-device performance
and the deployed scene have not been retested for this local material pass.

The result still falls short of the target reference: rough face-cage geometry,
some lumpy/baked fabric folds, and shoulder shape remain in the generated
asset. Material correction does not resolve those modeling problems or the
throwing-motion quality concern. Those need a separate geometry/animation pass.

GITHUB HANDOFF BLOCKED: the earlier automatic approval review required explicit
publishing approval, which remains outstanding. This is a local review result,
not a deployed graphics upgrade.

Publication update (2026-09-28): the user explicitly approved pushing this
update. The previous approval blocker is resolved. Direct Git has no credential;
publication is proceeding through the authenticated GitHub connector.
