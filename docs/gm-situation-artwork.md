# GM situation artwork

Fourteen original cinematic scenes for GM career. Decorative images accompany live event text; pictured people are not portraits of the saved players. WebP, 1280 × 720, lazy-loaded, full-frame. Player, Owner, and Agent art is unchanged.

| Scene | Art direction |
| --- | --- |
| office | A professional American football general manager reviewing a magnetic roster board in an executive football operations office overlooking an empty stadium. Thoughtful planning, no trophies. |
| gameplan | Three American football coaches and a general manager studying a play diagram around a meeting table, one coach pointing at a tactical board in a dark film room. |
| trade | Two American football front-office executives negotiating across a desk, a speakerphone and separate player dossier folders between them, tense and thoughtful, no handshake or signed agreement. |
| role | An American football player seen from behind seated across from a general manager and position coach in a small office, discussing a depth chart. Serious playing-time conversation, respectful tension. |
| breakout | An American football position coach with a clipboard evaluating a helmeted young adult receiver making a catch at practice, a scout watching nearby. Opportunity to earn a bigger role. |
| mentor | An older veteran American football player mentoring a young adult rookie at a film-room table, pointing to a playbook while a coach listens. Calm, focused development. |
| trust | An American football general manager listening carefully to an adult player seen from behind in a quiet office, an unfinished game-plan notebook on the desk. A difficult follow-up after a missed promise. |
| leadership | A veteran American football team captain addressing teammates in a locker room while the general manager watches from the doorway. Earnest leadership discussion, no celebration. |
| media | An American football general manager seated at a press conference facing microphones and reporters, neutral measured expression, unbranded charcoal backdrop. |
| medical | A sports physician explaining an athlete's leg scan on a monitor to an American football general manager in a professional medical room. Calm medical update, no visible injury or distress. |
| draft | An American football general manager on a phone in a busy draft war room, scouts studying prospect cards and a magnetic board, purposeful decision making, no readable text. |
| playoffs | An American football general manager and head coach seen from behind standing at the stadium tunnel entrance before a high-stakes postseason game, floodlit field and helmeted players beyond. Anticipation, no trophies. |
| review | An American football general manager and head coach reviewing a season binder in an empty stadium suite at dawn, reflective offseason planning, no celebration, no trophy. |
| champion | An American football general manager and head coach holding a unique unbranded silver football championship trophy with helmeted players celebrating behind them under gold confetti. Joyful earned championship. |

The seven franchise meeting kinds use an exhaustive typed mapping in `gmSceneArtwork.ts`. Injury reports use medical; broken-promise updates use trust. Playoffs show preparation, eliminated seasons show review, and only the champion result shows the celebration.

The GM season screen resets document scroll before modal effects capture the position. Returning to an existing season displays Continue Season. The front office uses one main heading and the team-selection masthead is compact.

## Verification

- `npm run lint` and `npm run build` passed. Existing bundle-size warning remains.
- `gm-artwork-check.ts`: fourteen distinct WebPs, seven meeting scenes, 1,137,666 bytes total.
- `gm-season-browser.mjs`: actual RealTeamFranchise controls, 17 games (2–15), week-eight reload, seven draft picks, 2027 restored; all seven player-meeting scenes encountered plus incoming trade art, no page errors. Separate seeded qualifying/title boundaries exercise playoff selection, bracket repair, final simulation, and both result images; these are not claimed as a naturally won championship.
- `franchise-full-season-browser.mjs`: shared non-GM 17-game flow, offseason, seven rookies, reload, qualifying and Legacy Bowl boundaries passed.
- `gm-events-browser.mjs`: Chromium 320/390/1280; alert queue, close/review/Escape, focus containment, scroll lock, duplicate taps, save failure/retry, haptic deduplication; actual two-week GM trade acceptance updates both rosters and survives reload.
- Full built app at 390px: career picker, scrolled entry, alert dismissal, pinned tabs, reset confirmation cancellation and return to the front office passed. Backend calls are isolated test responses; no live player saves were changed.
- Franchise interaction, GM trade, haptic bridge, Solo fictional universe, Fantasy Draft, career universe and back-navigation checks passed.
- Pre-existing `final-release-hardening-check.ts:60` Agent exact-source assertion remains failing on the unchanged base implementation. This change does not modify Agent signing or weaken that check.
- Browser checks use Chromium with a sandbox-compatible executable override. Physical iPhone haptics and WebKit were not exercised in this environment.

The GM tabs now clear the fixed app header. New Team is an in-flow action with its existing confirmation, so it cannot cover game controls or sit beneath the mobile navigation.
