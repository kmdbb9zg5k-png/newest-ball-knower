# All-screen visual verification

Tracking PR: #207. Application implementation reviewed: `d24676505b0cc3015d31ad1e7b3ae4764c8acaab`, based on approved Home main `b1dc206fa28d854c9cad317cc0c957538ddfea2c`.

## Completed visual checks

Isolated Actions run **34148575213** passed TypeScript, all-screen contracts, production build, the original startup-size limit, existing fantasy/profile-photo mobile checks, and the complete all-screen browser walkthrough using captured public headline data.

Its artifact is **10028607689**, `all-screen-final-evidence`, archive SHA-256 **fed863f995467f34a35a29628a29dafade20e934b4d9b6c4ed046db48ef3417f**. Downloaded, checksum-verified and inspected the actual screenshots. Preserve evidence before the three-day Actions retention expires.

The all-screen run captured 15 actual destinations at 320px, 390px and 1280px: Fantasy, News, Picks, Trivia, Solo, Agent, Owner, Franchise Command, My Player, League HQ, Profile, Hall of Fame, Partners, Fantasy Franchise and Cap Challenge. This is 45 screenshots, not 45 separately redesigned features. Draft/season/research surfaces have matching static treatment; individual fantasy tables and gameplay engines were not rebuilt.

Checks include real navigation controls, header/content separation, horizontal fit, five bottom tabs, shared motion preference, dynamic Reduce Motion, focused-game ticker suspension, and stopping offscreen decorative animation when the backdrop is outside the viewport. The existing profile-photo test passed at 375/390/392/430px, including decoding/cropping an oversized input without committing an upload.

## Corrections found through verification

- Changed the existing Profile-test heading to the actual new `Your Locker` title while retaining its complete layout/photo assertions. Target the real outer app header rather than a new page masthead.
- Fixed oversized help buttons caused by the base unlayered button font reset. In crowded mastheads the help icon remains labeled for assistive technology and opens the original instructions.
- Trimmed the office image's top eight pixels to remove text baked into the supplied concept crop. No new high-resolution photo is claimed.
- Observe the decorative backdrop itself, not the full long page, for offscreen motion suspension.

## Test data and limitations

The all-screen browser explicitly blocks Supabase requests and does not modify production accounts/leagues. Default/demo state is not the owner's private league. Profile error messages in that evidence reflect blocked test account access. A captured Picks-provider timeout exercises the unavailable view rather than invented odds; the run is not proof of live Picks uptime. Agent and Owner screenshots show their initial onboarding; their gameplay/continuation logic remains covered by existing engineering checks, not a complete physical-device career playthrough.

This is real browser evidence, not generated screenshots or physical iPhone/TestFlight QA. Source crops can remain soft, especially on desktop. No exact replica of the generated collage's invented thumbnails, crown or alternative navigation is claimed.

## Merge and release gate

The final pull-request workflows must pass on the final reviewed head before merge. Do not count a workflow awaiting approval or a skipped job as a pass. Do not change permissions or disable failing checks to publish. Record the final check IDs, merge SHA and successful production deployment in the PR.

No database, player identity, rating/projection input, scoring algorithm, saved-career, soundtrack, intro or native signing configuration was changed. A web deployment does not update the installed TestFlight binary. Broader rights/device/operator tasks in #200 remain separate.
