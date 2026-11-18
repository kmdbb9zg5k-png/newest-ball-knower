# Store cart and checkout

Shoppers can add Tunnel Fit and Gold Standard to one persistent cart, remove items, and check out once. These are the two collections with implemented wearable mappings; all other concept/catalog products retain previews. One copy per account. Existing $1 private Locker fixtures remain separate.

## Playable characters

The same cart accepts the two supported outfits and characters with gameplay rigs. The server snapshots item type and cents on each order. Verified live orders unlock characters in Profile and gameplay. Refunds and disputes remove access. Sandbox orders verify the receipt without granting gameplay access on the live account.

`STORE_CHARACTER_PRICES` is a server environment variable containing a JSON object from approved character SKUs to their USD price in integer cents. Without a configured live price a character remains preview-only. Test mode gives allowlisted buyers a $1.00 test price per playable character unless a test price map is configured. Check both migrations with `scripts/store-cart-database-check.sql` in a rollback transaction.

## Deployment and activation

Payment routes fail closed until explicitly configured. This PR does not activate live charging. Apply `supabase/migrations/20261110164332_store_cart_orders.sql` and `supabase/migrations/20261117014000_store_character_purchases.sql` in that order before enabling the service. Use the existing Supabase server secret. Configure secrets as sensitive server-only Vercel variables, never in VITE variables or source.

- `STORE_COMMERCE_MODE`: `test` first; `live` only after full provider tests.
- `STORE_TEST_BUYERS`: comma-separated authenticated user UUIDs for private tests.
- Stripe: `STORE_STRIPE_KEY` (restricted key preferred), `STORE_STRIPE_ACCOUNT`, `STORE_STRIPE_WEBHOOK_SECRET`.
- PayPal: `STORE_PAYPAL_CLIENT_ID`, `STORE_PAYPAL_SECRET`, `STORE_PAYPAL_MERCHANT_ID`, `STORE_PAYPAL_WEBHOOK_ID`. Credentials must match the selected sandbox/live environment.

Stripe hosted Checkout dynamically presents enabled eligible cards/Apple Pay/Google Pay. Configure wallet availability in the merchant Dashboard. PayPal uses its own Orders v2 approval/capture flow, since U.S. Stripe merchants do not have Stripe's PayPal payment method. No raw card data enters this app.

Webhook endpoints (required):
- `/api/store-webhook`: Stripe `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
- `/api/store-webhook?provider=paypal`: PayPal `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.RESOLVED`.

The ledger snapshots USD catalog prices server-side. Authenticated API reads reconcile provider records, and signed webhook handlers process asynchronous completion even without a browser return. Web return parameters never grant ownership. Refunds (including partial refunds) and disputes revoke the complete bundled order and stay revoked on event replay. Dispute resolution requires support review to reinstate. One pending cart per account/environment prevents parallel duplicate purchases; Stripe sessions can be canceled from the cart. PayPal pending orders can be resumed with the same cart/provider; unresolved/abandoned orders require support rather than risking a second charge. Provider idempotency windows are bounded and old ambiguous orders require support.

## Checkout promo codes

Customers enter the code on hosted Stripe Checkout. Create and manage campaigns in the Stripe Dashboard for the chosen environment. Review other active merchant-wide Stripe codes before enabling live Store Checkout, since eligible account-level codes can apply to these carts. PayPal checkout does not accept Stripe codes.

The ledger keeps the original catalog subtotal. Reconciliation verifies both the original cart and Stripe's per-item discounts, then matches the discounted total to the payment and charge. A full discount unlocks items only after Stripe confirms a completed zero-cost session. Verify valid, invalid and expired codes, a discounted payment and a zero-cost order in sandbox before enabling the corresponding live codes.

Outfits persist by account and environment, and only server-verified wearables appear in My Wardrobe. Native builds do not expose payment actions; native purchasing is a separate integration. Tax collection is not configured or advertised as enabled.

## Verification

- `npm run lint`
- `npm run build`
- `node --import tsx scripts/store-cart-check.ts`
- `node --import tsx scripts/locker-commerce-check.ts`
- `node scripts/store-cart-browser.mjs` (320/390/1280 widths; requires a browser-capable host)
- Run migration + `scripts/store-cart-database-check.sql` in a rollback transaction to verify the ledger without retaining test records.

Required before live activation: actual sandbox two-item payment for each provider, wallet device checks, successful asynchronous webhook delivery, logout/login restore, equip, duplicate-event/retry and refund verification, then live merchant onboarding and correct live credentials. The current connected Stripe account is only BallKnower sandbox; no PayPal credentials were available in this session.
