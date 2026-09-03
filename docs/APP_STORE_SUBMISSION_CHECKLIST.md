# Ball Knower App Store Submission Checklist

## Engineering

- [ ] Release PR green in GitHub Actions.
- [ ] Vercel preview green.
- [ ] Account deletion migration applied to production after matching API/UI deploy.
- [ ] Production account-delete endpoint has server-only Supabase admin key.
- [ ] `ballknower://auth/callback` added to Supabase redirect allowlist.
- [ ] Sign in with Apple token-revocation handling resolved.
- [ ] Codemagic signed IPA generated for `com.ballknower.ios` version 1.0.0.
- [ ] Exact IPA passes `docs/TESTFLIGHT_DEVICE_GATE.md`.

## App Store Connect

- [ ] App record uses bundle ID `com.ballknower.ios`.
- [ ] Name and category entered.
- [ ] Description, keywords, support URL, privacy URL, and marketing URL entered.
- [ ] Screenshots uploaded for required iPhone display sizes.
- [ ] App Privacy answers match `docs/APP_STORE_PRIVACY_DATA_MAP.md` and production SDK behavior.
- [ ] Age rating completed.
- [ ] Content rights completed.
- [ ] Export compliance completed.
- [ ] Pricing and availability completed.
- [ ] App Review contact information completed.
- [ ] Review notes based on `docs/APP_STORE_REVIEW_NOTES.md` entered.
- [ ] Correct tested build selected.
- [ ] Release method selected (manual recommended for 1.0.0).

## Final rule

If code, native configuration, signing, environment variables, or the IPA changes after the device gate, retest the new build before App Review submission.
