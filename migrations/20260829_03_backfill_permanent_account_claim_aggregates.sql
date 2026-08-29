-- Claims completed between the original guest-claim deployment and the
-- aggregate-transfer trigger need the same atomic merge. Allow an explicit
-- no-op claimed_at update to invoke the idempotent aggregate merger, then
-- backfill every completed claim once.
drop trigger if exists merge_guest_account_aggregates_on_claim
on public.ball_knower_guest_account_claims;
create trigger merge_guest_account_aggregates_on_claim
before update of claimed_at on public.ball_knower_guest_account_claims
for each row
when (new.claimed_at is not null)
execute function ball_knower_private.merge_guest_account_aggregates();

update public.ball_knower_guest_account_claims
set claimed_at=claimed_at
where claimed_at is not null and claimed_by is not null;
