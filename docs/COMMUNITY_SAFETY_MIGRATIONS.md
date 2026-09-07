# Community safety migration order

Apply both additive migrations, in order, before deploying the UI:

1. `20260907010000_community_safety.sql`
2. `20260907010100_scope_community_safety_trigger_updates.sql`

The second migration limits update triggers to body, author and thread/league identity columns. Deleting a parent message causes PostgreSQL to clear its replies' `reply_to` foreign key. That metadata-only update must remain possible even when the deleting user is not the reply's author, or that author has left the league.

CI runs the entire original fixture plus the real self-referencing reply foreign key and a moderation deletion while a different user identity is set. It retains all previous authorization, roster preservation and account-deletion checks. The fixture is generated in `/tmp` from committed tests and actual production RPC definitions; no production data is used.

A passed database test does not establish content licenses or eliminate the need for support staff to review reports. See `APP_STORE_REMEDIATION_STATUS.md` for the outstanding legal/source and operational work.
