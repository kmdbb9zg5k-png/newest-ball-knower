# App Store release remediation — current engineering status

Tracking: #200. Updated after #201–#204; supersedes the earlier #201-only status. Passing code checks is not legal clearance or App Review approval.

## Completed engineering work

- **#201:** In-app and per-player photo attribution; original shared team badges; accurate media-partner/data-supplier wording; explicit per-render Gemini permission; database-enforced user blocking, reporting and privileged moderation actions. AI rendering remains unavailable unless the operator completes its paid-service configuration.
- **#202:** Native API, invitations and support/metadata URLs point to `https://ballknowerofficial.com`. The former domain returned a different application's HTML. An installed older native binary still needs replacing; this does not revoke existing sessions.
- **#203:** Runtime Madden ratings/roster datasets were replaced with independently calculated ratings and projections based on documented factual inputs. Five owner-entered QB ratings remain editorial. Established legacy player IDs remain resolvable. The transactional source migration installed 2,477 active catalog entries and 793 projections per scoring format; its before/after saved-roster fingerprint matched. Existing leagues, scores and game saves were not reset. News switched from Google RSS to Tank01 headline links.
- **#204:** Explicit top-news selection and safe provider diagnostics restored the public News endpoint. It returned 20 actual headline links with `available:true` in the post-deployment check. No publisher images or article summaries are republished. Missing publication dates remain unknown.
- The follow-up release gate now rejects empty, unavailable, stale or unsafe News responses, even with HTTP 200. Mobile News tests exercise navigation, headline rendering, outage clearing and recovery at 320px/390px. Publication ordering is not advertised when the provider supplies no dates.

## Native build request and verification

The existing `ios-app-store` Codemagic workflow retains `com.ballknower.ios`, its signing integration and manual beta/public review flags. It runs web and backend preflight checks before signing and records the exact source commit/build number.

A push to the single exact branch `release/ios-candidate-2026-09-06` requests one build through the repository's Codemagic webhook. Main pushes and other branches do not automatically build. This is not proof that a webhook exists or that Codemagic accepted the request. Verify an actual Codemagic build ID/result and App Store Connect processing before claiming an IPA was built/uploaded. If the webhook does not start a build, use Codemagic's existing application → Start new build → current main → ios-app-store. Email notifications are configured only to the owner's Ball Knower mailbox for the build result.

`auth: integration` is the upload configuration. The two `submit_to_*: false` values keep beta review and public review manual; they do not disable the IPA upload itself. Do not submit public review until the exact binary passes device QA and the unresolved rights/operation items below are settled.

## Remaining owner/external decisions — not coding tasks marked complete

- Obtain the remaining source/creator evidence for soundtrack, intro and scene art. Filenames saying original are not proof. Do not replace the user's uploaded music or silently delete features.
- Finish individual photo provenance/identity-use assessment. The 21 Commons pages' declared metadata has been collected; it does not grant every athlete publicity/identity right.
- Confirm the precise Tank01 headline/display/caching permissions. The existing August 23 exchange discusses the Ultra plan, caching and no formal partnership/attribution requirement; its short final reply is not a detailed media license. A follow-up permission draft exists in the owner's Gmail and has not been sent by this task without explicit send approval.
- Resolve the actual real-athlete simulation uses through appropriate permission or a qualified mode-specific assessment. No blanket fictional-player conversion was authorized as a legal conclusion and none was performed.
- Install the newly processed TestFlight build on a real iPhone, perform the flows in `AT_HOME_RELEASE_CHECKLIST.md`, and provide actual final-app screenshots plus a working reviewer login. Never put reviewer credentials in public GitHub.

## Moderation operations

The support operator must regularly review `public.ball_knower_content_reports` where `status='open'`, investigate, act and respond promptly. Reporting does not automatically email support. The baseline text filter is not comprehensive contextual or image moderation.

Use trusted administrative access only. `public.moderate_ball_knower_report(report_id, action, note)` is executable only by `service_role`; actions are `dismiss`, `remove` or `suspend`. Suspension lasts 30 days and affects messaging, not game progress. Profile/photo reports require manual review and appropriate storage/profile removal; the message removal RPC intentionally refuses to claim it removed an avatar.

## Applied migration mapping

Repository timestamps and the migration service's recorded timestamps differ. Reconcile this mapping before any CLI migration push; do not blindly apply an already-installed migration again.

| Repository file prefix | Recorded production version | Name |
| --- | --- | --- |
| 20260907010000 | 20260907010825 | community_safety |
| 20260907010100 | 20260907010839 | scope_community_safety_trigger_updates |
| 20260907020000 | 20260907024140 | independent_football_sources |

No new license purchase, signed native build, physical-device QA or Apple approval follows solely from this document. Record actual outcomes in issue #200.
