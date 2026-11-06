# Cinematic BK Arena community design

Implements the owner-approved Community mockup from November 6, 2026: black-and-gold teammate bench photograph, Join the conversation action, and photographic Football H2H and Mini Games cards.

## Scope

- `CommunityHub.tsx`: compact Arena header, all existing horizontal navigation, slim guest strip, responsive bench photo, real conversation button and two game cards. Existing rankings, circle, solo trivia and active trivia-match rejoin remain reachable.
- `communityArena.css`: scoped Community presentation. Removes the empty studio architecture for this page; keeps other pages' broadcast scenes intact. Includes narrow-screen text wrapping, focus outlines, 44px-or-larger controls and reduced-motion support.
- `public/community`: generated fictional sports artwork, converted to WebP without embedded UI text. A 768px mobile hero (65,744 bytes), 1536px hero (193,388 bytes), helmet card (22,774 bytes) and turf card (28,136 bytes). The hero uses `srcset`/`sizes`; both decorative card images load lazily.
- No API, authentication, database, scoring, roster or gameplay logic changes.

## Validation completed

- `npm run lint` (TypeScript): passed.
- `npm run check:community-arena`: arena and state checks passed.
- `node --import tsx scripts/all-screens-broadcast-check.ts`: passed.
- Final `npm run build`: passed; standard existing large-chunk notices remain.
- `npm run check:root-bundle`: passed, 251.29 kB raw / 79.03 kB gzip.
- `git diff --check`: passed.

Cloud-browser review used the actual application inside temporary same-origin 320/390/430/1280px frames. Frames reserved a desktop scrollbar, leaving 311/381/421/1271px content widths. All reviewed widths had equal document/client widths (no horizontal page overflow). All three visible artwork files loaded successfully. At 320px the main action was 48px high and game cards were over 114px high. The subtitle stays on one line at the smallest width.

Interaction checks at 390px confirmed that the Football H2H card opens the real Football H2H screen, Pick your team opens team selection, Back returns to Community, Mini Games opens the real challenge picker, and Join the conversation opens guest read-only public chat. The final Messages tab remains reachable at 320px and shows the guest participation gate. The compact help button opens and closes Community instructions at 430px. Desktop review confirmed the photo fills the card's full width with all five faces visible.

`community-390.png` is the real 390px review frame, scrolled to show the complete hero and both graphic cards. The extra surrounding gray is the local layout-review surface, not shipped application UI. The highlighted conversation button is its keyboard focus outline.

Limits: browser review does not certify physical iPhone rendering or performance. Real account posting, authenticated H2H results and server writes were not exercised; their code was unchanged. Local Vite preview has no production API handlers.

## Release status

The owner explicitly approved uploading this change to the public GitHub repository and deploying it on November 6, 2026. The focused pull request records the final CI and production deployment results. No manual application configuration or migrations are needed.
