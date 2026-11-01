# Career interruption caused by background cloud refresh

## Report and reproduction

The user's iPhone recording shows My Player → Training Camp → First-team audition → RB “Find the crease.” After two missed reps and a clean third rep, the app abruptly returns to Home without an error screen.

Reproduced in the actual production build with a mocked authenticated cloud session: at the third-rep result, return an equivalent My Player save with reordered JSON keys and scrubbed private-image fields. The next 30-second poll unmounts the dialog and returns Home. With cloud unavailable, all five reps and the save complete normally.

`CloudSyncProvider` compared serialized local and remote state, then incremented a React Fragment key surrounding the entire app when restoration changed that string. A cloud echo could therefore destroy navigation and unfinished gameplay even when career data was unchanged. Genuine remote updates had the same interruption risk. This establishes a code-level reproduction matching the recording; it does not diagnose every possible iOS process crash.

## Fix

- Compare normalized cloud payloads semantically, preserving meaningful array order and Owner revisions. An unchanged cloud echo preserves local-only portraits and does not rewrite storage.
- Bootstrap still restores cloud state before mounting the app. Later background pulls detect actual updates without applying them to active sessions.
- A “Load cloud save” notice explains that loading returns Home. Only this explicit action can apply pending remote state and remount the app. Ordinary local saves continue uploading automatically.
- The load action flushes local work and refetches current cloud state. Polling and explicit loads are serialized, duplicate loads are guarded, and local changes made during a network request are captured before reconciliation.
- Revisioned Owner write conflicts hydrate Owner through its existing events and preserve a conflict backup; they no longer reset unrelated modes.

## Validation

- TypeScript check and production build pass.
- Full `check:hardening-core` passes, including account identity, cloud/Owner contracts and save/privacy safeguards.
- Athlete-passport checks exercise reordered echoes, private-art preservation, preview-only updates/deletions, nested JSON equality and meaningful Owner revision/array changes.
- My Player career, journey, decisions and arc suites pass (ordered camp, immutable evaluations, save restoration, 96 decision cases and multi-season progression).
- Actual built-app mobile browser checks at 320px and 390px complete all five RB audition reps. During the third-rep result, equivalent echoes, real remote updates and failed cloud requests leave the moment mounted. Saving completes the evaluation; explicitly loading cloud state returns Home and retains the newly saved score locally and in the mock cloud.
- Owner normal-control full-season browser regression passes with revisioned cloud mocks: 17 games, postseason transition, next-season rollover and reload.
- The cloud-refresh browser regression is included in the existing hardening workflow after the production build.

The browser tests use Chromium touch emulation and controlled cloud responses. They do not certify physical iPhone memory behavior or multi-device production latency. No drill scoring, player movement, accounts, database schema or paid assets were changed.
