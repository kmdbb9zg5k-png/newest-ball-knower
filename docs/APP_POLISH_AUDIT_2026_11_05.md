# Ball Knower app-wide polish and reliability audit — November 5, 2026

This branch improves the existing app across shared design, Fantasy, Community,
careers, lockers, trivia, Ask BK and embedded football. It preserves all product
destinations and does not certify the entire application as flawless or ready to
launch. It does not enable a paid service or change production data/schema.

## Changes and causes

| Area | Cause | Result |
| --- | --- | --- |
| Typography | Unlayered form reset overrode Tailwind typography; body font was not loaded | Reset moved into base layer; shared loaded font tokens |
| Navigation/Home | Menus escaped short viewports; tiny labels; excessive desktop stacking | Scrollable/dismissible menus, focus return, larger targets, responsive Home columns |
| Screen recovery | Lazy screen failures replaced app shell; stalled loads offered no exit | Per-screen boundary preserves navigation; loading escape; no empty league destinations |
| Startup/cloud | Optional writes could hold startup; captured data could cross account changes | Bounded auth and state operations; captured-account ownership; uploads do not hold ready state |
| Local state | Storage failure could throw from React state update | Best-effort cache writes leave in-memory session and navigation usable |
| Fantasy | Corrupt watchlist, account-switch/restore races, opaque empty/error states | Validated account-scoped list, serialized saves, My Guys filter, retry and clear filters |
| Community | Eight tabs clipped, creator above games, unrelated requests blocked pages | Visible section grid, game categories, lazy creator retaining edits with inactive preview cleanup |
| Community requests | Refresh state/queued requests survived lifecycle changes | Serialized refresh, separate refreshing state, stopped queued work after unmount |
| Agent/Owner | Crowded Agent page; async Owner edits could be overwritten | Recruit/Clients/My Agency panels; Owner pending decision lock; precise budget labels |
| Solo | Secondary event/save panels preceded choosing a mode | Mode choices appear before secondary content |
| H2H | Failed or stalled iframe; reload lost launch UUID; old recovery branch incomplete | Bounded health/startup watch, one automatic reload, manual retry, reachable same-attempt resume |
| Football runtime | RAF kept scheduling after a render exception | Stop animation/simulation, expose accessible recovery and same-URL retry |
| Ask BK | Old aborted request could complete/unlock a newer request | Controller-owned response/finally handling and accessible mobile controls |
| Hall of Fame | Malformed save dereferenced; failed publish hid standings | Validated restoration, independent standings read and visible retry |
| Trivia/lockers | Queued cross-account writes; overlapping equip/save interactions | Expected-account writes, busy guards, server-derived prices |
| Mobile recovery | Report issue button covered bottom navigation | Report control sits above phone navigation |

## Verification evidence and scope

- Existing hardening core suite and new app-polish regressions are run locally;
  final command results are recorded in the PR.
- New behavioral checks exercise corrupt storage, account-switch races, slow
  watchlist restore, queued writes, actual hook lifecycle, hung network requests,
  and exceptions injected into the actual football controller loop.
- Gameplay pure checks include 60 full rules-level games, normal-control
  run/pass/contact/next-play sequences, foundation/locomotion and Combine startup.
- Browser review used the actual application at 320px and 390px iframe viewports,
  844×390 landscape, and desktop. Verified Home, Community navigation/categories,
  guest views, Fantasy HQ/Cheat Sheet empty filters, Agent setup and workspace,
  account-menu Escape/focus behavior, screen recovery and graphics-failure retry.
  This is viewport testing, not physical iPhone testing.
- The development optimizer changed React chunk versions during live edits and
  produced an invalid-hook failure. The scoped boundary kept navigation working.
  Testing switched to a compiled production build; Fantasy opened successfully.
- This cloud browser has no WebGL2. It verified graphics-unavailable recovery,
  but cannot provide visual acceptance of live gameplay, real-device FPS, or heat.
  The existing repository CI runner now includes targeted real-WebGL recovery
  tests and screenshots for both full-game modes, with explicit software-renderer
  limits. CI outcomes must be inspected before merging.
- No messages were posted to Community, no real purchases were made, and no
  authenticated user league data was modified during browser review. Career
  testing used a disposable local guest profile.
- CI captured 18 screens at 320px, 390px and 1280px, plus guest Community views.
  Human visual inspection of those artifacts found clipped Trivia headings,
  Profile overlaps, News decoration crossing attribution, a blank Picks week
  selector, crowded fantasy draft rows and oversized career introductions.
  Follow-up corrections are included; new captures must validate their final layout.
- An HTTP browser check exposed unavailable `crypto.randomUUID` during athlete
  creation. Local athlete identities and Community subscription labels now use
  a compatible helper. Authentication and game attempt tokens are unchanged.

## Release blockers / remaining acceptance

1. Real NFL fantasy scoring is deliberately paused in production: the deployed
   handler only synchronizes schedules. See [Fantasy release audit](FANTASY_RELEASE_AUDIT_2026_11_05.md).
   Scoring-math unit passes do not establish live ingestion or provider entitlement.
2. Complete CI browser matrix, especially authenticated H2H three-drive recovery,
   reload/resume, results persistence and newly updated career/creator selectors.
3. Physical iPhone Safari portrait/landscape gameplay, GPU memory, heat and
   sustained frame pacing remain unverified.
4. Real-account league creation/join/draft/post-draft transactions and cross-device
   auth/save workflows require isolated production-like acceptance testing.
5. H2H resume reuses the original attempt in the same browser tab/session. It
   restarts field simulation, does not checkpoint unfinished play position, and
   does not promise cross-device resume.
6. Recovery cannot prevent operating-system page kills or guarantee driver recovery.

PR #540 is incorporated and extended here; do not merge that old conflicting
branch separately without comparing it against this implementation. Production
has not been changed by this audit branch.
