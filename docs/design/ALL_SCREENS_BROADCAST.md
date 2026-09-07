# All-screen broadcast atmosphere

Extends the owner-approved Home design from #206 to the remaining existing destinations. The user explicitly requested all screens, not another Home-only proof. No gameplay algorithms, player data, identity, scoring, transactions, database, authentication or native build settings are changed.

## Scene coverage

| Existing screen | Treatment | Motion/ticker |
| --- | --- | --- |
| Home | Existing approved stadium; unchanged layout/art | Existing controls |
| Fantasy leagues | Tunnel, compact gold/black action cards | On while browsing |
| Cheat Sheet | Static tunnel, existing rows/details | No headline strip or background animation |
| League HQ, rosters, matchups, trades and waivers | Static tunnel banner and surrounding dark surfaces | Focus mode; existing fantasy components retained |
| News | Original CSS studio; compact real headline links | Visible-page news refresh; no invented publisher images |
| Picks | Original CSS studio; existing games/markets | Motion while browsing |
| Trivia menu | Studio | Off during tier selection or gameplay |
| Solo hub | Stadium with six real mode destinations | Motion while browsing |
| Agent | Office, original onboarding and agency dashboard | Paused during recruitment/negotiation/verification |
| Owner | Suite, original onboarding and all four dashboard views | Paused during verification |
| Franchise Command | Suite, team picker and operations | Static in season |
| Fantasy Franchise / Cap Challenge / season simulation | Static tunnel/field; all draft and game mechanics intact | No distracting news or moving backgrounds |
| My Player | Locker/creator | Static after creator |
| Profile / collections | Locker | Same existing earned items and account controls |
| Hall of Fame | Trophy setting | Motion while browsing |
| Partners | Studio | Original links/copy retained |

The news component is still one shared lazy-loaded component in the existing navbar. `broadcastFocus.ts` uses reference-counted locks to suspend it while gameplay or instruction dialogs are open. Hidden/offscreen motion is paused; device Reduce Motion and the existing persisted motion preference are respected. No new audio/video playback is added.

## Artwork

Home's disclosed 249x158 stadium crop is preserved. The office/suite WebP is a 210x197 text-free crop (x790,y315 to x1000,y512; eight upper pixels trimmed from the existing WebP) of the supplied generated concept collage; it is not a new high-resolution photograph or an NFL photo license. CSS supplies the studio/tunnel/locker geometry and lighting. Existing original trophy imagery is reused. Small source crops may look soft on large displays; no pixel-exact match to all generated phones is claimed.

## Verification

Run `node --import tsx scripts/all-screens-broadcast-check.ts`, the full existing hardening suite, production build and unchanged root-bundle limits. `scripts/all-screens-broadcast-browser.mjs` uses explicit synthetic news in CI, or captured public provider output with `--live`. It blocks all Supabase requests and does not mutate production accounts or leagues. Actual screenshots cover phone and desktop widths, per-screen geometry, navigation, motion preferences, Reduce Motion and focus transitions. Original Home and fantasy regression suites remain required.

Browser evidence is not physical iPhone/TestFlight QA. A web rollout does not update already-installed native binaries. External rights questions tracked in #200 remain separate.
