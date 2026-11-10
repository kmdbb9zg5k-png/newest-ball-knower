# Gold Standard recovery

Gold Standard has its own catalog entry and full-screen product/showroom page. Tunnel Fit is retained unchanged. The shared orbit controls, detail framing, saved-athlete toggle and preview-only wardrobe remain available. A failed detailed sample load now shows Retry; it cannot silently display the old placeholder.

## Asset provenance and preservation

The original uploaded Tunnel-Fit-Athlete GLB was used for retexturing, not a new generated body. The deployed Tunnel Fit asset uses EXT_meshopt_compression, EXT_texture_webp and KHR_mesh_quantization; the original is an ordinary PNG-textured GLB. Compression incompatibility was suspected in the earlier session, but its precise service error could not be recovered.

A fresh Meshy v6-lite attempt rejected texture_resolution=4k (HTTP 422: 4k/8k require Meshy 6, 7 or latest). Meshy 7 accepted the original and produced the outfit successfully, request 01a1c2e2-aab1-7580-9526-f0cf8a2e135a. Topology and UVs matched the original exactly. scripts/asset-tools/prepare-gold-standard.mjs imports only the new clothing material into the original geometry and restores the original head/skin material. It retains all 500,000 triangles and 4096px maps. Skin/clothing primitives contain 80,534/419,466 triangles. Meshopt and WebP packaging produce a 10,549,780-byte web asset; it loads only on opening the showroom.

Tunnel Fit's SHA-256 remains c778e2b35273b585a095be4612b98c66357c40704a0f37b4e67390401424e5a5. Gold Standard's SHA-256 is 08a65845c9d42e88a28faa35173ce23416e8a530d4a8c2820f940d36c30264ab.

## Verification and limits

Passed: TypeScript, Vite build, dedicated gold-standard asset/catalog checks, player wardrobe validation, athlete wardrobe persistence/isolation, Solo navigation, and full Solo Fantasy season/playoffs/persistence. CPU rendering of the packaged model was visually inspected. Build retains existing large-chunk warnings.

The available cloud browser reports GL_RENDERER=Disabled and cannot create a WebGL context. Thus interactive 3D rendering, 360-degree orbit and saved-athlete switching cannot be visually certified in that browser. The existing store-browser.mjs suite is updated for the catalog and labels but was not executed in this environment. This is not an end-to-end visual production certification.

## Purchases remain blocked

This release adds a retail catalog preview, not live checkout. Production has no STRIPE_SECRET_KEY or LOCKER_TEST_BUYERS, and the existing commerce implementation is explicitly sandbox-only. Its older $1 sandbox item named Gold Standard (top-gold) is a different SKU and must not be reused for this $2.99 outfit. Live checkout requires a production account/key, retail prices, a verified bundle entitlement ledger and refund/webhook handling, plus an end-to-end purchase/restore/equip test. No unverified payment link or client-only ownership grant is introduced.

## Recovery checkpoint — November 9, 2026

- Recovered local implementation commit `3fb723f` and uncommitted original-normal/roughness-map correction. No paid generation calls made during this recovery.
- Public baseline: `a0c2be5` on main; Tunnel Fit packaged model is unchanged (180,000 triangles). Gold Standard retains 500,000 triangles.
- Private original source already saved as `Tunnel-Fit-Athlete.glb`, Library file `libfile_4599421f43008191a05b9ad066766696`.
- Retextured original securely saved as `gold-source.glb`, Library file `libfile_9b12bb73f19c819183887182636fa19e`. Neither private source belongs in public Git history.
- Recovery branch: `codex/recover-outfit-release`. This branch was created from a fresh full clone of public main and contains only release files and the conversion script, excluding the unrelated local source branch/commit `8df70b3`.
- Current phase: recovery checkpoint; build, browser QA, checkout regressions and deployment verification pending. Earlier validation above describes the interrupted session, not a new production certification.
- Rechecked production environment variable names: STRIPE_SECRET_KEY and LOCKER_TEST_BUYERS absent; STRIPE_WEBHOOK_SECRET, LOCKER_COMMERCE_MODE and SUPABASE_SERVICE_ROLE_KEY present. No secret values retrieved.
- Resume by checking this branch and this document before generating or rebuilding assets. Inspect GitHub/Vercel state before publishing.

## Follow-up verification checkpoint

- Recovery source branch PR #589 preserves both separate 3D outfit assets, and the Vercel preview for `3b8ea833` reached READY. Production is still on `a0c2be5` until release gates pass.
- GitHub Actions for `3b8ea833`: Ball Knower Hardening, Combine startup recovery, App Store remediation, All-screen broadcast, Football H2H, Fantasy reconciliation and several others passed. Failed: Home broadcast (legacy five-tab assertion with new sixth Store tab), Full app polish browser (football-session-stage intercepts pointer events in community reliability fixture), Community mini-game browser (my-player-tabs viewport assertion at line 28). Profile locker fidelity was cancelled. Do not claim the entire suite is green.
- Corrected the stale Home broadcast assertion on the recovery branch; targeted CI was automatically relaunched for commit `97ef4423`. The remaining failures require separate fixes or validation before production release.
- This inspection cannot certify interactive WebGL rendering on a real device. Preview deployment availability is not proof of correct face/detail/360-degree behavior.
- Live payment checkout remains disabled and must not be represented as active or ready for customers.
