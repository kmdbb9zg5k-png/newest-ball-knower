# Ball Knower Sports API v1

This read-only API adds free schedule/roster/injury feeds and Currents news. Fantasy and Picks still have Tank01 dependencies. No player IDs, leagues, scores or saved careers are migrated.

| GET route | Source | Origin cache TTL | Meaning |
| --- | --- | --- | --- |
| `/api/bk/v1/games` | nflverse schedules release | 5 minutes | 2026 schedule and published scores, not live play scoring |
| `/api/bk/v1/players` | nflverse 2026 roster release | 1 hour | Season roster, not complete fantasy player details |
| `/api/bk/v1/injuries` | nflverse 2026 injuries release | 5 minutes | Latest week in source, not proof of every player's current health |
| `/api/bk/v1/news` | Currents (`CURRENTS_API_KEY`, server-only) | 10 minutes | NFL headline/link metadata for the Ball Knower app |

The first three routes need no sports-provider API key. The generic JSON adapter supports other kinds internally, but these public routes use fixed nflverse adapters: setting `BK_GAMES_JSON_URL`, `BK_PLAYERS_JSON_URL` or `BK_INJURIES_JSON_URL` does not change them.

## Response contracts

Success includes `available: true`, `kind`, `items`, `fetchedAt` and its compatibility alias `updatedAt`. Retrieval time is not when a score, team assignment or injury changed. `sourceUpdatedAt` is upstream HTTP Last-Modified when available, otherwise null. nflverse responses include `live: false`, `freshness: periodic`, attribution and license links. Consumers must retain these labels and links.

Kickoffs convert US Eastern source time into explicit UTC, including daylight-saving offsets. Adapters validate schema, unique IDs and team coverage. Injury responses expose `scope: latest-reported-week` and `reportWeek`. Empty/error injury data never means all players are healthy.

Unconfigured, unreachable, oversized, malformed or incomplete feeds return 503 with `available: false`, empty items, a stable error code, and `Cache-Control: no-store`. Non-GET requests return 405 without contacting upstream. Successful CDN responses have short cache lifetimes; clients must still inspect retrieval/source timestamps. No data is fabricated.

## Download safety

Request input cannot choose upstream URLs. JSON sources require server-configured public HTTPS hostnames and reject redirects. nflverse uses fixed release paths and approved GitHub release hosts only. Streaming body limits, redirect caps, and a deadline covering headers and body bound downloads. Raw provider exceptions/credentials are not logged or returned. Per-instance backoff reduces repeated failures; it is not a global rate limit or monthly request budget.

## Optional durable snapshots

News never uses durable snapshots. `BK_SPORTS_SNAPSHOT_CACHE` defaults false for the other feeds. The additive migration provides a server-only cache with restrictive RLS and monotonic, idempotent writes. Apply and validate it before enabling the flag with server-only Supabase credentials. Browser roles cannot read/write it. Expired snapshots are not returned, retrieval timestamps do not get renewed on reads, and delayed older refreshes cannot replace newer requests. Reads/writes are bounded and cache outages fall through to upstream. See `BK_SPORTS_API_SNAPSHOTS.md`.

Refresh is on demand with per-instance coalescing; there is no distributed refresh lease or scheduled global sync. Do not treat this as enforcement of a paid-provider quota.

## Guarded news integration

`VITE_BK_NEWS_API_ENABLED` defaults false. When enabled at build time, NewsHub tries v1, validates its envelope/freshness, and falls back to `/api/nfl-news`. The UI distinguishes feed retrieval, article publication and fallback status, and preserves supplied license/attribution. Both feeds failing produces a recoverable empty state. See `BK_SPORTS_API_INTEGRATION.md`.

Both news response formats now use Currents, with no Tank01 news fallback. A free server-only key and live NFL coverage verification are required before release. News is displayed as attributed headline links, not stored as a permanent archive or sent to Ask BK for summaries. See `BK_CURRENTS_NEWS.md` for setup, scope, quota limits and source terms.

## Verification

```sh
node --import tsx scripts/bk-sports-api-check.ts
node --import tsx scripts/bk-nflverse-schedule-check.ts
node --import tsx scripts/bk-nflverse-roster-injury-check.ts
node --import tsx scripts/bk-sports-api-security-check.ts
node --import tsx scripts/bk-sports-snapshot-check.ts
node --import tsx scripts/bk-news-client-check.ts
node --import tsx scripts/bk-free-upstream-smoke.mjs
npm run lint
npm run build
```

Live-source smoke invokes actual production handlers and checks 2026 schedule/all32 coverage, roster identities and latest-week injury scope. CI also runs database permission/order tests and mobile news harnesses with migration off/on. Compilation is not proof of source permission, deployment health or physical iPhone behavior. PR #522 records the tested commit and remaining release blockers.
