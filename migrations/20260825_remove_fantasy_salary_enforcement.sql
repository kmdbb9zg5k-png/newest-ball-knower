-- Normal league snake drafts finalize through the dedicated live-draft roster RPC and do not use
-- salary-cap roster submission. The legacy submit_ball_knower_roster RPC remains reachable only
-- from the explicit competitive Draft Order Game, where the salary cap is part of the rules.
-- Keep that cap enforced server-side so a stale or modified client cannot lock an over-cap roster.
create or replace function public.submit_ball_knower_roster(
  p_league_id text,
  p_roster jsonb,
  p_team_ratings jsonb
)
returns table(member_id text, user_name text, revision_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_league public.ball_knower_leagues%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_spent numeric := 0;
  v_revision integer;
  v_submitted_at timestamptz := now();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_league_id),'') is null then raise exception 'League id is required'; end if;
  if jsonb_typeof(p_roster) <> 'array' or jsonb_array_length(p_roster) <> 20 then
    raise exception 'A complete 20-player roster is required';
  end if;

  select * into v_league
  from public.ball_knower_leagues
  where id = p_league_id
  for update;
  if not found then raise exception 'League not found'; end if;
  if coalesce(v_league.paused,false) then raise exception 'This league is paused by the commissioner.'; end if;
  if coalesce(v_league.rosters_locked,false) then raise exception 'Roster submissions are currently locked by the commissioner.'; end if;

  select * into v_member
  from public.ball_knower_league_members
  where league_id = p_league_id
    and auth_user_id = v_user
    and coalesce(is_ai,false) = false
  for update;
  if not found then raise exception 'Your league membership is no longer active.'; end if;

  select coalesce(sum(
    case
      when coalesce(item->>'salary','') ~ '^[0-9]+([.][0-9]+)?$'
        then (item->>'salary')::numeric
      else 0
    end
  ),0)
  into v_spent
  from jsonb_array_elements(p_roster) item;

  if v_spent > v_league.salary_cap then
    raise exception 'Roster salary %M exceeds the %M salary cap', v_spent, v_league.salary_cap;
  end if;

  select coalesce(max(revision.revision_number),0)+1 into v_revision
  from public.ball_knower_roster_revisions revision
  where revision.league_id = p_league_id and revision.member_id = v_member.id;

  update public.ball_knower_league_members
  set status = 'ready',
      roster = p_roster,
      team_ratings = coalesce(p_team_ratings,'{}'::jsonb),
      submitted_at = v_submitted_at
  where id = v_member.id;

  insert into public.ball_knower_roster_revisions(
    league_id,member_id,auth_user_id,revision_number,roster,team_ratings,reason
  ) values (
    p_league_id,v_member.id,v_user,v_revision,p_roster,coalesce(p_team_ratings,'{}'::jsonb),
    case when v_revision=1 then 'submitted' else 'resubmitted' end
  );

  return query select v_member.id,v_member.user_name,v_revision;
end;
$$;

revoke all on function public.submit_ball_knower_roster(text,jsonb,jsonb) from public, anon;
grant execute on function public.submit_ball_knower_roster(text,jsonb,jsonb) to authenticated, service_role;
