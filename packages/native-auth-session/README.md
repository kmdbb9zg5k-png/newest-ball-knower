# Native authentication session

Private Capacitor 8 iOS plugin for Ball Knower. It is installed through the root
`file:packages/native-auth-session` dependency and discovered by `cap sync ios`.
Both Swift Package Manager and CocoaPods definitions are included because the
Codemagic workflow generates the iOS project from scratch.

`authenticate({url})` starts Apple's `ASWebAuthenticationSession`. Only the
production Supabase authorization endpoint is accepted. The session is retained
until completion and anchored to the Capacitor view's actual window, including
on iPad. Cancellation returns `AUTH_CANCELLED`; a missing presenting window,
failed start or invalid callback returns a structured error. Tokens and URLs
are never logged by this plugin.

The JavaScript caller exchanges the callback code with Supabase using PKCE.
Native callbacks accept PKCE codes only. Token-only legacy deep links are
rejected because they cannot prove a locally initiated sign-in transaction;
requesting a new email link restores the supported flow. Duplicate delivery via
the native session and `appUrlOpen` shares one code exchange and one reload.
Web OAuth remains unchanged; Android retains its browser/deep-link PKCE flow.

`authorizeAppleForDeletion({nonce})` requests a fresh native Apple authorization
code without creating or changing the Supabase session. The nonce is a SHA-256
digest of 32 random bytes; the native controller validates its separate state
and anchors to the active app window. The API exchanges the one-use code,
verifies Apple's signed identity/nonce/audience against the account's linked
Apple subject, and revokes the resulting refresh token before deletion. Codes,
Apple access tokens and refresh tokens are never persisted or logged.
`npm run check:native-auth-session` checks the JS boundary with mocked native
and Supabase services. An Xcode build and actual iPhone/iPad sign-in are separate
required release checks. Native deletion additionally requires server Apple key
configuration and the iOS App ID grouped with the Supabase web Services ID.
