# Save and recovery verification — November 5, 2026

The initial cloud restore previously started upload timers after failure without
establishing a local baseline. Missing local saves could therefore become cloud
deletions, and failed session startup could leave uploads without a confirmed
owner. A `Request` containing a mutation also inherited the GET retry policy.

Writes now require a confirmed owner and completed initial read. Failed startup
keeps local play available and retries on reconnect/focus/resume. A slow initial
read releases the known owner's local shell after eight seconds; its eventual
cloud updates are staged for the existing explicit restore action. Local choices
made during the read are preserved. Background/page-hide callbacks capture
changes immediately, reconnect requests coalesce, and missing write receipts
fail the account-transition flush rather than spinning. Stale responses cannot
write metadata, restore an Owner save or emit save events after an account
boundary. Each user-state batch pins its bearer token to its original owner.
Offline deletions retain their owner-scoped timestamps across process restarts.
Edits made while Auth itself is unavailable also record that timestamp under the
unchanged startup owner, so a later reconnect cannot baseline away new progress.

The shared fetch policy bounds reads, response bodies and mutations even if a
native transport ignores abort. Only GET/HEAD retry; unknown mutation commits do
not replay at this layer. Existing dirty-state retries remain serialized and use
the latest local snapshot.

Focused checks:

- `node --import tsx scripts/request-reliability-check.ts`
- `node scripts/cloud-recovery-check.mjs`
- `node scripts/user-state-account-boundary-check.mjs`
- `node --import tsx scripts/account-identity-check.ts`
- `node --import tsx scripts/athlete-passport-check.ts`

These exercise actual provider/client/request code with controlled transport,
storage and lifecycle boundaries. They preserve the November 1 interruption
audit's staged restores and ordinary-game no-reload behavior. They do not certify
physical-device background process survival, iOS resource use or production
cross-device latency. No database migration or production write is required.
