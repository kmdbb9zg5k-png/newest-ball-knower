# Bounded Tank01 production readiness diagnostic

This route does not enable scoring. `GET /api/fantasy-scoring-readiness` requires
`Authorization: Bearer <CRON_SECRET>` and consumes no provider calls unless
`VERCEL_ENV=production` and `TANK01_READINESS_ENABLED_UNTIL` is an ISO timestamp
strictly in the future and at most one hour ahead. It uses the existing runtime
`TANK01_API_KEY`; do not retrieve, copy, print or move that sensitive credential.

The fixed fixture is `2026_08_CHI_SEA`, played November 2, 2026, provider ID
`20261102_CHI@SEA`. On November 6 the public schedule reported CHI 34, SEA 17,
and `released_games.csv` independently included the game. These sources were
published at `2026-11-06T01:36:34Z` and `2026-11-03T04:31:33Z` respectively.

Add this temporary cron entry through the deployment owner (this change does
not edit deployment configuration):

```json
{"path":"/api/fantasy-scoring-readiness","schedule":"*/15 * * * *"}
```

Temporarily set `TANK01_READINESS_ENABLED_UNTIL` to an actual UTC ISO time less
than one hour ahead, deploy, then read the `fantasy-scoring-readiness` log. Remove
the flag/cron after the observation. Expiry disables subsequent invocations.
At most two provider calls run concurrently per authorized enabled invocation:
a completed-game box score and week-8 projection request. Each has an 8-second
request/body deadline and 4 MB cap; redirects and retries are disabled. The
function has a 15-second maximum duration. A 15-minute schedule is at most four
enabled executions/eight requests during a one-hour window.

The response returns no provider statistics. The log contains only constructed
coverage/identity counts and request/source-timing metadata. No database client,
provider-body cache, scoring write, raw error or raw player row exists here.
Provider IDs from the existing crosswalk remain provisional: name matches are
counted diagnostically but never used to assign identity. Missing stat fields
remain missing, including D/ST points allowed. A successful probe establishes
only actual credential/endpoint access and shape/coverage for one completed
game; it does not certify live cadence, rare-event semantics, corrections,
identity namespace, projection week metadata or activation.

Validation: `node --import tsx scripts/fantasy-scoring-readiness-check.ts`.

For HTTP 401/403 only, the existing bounded reader consumes the JSON error body
and emits a fixed `authenticationFailure` enum: `not_subscribed`,
`invalid_api_key`, `forbidden_or_restricted`, or `unknown`. Raw messages, request
IDs, links and credentials are neither returned nor logged. These bodies never
enter stat/identity coverage. Unknown, contradictory, non-JSON or over-limit
errors remain `unknown`; a 403 alone does not prove a subscription/key problem.
The classifier reports the provider's stated category, not an account diagnosis.

The request uses the published RapidAPI Tank01 NFL host with `X-RapidAPI-Key`
and `X-RapidAPI-Host`, GET `/getNFLBoxScore?gameID=YYYYMMDD_AWAY@HOME`, and
GET `/getNFLProjections?week=8`. Header names are case-insensitive. Primary
references rechecked November 6, 2026:

- https://docs.rapidapi.com/v2/docs/configuring-api-authentication
- https://rapidapi.com/tank01/api/tank01-nfl-live-in-game-real-time-statistics-nfl/playground/apiendpoint_2b51b742-93f5-4185-ac4c-81729bf096c2
- https://rapidapi.com/tank01/api/tank01-nfl-live-in-game-real-time-statistics-nfl/playground/apiendpoint_244b2b2c-ab39-4f48-91f0-a6f01546dc06
