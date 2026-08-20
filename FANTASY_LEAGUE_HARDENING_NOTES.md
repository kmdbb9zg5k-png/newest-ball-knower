# Fantasy League Operations Hardening

- Online leagues default to 17-game seasons unless the commissioner explicitly chooses 16.
- Rejoining the same league is idempotent: the same authenticated user cannot create duplicate memberships.
- Join operations run atomically in Postgres, serialize capacity checks, and reject over-capacity joins.
- Roster submissions verify that the member row still exists instead of silently succeeding after removal/stale state.
- Realtime league refresh remains the source of truth after joins, submissions, and commissioner changes.

Database protections:
- `UNIQUE (league_id, auth_user_id)` on human memberships.
- `join_ball_knower_league(...)` RPC with authenticated-only execute permission, explicit auth check, league row lock, reconnect detection, capacity check, and one membership insert.
