-- Defense in depth for direct database writers: reject an aggregate transfer
-- before the merge trigger can run when guest and permanent ids are equal.
create or replace function ball_knower_private.guard_guest_account_claim_identity()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if new.claimed_at is not null then
    if new.guest_user_id is null or new.claimed_by is null then
      raise exception 'Claimed guest and permanent identities are required';
    end if;
    if new.guest_user_id=new.claimed_by then
      raise exception 'Claimed guest and permanent identities must differ';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function ball_knower_private.guard_guest_account_claim_identity()
from public,anon,authenticated;

drop trigger if exists guard_guest_account_claim_identity
on public.ball_knower_guest_account_claims;
create trigger guard_guest_account_claim_identity
before update of claimed_at on public.ball_knower_guest_account_claims
for each row
execute function ball_knower_private.guard_guest_account_claim_identity();

alter table public.ball_knower_guest_account_claims
drop constraint if exists ball_knower_guest_claim_identities_differ;
alter table public.ball_knower_guest_account_claims
add constraint ball_knower_guest_claim_identities_differ
check (claimed_by is null or claimed_by<>guest_user_id)
not valid;
