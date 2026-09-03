# Ball Knower Final Pre-Submission Precheck

Immediately before App Review submission:

- Confirm production `ballknower.com` is responding normally.
- Confirm no recurring high-severity Vercel runtime errors in the previous 24 hours.
- Confirm Supabase auth and database are healthy.
- Confirm the TestFlight build number matches the build selected in App Store Connect.
- Confirm account deletion still works with a disposable account.
- Confirm Apple, Google, and email login return to the native app.
- Confirm profile-photo permission prompts and uploads work on iPhone.
- Confirm fantasy live scoring/transactions do not produce 5xx errors.
- Confirm privacy/support URLs are publicly reachable without authentication.
- Confirm App Privacy answers match the production SDK/data behavior.

If any release code or native configuration changes, create a new build and repeat the device gate.
