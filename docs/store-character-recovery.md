# Outlaw and Kickflip recovery

Recovered November 10, 2026, without new generation or spending.

- BKF Outlaw is the requested Country Boy: cowboy hat, red plaid, white tank, jeans, engraved buckle and boots.
- BKF Kickflip is the requested Skater: black BKF beanie/tee, cream sleeves, baggy black denim, chain and skate shoes.
- Reused the approved 1024×1536 promotional posters and the exact full-body images used by the interrupted session's successful Hunyuan 3D jobs.
- Recovered original GLBs, including geometry, UVs and PBR maps. Outlaw: 100,000 triangles, 43,125,640 bytes. Kickflip: 99,992 triangles, 33,617,136 bytes.
- All six assets are hosted under public/store, rather than depending on expiring generation URLs. Original posters were converted to WebP without cropping. Embedded model textures are WebP quality 95 at their original dimensions; all non-image buffer bytes are unchanged. Served models are 7,774,692 and 5,194,020 bytes respectively.
- No committed character integration was found in the cloned repository's branches/history. No prior-session uncommitted filesystem was available in this workspace.

Both products use the premium three-view dialog and separate catalog identities. The standing showcase models never read or alter saved athletes. Rendering is on demand, pixel ratio is capped, decoded textures are capped at 2048 pixels, and model/texture/context resources are disposed on exit. Failed requests and lost WebGL contexts offer a realistic-image fallback and retry.

Checkout/individual wearable items remain unavailable, consistent with the existing concept collections; this work does not activate payments or grant ownership.

Validation commands: npm run lint; npm run build; node --import tsx scripts/player-wardrobe-check.ts; node --import tsx scripts/locker-commerce-check.ts; node scripts/store-characters-browser.mjs. The browser script covers 320/390/1280 widths, original images, 3D readiness/rotation/reset, context loss/retry, no horizontal overflow and saved-athlete isolation. Physical iPhone GPU performance is not certified by desktop emulation.

Type check, production build, wardrobe and commerce checks passed. Local automated browser launch was blocked by the executor socket policy; hosted visual checks are tracked in the PR.
