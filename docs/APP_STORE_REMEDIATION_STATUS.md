# Preserve-feature App Store remediation

Tracking: #200. This is a targeted implementation, not complete legal clearance.

## Implemented

- Original abbreviation badges replace the shared ESPN team-logo URL path while preserving all team choices, themes and layouts.
- Photo Credits is available in the app footer; player details expose the applicable creator/source/license links. Credits are lazy-loaded to preserve the initial JavaScript budget.
- Partner wording identifies Ball Knower's media partner and data supplier without suggesting a Dallas Cowboys endorsement or a formal Tank01 partnership.
- My Player requires an unchecked, explicit, per-render permission step before sending a selfie and descriptive inputs to Google Gemini. The server rejects absent/stale permission before consuming quota. `store: false` disables stored interaction history, not all provider retention.
- Rendering additionally requires `MY_PLAYER_AI_PAID_SERVICE_CONFIRMED=true`, to be set only after the operator verifies the applicable paid-service data terms and account setup. This deployment does not activate the unavailable AI service or purchase anything.
- League chat, direct messages and trade discussions offer report and block controls. Blocking is enforced in the database for direct/trade messages in both directions; existing shared-league history is hidden from the blocking user. Teams, trades themselves, rosters and scores are not removed by blocking.
- Reports are authoritatively resolved from existing content, private to the reporter/support, deduplicated and rate-limited. A trusted moderator can remove reported messages or suspend messaging access.
- Tests cover account binding, report privacy, original message RPCs, bilateral blocking, anonymous denial, abusive-text rejection, unblocking, service-generated receipts, deletion cascades, unchanged rosters, AI consent and mobile credit access.

## Deployment order

1. Run the JavaScript and disposable PostgreSQL checks in `.github/workflows/app-store-remediation.yml` and the existing full hardening suite.
2. Apply `migrations/20260907010000_community_safety.sql` to the production project using the migration mechanism.
3. Merge only the reviewed implementation branch after all required checks pass; verify the resulting deployment and public pages.
4. Test actual iPhone/TestFlight screens before public release. A successful web build is not a new native binary.

## Moderation operations: human work remains required

The owner/support operator must monitor `public.ball_knower_content_reports` for `status='open'` regularly and respond promptly. This PR does NOT create an autonomous moderation service or send an automatic email for every report. Users can also contact the support email shown in Community Safety.

Use privileged Supabase administrative access, never a browser or a published service key. Inspect evidence and context before taking action. `public.moderate_ball_knower_report(report_id, action, note)` is granted only to `service_role`; supported actions are `dismiss`, `remove`, and `suspend`. Suspension is limited to messaging for 30 days and does not delete game progress. An administrator can remove an erroneous suspension from `ball_knower_private.community_suspensions`. Record the reason and follow up with the reporter as appropriate.

Profile/photo reports require manual storage/profile review and, when justified, removal of the uploaded asset with the established profile-storage tools; the message-removal RPC deliberately refuses to pretend it removed a profile photo. The baseline prohibited-text filter catches selected clearly abusive phrases; it is not comprehensive contextual or image moderation. Full operational coverage of objectionable shared profile images and content must be verified before public App Store submission.

## Still open — do not mark #200 fully resolved

- Independent ratings/roster source or applicable authorization for Madden-derived inputs, with stable player IDs and tested versioned data migrations. No ratings or roster identities were changed here.
- Permission or replacement for external fantasy projection/depth-chart inputs, including Sleeper and the sources in saved ranking provenance. No production ranking rows were rewritten here.
- Permission or replacement for Google News RSS. The existing News destination and feed remain unchanged in this PR, not claimed cleared.
- Per-image original provenance and license validation of all 21 Commons photographs. Accessible attribution is necessary but is not proof that an uploader owned a photo or a player's personality rights were licensed.
- Media-rights evidence for cloud/bundled music, intro and scene graphics, and review of standalone artwork beyond the shared logo helper.
- Focused legal assessment or permission for the specific real-athlete simulation uses. Agent, Franchise, Owner and My Player game engines and saves remain intact.
- Confirm production domain/native API URLs and run real-device release validation.

No new player faces, purchases, third-party license agreements, external legal approval, or App Store submission are part of this patch.
