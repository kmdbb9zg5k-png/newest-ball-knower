# Fantasy native push handoff

This parity pass persists owner-scoped events in `ball_knower_notifications`. Each new event has a server-derived category plus independent `in_app_visible` and `push_eligible` decisions from the owner's Draft, Roster, Transactions, and League preferences. In-app delivery remains available without native push. Events cover scheduled-draft reminders, on-clock and autopick notices, trade state/thread changes, waiver results, player status, league chat/DMs, watched Trading Block players, matchup reminders, and final scores.

Native iOS/Android push is deliberately not enabled until the app shells provide all of the following:

1. A private device-token table keyed by permanent `auth.users.id`, platform, installation ID, token hash, last-seen time, and revoked time. Clients may only manage their own installations; service role alone may enumerate tokens.
2. APNs and FCM credentials stored in server-only Vercel/Supabase secrets. They must never be exposed through `VITE_*` variables or browser RPC results.
3. A service-role delivery worker that claims notification rows idempotently, sends one push per installation, records provider message IDs/outcomes, retries transient failures with backoff, and revokes invalid tokens.
4. Explicit notification permission UX in each app shell. The database and League HQ now persist category preferences and independent channel decisions; native delivery must honor `push_eligible` without changing `in_app_visible`.
5. Deep-link contracts for league, draft, trade, waiver, DM, lineup, and matchup destinations in both app shells.
6. Device-loss/sign-out handling that revokes that installation without deleting permanent-account notification history.

Until those pieces exist, treating database events as delivered native pushes would be incorrect. Web/in-app notifications continue to work independently.

## November 5, 2026 in-app audit

`FantasyNotificationInbox` now opens a known destination within the currently selected league through an `onOpenDestination` callback. `fantasyNotificationRouting.ts` maps draft, roster, trade, waiver, message, matchup and results event kinds; it excludes other leagues and hidden in-app rows and suppresses duplicate row IDs. A read-receipt failure does not block opening the destination. This is in-app routing, not a native push-tap callback.

Quiet hours are not implemented in the current fixed-column category-preference contract. Do not advertise or infer them from `push_eligible`. A future delivery worker needs an explicit owner timezone, quiet interval including overnight/date-boundary handling, an urgent-event policy, and delivery-time evaluation before provider dispatch.

Current external/native gates are unchanged: `package.json` contains no native push plugin or provider worker, and `capacitor.config.json` only configures Capacitor HTTP. Codemagic generates the iOS project and an Apple sign-in entitlement; it does not install push registration or an `aps-environment` entitlement. Completing native delivery requires APNs entitlement/provisioning and server credentials for `com.ballknower.ios`, native permission/token registration and revocation, a private token registry, idempotent worker/provider receipts and retry policy, push-tap routing, and physical-device receipt tests. Android delivery also requires an Android shell/FCM configuration. No provider credentials, entitlement or production database change is made by this audit.
