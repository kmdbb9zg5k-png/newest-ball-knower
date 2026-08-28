-- The member-update guard recognizes "system" for authoritative roster writes.
-- Correct the helper installed immediately before this migration.

create or replace function ball_knower_private.finalize_completed_live_draft(p_league_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_roster jsonb;
  v_ratings jsonb;
  v_member_count integer;
begin
  select * into v_draft
  from public.ball_knower_live_drafts
  where league_id=p_league_id
  for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;
  if v_draft.status<>'completed'
    or v_draft.pick_index<>jsonb_array_length(v_draft.order_member_ids)*v_draft.rounds
    or jsonb_array_length(v_draft.picks)<>v_draft.pick_index then
    raise exception 'Fantasy draft is not complete';
  end if;

  select count(*) into v_member_count
  from public.ball_knower_league_members
  where league_id=p_league_id;
  if v_member_count<>jsonb_array_length(v_draft.order_member_ids) then
    raise exception 'Draft order no longer matches league membership';
  end if;

  perform set_config('ball_knower.authorized_roster_operation','system',true);
  for v_member in
    select * from public.ball_knower_league_members
    where league_id=p_league_id
    for update
  loop
    select jsonb_agg(
      ball_knower_private.fantasy_player_payload(pick->>'playerId')
      order by (pick->>'overall')::integer
    )
    into v_roster
    from jsonb_array_elements(v_draft.picks) pick
    where pick->>'memberId'=v_member.id;

    if jsonb_typeof(v_roster)<>'array' or jsonb_array_length(v_roster)<>v_draft.rounds then
      raise exception 'Every completed fantasy roster must contain exactly % canonical players',v_draft.rounds;
    end if;
    if (select count(distinct player->>'id') from jsonb_array_elements(v_roster) player)<>v_draft.rounds then
      raise exception 'A completed fantasy roster contains duplicate players';
    end if;

    v_ratings:=ball_knower_private.fantasy_team_ratings_from_roster(v_roster);
    update public.ball_knower_league_members
    set roster=v_roster,
        team_ratings=v_ratings,
        status='ready',
        submitted_at=coalesce(v_draft.completed_at,clock_timestamp())
    where league_id=p_league_id and id=v_member.id;
  end loop;

  update public.ball_knower_leagues
  set status='drafting',rosters_locked=true
  where id=p_league_id;
  return true;
end;
$function$;

revoke all on function ball_knower_private.finalize_completed_live_draft(text)
from public,anon,authenticated,service_role;
