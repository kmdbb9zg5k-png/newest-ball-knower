# Ball Knower Sports API (v1 foundation)

This introduces four optional, independently configurable public read-only routes:

- `GET /api/bk/v1/news`
- `GET /api/bk/v1/games`
- `GET /api/bk/v1/players`
- `GET /api/bk/v1/injuries`

Each requires an approved HTTPS JSON upstream configured in Vercel production environment variables:
`BK_NEWS_JSON_URL`, `BK_GAMES_JSON_URL`, `BK_PLAYERS_JSON_URL`, `BK_INJURIES_JSON_URL`.

Accepted upstream payloads are a root array or object with `items`, `data`, or entity-specific arrays (`articles`, `games`, `players`, `injuries`). Unknown or malformed rows are removed. Only sanitized, intentionally limited fields are returned; source titles/descriptions are not reproduced in bulk. Cache TTL is 5 minutes for news/injuries, 1 minute for games and 1 hour for players, per function instance.

**Current state:** These endpoints do not replace the production Tank01 news route or existing fantasy/picks feeds. Without configured, licensed sources they correctly return HTTP 503 with `available:false`, not fabricated scores or articles. No reliable live-feed capability can be claimed until an authorized data source is connected, ingestion is verified on a deployment, and the UI is explicitly migrated.

**Next steps:** obtain redistribution permissions or approved feeds, store snapshots in Supabase for cross-instance cache and outage resilience, wire the News UI to /api/bk/v1/news with appropriate fallback, add actual data source adapters and end-to-end deployment checks. Live sports data may require paid licensing.

Run contract test: `node --import tsx scripts/bk-sports-api-check.ts`.
