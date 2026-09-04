# Ball Knower — Owner-Only Actions

These are the remaining actions that require account-holder access, device access, or secrets that must not be committed to the repository.

1. Apple Developer/App Store Connect: confirm or create the Ball Knower app record for `com.ballknower.ios`.
2. Supabase dashboard: add `ballknower://auth/callback` to allowed authentication redirect URLs.
3. Vercel project settings: confirm a server-only `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY` exists for production and preview as appropriate.
4. Codemagic: confirm the App Store Connect integration `BallKnowerApple` and `code-signing` environment group are connected to the correct Apple team.
5. Sign in with Apple: provide/configure the Apple key/client-secret material needed to meet Apple's token-revocation requirement on account deletion.
6. Run the signed iOS workflow and install the exact build through TestFlight on a real iPhone.
7. Complete the real-device checklist and capture App Store screenshots from the tested build.
8. Complete App Store Connect privacy/age-rating/content-rights/export-compliance/review-contact fields.
9. Select the exact tested build and submit it for App Review.

Do not send Apple private keys, certificate private keys, Supabase service-role keys, or other server secrets in chat or commit them to GitHub. Use the provider's secret/environment settings.
