# Ball Knower App Review Notes

Use this text as the starting point for App Store Connect review notes for version 1.0.0.

Ball Knower is free-to-play football entertainment: fantasy roster management, fictional football simulations, trivia, news, and prediction records. It has no paid contest entry, deposits, wagers, payouts, cash-out, cash prizes, or other prizes of monetary value. XP, ratings, salary caps and simulated team finances are not purchasable or redeemable and have no monetary value. Daily Picks records correct/incorrect predictions only. It does not connect users to a sportsbook or facilitate wagers. Apple is not a sponsor of or involved in any Ball Knower activity.

Regarding guideline 5.3.4: Please re-evaluate the real-money gaming classification in light of the above features. Reviewers can open Picks to see the free-play rules and prediction record. Fantasy and trivia competition is for rankings and personal achievement only, with no entry fees or prizes. If a specific remaining screen suggests otherwise, please identify it so we can address the concern precisely.

Guest play is available. Users who want a permanent identity may use Apple, Google, or email authentication.

The replacement iOS build routes Apple and Google OAuth through ASWebAuthenticationSession, anchored to the active app window, instead of a generic browser popover. It uses PKCE to exchange the return code, validates the callback, and handles cancellation or presentation failure without leaving the sign-in controls stuck. To test, open Account, choose Apple, complete sign-in, then repeat after cancelling a sign-in. Guest progress is retained through the existing account merge.

Camera and photo-library permissions are optional and requested only when the user explicitly chooses to take or select a profile photo.

Account deletion is available in-app from the Privacy screen. The user taps Delete my account and then a second Permanently delete account confirmation. The account identity and user-linked data are removed; if the user commissions a league containing another human member, commissioner ownership is transferred rather than deleting the other members' league.

Support URL: https://ballknowerofficial.com/support.html
Privacy Policy URL: https://ballknowerofficial.com/privacy.html
Terms URL: https://ballknowerofficial.com/terms.html

## Release operator checklist (do not paste into Apple notes)

- Replace rejected build 9 with the newly compiled candidate; do not resubmit build 9.
- Compile the local `@ball-knower/native-auth-session` plugin with Capacitor 8 in Codemagic.
- On a real iPhone and iPad, test Apple success, cancel/retry, and cold-launch callback; confirm guest league/progress migration and returning account sign-in. Test Google and email callback regression as well.
- Record the exact tested build number and commit. Static/JS tests do not establish that native Apple sign-in works on-device.
- Submit the candidate and above notes only after native QA. Do not claim Apple accepted the 5.3.4 clarification until a review response confirms it.
