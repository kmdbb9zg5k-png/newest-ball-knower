# Under the Lights — isolated 3D practice stadium pass

Continue PR #301; do not replace production PLAY MOMENT or merge this draft automatically.

## Creative slice

The practice field gets an original night-game stadium identity: canopied press suites,
steady ribbon lights, two end-zone video-board structures carrying **OWN THE MOMENT**,
framed player entrances, speaker arrays, sideline equipment and padded goal supports. Existing corner pylons are retained, not duplicated.
The boards identify this as **3D PRACTICE / ORIGINAL TEAMS**, not a live broadcast or
an invented scoreboard. Actual scores stay in the existing game HUD.

This is procedural, stylized scenery, not photorealism. No new photos, licensed team
marks, purchased assets, generation APIs, CDN dependencies, audio, or Replit services.

## Scope and rendering budget

Only `stadium.js` and the new `night-stadium.js` affect runtime. The concurrent players/lighting pass at `2b463f4` is preserved. Relative to that
head, the game, renderer, geometry, athlete/motion modules, camera, controls and HUD
remain unchanged. This pass adds two lines to its updated stadium module instead
of overwriting that work.
No account, fantasy, career save/result, native release or database behavior changes.

- 188 deterministic static additions, using existing cube, cylinder and plane batches.
- One shared 1024 x 256 texture (1 MiB RGBA base; about 1.33 MiB with mipmaps).
- Texture is allocated once per renderer, not per frame or per down.
- New boxes stay outside the playable field. Pads decorate existing goal supports.
- No new animation loop, flashing light effect or screen-space overlay.
- At most one additional texture/shape batch is expected; the browser test must
  measure this rather than treating the expectation as a completed benchmark.

## Verification recorded at handoff

**PASS locally:** Node geometry suite (using the unchanged renderer matrix API): finite matrices, unique identities,
deterministic output, count/texture budget, north/south board orientation,
texture reuse, unavailable-canvas fallback and off-field box bounds. Syntax and
Python compilation checks also pass.

**Not yet passed locally:** actual WebGL2 fixture screenshots. The local managed
Chromium has no WebGL2 context; its network policy also blocks localhost URLs.
No policy was disabled. The fixture now bundles the unchanged local module bodies
into separate in-memory scopes and makes no network requests. A dedicated,
read-only, preview-branch-only GitHub Actions job runs this fixture using installed
Playwright Chromium and uploads before/after renders and a measured JSON report.
Do not call those renderer checks passed until that job succeeds and the actual
images are inspected. It does not deploy or merge anything.

Commands:

```sh
node scripts/check-play-moment-night-stadium.mjs
python scripts/check-play-moment-night-stadium.py --output /tmp/bk-night-stadium
```

The test harness was updated for the new limb geometry and actor shadow pass.
The browser suite exercises the actual renderer, stadium and 22 athlete models at
844 x 334, 932 x 430 and 1440 x 810, with normal, sideline, bowl and sign views. It
checks WebGL errors, geometry batch capacity, repeated-frame texture allocation,
unchanged player coordinates, draw-call delta and absence of network requests.
These are **presentation fixtures**, not full-game, real-iPhone, multitouch, FPS or
thermal certification. Existing full-game checks remain distinct.

## Next creative passes

First inspect the uploaded images and fix any readability, occlusion or orientation
problem. Then prioritize grounded runner footwork/contact, followed by a short
optional pre-snap camera presentation that yields immediately to controls. A replay
must eventually use immutable in-memory snapshots and never apply a career result
twice. Keep those separate, tested slices rather than adding all at once.
