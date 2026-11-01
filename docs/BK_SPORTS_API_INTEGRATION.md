# Sports API application integration — issue #526

## Currents news migration

See `BK_CURRENTS_NEWS.md` for secure key configuration, permitted headline/link scope, and cache/quota limitations. Home and NewsHub show linked Currents attribution when this provider supplies content. Ask BK no longer fetches paid-provider headline context; its existing live-search/rate/spending controls remain.

`NewsHub.tsx` uses `sportsApiClient.ts`. The default is `/api/nfl-news` (Currents). Both response formats now use the server-only `CURRENTS_API_KEY`; neither calls Tank01. Set **build-time** `VITE_BK_NEWS_API_ENABLED=true` only after the v1 source is authorized and a deployment smoke test returns genuine headlines. Rebuild to enable or disable it; this is not a live server environment toggle. No provider credentials belong in a `VITE_` variable.

When enabled, the client tries `/api/bk/v1/news` first. HTTP failures, unavailable/malformed/empty envelopes, missing or invalid retrieval dates, dates more than a minute in the future, explicit stale snapshots, or retrieval dates older than fifteen minutes fall back to the legacy response format on `/api/nfl-news`. This fifteen-minute limit measures retrieval age, **not publisher freshness**. This is a compatibility path to the same upstream provider, not an independent source. Both failures yield the existing outage state and clear old stories. Each attempt has a ten-second budget, and leaving the screen cancels work. There is no paid retry loop or background polling.

The UI shows the actual reported provider and feed retrieval time separately from each publisher's publication time. Missing publication times remain unknown. Per-story license and attribution fields are preserved when supplied; attribution links allow only HTTP(S) without credentials. No images, article bodies, descriptions, or invented news are added. Native builds retain the shared `/api/` origin bridge.

## Compatibility gates before further migration

| Consumer | Existing contract | Why v1 cannot replace it yet | Acceptance gate |
| --- | --- | --- | --- |
| NewsHub | `/api/nfl-news`, `{available, articles, fetchedAt}` | v1 uses `{available, kind, items, updatedAt}` and needs an authorized source | Authorized headline/link scope, truthful retrieval/publication metadata, deployment availability, mobile rendering and outage recovery |
| Ask BK | Independent current web search; no Tank01/Currents headline context | Current v1 player/game snapshots are not current-news evidence | Optional source adapter must label dates and delayed data; preserve live-search guard, auth, rate and spending limits; never use retrieval as publication date |
| Picks | `/api/nfl-sportsbook` plus server-validated picks | v1 games lack current odds/locked-line semantics and are not live scoring | Preserve kickoff locks, saved lines, both spread sides, outcomes and grading; verify schedule/status/timezone coverage independently |
| Player details and roster lookup | `PLAYERS_DATABASE`, `ball_knower_player_id`, `provider_player_id`, position/team/history mappings | nflverse identifiers are not Ball Knower or Tank01 identifiers | Explicit one-to-one crosswalk, collision/unmapped handling, current-season roster completeness, historical identity tests; no name-only replacement |
| Fantasy scoring | `ball_knower_nfl_games`, `ball_knower_player_week_scores`, rich stats and correction lifecycle | v1 score snapshots omit individual stats, projections, DST semantics and verified live timing | Parallel shadow ingestion, reconciliation across all positions and DST, finalization/correction idempotency, locked-lineup and saved-league regressions; never write partial snapshots over scoring tables |

The new routes do not mutate existing fantasy rows, saved rosters, IDs, scores, picks or game saves. No automatic migration of those consumers is enabled. Current-season data availability and source rights still require validation by the provider workstream.

## Validation

- `node --import tsx scripts/bk-news-client-check.ts`: default isolation, v1 success, unavailable/malformed/stale fallbacks, both-route outage, unsafe links, duplicate links, missing publication dates, and cancellation.
- `npm run check:nfl-news`: Currents news release/provider checks.
- `node scripts/news-browser-check.mjs --fixture`: existing built-app 320/390px navigation, links, overflow, outage and recovery.
- `node scripts/bk-news-browser-check.mjs`: opt-in built-app 320/390px v1 success, fallback, stale fallback, total outage and recovery. Requires `VITE_BK_NEWS_API_ENABLED=true` build in `/tmp/bk-news-opt-in`.

Browser fixtures prove UI behavior only. They do not certify live source access, publication rights, physical-iPhone performance, or native release contents. Deployment verification and authorized sources remain release gates.

Local handoff: client contracts and existing NFL News release/provider checks passed. An opt-in production bundle built successfully. Local mobile browser execution was blocked because the Playwright Chromium executable was absent and both browser/headless-shell downloads returned invalid/truncated ZIPs. The browser scripts are supplied for CI; no mobile pass is claimed from compilation.
