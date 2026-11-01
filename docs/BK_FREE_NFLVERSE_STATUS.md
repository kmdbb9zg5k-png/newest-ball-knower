# Free NFL data adapter status
- `GET /api/bk/v1/games` now reads the public nflverse/nfldata schedules CSV. No token required. 2026 season games only.
- Produces season, week, matchup, game day/time (source-local, without invented timezone), final scores when present. Do **not** treat this as live in-game scoring.
- Credits nflverse under CC BY 4.0 in each API response; user-facing screens that show this data should link to https://github.com/nflverse/nflverse-data and https://creativecommons.org/licenses/by/4.0/.
- Origin: https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv ; canonical source used in code: https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv .
- In-memory five-minute cache is per function instance; no persistent sync or Supabase mirroring yet.
- Contract check: `node --import tsx scripts/bk-nflverse-schedule-check.ts`.
- Existing main app scores, fantasy, news, and picks unchanged, pending validation.
- News requires an independently licensed feed. Player/injury integrations require separately verified release formats and licenses. Do not switch current production UI before checking compatibility.
