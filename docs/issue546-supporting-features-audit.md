# Issue 546: soundtrack, alerts and trivia

Second-wave baseline: `871da741e1446513bcebc693b86c30502ed1e314`. Audit date: November 5, 2026.

## Soundtrack

The provider could stop at a normal track ending because browsers may emit `pause` before `ended`; the next-index effect required `isPlaying` to remain true. The fake-media regression reproduced this on the baseline. Advancement now uses playback intent and starts the next real playlist URL directly. Manual-only tracks remain excluded from automatic selection, and the single soundtrack audio element remains blocked by intro/team setup.

Premature-end recovery now stays on its recovered URL, runs only once for that track URL, and cannot replace a newer track selection or allocate a blob after unmount. Native app state and document visibility must both permit playback; explicit pause survives foreground transitions. Late native-listener registration is cleaned up after unmount.

Saved volume is bounded and finite. Cloud restore cannot overwrite a more recent local mute/volume edit, and initial defaults are not written over cloud preferences before restoration completes. Only explicit preference edits schedule a cloud save. The soundtrack menu has labeled mute/volume/close controls and Escape recovery; an empty playlist no longer displays “track 1 of 0”.

The media API cleans encoded copy/mastering/version suffixes, deduplicates punctuation variants and keeps track IDs stable when uploads are added. Hidden and retired tracks stay excluded, and remastered uploads are preferred when present. API fixtures cover actual upload URL selection; no live Blob listing or audible hardware playback is claimed.

## Notifications

The category/owner/receipt gates pass. Alert rows previously only marked themselves read. The reusable `FantasyNotificationInbox` maps 19 known event kinds to existing in-app league destinations, hides other leagues and disabled-channel rows, deduplicates repeated row IDs, and still opens when a read receipt fails. The pre-draft command center uses its existing draft/results/activity callbacks. Post-draft integration is coordinated with the fantasy workstream. No App-level arbitrary URL handler is added.

Preference retries temporarily disable the switches until the current server choices are known, preventing an in-flight retry from replacing a newly edited selection. The existing server-derived category and independent in-app/push flags remain intact.

Native push transport and quiet hours are unsupported in this checkout. The category preference schema has fixed boolean columns, and there is no permission/token registration, push delivery worker or quiet-time contract. External keys, native entitlements, provider receipts, push-tap routing and physical-device requirements are documented in `FANTASY_NATIVE_PUSH_HANDOFF.md`. In-app row-ID deduplication is not a claim of provider delivery deduplication.

## Trivia

Forty runtime offline questions across all four tiers grade once, award zero XP, and do not record verified progression. Invalid selections leave a live attempt usable; expired negative/local attempt IDs are rejected without sending them to the cloud grader. Duplicate choices now trigger the existing offline fallback, malformed grading receipts cannot award local progression, and an empty round no longer receives the perfect-round bonus. The Levels practice question now specifies multiple in-breaking routes, removing its overlap with the Smash option.

Existing checks cover the 400 scenario IDs/answer mappings, deterministic tier rounds, Daily flow, repeat families, idempotent progress merging and source gates for the server's 1,000-question bank. The production question table and current roster facts were not queried or rewritten. `ChallengesHub.tsx` is unchanged.

## Validation

```sh
node --import tsx scripts/soundtrack-lifecycle-check.mjs
node scripts/media-library-check.mjs
node --import tsx scripts/intro-media-release-check.ts
node --import tsx scripts/profile-photo-release-check.ts
node --import tsx scripts/fantasy-notification-routing-check.ts
node --import tsx scripts/fantasy-notification-preferences-check.ts
node --import tsx scripts/trivia-grading-runtime-check.mjs
node --import tsx scripts/gauntlet-trivia-check.ts
node --import tsx scripts/trivia-visual-fidelity-check.ts
git diff --check
```

All passed. No local browser, heavy build or TypeScript process was run for this wave. The integration owner runs the combined type/build checks and browser review. Follow-up browser review should exercise real audio natural endings/recovery, mute persistence, intro exclusivity, background/foreground transitions, the soundtrack menu at phone width, alert actions in both league phases, and the existing `scripts/trivia-rounds-browser.mjs` offline round flow. Fake media does not certify actual Safari audio behavior or physical-device push delivery.
