# Simulated-player production art overhaul

Baseline: main `71ac875c07b3901879ae1512bc6faa844ee0857f`.

**Release status: blocked only on the physical-iPhone visual pass. The full 1,696-player catalog and responsive/saved-trade checks are approved; do not merge until the device gate passes.**

## Replaced production path

The 96×120 face atlas, single 149×448 body template, canvas character renderer, CSS facial overlays, tattoo mask and v1 public assets were removed. Simulated players now use responsive WebP images supplied by a stable-ID manifest. The fantasy-football headshot system is unchanged and remains separate.

Every canonical simulated player receives a deterministic v4 identity descriptor derived from stable `player.id`. The descriptor locks age, skin tone, face structure, eyes, hair, facial hair, body archetype, measurements, tattoos, accessories and distinguishing details. Team, season, rating and uniform are excluded from the identity fingerprint. Team and uniform variant are separate asset dimensions, so a trade requests a new uniform render without changing the person.

## Production pipeline

- Source minimums: 640×800 portrait and 768×1536 full body.
- The first render creates a neutral, stable-ID identity anchor. Every team/uniform portrait and full-body render reuses that exact anchor, so a trade changes the kit without independently rerolling the face.
- Card/portrait sources are separately rendered in the correct fictional uniform; the neutral identity anchor is never sent to the client.
- Client derivatives: 96×96 avatar, 160×200 roster row, 384×480 card, 640×800 expanded portrait and 768×1152 full body.
- Full-body images are intersection-gated and lazy-loaded. Lists request only their thumbnail derivative.
- Approved manifests are cached in memory and local storage. Viewed images are primed into Cache Storage and can be recovered as blob URLs when the network image request fails.
- Supabase stores sources, derivatives and review state under a predictable stable-ID/team/uniform/appearance key. Normal clients can read only approved manifest rows; only the server service role can generate, upload, approve or reject.
- Generation is server-only, disabled unless explicitly enabled, and accepts no arbitrary user prompt. Generated art remains `pending_review` until every required manual defect/identity check is explicitly passed.

## App-wide integration

The shared production renderer/profile is used by Cap Challenge, Fantasy Franchise, Franchise Command, Agent, Owner staff, My Player, rosters, trade views, depth/upgrade views, weekly results, injury reports, team leaders, awards and offseason rookie-draft rows. Draft prospects use a stable `franchise-rookie-{year}-{prospectId}` identity before and after selection.

My Player retains the existing v1 save structure, career progression, selfie, AI render, cosmetics and body settings. Height and weight now feed the generated body identity. The UI no longer stretches a single body image along X/Y axes.

Eli Rodriguez remains locked to `bk-001-eli-rodriguez`, his approved creator face and requested football record: WR/slot receiver, 5′9″, age 30, 10 years, 85 OVR, 4.36 forty, elite route running and 96 durability.

## Current visual evidence

Nineteen local identities are approved: Eli plus an 18-player representative set containing two each of QB, RB, WR, TE, OL, DL, LB, DB and K. The set includes varied ages, skin tones, hair, facial hair, tattoos, accessories, heights, weights and position builds. Six initial portrait variants were rejected because their jersey numbers did not match stored data; corrected variants were regenerated.

The production catalog now contains 1,696 approved stable-ID identities with all five optimized derivatives and no cross-player duplicate identity fingerprints. Every generated portrait/full-body pair was reviewed in team contact sheets; malformed anatomy, generated text or brand-like marks, partial extra people and inconsistent uniforms were rejected and regenerated. A separately approved ABQ-to-TOR saved-trade render brings the manifest to 1,697 approved asset rows across the same 1,696 identities. Its face, hair, age, build and number remain stable while only the fictional uniform changes. Two failed trade variants were rejected for body drift, a sleeve mark, a divider artifact and swoosh-like cleat marks before the clean variant passed. Final Gemini spend was $30.894 of the $35 hard cap, leaving $4.106.

Four additional reviewed, photorealistic My Player portrait presets replace the former CSS-drawn face controls. Selfies and existing AI renders remain optional and take precedence; when a team/body render is not yet approved, the same selected portrait remains visible instead of a mannequin or generic silhouette.

Evidence:

- `docs/qa/simulated-player-art-contact-sheet.webp`
- `docs/qa/simulated-player-art-full-body-contact-sheet.webp`
- `docs/qa/simulated-player-art-visual-set.json`
- `docs/qa/simulated-player-art-catalog.json`

## Checks

The focused checks validate all 1,696 stable identities and 54,272 team assignments, identity invariance across trades, position measurements and numbers, rookie continuity, Eli fields, My Player save compatibility, source/derivative dimensions, hashes, obsolete-code removal, server-only storage writes, lazy loading, optimized list images and same-player offline fallback.

The production build, TypeScript/lint check, focused artwork checks and Solo presentation CI pass. The committed browser suite verified the real Solo screens at 320, 390 and 1280 CSS pixels. The deployed roster/profile flow was also inspected with approved cloud thumbnails, expanded portraits and lazy-loaded full-body art.

## Remaining release blocker

1. Complete the physical iPhone visual pass.

`scripts/solo-art-quality-gate.mjs` must remain failing while the physical-device pass is incomplete. The responsive browser suite, deployed roster/profile smoke test, saved-trade identity/uniform render and production catalog have passed; a successful compile still cannot override the final device gate.
