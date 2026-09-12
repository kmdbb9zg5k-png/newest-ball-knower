# Solo presentation implementation status

Date: 2026-09-12
PR: #280, solo-player-universe-reference-fidelity
Integrated application commit: 72a21814c801874714ed1791e0a7a3747c1979ef
Source base: ca86d81bbf5dcb212dbd7c0b20f89bcece2cd803

## Delivered in the development branch

- Shared Solo-only presentation provider and cinematic player-profile portal, now wired into existing career components rather than provided only as a source overlay.
- Player-name/profile controls in Cap rosters, upgrade cards, Franchise Command rosters/trade targets, Solo Fantasy Draft and Agent cards. Draft/recruitment selection remains a separate action; controls are not nested inside other buttons.
- Stable ID-based appearance, nine reusable portrait presets, on-demand static body previews, home/away/alternate color treatments for all 32 existing fictional teams, cosmetic face/build/number/sleeve editing with save and unsaved-change handling.
- Current Cap/Franchise season game lines and development are passed to the player profile. Missing values are explicitly unavailable, not fabricated.
- Scoped styling and artwork across the six Solo entry destinations; Owner staff cards gain portraits.
- Existing real-fantasy portraits and gameplay algorithms were not changed.

## Verification completed

GitHub Actions run 34704754515 completed successfully. It applied the reviewed integration, verified artwork checksums/decoding, passed TypeScript, built production, passed the appearance tests (1,696 players and 32 teams), Solo fictional-universe/full-flow checks, Solo Fantasy checks, Franchise interaction checks and the root bundle budget. It then ran actual Chromium browser checks at 320, 390 and 1,280 pixel widths.

The browser test captured 24 screenshots: six entry destinations plus the player profile and editor at each width. It verified opening a player, changing and saving face/build/jersey number, reopening with jersey number zero preserved, and no captured page exceptions or document-width overflow in those cases.

Separately, the locally integrated checkout passed all 42 commands in check:hardening-core. Local browser execution was blocked by the environment's administrator policy; that policy was not modified. Browser evidence came from the authorized GitHub Actions runner instead.

Prototype artwork totals 24,786 bytes across the three shared WebP files, excluding code, CSS and other app assets. This is a measured prototype size, not a promised budget for the final art library. Device-local appearance choices do not cloud-sync.

One-time integration and upload-repair code was removed after the successful run. The retained CI workflow is read-only and tests the checked-in source without changing it.

## Release blockers: do not merge as the finished redesign

Visual inspection of the actual profile screenshot shows the prototype is NOT at the approved reference quality: enlarged faces are soft/low-resolution, the face/neck join and body geometry are rough, and uniform markings/material detail need replacement. There are nine preset faces and one body template with width treatments, not a finished varied character library. No 16-face artwork pack was produced.

My Player's existing selfie/render/body creator has deliberately been preserved, not fully converted to the new character renderer. Its appearance must be unified with career profiles without losing photos, saved renders or working body controls. Rookie and historical-summary links lacking full Player records need explicit stable-ID integration. Agent team changes must be verified end-to-end, not inferred from the uniform helper tests.

The browser test covers entry screens and the profile/editor interactions described above, not every interior decision/trade/season screen. Full visual-fidelity review, all interior flows, skin/lighting/anatomical variation, uniform identity review, physical iPhone memory/touch/safe-area testing, and final Codex/CodeRabbit review remain open.

PR remains DRAFT. Nothing has been merged to main or submitted to the App Store. Passing functional tests is not visual approval.
