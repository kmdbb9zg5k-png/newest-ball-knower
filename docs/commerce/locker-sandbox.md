# Locker sandbox checkout

This change prepares **web-only, private sandbox testing**, not live sales. The public Locker keeps ten free choices and four premium try-on previews. A configured, signed-in test account can buy the four test items, restore ownership, and equip them throughout the 3D career profiles, training camp, position workouts, draft Combine, standalone practice and Community Combine. Full football games retain team uniforms. Cosmetics never affect ratings or speed. Native builds do not open web checkout.

## Provisioned

- Stripe account: `acct_1UVzIs7OIO7jIgo7` (BallKnower sandbox).
- Gold Standard: `price_1UVzrU7OIO7jIgo743aFAHZG`.
- Electric Blue: `price_1UVzri7OIO7jIgo7IwChYAzD`.
- Gold Rush Trainers: `price_1UVzrl7OIO7jIgo7jd2gvCAH`.
- Gold Wristbands: `price_1UVzrn7OIO7jIgo7N1MlksZR`.
- All prices are **USD 1.00 test fixtures**, not approved retail pricing.
- Sandbox webhook `we_1UVzzE7OIO7jIgo7jZaZxfaD` sends to `https://ballknowerofficial.com/api/locker-webhook`, version `2026-09-30.endive`. The handler uses event identity to retrieve current canonical Stripe objects; event payloads do not grant clothing directly.
- Its signing secret is stored as a sensitive production Vercel environment variable. It is not in GitHub.
- `LOCKER_COMMERCE_MODE=test` is set on Vercel production. Missing credentials or tester IDs keep checkout disabled.
- Supabase migration `20261029202418_locker_sandbox_commerce.sql` has been applied to project `gpnboygoosrmeydwjpvk`.

## Required before an end-to-end test

In the Ball Knower Vercel project's **production environment variables**, securely add:

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | The `sk_test_…` key from **BallKnower sandbox**. Never use a live key or put this in a `VITE_` variable. |
| `LOCKER_TEST_BUYERS` | Comma-separated Supabase Auth user UUIDs for the actual signed-in test accounts. Anonymous guest IDs are rejected. |

The existing server Supabase service key is also required. Redeploy after setting variables. The ChatGPT Stripe connection does not give Vercel a runtime Stripe API key. Do not paste keys into chat, GitHub, or browser code.

Then use an allowed account on the web app:

1. Locker → Shop → Gold Standard → **Test purchase · $1.00**.
2. Complete Stripe's sandbox checkout with test payment data; never use a real card.
3. Return to the Locker. **Restore purchases** checks Stripe again if payment is still processing.
4. Equip the item. Reload; sign out and confirm it disappears; sign back in and restore.
5. Retry checkout for an owned item: it must not create a second payable session.
6. Refund the sandbox charge. Restore again: ownership and equipped premium appearance must be removed.
7. Replay its completion event: it must not regrant a refunded/disputed order.
8. Check webhook deliveries, a failed payment, cancellation, and delayed payment completion. A success URL alone never grants ownership.

**Not yet verified:** a real browser → deployed API → Stripe → webhook → owned-item round trip. The runtime secret and tester allowlist were absent during implementation. Local mocked Stripe/browser checks are not a substitute for this final test.

## Security and state

- The server verifies the Supabase bearer token, rejects anonymous users, and checks the test allowlist. Client-supplied prices, user IDs, payment state, and return URLs are not accepted.
- The server rejects live mode and live keys, checks the authenticated Stripe account, and validates fixed test prices and SKU metadata.
- A PostgreSQL transaction/advisory lock and unique active-order index reserve one active order per user/SKU. Session creation uses that order ID as the Stripe idempotency key; retries use the existing session. Unbound orders older than 23 hours require support rather than risking a duplicate charge after idempotency-key expiry.
- Session expiry is fixed at 24 hours after the order reservation, keeping retry parameters stable. Do not delete an old unbound order without checking Stripe for a completed/active session; reconcile it manually before allowing another checkout.
- Raw-body webhook signatures are checked by the Stripe SDK. Fulfillment independently checks session metadata, user binding, line-item quantity/price, total/currency, paid status and the current payment/charge. Refunds (including partial refunds) and disputes revoke the entire single-item test grant. Revocations are terminal, including closed disputes; restoration after a reversed dispute is deliberately not automatic.
- The ledger and outfits are sandbox-only tables. They never write to `ball_knower_entitlements` or the legacy store. Users cannot access them directly: RLS is enabled, client grants are revoked, and only the server service role can execute the invoker RPCs.
- Supabase's `rls_enabled_no_policy` INFO notices for these two tables are intentional default-deny: [linter explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Existing unrelated project warnings were not changed.
- Reads/restore reconcile outstanding and owned orders with Stripe. Verified outfit state is held in memory, cleared on identity change or refresh failure and expires after two minutes without refresh. Local storage continues to accept free items only. Sandbox items are never converted to live ownership.
- Premium try-on is an explicit preview-only prop; a saved career profile cannot equip premium clothing by supplying its own `wardrobe` field.

## Validation

- `node --import tsx scripts/locker-commerce-check.ts`: sandbox/live gates, auth, cross-user isolation, amounts, duplicate checkout, pending/paid state, restore/equip, refund/replay, account checks and real SDK signature rejection.
- `scripts/locker-commerce-database-check.sql`: actual migrated Postgres checks in a rolled-back transaction; no test purchase or user data persists.
- `node scripts/locker-commerce-browser.mjs`: mocked sandbox purchase UI, honest failure, restore/equip, account switch/revocation and 320px layout.
- Existing clothing browser checks: 320/390/1280px free equip/reload, premium preview isolation, created athlete, categories, no overflow.
- Typecheck, production build, integrity, Solo full season/playoffs/persistence and Solo navigation regression checks.

## Live release is separate

This code cannot be switched to live by changing one environment variable. Live account activation, approved retail prices, production entitlements, refund/support terms, deployment/payment verification and native-store purchase support remain future work. Do not present this sandbox as a revenue-ready launch.

## Persistent off-field outfits

`dressMyAthlete` is the shared workout/game boundary. Camp and weekly position workouts, official draft drills, standalone practice and Community drills receive the equipped outfit. It never changes the original template, competitive ID, seed, position or ratings. Full-game callers strip any wardrobe override and keep team uniforms without overwriting the saved outfit.

Career body previews always use the customized live athlete, including when a user has selected a separate selfie/preset/AI portrait. Optional portrait previews and portrait cards remain available; existing photos are not edited to change their clothing. Questions/objective pages retain their focused layout.

Standalone/Community Combine restores verified account clothing before constructing its session athlete. A running drill uses a stable appearance snapshot; changing outfits takes effect on the next workout, without restarting or resetting an attempt. Regular player previews update immediately.

Additional checks: `scripts/athlete-wardrobe-check.ts` exercises workout → game → workout persistence, fixed competitive ratings, NPC isolation and premium grant clearing. `scripts/athlete-wardrobe-browser.mjs` checks actual material uniforms in the real renderer across career, camp, weekly workouts, practice and the player-controlled Community defender, plus a mocked verified-purchase restoration on entry. Browser instrumentation exists only in the test Vite plugin.
