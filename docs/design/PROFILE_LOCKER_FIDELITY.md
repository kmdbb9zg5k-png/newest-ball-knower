# Profile / Your Locker reference implementation

Target: the black/gold Profile screenshot supplied by the owner on September 8, 2026. Implement the real Profile destination, not a screenshot background or a disconnected mock page.

## Visual contract
- Compact Your Locker heading under the existing navigation/news strip.
- Large circular metallic gold profile medallion, readable real account identity, gold Add/Change Photo pill, original decorative suited-manager illustration.
- Universal profile header, actual league championship count, segmented gold XP rail and real next-level threshold.
- Six outlined hexagonal rating tiles alongside a metallic BK Rating plaque.
- Horizontal shield/medal trophy case with earned/locked states, captions, touch scrolling and accessible arrow controls.
- Framed Verified Receipts section, subtle decorative timeline and actual server activity/empty state.
- Restrained gold grid and lighting, dark charcoal surfaces, no changes to the global team palette or navigation.
- Preserve the existing Locker/Collection, entitlements and Equip actions below the reference sections.

## Data integrity
The live `ball_knower_private.apply_progress_event` function was inspected read-only on September 8. Its level formula is `greatest(1,1+floor((xp+v_xp)/1000.0)::int)`. The display uses 1,000 XP per level, keeps the returned server level, and omits a percentage if XP/level are inconsistent. Zero XP is an empty rail, not decorative progress.

All six ratings, overall rating, trophies and receipts come from the existing `fetchProgressionProfile` path. No new award writes, migration, entitlement logic, scoring changes or client-side progression are introduced. The reference's invented daily increments, league-wide milestone total and fake account identifier are not copied. Actual account names/photos/IDs are shown. The manager art and dotted receipt rail are decorative and aria-hidden.

## Photo and account safety
`ProfilePhotoEditor.tsx` and `profilePhoto.ts` remain unchanged. Its existing camera/library, 512px crop/compression, save/remove/validation and error behavior are styled through a Profile-only wrapper. Progression and locker sessions remount when account identity changes; stale read responses cannot replace a new session's data. Existing global account, sign-in, deletion and navigation controls are retained.

## Verification
The dedicated workflow runs type checks, existing profile-photo/account regressions, display contracts, production build/bundle budget, and the real page in Chromium (320,390,430,1280) and WebKit (390). Network responses are explicit QA fixtures, not evidence that a user's account contains the sample achievements. Screenshots and geometry/results JSON are uploaded to the workflow artifacts. No production data mutations or physical iPhone/TestFlight verification are performed by this workflow.
