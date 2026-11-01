# Free NFL adapter status

Versioned games, players and injuries routes use fixed public nflverse CSV releases without provider keys. The schedule source is `https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv`; roster/injury modules export the exact 2026 asset URLs.

Adapters validate actual release schemas and team coverage, bound downloads and allow only approved GitHub redirects. Kickoffs are UTC conversions from US Eastern. Injuries represent the latest reported week; missing source update times remain null. Responses retain nflverse attribution and license metadata.

These are periodically published datasets, not live fantasy scoring. Existing scores, Picks, identity mappings and Ask BK remain unchanged. Currents news integration is prepared separately and requires a server-only free API key plus live coverage verification. The snapshot cache was verified and enabled for the nflverse feeds in PR #522; it is not used for Currents news.

Run `node --import tsx scripts/bk-free-upstream-smoke.mjs` for real downloads through production handlers. See `BALL_KNOWER_SPORTS_API.md` and PR #522 for configuration and release status.
