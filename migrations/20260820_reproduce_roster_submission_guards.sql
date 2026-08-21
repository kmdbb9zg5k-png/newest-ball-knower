-- Reproduce the roster submission safeguards already active in production.
-- This migration is intentionally idempotent so existing deployments are not disrupted.

create or replace function public.enforce_ball_knower_roster_submission_lock()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_paused boolean;
  v_rosters_locked boolean;
begin
  -- Commissioner/system updates are handled by the broader member-update guard.
  -- This trigger specifically protects an authenticated owner changing their own roster state.
  if (select auth.uid()) is distinct from old.auth_user_id then
    return new;
  end if;

  if new.roster is not distinct from old.roster
     and new.team_ratings is not distinct from old.team_ratings
     and new.submitted_at is not distinct from old.submitted_at
     and new.status is not distinct from old.status then
    return new;
  end if;

  select paused, rosters_locked
    into v_paused, v_rosters_locked
  from public.ball_knower_leagues
  where id = old.league_id;

  if coalesce(v_paused, false) then
    raise exception 'This league is paused by the commissioner.';
  end if;

  if coalesce(v_rosters_locked, false) then
    raise exception 'Roster submissions are currently locked by the commissioner.';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_ball_knower_roster_submission_lock
  on public.ball_knower_league_members;

create trigger enforce_ball_knower_roster_submission_lock
before update on public.ball_knower_league_members
for each row
execute function public.enforce_ball_knower_roster_submission_lock();

-- Roster revision numbers are scoped to one owner inside one league. Keep retries or
-- concurrent submissions from producing duplicate revision identities.
do $block$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ball_knower_roster_revisions_league_id_member_id_revision_n_key'
      and conrelid = 'public.ball_knower_roster_revisions'::regclass
  ) then
    alter table public.ball_knower_roster_revisions
      add constraint ball_knower_roster_revisions_league_id_member_id_revision_n_key
      unique (league_id, member_id, revision_number);
  end if;
end;
$block$;
