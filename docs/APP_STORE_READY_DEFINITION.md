# Definition of App Store Ready

Ball Knower is App Store ready only when all of the following are true:

- Release PR and required CI are green.
- Matching production web/API deployment is healthy.
- Account-deletion migration is applied and verified.
- Native auth redirect is allowed by Supabase.
- Sign in with Apple deletion/revocation requirement is resolved.
- Codemagic produces a signed IPA for `com.ballknower.ios` version 1.0.0.
- The exact IPA is installed through TestFlight and passes the real-device gate.
- Required App Store Connect metadata, privacy disclosures, screenshots, and review information are complete.
- The build selected for App Review is the same build that passed device QA.
