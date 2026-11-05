# Ball Knower TestFlight Device Gate

Run this checklist against the exact build number intended for App Review. A rebuild resets this gate.

## Install / launch

- Fresh install launches without a blank screen or native error.
- Ball Knower intro/loading presentation fills the safe area correctly.
- Existing web navigation remains usable on the target iPhone.

## Identity

- Guest identity starts and persists through relaunch.
- Apple sign-in returns to Ball Knower and restores the correct identity.
- Google sign-in returns to Ball Knower and restores the correct identity.
- Email magic link opens Ball Knower even from a cold launch.
- New PKCE email links work; old token-only links show a retry error without switching accounts.
- Duplicate warm/cold callback delivery performs one sign-in and preserves guest progress.
- Guest-to-permanent-account merge preserves leagues/progress.
- Logout returns to the expected guest/account state.

## Native networking

- Home data loads.
- Fantasy league list loads.
- Fantasy matchup/live-scoring API calls return successfully.
- Waiver/transaction actions reach the production API.
- No request is accidentally sent to `capacitor://localhost/api/...`.

## Profile photo

- Take Photo permission prompt is clear and appears only after user action.
- Camera photo can be saved.
- Choose From Photos permission prompt is clear and appears only after user action.
- Selected photo can be saved.
- Failed upload does not destroy the existing avatar.
- Remove Photo works.

## Account deletion

Use a disposable test account.

- Privacy → Delete my account is easy to find.
- First tap does not delete anything.
- Second confirmation clearly says deletion is permanent.
- Switch accounts during the confirmation/save flush: the previous confirmation cannot delete the newly signed-in account.
- On the signed iOS build, an Apple-backed disposable account requests fresh Apple authorization, matches the linked subject and confirms token revocation before deletion.
- Cancel native Apple authorization and retry; the account remains intact after cancellation. Choosing a different Apple account cannot revoke it or delete the linked Ball Knower account.
- Simulate an Apple verification/revocation failure in a test environment: the native flow retains the account and can retry.
- Missing Apple server configuration/provider-token fallback clearly retains a manual-removal notice after the intentional sign-out/reload; do not count that result as a passed automatic-revocation gate.
- Account disappears and cannot be reused as the prior authenticated identity.
- Avatar object is removed.
- User-linked records are removed.
- A commissioned league with another human member remains and transfers commissioner status.

## Fantasy critical path

- Create/join league.
- Open roster and opponent roster.
- FLEX changes behave correctly.
- Player details/game logs/schedule load.
- Free-agent list and filters work.
- Add/drop/waiver flow works.
- Trade entry point works from opponent/player context.
- Weekly matchup screen loads both teams and can change week/matchup.
- Push/notification behavior required for the submitted build is verified.

## Release decision

Do not submit unless all applicable checks pass and there are no recurring production 5xx errors tied to the tested build.
