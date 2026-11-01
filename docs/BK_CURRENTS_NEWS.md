# Currents news integration

## Deployment

Create one Free Currents account at https://currentsapi.services/en/register. Store `CURRENTS_API_KEY` as a Sensitive server environment variable in the Ball Knower Vercel project's Production and Preview environments, then redeploy. Never use a `VITE_` prefix, commit the key, paste it in chat, or add it to a URL. No additional paid plan is required for this integration.

Both `/api/nfl-news` (legacy `articles` envelope) and `/api/bk/v1/news` (`items` envelope) use the same Currents adapter. The default app route continues to be `/api/nfl-news`, so existing app clients and the Home ticker can receive the new provider without a native rebuild. `VITE_BK_NEWS_API_ENABLED` selects the versioned response only; it does not select a different upstream provider. Neither news endpoint falls back to Tank01. Missing key, exhausted quota or unavailable data yields an honest unavailable state.

The deployed source must be tested with the real key before release. Confirm NFL relevance, original publisher links, actual publication dates, attribution, mobile display, and failure/recovery behavior. Fixture tests do not prove live source coverage.

## Display and usage

The adapter requests a fixed English NFL query and bounded recent date window. A conservative headline/link filter rejects unrelated full-text matches (including school-game and other-league reports). It can omit player-only headlines without clear NFL/team context; it does not infer relevance from hidden article descriptions. It exposes only headline, publisher, original URL and publication metadata. The app displays `Powered by Currents News API` linked to https://currentsapi.services/ beside Currents content and links stories to original publishers. Article bodies, previews, images and end-user AI summaries are excluded. Ask BK retains its independent live-search capability and existing cost controls, but no longer fetches Tank01 headline context or receives Currents content for summaries.

This is an app backend for Ball Knower, not a standalone licensed redistribution feed. These sources document the intended headline/link app workflow and limits:

- https://currentsapi.services/en/docs/search
- https://currentsapi.services/en/news-aggregator-api
- https://currentsapi.services/en/product/price
- https://currentsapi.services/en/faq
- https://currentsapi.services/terms

## Cache and quota

Short-lived process/edge caches and coalescing reduce repeat requests. News payloads do not use the durable sports snapshot table or an archive. A warm process can retain an expired object until reuse or teardown, but never serves it as fresh. The implementation has no cross-instance lease or global quota guarantee: cold starts, multiple regions and both API response formats can consume additional requests. Respect upstream rate-limit cooldowns and fail closed on exhaustion. Do not promise that a process-local cache enforces the account's daily request budget.

At the time of integration the official Free tier allows 250 requests/day and 20 results/request, with no overage billing; exhaustion returns429. No alternate accounts or quota evasion are used. Keep one canonical app route and review actual account usage after activation.

## Scope

This replaces news access only. Fantasy scoring and Picks still have Tank01 dependencies tracked in issue526. Historical Tank01 attribution remains intact. No scores, leagues, player IDs, saved careers, or partner records are migrated by this change.
