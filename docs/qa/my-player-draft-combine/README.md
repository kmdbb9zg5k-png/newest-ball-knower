# Playable My Player draft Combine

New My Player careers now play the existing 3D Combine before draft night instead
of receiving generated workout numbers. Every position completes the 40-yard dash,
broad jump, 20-yard shuttle and 30-second bench press. WR/TE also complete eight
receiver routes, RB completes five running-back reps, and CB/S completes five DB
reps. QB/EDGE/LB use the four core events; no unsupported position drill is invented.

The My Player name, position and athletic ratings are passed to the drill. The
existing 3D rigs remain in use; this does not recreate a custom selfie/face on a
new 3D mesh. Native drill controls, animations, pause, result screens and retry
flows stay intact. The full-screen career workout provides a persistent exit;
its game surface is scoped to the remaining height so it cannot cover that exit.

Completion callbacks record career-owned best, last mark and attempt count. The
fastest dash/shuttle, longest broad jump, highest bench reps and highest complete
position-session average count. Replays may improve bests before draft night;
incomplete sessions and false starts do not post marks. Zero jump/bench/session
scores are valid completed performances. Records survive reload with the existing
career save; storage errors are surfaced. Unrelated standalone local bests never
qualify a career for the draft.

Draft entry requires every relevant event, calculates a position-weighted grade
from played marks, and applies the displayed projected round and starting OVR
adjustment. Poor performances can lower draft stock; elite performances can move
the player into Round 1. The best marks freeze when the career advances. Existing
drafted and season saves remain playable without redoing the Combine. The old
calculateCombineResults export is retained for compatibility; new draft entry
uses calculatePlayedCombine, not generated workout values. Broad jump replaces
the old generated vertical-jump display; no playable vertical drill existed.

No backend migration or manual setup is required. This is local My Player career
progression, separate from Community challenge scoring and trivia ratings.

## Verification

- TypeScript and production build.
- `node --import tsx scripts/my-player-draft-combine-check.ts`: position requirements,
  incomplete-session gating, invalid marks, best/last records, save restoration,
  false starts, zero marks, weighting, draft round and OVR boundaries.
- `BROWSER_PATH=/path/to/chromium node --import tsx scripts/my-player-draft-combine-browser.mjs`:
  actual MyPlayerStory at 320/390/1280px; a real dash, broad jump, shuttle and bench
  through normal rendered controls/animation loops; mid-drill exit, partial save
  reload, draft gating, saved marks → exact draft grade/round/OVR, drafted reload,
  and an older drafted save without Combine records. All passed without page errors.
- Existing Solo fictional-universe/full-flow, integrity and My Player shared-renderer
  checks passed. Existing broad-jump, agility/strength, WR, DB and RB simulations passed.
- Community mini-challenge logic and real-dash browser/save-retry regression passed.

The full career browser playthrough uses QB (all four core events). Position-specific
requirements and complete rep counts have logic/simulation coverage; separate
complete career browser playthroughs for all positions were not performed. Browser
3D uses software rendering; physical iPhone frame rate is not certified.

`completed.webp` shows actual recorded career marks, and `dash.webp` shows the real
3D workout within its My Player modal.
