# Fantasy push delivery

## Contracts

- `GET /api/push?resource=config`: public `{web:{ready,publicKey},apns:{ready},android:{ready:false}}`. Keys and tokens are never returned; the VAPID public key is public by design. Readiness means credentials validate locally, not a verified device receipt.
- All other `/api/push` requests require a permanent Supabase user's Bearer access token, verified with `auth.getUser`, matching its verified JWT subject and live `auth.sessions` ID on every account operation. Devices reference that session, so server-side sign-out deletes their pending delivery registrations. The API derives the owner and rejects client-supplied owner fields.
- `GET ?resource=settings`: account quiet hours `{quietEnabled,timeZone,startMinute,endMinute}`; defaults disabled, UTC, 22:00–07:00.
- `POST {action:"settings",quietEnabled,timeZone,startMinute,endMinute}`: save that account's quiet interval. Timezone is IANA; endpoints are local wall-clock minutes. Equal endpoints are invalid. All push categories honor quiet hours; in-app alerts are unaffected.
- `GET ?resource=devices`: owner's redacted device list (ID, installation ID, transport, label, last seen and revoked time), never endpoints, tokens, or key material.
- `POST {action:"subscribe",installationId,installationSecret,transport:"web",subscription:{endpoint,keys:{p256dh,auth}},label}` or `transport:"apns",token`: register the authenticated owner. The per-installation secret permits secure account changes on that installation and is stored only as a hash server-side. A token cannot silently move between unrelated installations. `restore:true` refreshes only an existing active registration for the same owner/session; a remotely revoked device requires another explicit Enable action.
- `POST {action:"unsubscribe",installationId,installationSecret}` revokes this owner's installation. `POST {action:"revoke-device",deviceId}` lets the owner revoke a lost device.
- `GET /api/push?resource=notification&id=<uuid>` resolves the authenticated owner's notification to its exact league and known destination, rechecking current membership even for push-only alerts. No arbitrary URL is accepted.
- `GET /api/push-delivery`: CRON_SECRET Bearer auth, once per minute; claims a bounded batch, sends to fixed provider endpoints and records acceptance/suppression/retry. Recommended Vercel cron: `{ "path": "/api/push-delivery", "schedule": "* * * * *" }`.

Existing four-category in-app/push preferences continue using their owner-derived RPCs. Devices register only after an explicit Enable button and granted OS/browser permission. Guest browsing never prompts. A push service worker does not intercept fetches or cache app code. A push tap focuses a running client or opens the canonical app with a notification ID; the client resolves authorization before selecting a league or destination.

## Delivery semantics

Only notifications inserted after the queue trigger is installed are eligible. Each event queues only for devices already registered at insertion; enabling a device never blasts old history. There is one receipt per notification/device, exclusive leases with claim tokens, bounded exponential retry, and an expiry. Provider acceptance is recorded as `accepted`, never as proven device receipt. A lost provider response may cause a retry; stable notification tags/APNs collapse IDs reduce duplicate presentation. Exactly-once remote delivery is not promised.

Every attempt rechecks current owner, permanent-account status, membership, both the event's persisted push flag and the owner's current category preference, read state, revoked/expired device and event expiry. Quiet hours are evaluated in Node Intl by scanning real instants, independent of older database tzdata. They defer until the first permitted local wall-clock minute; expired time-sensitive alerts are discarded. No event bypasses quiet hours. Draft turns are checked against the current live draft identity, turn, owner and deadline before dispatch. Draft countdowns expire at scheduled start and are invalidated by a reschedule or an already-created draft; draft-start notices are discarded after completion. Permanent provider failures revoke invalid subscriptions; credential/config errors do not falsely revoke devices. Queue details and credentials are service-role-only in the private schema with RLS enabled.

## Server setup

Required existing server variables: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`), `CRON_SECRET`.

Web: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (real external `mailto:` or HTTPS contact). Run `node scripts/generate-push-vapid.mjs /absolute/private/output-directory https://ballknowerofficial.com` once. It creates mode-0600 files and prints paths only. Provision these server-side; never use `VITE_` for private material. Rotating VAPID requires browsers to resubscribe.

iOS: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (.p8 PEM, literal newlines or escaped `\n`), `APNS_TOPIC=com.ballknower.ios`, `APNS_ENVIRONMENT=production` for App Store/TestFlight or `sandbox` for development-signed installs. Missing configuration is reported unavailable. Android is reported unavailable until a shell and FCM transport are configured.

The native wrapper must install pinned `@capacitor/push-notifications`, enable Push Notifications capability, carry the provisioning profile's correct `aps-environment`, and forward `didRegisterForRemoteNotificationsWithDeviceToken` and `didFailToRegisterForRemoteNotificationsWithError` to Capacitor's corresponding `NotificationCenter` events. Native setup is owned by the native release workflow.

Apply the reviewed migration through the release owner's normal migration path. Review Supabase database tzdata: October 30, 2026 documents a Vancouver/Edmonton/Casablanca correction in Postgres 15.19.0.003 / 17.11.0.003 and later. The deployed database currently predates this fix; delivery deliberately avoids database timezone conversions. Runtime readiness also checks the three 2026 timezone rules and fails closed if Node embeds older tzdata. Inspect `process.versions.tz` in operator checks; do not upgrade either runtime or production database without separate regression tests.

## Release verification

Run `npm run check:push`, `npm run check:fantasy-notifications`, `node --import tsx scripts/fantasy-notification-routing-check.ts`, `npm run lint`, and the `Push notification delivery` PostgreSQL integration workflow. The SQL fixture is disposable local/CI-only, not a production smoke script. Before claiming live delivery, verify the migration, cron, environment, explicit permission, foreground/background receipt, exact push tap destination, account change/sign-out revocation and quiet interval on a real subscribed browser and signed iPhone. APNs configuration readiness alone does not satisfy that physical-device gate.
