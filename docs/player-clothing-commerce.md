# Player Locker — first release and payment handoff

Owner decisions: standalone main-app Locker, direct real-money purchases (no coins), no merchant account yet.

## Shipped scope

- Ten included training-gear choices across tops, shorts, shoes and wristbands, including no wristbands.
- Four premium designs available for try-on only. No price, checkout, purchase grant or payment collection is enabled.
- Uses the existing saved My Player identity, with an explicitly labelled sample for visitors who have not created a player.
- Equipped free loadout is saved separately on the device; starting a new career does not erase it. This release does not claim account/cloud ownership for clothing.
- Preview and My Player draft Combine use the selected gear. NPCs, competitive mini-game presets, team uniforms, speed and ratings are unchanged.
- Existing Profile / manager locker, collections and database entitlements remain intact.
- `cleanOutfit` rejects premium, unknown and cross-slot IDs from local storage. Try-on is transient and can display premium designs without granting ownership.

## Remaining work before accepting money

1. Owner opens and completes onboarding for the chosen merchant account. Configure credentials through provider/Vercel secret management, never chat or source control.
2. Confirm actual item prices/currency and selling regions. Create provider products mapped to immutable catalog IDs. No suggested prices are being advertised in this release.
3. Add authenticated server checkout using provider-side price IDs. Require a durable non-anonymous account and check existing ownership before creating a checkout session.
4. Verify signed provider events server-side and record idempotent purchase/reversal grants in the existing account entitlement system. A browser success URL or local storage value must never grant an item.
5. Support restores, duplicate events, cancellation, delayed payment, refunds and account switching. Persist and validate equipped paid loadouts against current account entitlements. Keep free outfits usable offline.
6. Choose and implement the native iOS/Android purchase path separately after reviewing the applicable store requirements. Do not expose an unreviewed web checkout inside native builds.
7. Test the complete purchase/restore/refund path in sandbox; enable live sales only after provider configuration and production verification.

Clothing is cosmetic. No purchase is allowed to improve athletic attributes or competitive scores. New garment shapes (hoodies, pants, hats, etc.) need properly fitted 3D assets; the first collection deliberately uses the existing training top, shorts and trainers plus rendered wristbands.
