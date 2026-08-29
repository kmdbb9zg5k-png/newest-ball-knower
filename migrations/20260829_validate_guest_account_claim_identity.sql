-- NOT VALID installs the write-time guard without a blocking table scan.
-- Validate separately so existing rows are checked with the lighter lock.
alter table public.ball_knower_guest_account_claims
validate constraint ball_knower_guest_claim_identities_differ;
