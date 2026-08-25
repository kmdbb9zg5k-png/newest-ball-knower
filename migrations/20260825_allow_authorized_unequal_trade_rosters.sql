-- Post-draft trades may legitimately leave a human team below the 20-player
-- draft maximum (for example, sending two players for one). The trade/waiver
-- RPCs already enforce the roster maximum and ownership rules. Do not let the
-- generic draft-submission trigger reject those authorized season operations
-- just because the member remains in the `ready` state.

create or replace function public.enforce_ball_knower_member_update()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_requester uuid := public.fantasy_requester_id();
  v_is_commissioner boolean := public.is_ball_knower_commissioner(new.league_id);
  v_paused boolean;
  v_rosters_locked boolean;
  v_roster_count integer;
  v_authorized_operation text := current_setting('ball_knower.authorized_roster_operation', true);
begin
  if v_requester is null then
    raise exception 'Authentication required';
  end if;

  if not v_is_commissioner and old.auth_user_id = v_requester then
    if new.id is distinct from old.id
       or new.league_id is distinct from old.league_id
       or new.auth_user_id is distinct from old.auth_user_id
       or new.app_user_id is distinct from old.app_user_id
       or new.is_commissioner is distinct from old.is_commissioner
       or new.is_ai is distinct from old.is_ai then
      raise exception 'League membership identity fields cannot be changed by members';
    end if;
  end if;

  select league.paused, league.rosters_locked
    into v_paused, v_rosters_locked
  from public.ball_knower_leagues league
  where league.id = new.league_id;

  if not found then raise exception 'League not found'; end if;

  if not v_is_commissioner
     and old.auth_user_id = v_requester
     and coalesce(v_authorized_operation, '') not in ('trade', 'waiver')
     and (new.roster is distinct from old.roster
          or new.team_ratings is distinct from old.team_ratings
          or new.status is distinct from old.status
          or new.submitted_at is distinct from old.submitted_at) then
    if v_paused then raise exception 'This league is paused by the commissioner'; end if;
    if v_rosters_locked then raise exception 'Roster submissions are currently locked by the commissioner'; end if;
  end if;

  if new.status = 'ready'
     and (new.status is distinct from old.status or new.roster is distinct from old.roster) then
    v_roster_count := jsonb_array_length(coalesce(new.roster, '[]'::jsonb));

    if coalesce(v_authorized_operation, '') in ('trade', 'waiver') then
      -- Season management may leave an open bench spot, but never exceed the
      -- standard fantasy roster maximum. The RPC performs its own stricter
      -- operation-specific validation as well.
      if v_roster_count > 20 then
        raise exception 'Roster cannot exceed 20 players';
      end if;
    elsif v_roster_count <> 20 then
      -- Draft submission / force-ready still requires the complete draft
      -- roster. Only the explicitly authorized season operations are exempt.
      raise exception 'A ready roster must contain exactly 20 players';
    end if;
  end if;

  return new;
end;
$$;
