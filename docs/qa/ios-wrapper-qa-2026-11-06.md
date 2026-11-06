# Full iOS wrapper QA — November 6, 2026

The native app is generated from the locked Capacitor 8.5.1 CLI/iOS packages.
The private authentication/haptic Swift plugin is unchanged. All four native
plugins (private auth, App, Browser and Push Notifications) are included by SPM.

## Reproducible preparation

On a Mac with Xcode 26 or later and Node 22:

```sh
npm ci --no-audit --no-fund
npm run build
npx --no-install cap add ios --packagemanager SPM
npx --no-install cap sync ios
python3 scripts/configure-ios-project.py
node scripts/generate-ios-icon.mjs
bash scripts/build-ios-simulator.sh
```

Use a clean checkout. `ios/` is generated and intentionally excluded from Git.
After any later `cap sync`, run the configuration and icon scripts again before
building. The configuration script preserves unrelated plist/project settings,
merges the callback URL scheme, adds user-initiated camera/photo descriptions,
enables Apple/Push capabilities, and installs the documented APNs registration
callbacks. Debug uses development APNs; Release uses production APNs. The
exported IPA audit verifies the actual signed entitlements and embedded profile.

## What the macOS workflow checks

`.github/workflows/native-app-simulator.yml` first compiles the full production
web bundle inside the actual iOS app target in Release configuration for both
Simulator architectures without signing. It audits the built `.app`, including
the production bundle ID, local web assets, icon compilation, permissions,
custom callback scheme and registered native plugin classes.

It then builds and installs a separate Debug-only `.nativeqa` fixture on a fresh
iPhone Simulator. The fixture uses the real WKWebView, Capacitor bridge,
AppDelegate and native plugins. The production photo crop/compression and native
auth callback code run with only their Supabase service boundary substituted,
so no real identity exchange, upload or deletion occurs. It checks:

- Private plugin registration and native iOS routing.
- Swift rejection of insecure/untrusted OAuth URLs and an invalid Apple-deletion nonce.
- Completion of the real UIKit warning-feedback request. Simulator completion
  does not prove physical feedback.
- Real WebKit PNG decoding, selected square crop, 512 × 512 JPEG encoding and
  corrupted-JPEG rejection.
- Actual warm and cold custom-scheme delivery through the App plugin. Token-only
  callbacks are rejected by the production handler without a session exchange.
- Camera/photo authorization remains undetermined without a user action.

The workflow retains exact source and lockfile hashes, Xcode/Swift versions,
separate production/fixture build logs, sanitized JSON results and screenshots.
No QA file/controller is included by the signed-candidate workflow; a candidate
containing fixture assets or the fixture bundle ID fails the built-app audit.

## Distribution stages

`ios-app-store` remains the default Codemagic workflow and now produces artifacts
only. It uses the existing `BallKnowerApple` integration and `code-signing` group,
fetches existing signing files without creating certificates/profiles, and does
not upload to App Store Connect or send build email. Missing signing resources
are a configuration gate, never a reason to create credentials automatically.

`ios-app-store-upload` preserves the existing upload and owner-email capability
as a separate manual stage. Its `BK_APPROVED_UPLOAD_SHA` must exactly match the
full commit specifically approved for upload. Both review-submission flags
remain false. Selecting this stage uploads an IPA even with those flags false;
the flags do not make the upload itself build-only. It is not selected as part
of this task.

## Evidence and remaining gates

Local Linux verification covers repeatable project configuration, the production
web build, native auth/session/deletion regressions, photo crop/save regressions,
GM feedback behavior and release-source contracts. Linux cannot run Xcode or an
iOS Simulator. The actual macOS run and its exact source are recorded in the PR.

The Codemagic account check reached its sign-in page; this session has no
authenticated Codemagic account. No Apple/Codemagic credentials or integration
values were inspected, changed or created. Starting the build-only signed
workflow requires the owner to select an existing sign-in method securely.

Neither an unsigned wrapper compile nor the fixture proves successful real
Apple/Google/email authorization, physical camera/library interaction, APNs
delivery, native Apple account revocation, physical haptics, multiplayer behavior
or a TestFlight install. The exact signed commit/build must pass
`docs/TESTFLIGHT_DEVICE_GATE.md` on a physical iPhone and iPad. Server-only Apple
and APNs configuration and Apple App-ID/Services-ID grouping remain external
gates until verified with authorized account access. No App Store review is
requested by this work.

Primary references:

- [Capacitor 8 migration](https://capacitorjs.com/docs/updating/8-0)
- [Capacitor SPM](https://capacitorjs.com/docs/ios/spm)
- [Capacitor push registration callbacks](https://capacitorjs.com/docs/apis/push-notifications)
- [Codemagic signing](https://docs.codemagic.io/yaml-code-signing/alternative-code-signing-methods/)
- [Codemagic App Store Connect publishing](https://docs.codemagic.io/yaml-publishing/app-store-connect/)
