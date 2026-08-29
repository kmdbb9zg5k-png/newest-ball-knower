-- Cover the claimed_by foreign key for account-merge receipt lookups and deletes.
create index if not exists ball_knower_guest_claims_claimed_by_idx
  on public.ball_knower_guest_account_claims (claimed_by)
  where claimed_by is not null;
