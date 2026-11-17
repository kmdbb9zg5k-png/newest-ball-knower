# Country Boy clothing collections

Black Tie and Ivory Standard reuse the Country Boy reference identity in new generated clothing images. Source stills and campaign covers are committed under public/store. Static 3D showcases, not wearable garments or checkout activation.

3D endpoint: fal-ai/hunyuan-3d/v3.1/pro/image-to-3d; Normal, PBR, 100000 faces.

Black Tie request: 01a1c75d-be6e-74a0-83c8-9fba14081842; key bk-black-tie-20261110-5519faa9.
Ivory Standard request: 01a1c75d-be61-7a73-971b-e3bb0234ed6c; key bk-ivory-standard-20261110-5519faa9.

Poll these existing requests when recovering; do not regenerate.

## Recovered integration
Both original jobs completed and were recovered without regeneration. Original GLBs:
- Black Tie: https://v3b.fal.media/files/b/0ab1f486/qPiOuNGztUsonpZyNVNWW_model.glb
- Ivory Standard: https://v3b.fal.media/files/b/0ab1f488/u-stD54nundvZu9LNI-GH_model.glb

Embedded textures converted with scripts/prepare-store-character.mjs, retaining mesh and UV buffers. Downloads are 5,703,752 and 4,868,628 bytes. Both products appear under Clothing with campaign art, realistic references and independent 360-degree models. They remain non-purchasable static showcases, not rigged/equippable clothing.

Validation: TypeScript, production build, wardrobe validation and sandbox commerce checks passed. Local Chromium launch is blocked by the host socket restriction; the existing GitHub browser workflow now includes both outfits and Clothing department assertions at 320, 390 and 1280px. Physical iPhone performance remains unverified.
