# Fantasy HQ — gold reference implementation

The September 8 owner-supplied Fantasy HQ screen defines this layout: metallic tabs, a compact framed stadium, horizontal league/status pairs, four league tools, and recent activity. This is real React/CSS work, not a new mockup.

## Data and behavior
- League names, commissioner, phase, own draft position and own roster/pick counts use the current authorized league context. A completed Draft Order Game is not labeled a completed fantasy season.
- Creation, joining by code, free public matchmaking, League HQ, draft/results, the Cheat Sheet, player detail, and watchlist remain connected to their existing flows.
- My Leagues opens the complete accessible league list; the overview also supports horizontal scrolling.
- Draft Simulation is private, read-only snake practice from the published full-PPR player board. It does not mutate drafts, order, rosters, scoring, or account state. The UI clearly explains the ranking basis and fallback practice order.
- Matchup Analyzer reads existing weekly scores/projections and the existing schedule helpers. Missing or partial projections remain unavailable. It does not simulate real fantasy weeks or assign fabricated win probabilities.
- Recent activity reads existing transaction and announcement/receipt records. No fabricated activity is seeded into production.

## Artwork and scope
The existing locally hosted stadium is retained. A 10.8 KB local WebP atlas contains decorative crest/icon crops from the supplied reference, with its sample initial removed. All names, numbers, labels, statuses, buttons, news and tool results remain live elements. No new generated image, protected league logo, flattened screen, or external image service is introduced. Styling is scoped to Fantasy HQ; the corrected Profile, native/iOS configuration and backend remain unchanged.

## Verification
The dedicated workflow runs TypeScript, pure display/practice contracts across 6–16 teams, a production build/bundle budget, and production-built Chromium/WebKit browser scenarios. Browser fixtures isolate all hosted account, league, ranking and score requests from production. Captures and geometry are uploaded as artifacts for inspection. No physical-iPhone, TestFlight upload or authenticated live transaction success is implied by fixture tests.
