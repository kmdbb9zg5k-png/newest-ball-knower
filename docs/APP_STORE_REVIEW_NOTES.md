# Ball Knower App Review Notes

Use this text as the starting point for App Store Connect review notes for version 1.0.0.

Ball Knower is an independent football and fantasy-football entertainment application. It does not operate a sportsbook or process real-money wagers.

Guest play is available. Users who want a permanent identity may use Apple, Google, or email authentication. Test the authentication flows on a device after `ballknower://auth/callback` has been added to the Supabase redirect allowlist.

Camera and photo-library permissions are optional and requested only when the user explicitly chooses to take or select a profile photo.

Account deletion is available in-app from the Privacy screen. The user taps Delete my account and then a second Permanently delete account confirmation. The account identity and user-linked data are removed; if the user commissions a league containing another human member, commissioner ownership is transferred rather than deleting the other members' league.

Support URL: https://ballknower.com/support.html
Privacy Policy URL: https://ballknower.com/privacy.html
Terms URL: https://ballknower.com/terms.html
