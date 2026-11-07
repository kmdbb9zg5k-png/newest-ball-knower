# My Player situation artwork

Sixteen original illustrations belong to My Player, with explicit mappings for all seven draft-story chapters and all six career cast roles. Related situations share their relevant scene. Agent, Owner, and Community images are not reused.

## Direction and assets

Generated individually with the built-in image generator on November 7, 2026. Common prompt: cinematic 16:9 sports documentary photography; authentic American football; charcoal/black and muted gold; realistic anatomy; complete heads within the frame; main athlete viewed from behind or helmeted so artwork does not replace the custom athlete renderer; no required text, brand logos, watermark, or UI. Supporting people are illustrative, while existing named-cast portraits remain the identity source.

All assets are `public/my-player-scenes/{scene}-v1.webp`, 1280×720, quality 82. Total: 1,308,912 bytes. Images are lazy-loaded, reserve their aspect ratio, retain the full composition, and are capped at 560px wide.

| Scene | Generation brief |
| --- | --- |
| origin | A college American football coach and a young adult prospect looking over a worn college playbook beside the empty university practice field at sunset. Intimate grounded origin story. |
| training | A professional strength coach supervising a young adult American football prospect pulling a weighted sled at an elite indoor training facility; teammates stretching in soft background, determined preparation. |
| agent | A young adult American football player meeting their professional agent at a quiet cafe booth, agent explaining a career plan on a tablet beside a closed contract folder. Football stadium softly visible outside. |
| recovery | A young adult American football athlete resting on a treatment bench with ice wraps while a sports physiotherapist reviews the recovery schedule in a calm professional training room. |
| film | An American football position coach standing beside a large film-screen showing abstract Xs and Os while a young adult athlete sits taking notes, seen over the player's shoulder in a dark film room. |
| interview | A young adult American football prospect at a formal scouting interview, seen from behind across a table facing three coordinators, one gesturing toward an erasable tactics board. The setting is tense but respectful. |
| visit | A young adult American football prospect with a duffel walking beside a team representative through a modern team facility corridor, glass overlooking the indoor practice field, welcoming private club visit. |
| draft | Draft night in a family living room, a young adult American football prospect seen from behind answering a phone, supportive family reacting joyfully around the sofa, television showing only abstract blurred sports graphics. Warm intimate cinematic moment. |
| camp | A young adult rookie American football athlete seen from behind holding a helmet at the edge of a professional preseason practice, coaches evaluating a line of players doing drills; sunrise and training-camp atmosphere. |
| coach | A veteran position coach calmly discussing a depth chart with a young adult American football player seated opposite, seen over the player's shoulder in a modest position-room office. A helmet on the desk, magnetic team board blurred behind. |
| rivalry | Two young adult American football athletes in contrasting black and off-white practice jerseys, both wearing helmets, facing each other across a practice-field yard line. Competitive but respectful body language, no fighting, scouts and a stadium in the distant background. |
| locker | A young adult American football athlete seen from behind on a locker-room bench listening to a veteran teammate speaking earnestly, helmets and hanging black-and-gold uniforms behind, quiet trust-building team conversation. No phones or casual community-party atmosphere. |
| gameday | A helmeted American football player seen from behind stepping out of a dark stadium tunnel toward a floodlit field, teammates in black and muted gold ahead, a packed crowd beyond. Anticipation before the game, no visible numbers or names. |
| contract | A young adult American football athlete seen from behind reviewing a contract with their agent at a polished desk, pen and closed folder, two different unbranded team helmets on a shelf in the background. Thoughtful offseason career choice, no handshake implying a completed deal. |
| legacy | A contemplative American football athlete seen from behind standing in a personal career memorabilia room, warm light on an unbranded helmet, worn cleats, a framed blank jersey, and an empty illuminated trophy plinth. The feeling of a legacy still to build. No trophies or championship rings. |
| media | A young adult American football athlete seen from behind and slightly over the shoulder speaking to a female sports reporter with a handheld microphone in a stadium media corridor, camera operator in soft background. Calm professional interview, black and muted gold surroundings. |

## Integration

- Draft journey: origin, training, agent, recovery, film, interview, and private-visit scenes.
- Draft night: agent scene while waiting or undrafted; family celebration only after a drafted result is revealed.
- Preparation: image follows extra reps, film, or recovery selection; fatigue starts the card on recovery where appropriate.
- Camp: training, first-team practice, and game-day evaluations.
- Weekly conversations: coach, agent, rival, or locker-room scene matches the actual speaker.
- Career: scheme discussion, optional film room, rivalry, media feed, contract/offseason, and legacy collection.
- Existing player appearance, named portraits, save schema, outcomes, and tactical/3D controls are preserved.

## Reproduction and validation

`node --import tsx scripts/my-player-artwork-check.ts` checks chapter/cast coverage, outcome gating, image headers, and download budgets. `npm run lint` and `npm run build` cover production integration.

`my-player-journey-browser.mjs` supports `BK_QA_WIDTHS` and `BK_CHROMIUM_MODULE`, exercises all seven choices, draft-board persistence, drafted/undrafted outcomes, signing and the camp gate with fixed workout fixtures. It does not claim the fixtures were played as 3D workouts.

`my-player-season-browser.mjs` starts from an isolated post-camp save and plays each weekly preparation, response, five-rep tactical evaluation and team game through visible controls. It checks tabs, images, overflow, reload persistence, the offseason and next-year transition. `BK_QA_LAYOUT_ONLY=1` runs one week at the requested `BK_QA_WIDTH`; full season defaults to 390px. Backend calls are isolated mocks; it does not write a real account or certify physical-phone graphics performance.

Domain regressions cover combine marks/gates, ordered journey choices, role/fatigue/relationship consequences, 63 games across seasons/playoffs, contracts, transfer/loyalty, legacy saves, and award idempotency. Shared Solo regressions cover roster/cap validity, 17 games, playoffs, and saved career state.
