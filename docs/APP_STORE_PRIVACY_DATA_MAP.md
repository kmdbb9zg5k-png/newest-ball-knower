# Ball Knower App Store Privacy Data Map

Use this document as the engineering source of truth when answering App Store Connect App Privacy questions. Final answers should match the production configuration and any third-party SDKs enabled at submission time.

## Account and profile

- Email address: used for authentication/account access when the user chooses email sign-in.
- User ID / account identifier: used to maintain identity, league ownership, saved progress, and security.
- Name / GM alias: user-provided profile information.
- Profile photo: optional, user-provided; stored for profile display.

## Product interaction and gameplay

- League membership, rosters, transactions, messages, scoring state, picks, trivia/game progress, settings, achievements, and similar in-product activity are stored to provide Ball Knower features and sync state.

## Diagnostics and analytics

- Basic product analytics and technical/error information are used for reliability and product improvement.
- Approximate country/region/city analytics may be recorded. Ball Knower's product policy states that raw IP addresses are not intentionally stored as profile data.

## Device permissions

- Camera: requested only when the user chooses to take a profile photo.
- Photo library: requested only when the user chooses an existing profile photo.

## Third-party/service-provider categories to account for in App Store Connect

Review the production configuration at submission time for:

- Supabase — authentication, database, storage.
- Vercel — hosting/serverless delivery and analytics currently integrated in the web client.
- Tank01/RapidAPI — sports data provider; verify whether any user-identifying data is transmitted before submission.
- Email delivery provider, if enabled for production support/auth-related delivery.
- Any Google authentication / Sign in with Apple provider data required for login.

## Tracking

Do not mark data as used for cross-app tracking unless production code/SDK behavior actually meets Apple's definition of tracking. Re-audit before submission if advertising, attribution, or additional analytics SDKs are added.

## Deletion

The App Store release branch provides in-app account deletion and removes the auth identity, profile photo, and user-linked Ball Knower data, with commissioner transfer for leagues that still contain another human member.
