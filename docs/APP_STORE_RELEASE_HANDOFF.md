# Ball Knower — App Store Release Handoff

Prepared September 3, 2026.

## Repo-side work completed in this release branch

- Capacitor iOS identity: `com.ballknower.ios` / Ball Knower.
- Codemagic signed IPA workflow with App Store signing integration.
- iOS version `1.0.0`; build number supplied by Codemagic.
- Production 1024×1024 icon generation from the Ball Knower vector, with transparency flattened.
- Camera and photo-library iOS permission descriptions.
- Native `ballknower://auth/callback` URL scheme for Apple, Google, and email authentication callbacks.
- Cold-launch and warm-launch native auth callback handling.
- CapacitorHttp enabled and `/api/*` calls rewritten to `https://ballknower.com` for native builds.
- Real in-app account deletion with explicit confirmation.
- Transactional database cleanup/commissioner-transfer migration for deleted accounts.
- Public App Store URLs:
  - Privacy: `https://ballknower.com/privacy.html`
  - Support: `https://ballknower.com/support.html`
  - Terms: `https://ballknower.com/terms.html`
  - Marketing: `https://ballknower.com`
- Deterministic `npm run check:ios-release` gate included in the normal hardening suite.
- Automatic App Store submission intentionally remains OFF until the exact IPA passes TestFlight on a real iPhone.

## Owner / Apple-account actions still required

These cannot safely be completed from repository code alone.

1. In Apple Developer / App Store Connect, confirm the App ID / app record uses bundle ID `com.ballknower.ios`.
2. Confirm the Codemagic App Store Connect integration is named `BallKnowerApple`, and the `code-signing` environment group contains the required certificate private key/signing values. Never commit those secrets to GitHub.
3. In Supabase Auth URL Configuration, add `ballknower://auth/callback` to the allowed redirect URLs before testing Apple, Google, or email sign-in on iPhone.
4. Confirm the production Vercel project has a server-only `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) because `/api/account-delete` requires admin deletion. Do not use a `VITE_` prefix for this key.
5. Sign in with Apple: Apple requires associated Sign in with Apple tokens/authorization to be revoked when the Ball Knower account is deleted. The current Supabase auth flow does not persist an Apple refresh token in Ball Knower's backend, so this must be completed before treating Sign in with Apple deletion as fully closed. Configure the Apple private-key/client-secret path needed for revocation or adopt an Apple/Supabase-supported revocation flow.
6. Run the Codemagic `ios-app-store` workflow and keep `submit_to_testflight: false` for the first signed build. Download the generated IPA/artifact or switch only TestFlight submission on once signing is verified.
7. Install the exact build on a real iPhone through TestFlight and test: fresh install, guest play, Apple sign-in, Google sign-in, email magic link, profile photo camera/library, fantasy API calls, push/deep-link behavior, logout, and account deletion using a disposable test account.
8. In App Store Connect complete the human-entered metadata: screenshots, age rating, content rights, App Privacy answers, review contact, export-compliance questions, pricing/availability, and release setting.
9. Submit the same tested build to App Review. Do not rebuild after the device gate unless the new build is retested.

## Suggested App Store metadata

- Name: `Ball Knower`
- Version: `1.0.0`
- Primary category: Sports
- Privacy Policy URL: `https://ballknower.com/privacy.html`
- Support URL: `https://ballknower.com/support.html`
- Marketing URL: `https://ballknower.com`

Suggested reviewer note:

> Ball Knower is an independent football/fantasy entertainment app and does not process real-money wagers. Guest play is available. Permanent accounts can use Apple, Google, or email. Profile camera/photo-library permission is requested only when a user chooses a profile photo. Account deletion is available from Privacy → Delete my account and requires a second confirmation.

## Do not submit until these are green

- GitHub hardening checks on the release PR.
- Vercel preview build.
- Supabase account-deletion migration applied only after the corresponding API/UI code is deployed.
- Native auth redirect allowlist configured.
- Apple token-revocation requirement resolved for Sign in with Apple.
- Signed IPA successfully generated.
- Real-iPhone TestFlight pass on that exact IPA/build number.
