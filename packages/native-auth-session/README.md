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
Web OAuth remains unchanged; Android retains its browser/deep-link flow.
`npm run check:native-auth-session` checks the JS boundary with mocked native
and Supabase services. An Xcode build and actual iPhone/iPad sign-in are separate
required release checks.
