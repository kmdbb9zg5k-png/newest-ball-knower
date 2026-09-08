# Home broadcast visual preview

Base: `564ec557ab6753b210679fc90eef0bb4ca26f9a8`. Preview only: do not merge until the owner approves the actual rendered Home screen.

## Reference and intentional differences

Match the supplied concept's stadium-at-night hero, metallic gold action, compact dark destination tiles and headline strip. The dedicated stadium panel is cropped from that exact concept; see HOME_STADIUM_ASSET.md. It is a small background asset, not a flattened UI. The logo stays Ball Knower's current wordmark, not the generated crown. The five existing bottom-navigation destinations are retained, not replaced with the concept's unimplemented navigation. No invented records, weekly updates, player images or push notifications are added.

The first Home viewport leads with the scene, My Leagues, all four existing primary destinations, and a working Cheat Sheet feature. The existing dynamic league picker, verified rating, current league action, activity, create/join controls, Solo access and partner cards remain below. Existing data logic is unchanged.

## Behavior

Home-only CSS light/haze animations plus six independently timed floodlights with restrained brightness flicker and lens-halo shimmer. No background video, canvas, JavaScript animation timer, new sound, or on-screen motion toggle. Atmosphere motion respects live device Reduce Motion changes and pauses in background tabs/offscreen. Decorative elements do not intercept input.

Home-only lazy-loaded ticker uses the existing first-party News endpoint; checks every two minutes while shown/visible, rotates one readable headline every ten seconds, supports manual next/swipe, focus/hover pause, explicit pause and hide. It rejects invalid or credentialed links and clears stories after a failed refresh instead of fabricating news. It does not announce automatic headline changes to screen readers. The headline controls remain independent from automatic decorative motion. Publication freshness/order is not invented.

## Verification

Run `npm run lint`, `npm run check:home-dashboard`, `node --import tsx scripts/home-broadcast-check.ts`, full existing hardening, `npm run build`, `npm run check:root-bundle`, and `node scripts/home-broadcast-browser-check.mjs`. Use `--live` for actual public headline input and a motion recording. Browser tests isolate account requests and do not create production accounts/leagues or submit transactions.

Inspect actual 320/390/430/1280 screenshots, fixed-header offsets, motion and reduced-motion behavior, ticker pause/next/hide, navigation and unmount cleanup. These are browser tests, not a physical-iPhone or TestFlight approval. A rendered screenshot is the preview evidence; the generated collage is only the target.

There are no database migrations, new subscriptions, media-generation API calls, native build triggers or deployment-to-main instructions in this change.
