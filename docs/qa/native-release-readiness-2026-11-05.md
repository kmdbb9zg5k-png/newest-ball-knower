# Native release readiness — November 5, 2026

## Implemented and checked in source

- Capacitor 8 packaging retains `com.ballknower.ios`, the production HTTPS API
  bridge, auth URL scheme, Sign in with Apple entitlement and manual store
  submission flags in Codemagic. No purchase, upload or submission was performed.
- Native sign-in callbacks now accept PKCE codes only. An implicit-token deep
  link cannot force an unrelated account onto the device. Duplicate callback
  deliveries share a single exchange/reload; partially installed listeners can
  recover, and foreground/background events manage auth refresh and cloud resume.
- iOS Apple-backed account deletion requests a fresh authorization code from the
  existing private native plugin. The server exchanges it directly with Apple,
  verifies the RS256 JWS against current Apple JWKS, and checks issuer, audience,
  nonce, subject, linked account, expiry and issue time before revoking the refresh
  token. An invalid, replayed, expired, mismatched or failed code does not delete
  the account. No long-lived Apple credential is stored by Ball Knower.
- Confirmation binds to the displayed account across cloud flush/native auth.
  An older completed request cannot sign out a subsequently signed-in account.
  Successful deletion globally revokes Supabase refresh sessions first and cleans
  every page of owned avatar objects. Existing access JWTs still expire naturally;
  this is not instant JWT invalidation.
- Missing Apple configuration/provider tokens still permit the established
  deletion fallback. The result explicitly reports manual revocation required,
  and an Apple-removal notice survives the sign-out reload until dismissed. That
  fallback must never be counted as successful automatic Apple revocation.

## Focused executable verification

- `node scripts/native-auth-session-check.mjs`
- `node scripts/account-deletion-recovery-check.mjs`
- `node scripts/account-deletion-client-check.mjs`
- `node --import tsx scripts/native-auth-release-check.ts`
- `node scripts/ios-app-store-release-check.mjs`

The API suite runs the actual handler and actual signature verifier against
synthetic RSA/EC keys and mocked Apple/Supabase services. Negative cases cover
algorithm/key/signature, issuer/audience/subject/nonce/time, used-code rejection,
provider timeout, missing configuration, session revocation and multi-page avatar
cleanup. The client suite checks confirmation/account switches and notice timing.
No real account was deleted and no production data, secrets or schema changed.

## External gates still requiring evidence

1. Set valid server-only `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`,
   `APPLE_NATIVE_CLIENT_ID=com.ballknower.ios`, and `APPLE_OAUTH_CLIENT_ID` for the
   Supabase web Services ID. Never expose them with `VITE_`. This audit did not
   inspect or change production credential values.
2. In Apple Developer, enable Sign in with Apple for the signed native App ID and
   group the web Services ID with the same primary App ID. Native and web subjects
   must match the Apple identity already linked in Supabase. A grouping mismatch
   fails closed and needs account-holder configuration, not a relaxed subject
   check. Supabase must allow `ballknower://auth/callback` and have valid Apple and
   Google provider configuration.
3. Build the updated Swift plugin in Codemagic/Xcode with valid signing. Linux JS
   and source checks do not compile AuthenticationServices or certify an IPA.
4. Test the exact signed commit/build on a physical iPhone and iPad using the
   updated `docs/TESTFLIGHT_DEVICE_GATE.md`, including cold/warm auth, native
   Apple deletion, cancellation/retry, offline/background recovery and guest merge.
5. Finish App Store account metadata/screenshots and submit only the tested
   candidate. These actions remain with the release operator.

There is no new database migration for this authorization-code recovery path.
Browser deletion can use provider tokens when the current Supabase session has
them; a restored browser session without them follows the explicit manual-removal
fallback. Automatic revocation for every browser-only deletion is not claimed.

## Primary references checked

- [Apple: verifying a user](https://developer.apple.com/documentation/signinwithapple/verifying-a-user)
- [Apple: token validation](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens)
- [Apple OpenID discovery](https://appleid.apple.com/.well-known/openid-configuration)
- [Apple current JWKS](https://appleid.apple.com/auth/keys)
- [Apple: account deletion and revocation](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [Supabase: native auth refresh lifecycle](https://supabase.com/docs/reference/javascript/auth-startautorefresh)
- [Supabase: sign-out and JWT lifetime](https://supabase.com/docs/reference/javascript/auth-signout)

The Supabase changelog was checked. The November 10, 2026 legacy TLS-cipher change
does not require an API/signature change for this supported Capacitor 8 target;
the exact device/network path still belongs in native QA.
