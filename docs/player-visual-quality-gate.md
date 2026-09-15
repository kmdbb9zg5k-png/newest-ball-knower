# Player visuals first — realism is an art acceptance gate

Elijah explicitly redirected this work to realistic on-field player visuals.
Do not spend this scope on stadium, camera, HUD, scoring or new gameplay features.
Keep draft PR #301 isolated and unmerged.

## Current actual-renderer findings

The first player-only mesh pass at eeef8f3 removes wrist discs and round pad caps,
adds shaped helmet/face/visor/cleat geometry, transparent number decals and more
fitted limb envelopes. Numeric and actual-renderer checks pass, but close-up images
still show stylized faces and segmented body silhouettes. This does **not** meet the
requested realistic-player quality bar. Do not describe it as photorealistic or done.

## Better anatomical foundation

For evaluation, use the MakeHuman core graphical assets at immutable upstream
revision a8bc2d54ff0ac92e78ff71431b1023eda42bf482. The upstream LICENSE.md explicitly
separates AGPL application code from CC0 graphical assets; LICENSE.ASSETS.md contains
the CC0 statement. The base OBJ and the two selected adult male target files also
carry explicit CC0 headers. No application code, UI art or third-party community
asset is copied by this intake.

`scripts/prepare-player-foundation.py` retrieves only those five reviewed files,
verifies their exact Git blob hashes, retains license text and outputs provenance.
This is development-only. The current app has **no** MakeHuman runtime dependency,
remote asset request or integrated anatomical mesh yet. Do not imply otherwise.

## Acceptance before expansion

Build one fully equipped fictional football player around believable anatomy.
Judge front, side and rear close-ups, then the unchanged gameplay camera. Check
shoulder/neck continuity, natural hands and face, football helmet fit, cloth seams,
and skin/fabric material detail. Then examine standing/running/catching poses.
Only after this is visually convincing should the same basis expand across role
builds and fictional identities. Keep compressed/download/GPU costs bounded and
record actual measurements. Technical tests prove operation, not realism.
