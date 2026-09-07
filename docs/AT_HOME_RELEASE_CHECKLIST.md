# Ball Knower: final at-home release checklist

Use the final merged commit from PR #203, not an earlier installed TestFlight build. The site is `https://ballknowerofficial.com`. The old native API domain was incorrect; a web deployment alone does not update an installed binary.

## Build and upload

1. In the existing Codemagic Ball Knower application, select current `main` and the `ios-app-store` workflow. Check the source commit matches the merged release commit and use a build number greater than the latest uploaded build.
2. Let the workflow run its full source, backend, web and signing checks. Record its IPA source SHA and build number. Do not bypass a failing gate.
3. The existing App Store Connect publishing integration uploads a successful signed artifact. `submit_to_testflight: false` controls automatic beta-review submission; it is not the switch for binary upload. `submit_to_app_store: false` keeps public review manual. Verify processing in App Store Connect rather than assuming a successful web build is an uploaded iOS build.
4. Install this exact processed build in TestFlight. No signed native build, upload or real-device test was performed by the source-cleanup task.

## Test on the iPhone

Use a disposable test account/league for destructive actions, not Justice League. Check Apple/Google sign-in and return to the app; create/join a test league; draft; inspect both rosters; change and save a legal lineup; inspect player logs; test waivers/trades; open News and Picks; upload/crop a profile photo; report/block/unblock another test manager; open Photo Credits and Data Credits; leave/reopen and verify saved progress. Delete only the disposable account and confirm another manager's league survives. Check relevant Solo/Agent/Franchise saves still reopen.

## Submission documents

Use screenshots of the actual final app, accurate privacy and content-rights answers, the correct support/privacy URLs, and a reviewer account with access to the relevant features. Keep detailed credentials out of public GitHub issues. Do not submit the generated concept mockup as a screenshot of implemented UI.

## Items code cannot certify

Complete the remaining creator/licensing records for photos, soundtrack, intro and scene art; obtain a precise answer on Tank01's intended commercial headline/data display and caching rights; resolve the specific real-athlete simulation uses. The public Commons metadata check and nflverse source notice are evidence, not a blanket license for every third-party identity. Support must actually monitor and handle content reports.

Do not declare App Review approval, legal clearance or real-device QA complete merely because CI passed. Keep issue #200 open for any unresolved permissions and operator tasks.
