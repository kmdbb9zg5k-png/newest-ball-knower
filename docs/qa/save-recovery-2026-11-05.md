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
An owner-scoped durable dirty ledger preserves offline edits and explicit
deletions across process restarts. Account isolation clears that outgoing intent;
missing local data after a later account switch restores the existing cloud save
instead of inferring a deletion from a stale timestamp. Edits made while Auth is
unavailable retain the unchanged startup owner. Bootstrap observes identity
changes during both session creation and delayed guest claiming.

The shared fetch policy bounds reads, response bodies and mutations even if a
native transport ignores abort. Only GET/HEAD retry; unknown mutation commits do
not replay at this layer. Existing dirty-state retries remain serialized and use
the latest local snapshot. Timed-out, unsettled mutations remain serialized with
later writes to the same endpoint, so a native transport that ignores abort
cannot deliver an old save after its newer retry. Requests waiting for that
transport also time out without dispatching a duplicate. A backend transaction
that outlives a rejected connection still needs server revision protection for
an absolute ordering guarantee; Owner already has that protocol.

Gauntlet queues, guest merge steps, Fantasy watchlists and soundtrack preferences
retain their producing account identity through deferred reads and writes. A
late soundtrack restore also preserves mute/volume choices made while loading,
and an untouched failed read never uploads default preferences.

Focused checks:

- `node --import tsx scripts/request-reliability-check.ts`
- `node scripts/cloud-recovery-check.mjs`
- `node scripts/user-state-account-boundary-check.mjs`
- `node --import tsx scripts/account-flow-boundary-check.mjs`
- `node --import tsx scripts/account-identity-check.ts`
- `node --import tsx scripts/athlete-passport-check.ts`

These exercise actual provider/client/request code with controlled transport,
storage and lifecycle boundaries. They preserve the November 1 interruption
audit's staged restores and ordinary-game no-reload behavior. They do not certify
physical-device background process survival, iOS resource use or production
cross-device latency. No database migration or production write is required.
