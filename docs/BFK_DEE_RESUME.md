# BFK Dee store pack — prepared assets and resume plan

Status: blocked by fal account balance exhaustion. No 3D model has been submitted. Do not represent the standing reference as a finished A-pose or 3D model.

## Prepared assets

- public/store/bfk-dee-cover-v1.webp: supplied clean BFK Dee poster, preserved composition and lettering, exported quality-95 WebP, 1122 × 1402.
- public/store/bfk-dee-standing-reference-v1.webp: full-body identity/outfit reference, 1200 × 1789. Arms are too close to sides for intended wide A-pose; pose correction is pending.
- Original reference output: https://v3b.fal.media/files/b/0ab1f948/xunv1HhzAOY8VIo-c3BvD_iGPdVee0.png
- Original supplied poster uploaded to fal: https://v3b.fal.media/files/b/0ab1f946/xMBtxxf8QgPKATPYHigEA_AEB4BECA-2298-4E86-BC5A-204E69A81D8C%281%29.jpeg

SHA-256:
- Cover: 4fbda0d9aab5b9cca5dc362badaf4ecb1285c5e43a56d620aa0f0ed189d2d39d
- Reference: dd1cb22c44b963867ac845d5d5a43a2cd2bb77ed23c46172c7893712f19e6101

## Generation continuity

Completed reference request: 01a1c819-aae4-7e80-80f1-c69446281cf8
Endpoint: google/nano-banana-2.1/edit
Completed submission key: bfk-dee-apose-20261110-v1

Pose correction was denied before submission with HTTP 403 balance_exhausted.
Blocked submission key: bfk-dee-apose-20261110-v2
Decision ID: e6695415-7569-46ef-b233-5271bf08ce01
Payer: kmdbb9zg5k@privaterelay.appleid.com
Do not automatically retry or switch accounts. After the user adds credits, call check_account_status, then resume the same key and exact input.

Blocked input:
```json
{
  "image_urls": [
    "https://v3b.fal.media/files/b/0ab1f948/xunv1HhzAOY8VIo-c3BvD_iGPdVee0.png"
  ],
  "prompt": "Precise pose correction only. Keep this exact same adult woman's identity face hair tattoo outfit body shoes. Change ONLY both arms into a WIDE SYMMETRICAL A-POSE: straight arms angled 40 degrees AWAY from the vertical torso, straight elbows, hands far outside the hips at approximately waist level. Each hand must be at least a forearm's distance from the body with a broad triangular gray background gap between each arm and the waist. Both arms form downward diagonals like the two outer strokes of the letter A, NOT hanging near the thighs. Palms down/inward, all fingers visible and natural, hands empty. Full body head to soles, front view, same light gray backdrop. No text, graphics or props. Generous side margins so both extended hands fit. Preserve all garment details and chest tattoo.",
  "aspect_ratio": "2:3",
  "resolution": "2K",
  "output_format": "png",
  "num_images": 1
}
```

After visually validating corrected pose, generate textured static GLB using the selected endpoint fal-ai/hunyuan-3d/v3.1/pro/image-to-3d (decision 12006b16-bb87-471c-9f26-c7c9c5ae0587), input_image_url pointing to corrected reference, generate_type Normal, enable_pbr true, face_count 500000. No 3D job exists yet.

## Integration

Use a separate product ID bfk-dee and the supplied spelling BFK Dee. Six included items: black leather jacket, burgundy crop top, black leather cargo pants, burgundy/black/white sneakers, BK necklace, earrings. Use existing character showcase dialog and StoreCharacterPreview, with Full poster, A-pose, and 3D preview modes. Preserve Nicki and other packs. Do not bake navigation tabs into artwork. Use accurate image ratios and lazy-load the model. Maintain preview-only purchase/entitlement status until real checkout/wearables exist.

Before release: add product and image mapping, optional scalable A-pose label metadata, validate GLB and image identity, build and lint, open/update this PR, merge/deploy under existing authorization, verify live cover/reference and 3D rendering where WebGL is available. The current cloud test browser previously reported WebGL disabled; do not claim rotation verified from a fallback image.

## Validation so far

Cover and standing reference visually inspected. Dimensions and SHA-256 recorded. Asset-only draft has no runtime code changes; build not required until integration.
