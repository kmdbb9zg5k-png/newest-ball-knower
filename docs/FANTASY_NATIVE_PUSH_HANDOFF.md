# Fantasy native push handoff

This parity pass persists owner-scoped events in `ball_knower_notifications`. In-app delivery remains the source of truth. Events now cover scheduled-draft reminders, on-clock and autopick notices, trade state/thread changes, waiver results, player status, league chat/DMs, watched Trading Block players, matchup reminders, and final scores.

Native iOS/Android push is deliberately not enabled until the app shells provide all of the following:

1. A private device-token table keyed by permanent `auth.users.id`, platform, installation ID, token hash, last-seen time, and revoked time. Clients may only manage their own installations; service role alone may enumerate tokens.
2. APNs and FCM credentials stored in server-only Vercel/Supabase secrets. They must never be exposed through `VITE_*` variables or browser RPC results.
3. A service-role delivery worker that claims notification rows idempotently, sends one push per installation, records provider message IDs/outcomes, retries transient failures with backoff, and revokes invalid tokens.
4. Explicit notification permission UX plus per-kind preferences. Disabling push must not disable the in-app notification row.
5. Deep-link contracts for league, draft, trade, waiver, DM, lineup, and matchup destinations in both app shells.
6. Device-loss/sign-out handling that revokes that installation without deleting permanent-account notification history.

Until those pieces exist, treating database events as delivered native pushes would be incorrect. Web/in-app notifications continue to work independently.
