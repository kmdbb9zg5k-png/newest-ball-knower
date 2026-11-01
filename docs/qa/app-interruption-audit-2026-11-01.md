# App-wide interruption audit — November 1, 2026

Follow-up to the reproduced cloud-refresh interruption (#536) and embedded drill retry finding (#537).

## Scope and method

Searched authored TypeScript/JavaScript across the app and public game entrypoints for document reload/navigation, timer/visibility/auth/storage callbacks, keyed React session remounts, iframe messages, asynchronous hydration, and state replacement after navigation. Generated bundles, third-party vendor libraries, build outputs and archived deployment copies are excluded from the authored-source guard; their source entrypoints are reviewed instead. This is a source-wide interruption audit plus targeted runtime tests, not a claim that every possible device crash has been eliminated.

## Findings and changes

| Priority | Trigger | Result before | Change |
| --- | --- | --- | --- |
| High | Retry Drill after model-load or graphics failure | Six shared components reload the whole document; embedded career returns Home | Recreate only the failed renderer, pause/resume the existing session, retain reps/results and dispose the old scene/listeners; covers eight drill modes |
| High | Franchise Play Moment completes | Legacy bridge clicks Back/Start and can reload the whole app; save key is hard-coded | Update the mounted owning season through a scoped event; bind save key/player/year and accept only the active iframe/week |
| High | Invite join resolves after navigation | Forces Lobby and switches the active league/draft | Join without activation; activate and navigate only if the user stayed on the original Home screen |
| High | First anonymous profile resolves late | Home/Community session keys change and discard open game selection or guest activity | Preserve initial guest hydration; retain isolation on actual account changes, logout and anonymous-to-member transitions |
| Medium | Owner screen's second cloud read resolves late | Replaces current setup/decision state independently of global staged sync | Use CloudSyncProvider's initial restore and staged updates; retain authoritative Owner save/conflict events |
| Medium | Fantasy watchlist read resolves after a star toggle | Restored list erases the new choice | Replay pending local choices over the restored list before saving |
| Medium | Draft preference read resolves after queue/favorite edits, or fails untouched | New edits can disappear; failed read can save empty defaults | Replay pending scoped edits; do not save untouched defaults after a failed read |

## Runtime coverage

- All eight real drill components: repeated initialization failure, successful local retry, mid-attempt graphics interruption, same phase/progress, one remaining scene and no top-level navigation. The matrix injects a small scene implementation to isolate recovery/state behavior.
- RB completion after recovery: all five reps finish through normal Next Rep controls; exactly one score is saved. A further retry at Session Complete preserves all results without another write.
- Real embedded My Player RB renderer: failed GLB requests, repeated retry, restored asset download, running-rep context-loss callback, local recovery/resume, one canvas, unchanged incomplete career save and return to camp.
- Legacy bridge in portrait/landscape: wrong message source/week rejected, no Back/Start/reload, scroll restored, duplicate/stale results ignored, owner navigation cancels delayed callbacks.
- Actual React FranchiseSeason and CapChallenge: terminal moment message updates real simulated week, visible record/message and saved state without navigation; normal Cap auto-draft/start preserves a legal 20-player roster. Terminal iframe gameplay result is mocked; football motion is unchanged.
- Invite completion: delayed resolution after navigation, away-and-back, unmount and failure cannot replace screen/active league; unchanged Home still opens the joined league.
- Session identity boundaries: initial anonymous hydration is preserved; actual account changes, logout and privilege changes reset user-scoped state.
- Fantasy delayed-hydration browser fixtures exercise the actual hooks/handlers with delayed cloud results and league changes.

## Other reviewed paths

Account switching/sign-out/native authentication and explicit fatal-error recovery still intentionally reload. The source guard allowlists only those reviewed boundaries and rejects new document reloads in games/drills. Ordinary explicit Home/exit/checkout/mail links remain intentional navigation.

Community resource polling uses request gates; active mini-game sessions keep their attempt token separate from refreshed lists. H2H uses generation/attempt guards and source/token validation; the deadline ending an abandoned drive is an intentional rules transition. Fantasy availability/news/audio/locker refreshes do not remount the global app. My Player weekly/camp completion and Agent progression are explicit transitions. The previously fixed cloud polling path remains covered by its mobile regression.

## Limits

Cloud responses and terminal iframe results are mocked in targeted tests. Chromium touch/software rendering does not establish physical iPhone memory, heat, frame rate, native authentication delivery or live-human network behavior. No scoring rules, football motion, database schema or paid assets were changed. Full test/build and deployment results are recorded on the accompanying PR.
