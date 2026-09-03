-- App Store account-deletion support.
-- Keep Ball Knower league state valid while removing the deleting user's personal data.
-- This trigger runs inside the same transaction as the auth.users deletion, so a failed
-- cleanup prevents a half-deleted account.

create or replace function public.ball_knower_cleanup_account_before_auth_delete()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  league_row record;
  successor_id uuid;
  successor_auth_id uuid;
  successor_name text;
begin
  -- If the deleting user commissions a league, transfer commissioner ownership to the
  -- oldest remaining human member. If nobody remains, delete the league and its
  -- league-owned data through existing ON DELETE CASCADE relationships.
  for league_row in
    select id
    from public.ball_knower_leagues
    where commissioner_auth_id = old.id
    for update
  loop
    successor_id := null;
    successor_auth_id := null;
    successor_name := null;

    select id, auth_user_id, user_name
      into successor_id, successor_auth_id, successor_name
    from public.ball_knower_league_members
    where league_id = league_row.id
      and auth_user_id is not null
      and auth_user_id <> old.id
      and coalesce(is_ai, false) = false
    order by created_at asc, id asc
    limit 1;

    if successor_id is null then
      delete from public.ball_knower_leagues where id = league_row.id;
    else
      update public.ball_knower_league_members
      set is_commissioner = (id = successor_id)
      where league_id = league_row.id;

      update public.ball_knower_leagues
      set commissioner_auth_id = successor_auth_id,
          commissioner_name = successor_name,
          updated_at = now()
      where id = league_row.id;
    end if;
  end loop;

  -- These legacy/current columns intentionally are not all foreign keys to auth.users,
  -- so remove them explicitly before the auth row disappears.
  delete from public.ball_knower_league_messages where auth_user_id = old.id;
  delete from public.ball_knower_notifications where auth_user_id = old.id;
  delete from public.ball_knower_owner_profiles where auth_user_id = old.id;
  delete from public.ball_knower_roster_revisions where auth_user_id = old.id;
  delete from public.ball_knower_league_members where auth_user_id = old.id;

  return old;
end;
$$;

revoke all on function public.ball_knower_cleanup_account_before_auth_delete() from public;

-- One trigger per auth user deletion keeps cleanup coupled to the actual account delete.
drop trigger if exists ball_knower_cleanup_before_user_delete on auth.users;
create trigger ball_knower_cleanup_before_user_delete
before delete on auth.users
for each row execute function public.ball_knower_cleanup_account_before_auth_delete();
