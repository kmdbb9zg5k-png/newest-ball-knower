-- The draft roster lock protects manual roster submissions. It must not block
-- server-authorized season transactions after the draft, otherwise every
-- trade/waiver fails as soon as the commissioner has locked drafted rosters.

create or replace function public.enforce_ball_knower_roster_submission_lock()
returns trigger
language plpgsql
set search_path='public'
as $$
declare
  v_paused boolean;
  v_rosters_locked boolean;
  v_authorized_operation text := current_setting('ball_knower.authorized_roster_operation', true);
begin
  -- Trade and waiver RPCs validate ownership/roster legality themselves and
  -- explicitly mark the transaction before touching member rosters.
  if coalesce(v_authorized_operation,'') in ('trade','waiver') then
    return new;
  end if;

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
$$;
