-- Final live-fantasy trust boundary.
-- Any signed-in human league member may keep a CPU turn moving, but the server
-- chooses the CPU player. Completed rosters and team ratings are also rebuilt
-- from the locked draft picks and private canonical player catalog, so client
-- payloads cannot alter player data or simulation strength.

create or replace function ball_knower_private.fantasy_player_payload(p_player_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_group text;
  v_payload jsonb;
  v_team text;
  v_dst_ovr integer;
begin
  select g.draft_group,p.player_json
  into v_group,v_payload
  from public.ball_knower_fantasy_player_groups g
  left join ball_knower_private.draft_order_game_players p on p.player_id=g.player_id
  where g.player_id=p_player_id;

  if v_group is null then raise exception 'Unknown fantasy player id %',p_player_id; end if;
  if v_group not in ('QB','RB','WR','TE','K','DST') then raise exception 'Invalid fantasy player group %',v_group; end if;

  if v_payload is not null then
    return v_payload || jsonb_build_object('position',v_group,'positionGroup',v_group);
  end if;

  if v_group<>'DST' then raise exception 'Canonical fantasy player data is missing for %',p_player_id; end if;
  v_team:=upper(split_part(p_player_id,'-',2));
  if nullif(v_team,'') is null then raise exception 'Invalid D/ST id %',p_player_id; end if;

  select coalesce(round(avg(defender_ovr))::integer,70)
  into v_dst_ovr
  from (
    select (p.player_json->>'ovr')::numeric as defender_ovr
    from ball_knower_private.draft_order_game_players p
    where upper(p.player_json->>'team')=v_team
      and upper(p.player_json->>'position') in ('EDGE','DE','DT','DL','LB','MLB','OLB','CB','FS','SS','S')
      and (p.player_json->>'ovr') ~ '^[0-9]+([.][0-9]+)?$'
    order by (p.player_json->>'ovr')::numeric desc
    limit 11
  ) defense;
  v_dst_ovr:=greatest(60,least(99,coalesce(v_dst_ovr,70)));

  return jsonb_build_object(
    'id',p_player_id,'playerId',p_player_id,'name',v_team||' D/ST','team',v_team,'teamId',v_team,
    'position','DST','positionGroup','DST','ovr',v_dst_ovr,'overall',v_dst_ovr,'overallRating',v_dst_ovr,
    'ratingSource','Ball Knower Composite','ratingSeason',2026,'ratingStatus','VERIFIED','rosterSeason',2026,
    'active',true,'isFreeAgent',false
  );
end;
$$;
revoke all on function ball_knower_private.fantasy_player_payload(text) from public,anon,authenticated;

create or replace function ball_knower_private.fantasy_team_ratings_from_roster(p_roster jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_qb numeric:=65;v_rb numeric:=65;v_wr numeric:=65;v_te numeric:=65;v_flex numeric:=65;
  v_k numeric:=60;v_dst numeric:=60;v_depth numeric:=65;
  v_offense integer;v_defense integer;v_overall integer;v_balance integer;v_efficiency integer;
  v_min_group numeric;v_max_group numeric;v_spread numeric:=30;
  v_penalties text[]:=array[]::text[];v_strengths text[]:=array[]::text[];
begin
  if jsonb_typeof(p_roster)<>'array' or jsonb_array_length(p_roster)<1 then raise exception 'Fantasy roster is empty'; end if;

  select coalesce(avg(ovr),65) into v_qb from (select (x->>'ovr')::numeric ovr from jsonb_array_elements(p_roster) x where x->>'position'='QB' order by 1 desc limit 1) s;
  select coalesce(avg(ovr),65) into v_rb from (select (x->>'ovr')::numeric ovr from jsonb_array_elements(p_roster) x where x->>'position'='RB' order by 1 desc limit 2) s;
  select coalesce(avg(ovr),65) into v_wr from (select (x->>'ovr')::numeric ovr from jsonb_array_elements(p_roster) x where x->>'position'='WR' order by 1 desc limit 3) s;
  select coalesce(avg(ovr),65) into v_te from (select (x->>'ovr')::numeric ovr from jsonb_array_elements(p_roster) x where x->>'position'='TE' order by 1 desc limit 1) s;
  select coalesce(avg(ovr),65) into v_flex from (select (x->>'ovr')::numeric ovr from jsonb_array_elements(p_roster) x where x->>'position' in ('RB','WR','TE') order by 1 desc limit 6) s;
  select coalesce(avg(ovr),60) into v_k from (select (x->>'ovr')::numeric ovr from jsonb_array_elements(p_roster) x where x->>'position'='K' order by 1 desc limit 1) s;
  select coalesce(avg(ovr),60) into v_dst from (select (x->>'ovr')::numeric ovr from jsonb_array_elements(p_roster) x where x->>'position'='DST' order by 1 desc limit 1) s;
  select coalesce(avg(ovr),65) into v_depth from (select (x->>'ovr')::numeric ovr from jsonb_array_elements(p_roster) x order by 1 desc limit 12) s;

  v_offense:=greatest(40,least(99,round(v_qb*.24+v_rb*.22+v_wr*.27+v_te*.10+v_flex*.12+v_depth*.05)::integer));
  v_defense:=greatest(40,least(99,round(v_dst*.72+v_k*.08+v_depth*.20)::integer));
  v_overall:=greatest(40,least(99,round(v_offense*.78+v_defense*.10+v_depth*.12)::integer));

  select min(group_avg),max(group_avg) into v_min_group,v_max_group
  from (
    select avg(ovr) group_avg
    from (
      select x->>'position' position,(x->>'ovr')::numeric ovr,
             row_number() over(partition by x->>'position' order by (x->>'ovr')::numeric desc) rn
      from jsonb_array_elements(p_roster) x
      where x->>'position' in ('QB','RB','WR','TE','K','DST')
    ) ranked
    where rn<=2
    group by position
  ) groups;
  if v_min_group is not null and v_max_group is not null then v_spread:=v_max_group-v_min_group; end if;
  v_balance:=greatest(40,least(99,round(100-v_spread*1.8)::integer));
  v_efficiency:=greatest(40,least(99,round(v_overall*.7+v_balance*.3)::integer));

  if not exists(select 1 from jsonb_array_elements(p_roster) x where x->>'position'='QB') then v_penalties:=array_append(v_penalties,'No quarterback'); end if;
  if (select count(*) from jsonb_array_elements(p_roster) x where x->>'position'='RB')<2 then v_penalties:=array_append(v_penalties,'Thin running back room'); end if;
  if (select count(*) from jsonb_array_elements(p_roster) x where x->>'position'='WR')<3 then v_penalties:=array_append(v_penalties,'Thin wide receiver room'); end if;
  if not exists(select 1 from jsonb_array_elements(p_roster) x where x->>'position'='TE') then v_penalties:=array_append(v_penalties,'No tight end'); end if;
  if not exists(select 1 from jsonb_array_elements(p_roster) x where x->>'position'='K') then v_penalties:=array_append(v_penalties,'No kicker'); end if;
  if not exists(select 1 from jsonb_array_elements(p_roster) x where x->>'position'='DST') then v_penalties:=array_append(v_penalties,'No D/ST'); end if;

  if v_qb>=85 then v_strengths:=array_append(v_strengths,'Elite quarterback ceiling'); end if;
  if v_rb>=84 then v_strengths:=array_append(v_strengths,'High-end running backs'); end if;
  if v_wr>=84 then v_strengths:=array_append(v_strengths,'Deep receiving corps'); end if;
  if v_depth>=82 then v_strengths:=array_append(v_strengths,'Strong fantasy depth'); end if;

  return jsonb_build_object(
    'overall',v_overall,'offense',v_offense,'defense',v_defense,
    'passing',greatest(40,least(99,round(v_qb*.55+v_wr*.32+v_te*.13)::integer)),
    'rushing',greatest(40,least(99,round(v_rb*.78+v_flex*.22)::integer)),
    'passProtection',greatest(40,least(99,round(v_depth)::integer)),
    'runBlocking',greatest(40,least(99,round(v_flex)::integer)),
    'passRush',greatest(40,least(99,round(v_dst)::integer)),
    'runDefense',greatest(40,least(99,round(v_dst)::integer)),
    'coverage',greatest(40,least(99,round(v_dst)::integer)),
    'balanceScore',v_balance,'efficiencyRating',v_efficiency,
    'penalties',to_jsonb(v_penalties),'strengths',to_jsonb(v_strengths)
  );
end;
$$;
revoke all on function ball_knower_private.fantasy_team_ratings_from_roster(jsonb) from public,anon,authenticated;

create or replace function public.finalize_ball_knower_live_draft_rosters(p_league_id text,p_assignments jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid:=(select auth.uid());
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_roster jsonb;
  v_ratings jsonb;
  v_member_count integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.ball_knower_league_members requester
    where requester.league_id=p_league_id and requester.auth_user_id=v_auth and coalesce(requester.is_ai,false)=false
  ) then raise exception 'Only league members can finalize completed fantasy rosters'; end if;

  select * into v_draft from public.ball_knower_live_drafts where league_id=p_league_id for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;
  if v_draft.status<>'completed'
    or v_draft.pick_index<>jsonb_array_length(v_draft.order_member_ids)*v_draft.rounds
    or jsonb_array_length(v_draft.picks)<>v_draft.pick_index then
    raise exception 'Fantasy draft is not complete';
  end if;

  select count(*) into v_member_count from public.ball_knower_league_members where league_id=p_league_id;
  if v_member_count<>jsonb_array_length(v_draft.order_member_ids) then raise exception 'Draft order no longer matches league membership'; end if;

  for v_member in select * from public.ball_knower_league_members where league_id=p_league_id for update loop
    select jsonb_agg(ball_knower_private.fantasy_player_payload(pick->>'playerId') order by (pick->>'overall')::integer)
    into v_roster
    from jsonb_array_elements(v_draft.picks) pick
    where pick->>'memberId'=v_member.id;

    if jsonb_typeof(v_roster)<>'array' or jsonb_array_length(v_roster)<>v_draft.rounds then
      raise exception 'Every completed fantasy roster must contain exactly % canonical players',v_draft.rounds;
    end if;
    if (select count(distinct x->>'id') from jsonb_array_elements(v_roster) x)<>v_draft.rounds then
      raise exception 'A completed fantasy roster contains duplicate players';
    end if;

    v_ratings:=ball_knower_private.fantasy_team_ratings_from_roster(v_roster);
    update public.ball_knower_league_members
    set roster=v_roster,team_ratings=v_ratings,status='ready',submitted_at=coalesce(v_draft.completed_at,clock_timestamp())
    where league_id=p_league_id and id=v_member.id;
  end loop;

  update public.ball_knower_leagues set status='drafting',rosters_locked=true where id=p_league_id;
  return true;
end;
$$;
revoke all on function public.finalize_ball_knower_live_draft_rosters(text,jsonb) from public,anon;
grant execute on function public.finalize_ball_knower_live_draft_rosters(text,jsonb) to authenticated,service_role;

create or replace function public.make_ball_knower_live_draft_pick(
  p_league_id text,p_player_id text,p_group text,p_final_assignments jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid:=(select auth.uid());
  v_draft public.ball_knower_live_drafts%rowtype;
  v_member public.ball_knower_league_members%rowtype;
  v_team_count integer;v_total_picks integer;v_round_index integer;v_slot integer;v_order_index integer;v_member_id text;
  v_selected_player_id text;v_canonical_group text;v_group_count integer;v_pick jsonb;v_next_index integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  select * into v_draft from public.ball_knower_live_drafts where league_id=p_league_id for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;
  if v_draft.status<>'active' then raise exception 'Fantasy draft is already complete'; end if;

  v_team_count:=jsonb_array_length(v_draft.order_member_ids);v_total_picks:=v_team_count*v_draft.rounds;
  if v_team_count<1 or v_draft.pick_index>=v_total_picks then raise exception 'Fantasy draft is already complete'; end if;
  v_round_index:=v_draft.pick_index/v_team_count;v_slot:=mod(v_draft.pick_index,v_team_count);
  v_order_index:=case when mod(v_round_index,2)=0 then v_slot else v_team_count-1-v_slot end;
  v_member_id:=v_draft.order_member_ids->>v_order_index;
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and id=v_member_id;
  if not found then raise exception 'The manager on the clock is no longer in the league'; end if;

  if coalesce(v_member.is_ai,false) then
    if not exists(select 1 from public.ball_knower_league_members requester where requester.league_id=p_league_id and requester.auth_user_id=v_auth and coalesce(requester.is_ai,false)=false) then
      raise exception 'Only league members can advance CPU picks';
    end if;

    select g.player_id,g.draft_group
    into v_selected_player_id,v_canonical_group
    from public.ball_knower_fantasy_player_groups g
    left join ball_knower_private.draft_order_game_players p on p.player_id=g.player_id
    left join lateral (
      select min(r.overall_rank) as overall_rank
      from public.ball_knower_fantasy_rankings r
      where r.season=2026 and r.scoring_format='ppr'
        and lower(regexp_replace(r.player_name,'[^a-z0-9]','','g'))=
            lower(regexp_replace(coalesce(p.player_json->>'name',''),'[^a-z0-9]','','g'))
    ) ranked on true
    where g.draft_group in ('QB','RB','WR','TE','K','DST')
      and not exists(select 1 from jsonb_array_elements(v_draft.picks) prior where prior->>'playerId'=g.player_id)
    order by ranked.overall_rank nulls last,
             coalesce(case when (p.player_json->>'ovr') ~ '^[0-9]+([.][0-9]+)?$' then (p.player_json->>'ovr')::numeric end,0) desc,
             g.player_id
    limit 1;
    if v_selected_player_id is null then raise exception 'No legal CPU fantasy player remains'; end if;
  else
    if v_member.auth_user_id<>v_auth then raise exception '% is on the clock',v_member.user_name; end if;
    if nullif(btrim(p_player_id),'') is null then raise exception 'Player id is required'; end if;
    v_selected_player_id:=p_player_id;
    select draft_group into v_canonical_group from public.ball_knower_fantasy_player_groups where player_id=v_selected_player_id;
    if not found then raise exception 'That player is not in the current fantasy player index'; end if;
    if v_canonical_group<>p_group then raise exception 'Player position does not match the submitted draft group'; end if;
  end if;

  if v_canonical_group not in ('QB','RB','WR','TE','K','DST') then raise exception 'Only QB, RB, WR, TE, K and D/ST are valid fantasy positions'; end if;
  if exists(select 1 from jsonb_array_elements(v_draft.picks) prior where prior->>'playerId'=v_selected_player_id) then raise exception 'That player was already drafted'; end if;
  select count(*) into v_group_count from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'=v_canonical_group;
  if v_group_count>=v_draft.rounds then raise exception '% reached the % roster limit',v_member.user_name,v_canonical_group; end if;

  v_pick:=jsonb_build_object('overall',v_draft.pick_index+1,'round',v_round_index+1,'memberId',v_member_id,'playerId',v_selected_player_id,'group',v_canonical_group,'pickedAt',clock_timestamp());
  v_next_index:=v_draft.pick_index+1;
  update public.ball_knower_live_drafts
  set picks=picks||jsonb_build_array(v_pick),pick_index=v_next_index,
      status=case when v_next_index>=v_total_picks then 'completed' else 'active' end,
      completed_at=case when v_next_index>=v_total_picks then clock_timestamp() else null end,
      updated_at=clock_timestamp()
  where league_id=p_league_id returning * into v_draft;

  if v_next_index>=v_total_picks then
    perform public.finalize_ball_knower_live_draft_rosters(p_league_id,null);
  end if;
  return to_jsonb(v_draft);
end;
$$;
revoke all on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) from public,anon;
grant execute on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) to authenticated,service_role;
