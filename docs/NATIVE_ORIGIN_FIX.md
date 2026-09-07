# Native production origin correction

The prior native API origin and shared invite URLs used ballknower.com. A credential-free probe returned a different baseball application's HTML rather than Ball Knower football API JSON. The verified football deployment is ballknowerofficial.com.

This patch corrects native API requests, share/invite links, support and social metadata. It does not change the bundle ID, Apple callback scheme, Supabase project, player identities, leagues or saved games. An executable test rejects a generic webpage masquerading as a successful health response.

Existing installed native builds are not changed by a web deployment: rebuild and install a new signed IPA through Codemagic/TestFlight. Do not submit the previous binary. If a user made authenticated API calls through an older build, assess potential exposure of bearer tokens to the previous domain; there is no evidence here of misuse. Do not claim this code change revokes existing sessions.

Still required: real-device sign-in, protected API and account-deletion QA on the new binary, and review of the separate remaining content-source items in issue #200.
