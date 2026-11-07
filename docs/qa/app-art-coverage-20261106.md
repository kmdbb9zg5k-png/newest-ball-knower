# Remaining app artwork coverage — 2026-11-06

## Scope and implementation boundary

Extend the established black/gold football photography into remaining destinations and career workspaces. Preserve existing routes, real records, gameplay, draft rules, rosters, authentication and API behavior. Shared `SectionArtwork` reuses optimized local WebP assets; photography is decorative, with empty image alt text and existing screen titles and actions retained.

This is a source coverage inventory, not a statement that every nested state was manually tested. Build, type-check and browser evidence belong in the PR validation summary. In particular, authenticated league states, completed seasons and all career branches require representative state fixtures or account data to verify visually.

## Route coverage

The inventory follows `appNavigation.ts` and the actual component branches in `App.tsx`.

| Destination | Entry component | Artwork coverage |
| --- | --- | --- |
| Home | `HomeDashboard.tsx` | Existing cinematic stadium and game discovery retained. |
| Play | `PlayHub.tsx` | Expand remaining game discovery presentation; preserve existing mini-game graphics. |
| Fantasy | `FantasyHub.tsx` | Extend photography through league discovery and relevant HQ/season/settings entry surfaces. |
| Community | `CommunityHub.tsx` | Existing bench, rankings, friends, trivia H2H, football H2H and mini-game imagery retained. |
| Profile | `LockerHub.tsx` | Existing cinematic profile, stadium and trophy imagery retained. |
| Solo careers | `SoloMode.tsx` / `SoloFranchiseHub.tsx` | Retain cinematic career selection; add art to remaining draft, season and completed-run surfaces. |
| Online football | `FootballArenaScreen.tsx` | Existing football presentation retained; no field renderer or gameplay modification. |
| Trivia | `ChallengesHub.tsx` | Existing cinematic Gauntlet hero retained; question and answer flows unchanged. |
| NFL picks | `SportsbookHub.tsx` | Compact helmet artwork above the real picks workspace. |
| NFL news | `NewsHub.tsx` | Stadium photography complements the actual article and feed interface. |
| Ask BK | `AskBkHub.tsx` | Decorative film-room header treatment preserves conversation viewport and composer space. |
| Hall of Fame | `HallOfFame.tsx` | Trophy photography complements actual records and earned achievements. |
| Partners | `PartnersPage.tsx` | Community photography preserves existing partner cards and outbound destinations. |
| Player locker | `PlayerClothingLocker.tsx` | Retain live athlete and garment previews; do not replace customization controls with decorative art. |
| League HQ | `LeagueLobby.tsx`, `FantasyLeagueCommandCenter.tsx` | Add appropriate compact league artwork around the operational workspace. |
| Draft | `DraftRoom.tsx`, `MobileDraftRoom.tsx`, `LeagueLiveDraftRoom.tsx` | Review desktop, mobile and live draft variants together; retain existing dense board and player/team imagery where already present. |
| Simulation / Results | `SimulationView.tsx` | Compact trophy artwork in empty results, random/commissioner draft order, and season results branches. |

## Nested career and fantasy coverage

| Workspace | Source components | Treatment |
| --- | --- | --- |
| Fantasy season and league settings | `FantasySeasonHub.tsx`, `FantasySettingsHub.tsx` | Contextual entry artwork; preserve tabbed stats, standings, transactions and settings controls. |
| Solo fantasy franchise | `FantasyFranchise.tsx` | Helmet artwork at team-building entry. |
| Owner career | `OwnerBusinessMode.tsx` | Front-office entry/operational framing. Actual owner file is not `OwnerMode.tsx`. |
| Agent career | `PlayerAgentMode.tsx` | Film-room and player imagery around recruiting and representation. |
| Real-team franchise | `RealTeamFranchise.tsx` | Front-office and legacy imagery around management surfaces. |
| Franchise season | `FranchiseSeason.tsx` | Postseason and season legacy trophy framing; game field remains intact. |
| My Player career | `MyPlayerStory.tsx`, `MyPlayerCareer.tsx`, `MyPlayerArc.tsx` | Retain athlete creator/live player presentation; extend plain career and offseason entry sections. |
| My Player combine | `MyPlayerDraftCombine.tsx` | Compact field artwork around combine hub; active drill remains unobstructed. |
| Athlete locker | `AthleteLocker.tsx` | Contextual locker/legacy framing where empty or summary states need it; retain real athlete view. |
| Launch information | `LaunchCenter.tsx` | Welcome/beta context imagery; preserve legal and contact text. |

## Deliberately retained tool and gameplay surfaces

Do not insert large photo banners into every modal, statistical tab or active game. Existing contextual artwork on parent screens is sufficient for dense nested tools such as `LeagueIntelligenceHub.tsx`, `FantasyDraftFormatWorkspace.tsx`, `OfficialCombineResults.tsx`, roster comparison, transactions and player detail dialogs. Live athlete previews, wardrobe rendering, active trivia rounds, combine events and football fields already provide the visual focus.

Create/join league, sign-in, account settings, safety controls, database browsing, help, legal and support dialogs retain clear forms and reachable actions. The intro, all 32 favorite-team themes, soundtrack controls, player portraits and existing cinematic team selection remain supported.

## Existing verification resources

These scripts existed before this artwork pass; listing them does not mean they were executed for this change. Local browser launch scripts are CI-oriented; use the supported browser environment for visual checks in restricted sessions.

| Resource | Useful coverage |
| --- | --- |
| `npm run lint`, `npm run build` | TypeScript correctness and production bundling. |
| `scripts/all-screens-broadcast-check.ts` | Real route scene contracts, focus behavior and reduced-motion requirements. |
| `scripts/navigation-polish-browser.mjs` | 320/375/390/768/1366 widths, five primaries, Explore routes, profile, Ask BK and overflow. |
| `scripts/home-broadcast-browser-check.mjs` | 320/390/430/1280 Home geometry, hero imagery and shared navigation. |
| `scripts/solo-ui-browser.mjs` | 320/390/1280 career entry screens, player profile and appearance save/reopen. |
| `scripts/fantasy-mobile-browser-check.mjs` | Phone fantasy HQ, dialogs, gauntlet layout and keyboard constraints. |
| `scripts/fantasy-hq-gold-browser.mjs` | Fantasy HQ visual/navigation fixtures. |
| `scripts/picks-screen-browser.mjs` | NFL picks fixture and pick tracking presentation. |
| `scripts/bk-news-browser-check.mjs`, `scripts/news-browser-check.mjs` | News feed and opt-in states. |
| `scripts/supporting-ui-browser.mjs` | Help dialog focus and Ask BK duplicate submission/cancellation behavior. |
| `scripts/community-arena-browser.mjs`, `scripts/football-arena-browser.mjs` | Community and football arena regressions. |
| `scripts/profile-locker-browser.mjs`, `scripts/player-clothing-locker-browser.mjs` | Profile and athlete wardrobe presentation. |

Verify at least a narrow phone and desktop viewport, loaded decorative images, no horizontal page overflow, visible main actions, readable text and no new runtime errors. Do not infer physical iPhone performance from desktop browser emulation.
