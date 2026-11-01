# Solo and Franchise audit — November 1, 2026

## Fixes

- Conference playoff home/away designation now follows seeding. Previously it alternated by round index, allowing a low seed to host a higher seed. Existing title-game designation is unchanged.
- A missing or malformed saved playoff bracket no longer crashes or strands the season. Brackets are validated before use. The recovery action rebuilds bracket metadata from the season record while preserving completed games, player development, and roster data. Completed/eliminated runs recover to the offseason instead of replaying games.

## Completed checks

- `node --import tsx scripts/solo-fictional-universe-check.ts`: passed. Covers all 32 fictional teams, 1696 fictional players, legal Cap roster, 17 regular-season simulations, awards/career persistence, complete 32-team 53-round Fantasy Draft, schedule/rookie class checks, and MyPlayer combine calculations. Added 126 conference-round/seed home-field cases and malformed bracket validation cases.
- `node --import tsx scripts/solo-fantasy-league-check.ts`: passed (full draft engine and UI/source contracts).
- `node --import tsx scripts/franchise-interactions-check.ts`: passed (17 weekly decisions, goals, morale, injury and development progression).
- `node --import tsx scripts/solo-back-navigation-check.ts`: passed (navigation contracts).
- `node --import tsx scripts/solo-career-universe-check.ts`: passed (save/progression normalization).

## Browser coverage completed

`BROWSER_PATH=/tmp/chromium node scripts/franchise-full-season-browser.mjs`: PASS using a static esbuild bundle of the actual FranchiseSeason component, with normal UI controls and no mocked game results.

- Natural season: all 17 weekly decisions and games, finishing 4–13; reload after Week 8 preserved progress.
- Offseason: seven actual draft selections, seven rookies, year 2027, empty next-season schedule; reload preserved the new year and roster.
- Malformed save: replacing only playoff bracket metadata with `[null]` no longer crashes. The recovery button preserved all completed weeks/playoff results and returned the eliminated run to the offseason.
- Separate qualifying-save fixture: seeded a 17–0 regular-season boundary, rebuilt a damaged bracket, retained the first-round bye, then played the real Divisional game to an 18–21 elimination.
- Separate title-game boundary fixture: seeded the two preceding postseason wins, then resolved the real Legacy Bowl through its button (8–29 loss), verified the final result, and reached offseason access.
- No page errors in the functional progression run. The initial fixture omitted part of the split production CSS; those functional screenshots are not visual-polish evidence. The loader now reads every stylesheet from built index.html. A separate corrected visual-only finale check passed at 320px, 390px and 1280px, with visible/reachable offseason action and no horizontal overflow. The 390px styled screenshot was visually inspected: dark/gold panels, readable wrapping and intact action controls. Styled artifacts are `styled-finale-320.png`, `styled-finale-390.png`, and `styled-finale-1280.png` under the same artifact folder.

The qualifying and title-boundary fixtures are explicitly seeded coverage, not claims that a naturally played season reached the championship. The initial concurrent Vite attempt was killed with exit 137; a lighter Vite attempt timed out before its first decision. Replacing the fixture with an esbuild/static server and exact-case TypeScript resolution removed those harness blockers. The final static run passed.

Physical iPhone responsiveness/FPS is not certified by this environment. Owner/Agent, MyPlayer, and 3D modes are covered by other agents.
