-- Final trust boundary for the explicit Draft Order Game roster builder.
-- Normal fantasy snake drafts never use this RPC. The caller may still send the
-- legacy team-ratings argument for API compatibility, but it is intentionally ignored.

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
  v_ids text[];
  v_spent numeric := 0;
  v_revision integer;
  v_submitted_at timestamptz := now();
  v_canonical_roster jsonb;
  v_team_ratings jsonb;
  v_qb numeric;
  v_rb numeric;
  v_wr numeric;
  v_te numeric;
  v_ol numeric;
  v_dl numeric;
  v_lb numeric;
  v_cb numeric;
  v_s numeric;
  v_passing numeric;
  v_rushing numeric;
  v_pass_rush numeric;
  v_run_def numeric;
  v_coverage numeric;
  v_offense numeric;
  v_defense numeric;
  v_overall numeric;
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

  -- This legacy 20-man salary builder exists only for the explicit Draft Order Game.
  -- Once the order game is finished or a live snake draft exists, this endpoint is dead.
  if coalesce(v_league.settings->>'draftOrderMethod',v_league.settings->>'draft_order_method','') <> 'game' then
    raise exception 'Roster submission is only available in the Draft Order Game.';
  end if;
  if v_league.status <> 'drafting' or v_league.season_result is not null then
    raise exception 'The Draft Order Game roster-building phase is closed.';
  end if;
  if exists(select 1 from public.ball_knower_live_drafts d where d.league_id=p_league_id) then
    raise exception 'The live fantasy draft has already been created.';
  end if;

  select * into v_member
  from public.ball_knower_league_members
  where league_id = p_league_id
    and auth_user_id = v_user
    and coalesce(is_ai,false) = false
  for update;
  if not found then raise exception 'Your league membership is no longer active.'; end if;

  select array_agg(coalesce(nullif(item.value->>'id',''),nullif(item.value->>'playerId','')) order by item.ordinality)
  into v_ids
  from jsonb_array_elements(p_roster) with ordinality as item(value,ordinality);

  if coalesce(cardinality(v_ids),0) <> 20 or array_position(v_ids,null) is not null then
    raise exception 'Every roster entry must contain a valid player id.';
  end if;
  if (select count(distinct x) from unnest(v_ids) x) <> 20 then
    raise exception 'Roster players must be unique.';
  end if;
  if (select count(*) from ball_knower_private.draft_order_game_players p where p.active and p.player_id=any(v_ids)) <> 20 then
    raise exception 'Roster contains an unknown or inactive player.';
  end if;

  -- The Draft Order Game is an exact 20-player roster: 1 QB, 1 RB, 2 WR, 1 TE,
  -- 4 OL, 3 DL/EDGE, 2 LB, 2 CB, 2 S, 1 K and 1 P.
  if (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='QB') <> 1
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='RB') <> 1
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='WR') <> 2
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='TE') <> 1
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='OL') <> 4
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='DL_EDGE') <> 3
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='LB') <> 2
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='CB') <> 2
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='S') <> 2
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='K') <> 1
    or (select count(*) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids) and p.position_group='P') <> 1 then
    raise exception 'Roster does not match the required Draft Order Game position build.';
  end if;

  select coalesce(sum(p.salary),0)
  into v_spent
  from ball_knower_private.draft_order_game_players p
  where p.player_id=any(v_ids);
  if v_spent > coalesce(v_league.salary_cap,301.2) then
    raise exception 'Roster salary %M exceeds the %M salary cap',v_spent,coalesce(v_league.salary_cap,301.2);
  end if;

  -- Persist only server-owned canonical player objects, in the order submitted.
  select jsonb_agg(p.player_json order by chosen.ordinality)
  into v_canonical_roster
  from unnest(v_ids) with ordinality as chosen(player_id,ordinality)
  join ball_knower_private.draft_order_game_players p on p.player_id=chosen.player_id and p.active;

  -- Compute the outcome-driving rating payload entirely from canonical OVRs. This
  -- deliberately ignores p_team_ratings, preventing a modified client from forging
  -- simulation strength while retaining the legacy RPC signature.
  select
    avg(p.ovr) filter(where p.position_group='QB'),
    avg(p.ovr) filter(where p.position_group='RB'),
    avg(p.ovr) filter(where p.position_group='WR'),
    avg(p.ovr) filter(where p.position_group='TE'),
    avg(p.ovr) filter(where p.position_group='OL'),
    avg(p.ovr) filter(where p.position_group='DL_EDGE'),
    avg(p.ovr) filter(where p.position_group='LB'),
    avg(p.ovr) filter(where p.position_group='CB'),
    avg(p.ovr) filter(where p.position_group='S')
  into v_qb,v_rb,v_wr,v_te,v_ol,v_dl,v_lb,v_cb,v_s
  from ball_knower_private.draft_order_game_players p
  where p.player_id=any(v_ids);

  v_passing := least(99,greatest(60,v_qb*0.45+v_ol*0.30+((v_wr*2+v_te)/3)*0.25));
  v_rushing := least(99,greatest(60,v_rb*0.48+v_ol*0.42+v_te*0.10));
  v_pass_rush := least(99,greatest(60,v_dl));
  v_run_def := least(99,greatest(60,v_dl*0.55+v_lb*0.45));
  v_coverage := least(99,greatest(60,v_cb*0.45+v_s*0.35+greatest(0,v_lb-5)*0.20));
  v_offense := round(v_passing*0.55+v_rushing*0.45);
  v_defense := round(v_pass_rush*0.35+v_run_def*0.30+v_coverage*0.35);
  v_overall := round((v_offense+v_defense)/2);

  v_team_ratings := jsonb_build_object(
    'overall',v_overall,
    'offense',v_offense,
    'defense',v_defense,
    'passing',round(v_passing),
    'rushing',round(v_rushing),
    'passProtection',round(v_ol),
    'runBlocking',round(v_ol),
    'passRush',round(v_pass_rush),
    'runDefense',round(v_run_def),
    'coverage',round(v_coverage),
    'balanceScore',greatest(30,100-round(greatest(v_passing,v_rushing,v_pass_rush,v_run_def,v_coverage)-least(v_passing,v_rushing,v_pass_rush,v_run_def,v_coverage))),
    'efficiencyRating',least(99,greatest(40,round(((select avg(p.ovr) from ball_knower_private.draft_order_game_players p where p.player_id=any(v_ids))-70)*2+60))),
    'penalties','[]'::jsonb,
    'strengths','[]'::jsonb
  );

  select coalesce(max(revision.revision_number),0)+1 into v_revision
  from public.ball_knower_roster_revisions revision
  where revision.league_id=p_league_id and revision.member_id=v_member.id;

  update public.ball_knower_league_members
  set status='ready',roster=v_canonical_roster,team_ratings=v_team_ratings,submitted_at=v_submitted_at
  where id=v_member.id;

  insert into public.ball_knower_roster_revisions(
    league_id,member_id,auth_user_id,revision_number,roster,team_ratings,reason
  ) values (
    p_league_id,v_member.id,v_user,v_revision,v_canonical_roster,v_team_ratings,
    case when v_revision=1 then 'submitted' else 'resubmitted' end
  );

  return query select v_member.id,v_member.user_name,v_revision;
end;
$$;

revoke all on function public.submit_ball_knower_roster(text,jsonb,jsonb) from public, anon;
grant execute on function public.submit_ball_knower_roster(text,jsonb,jsonb) to authenticated, service_role;
