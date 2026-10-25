# Approved Ball Knower homepage artwork

The user explicitly approved the generated black/gold running-back mockup and requested that exact image on the homepage.

- Source: approved 1354 × 1162 image from this conversation. Encoded as a 222 KB WebP without cropping, regeneration, or layout changes to the artwork.
- `HomeStadiumHero` displays the complete image at its original aspect ratio. Its printed controls have semantic button/link hit areas and visible keyboard focus rings.
- Explore Modes scrolls to the existing primary destinations and focuses the first action. My Leagues/Fantasy opens the existing Fantasy tab, Solo opens Solo, Trivia opens Challenges, and Combine opens the existing drill-selection menu.
- Main CTA hit areas are at least 44 CSS pixels high. Small-phone footer links use 32-pixel targets, positioned separately so they do not steal taps from the main buttons.
- Screen-reader heading/copy and a visible image-failure fallback preserve navigation. No video, motion or new data requests are introduced. Existing news, soundtrack, Solo and Mini Games sections remain.

Verification: production build, TypeScript, Home dashboard/broadcast checks, Solo Fantasy and fictional-universe full-flow checks. Browser coverage uses 320, 390, 430 and 1280px widths, checks full artwork aspect ratio, printed hit locations, action navigation, image failure recovery, and existing news controls. Chromium mobile emulation is not a physical-iPhone test.
