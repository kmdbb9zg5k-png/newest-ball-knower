# Profile visual-fidelity correction

Starting point: main `300d68d` / PR #216. The owner rejected the initial implementation's flat appearance and requested code changes, not another generated image.

## Actual changes
- Reuse ornamental crops of the owner-supplied approved reference in a single local WebP atlas: metallic avatar surround, suited-manager/tunnel vignette, dimensional gold/silver trophy borders, receipt player/tunnel, and Ball Knower's own wordmark.
- The atlas is not a screenshot background. It contains no buttons, account ID/email/name, scores, progress bars, news, trophy labels or receipt copy. The concept's sample initials/founding date and badge centers were removed. Initials, uploaded photos, awards and all text are still rendered by working React components.
- Reframe the locker header/identity/overview, broaden the rating hexagons, emboss the live rating numeral, tighten vertical rhythm, and add the reference's decorative framing/lighting.
- Show six trophy shields together on phones; full requirements and rewards appear on tap. Larger catalogs remain horizontally scrollable. Desktop also shows descriptions inline. No catalog entries are discarded.
- Restore the illustrated receipts panel and keep it within the initial 390×844 empty-state screen above the fixed navigation (checked by actual rendered geometry, not merely page overflow).
- Keep Locker/Collection under an expandable section rather than deleting it.
- Scope navigation cosmetics to the active Profile using `body:has(.bk-app-shell[data-tab="locker"])`; no navigation handlers, auth, iOS or global team palette changes.

## Preserved
`ProfilePhotoEditor.tsx`, `profilePhoto.ts`, `progressionCloud.ts`, and the backend are unchanged. Existing photo picking/cropping/upload/removal, account-keyed read guards, progression thresholds, real counts, collection/equipment, fantasy and fictional solo identities remain in place. No NFL shield was added outside the existing favorite-team selector.

## Source / provenance
The decorative atlas was cropped from the owner's supplied `017763ED-D409-47F3-AC8F-984C670B3998.jpeg` reference (864×1536), not newly generated. Coordinates are based on a 544×552 logical atlas, stored at 408×414. No image-generation tool is part of this correction.

## Verification
Existing six CI workflows remain enabled. Profile checks cover the real production build with isolated backend fixtures in Chromium and WebKit. Screenshots are evidence of the rendered code, not mockups or real customer account data. Physical iPhone permissions, live customer photo uploads and a new TestFlight build are not claimed.
