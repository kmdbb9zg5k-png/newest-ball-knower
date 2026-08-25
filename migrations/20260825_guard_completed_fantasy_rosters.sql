-- A completed snake draft is authoritative. Legacy commissioner roster-reopen
-- controls must not be able to put a completed fantasy roster back into the
-- Draft Order Game's `building` state. Keep the old commissioner helper for the
-- explicit pre-live-draft roster game, but fence it off once the live draft is
-- complete.
--
-- Existing completed-draft rows that were dirtied by the old control are
-- repaired separately through an authenticated/commissioner-safe data repair;
-- this migration itself contains no data mutation so the member-update guard
-- remains fully enforced during DDL application.

create or replace function public.commissioner_set_member_roster_status(
  p_league_id text,
  p_member_id text,
  p_status text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_member public.ball_knower_league_members%rowtype;
  v_cap numeric;
  v_spent numeric:=0;
  v_live_draft_complete boolean:=false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_ball_knower_commissioner(p_league_id) then raise exception 'Commissioner authorization required'; end if;
  if p_status not in ('building','ready') then raise exception 'Invalid roster status'; end if;

  select exists(
    select 1
    from public.ball_knower_live_drafts draft
    where draft.league_id=p_league_id and draft.status='completed'
  ) into v_live_draft_complete;

  select * into v_member
  from public.ball_knower_league_members
  where league_id=p_league_id and id=p_member_id
  for update;
  if not found then raise exception 'League member not found'; end if;

  if v_live_draft_complete and p_status='building' then
    raise exception 'Completed fantasy draft rosters cannot be reopened. Use season trades, waivers, lineup moves, or reset the league for a new season.';
  end if;

  if p_status='ready' then
    if jsonb_typeof(v_member.roster)<>'array' or jsonb_array_length(v_member.roster)<>20 then
      raise exception 'Roster must contain exactly 20 players';
    end if;

    -- Salary cap belongs only to the explicit Draft Order Game roster build.
    -- Once the standard live fantasy draft is complete, a canonical 20-player
    -- roster can be restored to ready without NFL cap-hit validation.
    if not v_live_draft_complete then
      select salary_cap into v_cap from public.ball_knower_leagues where id=p_league_id;
      select coalesce(sum(
        case when coalesce(elem->>'salary','') ~ '^[0-9]+([.][0-9]+)?$'
          then (elem->>'salary')::numeric else 0 end
      ),0) into v_spent
      from jsonb_array_elements(v_member.roster) elem;
      if v_spent>v_cap then raise exception 'Roster is over the salary cap'; end if;
    end if;
  end if;

  update public.ball_knower_league_members
  set status=p_status,
      submitted_at=case when p_status='ready' then coalesce(submitted_at,now()) else null end
  where league_id=p_league_id and id=p_member_id;

  insert into public.ball_knower_league_events(
    league_id,actor_auth_id,actor_name,event_type,message,metadata
  )
  select p_league_id,auth.uid(),league.commissioner_name,
    case when p_status='ready' then 'commissioner_force_ready' else 'roster_reopened' end,
    case when p_status='ready'
      then 'Commissioner force-readied '||v_member.user_name||'.'
      else 'Commissioner reopened '||v_member.user_name||'''s roster.' end,
    jsonb_build_object('memberId',p_member_id)
  from public.ball_knower_leagues league
  where league.id=p_league_id;
end;
$$;

revoke all on function public.commissioner_set_member_roster_status(text,text,text) from public,anon;
grant execute on function public.commissioner_set_member_roster_status(text,text,text) to authenticated,service_role;
