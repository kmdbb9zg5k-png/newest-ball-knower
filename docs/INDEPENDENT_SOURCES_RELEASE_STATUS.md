# Independent sources release candidate

Tracking issue: #200. Base: main after #201. This document describes the patch, not a blanket legal or App Review approval.

## Changes

- 2026 roster/depth inputs and 2025 regular-season facts are from the documented nflverse releases under CC BY 4.0. Field whitelists explicitly omit artwork. Raw football facts are normalized and source files hashed. Their license is not a grant of athlete publicity or club trademark rights.
- A one-to-one identity crosswalk preserves every pre-existing player ID. Same-name matches require position compatibility and, where needed, current/historical team evidence. Unmatched identities are archived for saved-data resolution, never silently merged with a different athlete.
- Ratings and simulation attributes are independently calculated. They do not import game-rating values; the old copied game datasets are no longer runtime dependencies. The five owner-provided quarterback ratings are independent editorial overrides. Sparse-data/OL estimates are explicitly low confidence.
- Gameplay salaries are independent estimates, not reported contracts. Existing saved results are not recalculated by the database migration.
- Season projections are independently generated for standard, half-PPR and PPR. Missing historical inputs remain unavailable. The former commercial projection-board/Sleeper refresh is replaced by the versioned published snapshot; refresh does not falsely advance its source timestamp. These forecasts are not validated predictions or a live injury feed.
- UI draft-rank labels do not present model rank as observed ADP. Existing weekly Tank01 live scoring and score history are untouched.
- News uses a server-side bounded Tank01 headline/link adapter, not Google RSS or copied article bodies/images. Provider availability and permission for the exact intended display must still be verified; an advertised API is not a blanket publisher license.
- Native API, support, sharing and metadata URLs use ballknowerofficial.com. The old ballknower.com endpoint returned another baseball app's HTML. Preflight now requires actual Ball Knower JSON identity, not HTTP 200 alone. The obsolete native API origin fails closed.
- Codemagic runs full source/backend checks, rejects invalid version-setting failures and records the tested source commit. `auth: integration` uploads an IPA; `submit_to_testflight:false` controls beta review, not binary upload. Public review remains manual. A YAML change does not prove a build ran or a new IPA was uploaded.

## Deployment

Run full hardening, source/projection snapshot reproducibility, database integration and mobile-browser tests. Apply the new versioned source migration only after successful checks. The migration verifies the exact published snapshot hash and refuses to change catalog prices during an unfinished Draft Order Game. Existing saved roster JSON, fantasy scoring rows and completed results are not rewritten. Previously applied migrations are immutable.

The snapshot URL points to the dedicated implementation branch and is cryptographically pinned. Do not delete that branch before migration; retain a durable copy of the exact snapshot and migration evidence. Future snapshot changes require a new versioned migration and updated checksum, not a silent overwrite.

## Still requiring evidence or operator action

- Verify each current Commons photo's creator/license/provenance and any applicable person/mark restrictions. Metadata collection does not by itself authenticate an uploader's ownership.
- Keep valid distribution rights for all active soundtrack/intro/scene assets, including cloud files. No ownership record was invented by this patch.
- Obtain a focused assessment/permission for the actual uses of real athletes and club identities inside simulation modes. No blanket fictionalization, license purchase or external legal approval is included.
- Support must actively monitor and handle the community report queue. Baseline filtering is not comprehensive image moderation.
- Produce and install a signed iOS build from the merged commit and test on a real iPhone. No connected build action or existing YAML alone proves that step happened.
- Older installed builds are not repaired by a web deployment. Because the old native origin was unrelated, assess whether bearer tokens were sent there and invalidate affected sessions where appropriate. This patch is not evidence of misuse and does not claim to revoke sessions.
- Supply accurate App Store metadata, real screenshots, privacy answers and reviewer access. Do not assert that code tests establish all content rights or guarantee approval.

## Existing offline Solo budgets

Already-started offline Cap Challenge runs retain their accepted saved salary budget, clearly marked as a legacy run budget. Names and ability estimates resolve to the independent canonical player; new acquisitions and online submissions still use the new authoritative catalog. This compatibility function is not imported by the online validation path. A rejected legacy save is copied to a local recovery key before the active key is cleared. Existing online roster, history and score JSON is not rewritten.
