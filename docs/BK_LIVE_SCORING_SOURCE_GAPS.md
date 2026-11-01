# Free live-scoring source gaps

Research checked **October 31, 2026 (America/New_York)**. This is a public-documentation review, not an authenticated provider test. No signup, purchase, API-key access, production provider switch, or raw-data redistribution is part of this review.

Neither candidate currently has verified parity with Ball Knower's full live-scoring contract. Both can be evaluated as independent data inputs; neither should silently replace Tank01 or convert missing statistics to zero.

## Required scoring fields

The current `api/fantasy-live-scoring.ts` logic requires:

- Players: passing/rushing/receiving yards and touchdowns, receptions, interceptions thrown, two-point conversions, fumbles lost, and return touchdowns.
- Kickers: field goals and extra points made/missed, with attempts where supplied for consistency checks. Current scoring uses flat field-goal values; distance buckets are **not** required by today's implementation.
- D/ST: sacks, interceptions, fumbles recovered, defensive and return touchdowns, safeties, blocked kicks, and points allowed with a verified definition.
- Shared requirements: stable identity mappings, complete game coverage, game-final state, source timestamps, nullable/missing-field handling, and later stat corrections.

## Big Balls Sports Data

The [OpenAPI specification](https://bigballsdata.com/openapi.json) marks `/v1/live-stats/american_football/{matchId}/players` free and describes a 15-second cache. It returns dynamic stat keys/string cells and potentially null player IDs. Required kicker, fumble-loss and team-defense completeness has not been demonstrated. The free weekly player schema omits kicker and fumbles-lost fields. Free `/v1/nfl/team-stats` includes defense, but some components rely on nightly processing; its points-allowed definition includes every scoring phase. Live defensive/play details require Pro. The stored match-stats route explicitly exposes withheld-field metadata.

[Published quotas](https://bigballsdata.com/docs/rate-limits) are 250 requests/day, or 500 with GitHub. Illustrative calculation: one player-box request per game for sixteen three-hour games consumes 576 calls at five-minute intervals, or 192 at fifteen-minute intervals, before schedules, defense, retries, or corrections. Server caching shares results across users but does not eliminate per-game source polling.

[Terms](https://bigballsdata.com/legal/terms) permit stored/internal data use, derived outputs and app display, while excluding redistribution of raw fields through an API/file/feed/export. This distinction matters: an internal input to derived fantasy points is different from adding raw provider statistics to the public Ball Knower API.

## API-Sports

The [official NFL guide](https://www.api-football.com/news/post/how-to-get-started-with-api-nfl-the-complete-beginners-guide) documents `/games/statistics/players`, `/games/statistics/teams`, and `/games/events`, with nominal 30-second updates and a 100-request/day free plan. Its [formal YAML specification](https://api-sports.io/public/documentations/nfl-v1.yaml) uses dynamic player-stat names. The team schema does not explicitly include blocked kicks or fumble-return touchdowns; other groups/events would need validated, complete mappings. Scoring-event examples use text descriptions, not a guaranteed complete structured fantasy-stat contract.

Illustrative calculation: three endpoints per game for sixteen games cost 48 calls for one postgame pass; a correction pass brings that to 96, leaving only four calls for other needs. Frequent full-slate live polling does not fit this quota. Current-season league coverage must also be verified.

[Terms](https://api-sports.io/terms) permit application projects but disclaim granting underlying publication/commercial rights and identify possible additional fantasy-platform permissions. They prohibit multiplying free quotas through multiple accounts.

## Acceptance gate

Keep any new adapter in shadow/read-only mode until actual current-season fixtures establish every required field, player/team identity mapping, freshness cadence, and correction behavior. Validate low-frequency events including return touchdowns, safeties, blocked kicks, two-point attempts and fumble recoveries. Missing proof is an unresolved capability, not permission to assume zero. Document a daily call budget and the permitted display/derived-output boundary before enabling a replacement.
