# Profile design and verification

Updated November 5, 2026 following the owner's request for a cleaner Profile and a comprehensive instruction page. This supersedes the September reference artwork layout.

## Visual contract
- Profile title, consistent app branding, a clean identity card and readable name/photo/account actions.
- Live XP and next-level threshold, a separate BK Rating summary and six large skill cards with expandable explanations.
- Three trophy cards per row on phones, six on desktop; visible Locked/Unlocked states. Extended catalogs retain touch scrolling and arrow controls.
- A simple Verified activity section with genuine events or a readable empty/error state.
- Restrained gold accents, dark surfaces, shared typography and practical touch targets.
- Preserve account, photo, public-profile, prediction-history, trophy detail, Locker/Collection and Equip behavior.

## Profile instructions
How it works opens a scrollable nine-chapter guide on first visit and remains available in the header. Closing marks it seen where storage is available. Escape closes it, keyboard focus is contained/restored by ModalPortal, and chapter buttons scroll within the guide without changing the application URL. Guide content distinguishes universal XP, BK categories, H2H rating, cosmetic Pass progression and local/offline results. It explains guest email confirmation, recent receipts, grading states, trophy requirements, refresh and public viewing.

## Data integrity
The live `ball_knower_private.apply_progress_event` function was inspected read-only on September 8. Its level formula is `greatest(1,1+floor((xp+v_xp)/1000.0)::int)`. The display uses 1,000 XP per level, keeps the returned server level, and omits a percentage if XP/level are inconsistent. Zero XP is an empty rail, not decorative progress.

All six ratings, overall rating, trophies and receipts come from the existing `fetchProgressionProfile` path. No new award writes, migration, entitlement logic, scoring changes or client-side progression are introduced. The reference's invented daily increments, league-wide milestone total and fake account identifier are not copied. Actual account names/photos/IDs are shown. Legacy decorative assets remain in the repository; the redesigned page hides the manager collage, hex frames and receipt ornament.

## Photo and account safety
`ProfilePhotoEditor.tsx` and `profilePhoto.ts` remain unchanged. Its existing camera/library, 512px crop/compression, save/remove/validation and error behavior are styled through a Profile-only wrapper. Progression and locker sessions remount when account identity changes; stale read responses cannot replace a new session's data. Existing global account, sign-in, deletion and navigation controls are retained.

## Verification
The dedicated workflow runs type checks, existing profile-photo/account regressions, display contracts, production build/bundle budget, and the real page in Chromium (320,390,430,1280) and WebKit (390). Network responses are explicit QA fixtures, not evidence that a user's account contains the sample achievements. Screenshots and geometry/results JSON are uploaded to the workflow artifacts. No production data mutations or physical iPhone/TestFlight verification are performed by this workflow.
