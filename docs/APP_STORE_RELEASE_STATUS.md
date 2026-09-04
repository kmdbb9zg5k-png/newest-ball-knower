# App Store Release-Prep Status

Branch: `app-store-release-prep`
Target: `main`
Version: `1.0.0`
Bundle ID: `com.ballknower.ios`

## Completed in code

- Native Capacitor iOS packaging configuration.
- Native API bridge to the production Ball Knower backend.
- Apple/Google/email native callback URL scheme and cold-launch handling.
- Camera/photo iOS permission strings.
- App icon generation.
- Real in-app account deletion UI/API/database cleanup.
- Public privacy/support/terms pages.
- App Store metadata/privacy/review-note drafts.
- iOS release guard added to the normal hardening suite.
- PostgreSQL regression coverage for commissioner-safe account deletion.

## Intentionally not automatic

- Production database migration is not applied until the matching deletion API/UI deployment is ready.
- TestFlight submission is off until signing is verified.
- App Store submission is off until the exact TestFlight build passes a real-device gate.

## External blockers

- Apple Developer/App Store Connect app/signing configuration must be valid for `com.ballknower.ios`.
- Supabase must allow `ballknower://auth/callback` as an auth redirect.
- Production Vercel must expose a server-only Supabase admin key to the deletion endpoint.
- Sign in with Apple token revocation must be resolved for deleted Apple-authenticated accounts.
- Human App Store metadata answers/screenshots and real-iPhone TestFlight QA remain required.
