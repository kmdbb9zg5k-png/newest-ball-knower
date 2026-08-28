-- Fantasy season integrity: exact lineup validation, score-backed playoff
-- champions, realistic CPU roster limits, and stale post-draft rating repair.

create or replace function public.save_my_ball_knower_weekly_lineup(
  p_league_id text,p_week_number integer,p_starters jsonb,p_bench jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid:=(select auth.uid());
  v_member public.ball_knower_league_members%rowtype;
  v_existing public.ball_knower_weekly_lineups%rowtype;
  v_id uuid;v_slot text;v_player_id text;v_position text;v_seen text[]:=array[]::text[];v_roster jsonb;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if p_week_number<1 or p_week_number>22 then raise exception 'Invalid week'; end if;
  if jsonb_typeof(p_starters)<>'object' then raise exception 'Starters must be an object'; end if;
  if jsonb_typeof(coalesce(p_bench,'[]'::jsonb))<>'array' then raise exception 'Bench must be an array'; end if;
  if (select array_agg(slot order by slot) from jsonb_object_keys(p_starters) slots(slot))
     is distinct from array['DST','FLEX','K','QB','RB1','RB2','TE','WR1','WR2']::text[] then
    raise exception 'Lineup must contain exactly QB, RB1, RB2, WR1, WR2, TE, FLEX, K and DST';
  end if;

  select * into v_member
  from public.ball_knower_league_members
  where league_id=p_league_id and auth_user_id=v_auth and coalesce(is_ai,false)=false
  limit 1 for update;
  if not found then raise exception 'League membership not found'; end if;
  v_roster:=coalesce(v_member.roster,'[]'::jsonb);

  select * into v_existing from public.ball_knower_weekly_lineups
  where league_id=p_league_id and member_id=v_member.id and week_number=p_week_number for update;
  if found and v_existing.locked then raise exception 'This lineup is locked'; end if;

  for v_slot,v_player_id in select entry.key,entry.value #>> '{}' from jsonb_each(p_starters) entry loop
    if nullif(btrim(v_player_id),'') is null then raise exception '% requires a player',v_slot; end if;
    if v_player_id=any(v_seen) then raise exception 'A player cannot fill more than one lineup slot'; end if;
    select upper(coalesce(player->>'position',player->>'positionGroup')) into v_position
    from jsonb_array_elements(v_roster) player where player->>'id'=v_player_id limit 1;
    if v_position is null then raise exception 'Starter is not on your roster'; end if;
    if (v_slot='QB' and v_position<>'QB')
      or (v_slot in ('RB1','RB2') and v_position not in ('RB','FB'))
      or (v_slot in ('WR1','WR2') and v_position<>'WR')
      or (v_slot='TE' and v_position<>'TE')
      or (v_slot='FLEX' and v_position not in ('RB','FB','WR','TE'))
      or (v_slot='K' and v_position<>'K') or (v_slot='DST' and v_position<>'DST') then
      raise exception '% is not eligible for %',v_position,v_slot;
    end if;
    v_seen:=array_append(v_seen,v_player_id);
  end loop;

  for v_player_id in select bench.player_id from jsonb_array_elements_text(coalesce(p_bench,'[]'::jsonb)) bench(player_id) loop
    if v_player_id=any(v_seen) then raise exception 'A player cannot appear twice in a lineup'; end if;
    if not exists(select 1 from jsonb_array_elements(v_roster) player where player->>'id'=v_player_id) then
      raise exception 'Bench player is not on your roster';
    end if;
    v_seen:=array_append(v_seen,v_player_id);
  end loop;

  insert into public.ball_knower_weekly_lineups(league_id,member_id,week_number,starters,bench,submitted_at,updated_at)
  values(p_league_id,v_member.id,p_week_number,p_starters,coalesce(p_bench,'[]'::jsonb),clock_timestamp(),clock_timestamp())
  on conflict(league_id,member_id,week_number) do update
  set starters=excluded.starters,bench=excluded.bench,submitted_at=clock_timestamp(),updated_at=clock_timestamp()
  returning id into v_id;
  insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
  values(p_league_id,v_member.id,'lineup',v_member.user_name||' submitted Week '||p_week_number||' starters.',jsonb_build_object('week',p_week_number));
  return jsonb_build_object('id',v_id,'week',p_week_number,'memberId',v_member.id);
end;
$$;
revoke all on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb) from public,anon;
grant execute on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb) to authenticated,service_role;

create or replace function public.finalize_ball_knower_fantasy_season(p_league_id text,p_season_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid:=(select auth.uid());v_league public.ball_knower_leagues%rowtype;
  v_champion text;v_game jsonb;v_home numeric;v_away numeric;v_winner text;v_playoff_teams integer;v_games jsonb;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  select * into v_league from public.ball_knower_leagues where id=p_league_id for update;
  if not found then raise exception 'League not found'; end if;
  if not exists(select 1 from public.ball_knower_league_members m where m.league_id=p_league_id and m.auth_user_id=v_auth and coalesce(m.is_ai,false)=false) then
    raise exception 'League membership not found';
  end if;
  if not exists(select 1 from public.ball_knower_live_drafts d where d.league_id=p_league_id and d.status='completed') then
    raise exception 'Fantasy draft is not complete';
  end if;
  if jsonb_typeof(p_season_result)<>'object' or jsonb_typeof(p_season_result->'standings')<>'array' then raise exception 'Invalid season result'; end if;
  v_games:=coalesce(p_season_result->'playoffGames','[]'::jsonb);
  v_playoff_teams:=case when coalesce((v_league.settings->>'playoffTeams')::integer,6) in (4,6,8) then coalesce((v_league.settings->>'playoffTeams')::integer,6) else 6 end;
  if jsonb_typeof(v_games)<>'array' or jsonb_array_length(v_games)<>v_playoff_teams-1 then raise exception 'The playoff bracket is incomplete'; end if;
  v_champion:=nullif(p_season_result->>'championMemberId','');
  if v_champion is null then raise exception 'Champion is missing'; end if;
  if not exists(select 1 from public.ball_knower_league_members m where m.league_id=p_league_id and m.id=v_champion) then raise exception 'Champion is not a league member'; end if;

  for v_game in select value from jsonb_array_elements(v_games) loop
    if coalesce(v_game->>'playoffRound','') not in ('quarterfinal','semifinal','championship') then raise exception 'Invalid playoff round'; end if;
    if not exists(select 1 from public.ball_knower_league_members m where m.league_id=p_league_id and m.id in (v_game->>'homeMemberId',v_game->>'awayMemberId') group by m.league_id having count(*)=2) then raise exception 'Invalid playoff matchup'; end if;
    select live_points into v_home from public.ball_knower_weekly_scores
      where league_id=p_league_id and member_id=v_game->>'homeMemberId' and week_number=(v_game->>'week')::integer and is_final=true;
    select live_points into v_away from public.ball_knower_weekly_scores
      where league_id=p_league_id and member_id=v_game->>'awayMemberId' and week_number=(v_game->>'week')::integer and is_final=true;
    if v_home is null or v_away is null then raise exception 'Every playoff score must be final'; end if;
    if v_home<>(v_game->>'homeScore')::numeric or v_away<>(v_game->>'awayScore')::numeric then raise exception 'Playoff score does not match official scoring'; end if;
    v_winner:=v_game->>'winnerId';
    if v_home>v_away and v_winner<>v_game->>'homeMemberId' then raise exception 'Incorrect playoff winner'; end if;
    if v_away>v_home and v_winner<>v_game->>'awayMemberId' then raise exception 'Incorrect playoff winner'; end if;
    if v_home=v_away and v_winner not in (v_game->>'homeMemberId',v_game->>'awayMemberId') then raise exception 'Invalid playoff tiebreak winner'; end if;
  end loop;
  select game->>'winnerId' into v_winner from jsonb_array_elements(v_games) game where game->>'playoffRound'='championship' limit 1;
  if v_winner is null or v_winner<>v_champion then raise exception 'Champion must be the championship-game winner'; end if;

  p_season_result:=jsonb_set(p_season_result,'{completedAt}',to_jsonb(clock_timestamp())) || jsonb_build_object('championMemberId',v_champion);
  update public.ball_knower_leagues set season_result=p_season_result,status='completed',settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object('fantasySeasonComplete',true),updated_at=clock_timestamp() where id=p_league_id;
  return p_season_result;
end;
$$;
revoke all on function public.finalize_ball_knower_fantasy_season(text,jsonb) from public,anon;
grant execute on function public.finalize_ball_knower_fantasy_season(text,jsonb) to authenticated,service_role;

create or replace function public.make_ball_knower_live_draft_pick(
  p_league_id text,p_player_id text,p_group text,p_final_assignments jsonb default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_auth uuid:=(select auth.uid());v_draft public.ball_knower_live_drafts%rowtype;v_member public.ball_knower_league_members%rowtype;
  v_team_count integer;v_total_picks integer;v_round_index integer;v_slot integer;v_order_index integer;v_member_id text;
  v_selected_player_id text;v_canonical_group text;v_group_count integer;v_group_limit integer;v_pick jsonb;v_next_index integer;
  v_member_pick_count integer;v_picks_remaining integer;v_missing_count integer;v_required_now boolean;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  select * into v_draft from public.ball_knower_live_drafts where league_id=p_league_id for update;
  if not found then raise exception 'Fantasy draft has not started'; end if;if v_draft.status<>'active' then raise exception 'Fantasy draft is already complete'; end if;
  v_team_count:=jsonb_array_length(v_draft.order_member_ids);v_total_picks:=v_team_count*v_draft.rounds;
  if v_team_count<1 or v_draft.pick_index>=v_total_picks then raise exception 'Fantasy draft is already complete'; end if;
  v_round_index:=v_draft.pick_index/v_team_count;v_slot:=mod(v_draft.pick_index,v_team_count);v_order_index:=case when mod(v_round_index,2)=0 then v_slot else v_team_count-1-v_slot end;v_member_id:=v_draft.order_member_ids->>v_order_index;
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and id=v_member_id;if not found then raise exception 'The manager on the clock is no longer in the league'; end if;

  if coalesce(v_member.is_ai,false) then
    if not exists(select 1 from public.ball_knower_league_members requester where requester.league_id=p_league_id and requester.auth_user_id=v_auth and coalesce(requester.is_ai,false)=false) then raise exception 'Only league members can advance CPU picks';end if;
    select count(*) into v_member_pick_count from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id;
    v_picks_remaining:=v_draft.rounds-v_member_pick_count;
    select sum(greatest(requirement.minimum-coalesce(picked.position_count,0),0))::integer into v_missing_count
    from (values ('QB',1),('RB',2),('WR',2),('TE',1),('K',1),('DST',1)) requirement(draft_group,minimum)
    left join lateral(select count(*)::integer position_count from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'=requirement.draft_group)picked on true;
    v_required_now:=v_picks_remaining<=coalesce(v_missing_count,0);

    select candidate.player_id,candidate.draft_group into v_selected_player_id,v_canonical_group
    from (
      select g.player_id,g.draft_group,coalesce(picked.position_count,0) position_count,ranked.overall_rank,
        coalesce(case when (p.player_json->>'ovr')~'^[0-9]+([.][0-9]+)?$' then (p.player_json->>'ovr')::numeric end,0) ovr,
        case g.draft_group when 'QB' then 2 when 'RB' then 5 when 'WR' then 7 when 'TE' then 2 when 'K' then 2 when 'DST' then 2 end position_limit,
        case g.draft_group when 'QB' then 75 when 'TE' then 62 when 'K' then 45 when 'DST' then 45 when 'RB' then 14 else 10 end depth_penalty,
        case g.draft_group when 'QB' then 1 when 'RB' then 2 when 'WR' then 2 when 'TE' then 1 when 'K' then 1 when 'DST' then 1 end starter_minimum
      from public.ball_knower_fantasy_player_groups g
      left join ball_knower_private.draft_order_game_players p on p.player_id=g.player_id
      left join lateral(select count(*)::integer position_count from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'=g.draft_group)picked on true
      left join lateral(select min(r.overall_rank) overall_rank from public.ball_knower_fantasy_rankings r where r.season=2026 and r.scoring_format='ppr' and lower(regexp_replace(r.player_name,'[^a-z0-9]','','g'))=lower(regexp_replace(coalesce(p.player_json->>'name',''),'[^a-z0-9]','','g')))ranked on true
      where g.draft_group in ('QB','RB','WR','TE','K','DST') and (p.player_id is not null or g.draft_group='DST')
        and not exists(select 1 from jsonb_array_elements(v_draft.picks) prior where prior->>'playerId'=g.player_id)
    ) candidate
    where candidate.position_count<candidate.position_limit and (not v_required_now or candidate.position_count<candidate.starter_minimum)
    order by case when candidate.position_count<candidate.starter_minimum then 0 else 1 end,
      coalesce(candidate.overall_rank,9999)+candidate.position_count*candidate.depth_penalty+
        case when candidate.draft_group in ('K','DST') and v_member_pick_count<13 then 500 else 0 end,
      candidate.ovr desc,candidate.player_id limit 1;
    if v_selected_player_id is null then raise exception 'No legal CPU fantasy player remains'; end if;
  else
    if v_member.auth_user_id<>v_auth then raise exception '% is on the clock',v_member.user_name;end if;
    if nullif(btrim(p_player_id),'') is null then raise exception 'Player id is required';end if;
    v_selected_player_id:=p_player_id;select draft_group into v_canonical_group from public.ball_knower_fantasy_player_groups where player_id=v_selected_player_id;
    if not found then raise exception 'That player is not in the current fantasy player index';end if;if v_canonical_group<>p_group then raise exception 'Player position does not match the submitted draft group';end if;
  end if;
  if v_canonical_group not in ('QB','RB','WR','TE','K','DST') then raise exception 'Only QB, RB, WR, TE, K and D/ST are valid fantasy positions';end if;
  if exists(select 1 from jsonb_array_elements(v_draft.picks) prior where prior->>'playerId'=v_selected_player_id) then raise exception 'That player was already drafted';end if;
  select count(*) into v_group_count from jsonb_array_elements(v_draft.picks) prior where prior->>'memberId'=v_member_id and prior->>'group'=v_canonical_group;
  v_group_limit:=case v_canonical_group when 'QB' then 2 when 'RB' then 5 when 'WR' then 7 when 'TE' then 2 when 'K' then 2 when 'DST' then 2 end;
  if v_group_count>=v_group_limit then raise exception '% reached the % roster limit',v_member.user_name,v_canonical_group;end if;
  v_pick:=jsonb_build_object('overall',v_draft.pick_index+1,'round',v_round_index+1,'memberId',v_member_id,'playerId',v_selected_player_id,'group',v_canonical_group,'pickedAt',clock_timestamp());v_next_index:=v_draft.pick_index+1;
  update public.ball_knower_live_drafts set picks=picks||jsonb_build_array(v_pick),pick_index=v_next_index,status=case when v_next_index>=v_total_picks then 'completed' else 'active' end,completed_at=case when v_next_index>=v_total_picks then clock_timestamp() else null end,updated_at=clock_timestamp() where league_id=p_league_id returning * into v_draft;
  if v_next_index>=v_total_picks then perform public.finalize_ball_knower_live_draft_rosters(p_league_id,null);end if;return to_jsonb(v_draft);
end;$$;
revoke all on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) from public,anon;
grant execute on function public.make_ball_knower_live_draft_pick(text,text,text,jsonb) to authenticated,service_role;

create or replace function public.rollup_ball_knower_owner_profiles(p_league_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_auth uuid:=(select auth.uid());v_league record;v_member record;v_standing jsonb;v_rank int;v_wins int;v_losses int;v_ties int;v_champ int;v_rating int;v_completed timestamptz;v_champion_id text;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  select * into v_league from public.ball_knower_leagues where id=p_league_id;
  if v_league.id is null then raise exception 'League not found'; end if;
  if v_league.commissioner_auth_id<>v_auth then raise exception 'Commissioner only'; end if;
  if v_league.season_result is null then raise exception 'Season result not available'; end if;
  v_completed=(v_league.season_result->>'completedAt')::timestamptz;if v_completed is null then raise exception 'Completed timestamp missing'; end if;
  v_champion_id:=nullif(v_league.season_result->>'championMemberId','');
  insert into public.ball_knower_owner_rollups(league_id,completed_at) values(p_league_id,v_completed) on conflict do nothing;if not found then return;end if;
  for v_member in select * from public.ball_knower_league_members where league_id=p_league_id and auth_user_id is not null and is_ai=false loop
    select elem,ord::int into v_standing,v_rank from jsonb_array_elements(v_league.season_result->'standings') with ordinality a(elem,ord) where elem->>'memberId'=v_member.id limit 1;
    if v_standing is null then continue;end if;
    v_wins=coalesce((v_standing->>'wins')::int,0);v_losses=coalesce((v_standing->>'losses')::int,0);v_ties=coalesce((v_standing->>'ties')::int,0);v_champ=case when v_member.id=v_champion_id then 1 else 0 end;
    v_rating=greatest(0,least(100,round(50+(case when v_wins+v_losses+v_ties>0 then(v_wins::numeric/(v_wins+v_losses+v_ties))*30 else 0 end)+v_champ*12+greatest(0,8-v_rank)*1.5)::int));
    insert into public.ball_knower_owner_profiles(auth_user_id,display_name,ball_knower_rating,career_wins,career_losses,career_ties,championships,leagues_played,best_finish,updated_at)
    values(v_member.auth_user_id,v_member.user_name,v_rating,v_wins,v_losses,v_ties,v_champ,1,v_rank,clock_timestamp())
    on conflict(auth_user_id) do update set display_name=excluded.display_name,career_wins=public.ball_knower_owner_profiles.career_wins+excluded.career_wins,career_losses=public.ball_knower_owner_profiles.career_losses+excluded.career_losses,career_ties=public.ball_knower_owner_profiles.career_ties+excluded.career_ties,championships=public.ball_knower_owner_profiles.championships+excluded.championships,leagues_played=public.ball_knower_owner_profiles.leagues_played+1,best_finish=least(coalesce(public.ball_knower_owner_profiles.best_finish,excluded.best_finish),excluded.best_finish),ball_knower_rating=greatest(0,least(100,round(((public.ball_knower_owner_profiles.ball_knower_rating*public.ball_knower_owner_profiles.leagues_played)+excluded.ball_knower_rating)::numeric/(public.ball_knower_owner_profiles.leagues_played+1))::int)),updated_at=clock_timestamp();
  end loop;
end;$$;
revoke all on function public.rollup_ball_knower_owner_profiles(text) from public,anon;
grant execute on function public.rollup_ball_knower_owner_profiles(text) to authenticated,service_role;

-- Repair ratings that were captured before finalized live-draft rosters existed.
alter table public.ball_knower_league_members disable trigger ball_knower_member_update_guard;
alter table public.ball_knower_league_members disable trigger enforce_ball_knower_roster_submission_lock;
update public.ball_knower_league_members member
set team_ratings=ball_knower_private.fantasy_team_ratings_from_roster(member.roster)
where jsonb_typeof(member.roster)='array' and jsonb_array_length(member.roster)=20
  and exists(select 1 from public.ball_knower_live_drafts draft where draft.league_id=member.league_id and draft.status='completed');
alter table public.ball_knower_league_members enable trigger ball_knower_member_update_guard;
alter table public.ball_knower_league_members enable trigger enforce_ball_knower_roster_submission_lock;

update public.ball_knower_leagues league
set season_result=jsonb_set(league.season_result,'{draftOrder}',coalesce((
  select jsonb_agg(item || jsonb_build_object('teamRating',coalesce((member.team_ratings->>'overall')::integer,0)) order by ord)
  from jsonb_array_elements(coalesce(league.season_result->'draftOrder','[]'::jsonb)) with ordinality pick(item,ord)
  left join public.ball_knower_league_members member on member.league_id=league.id and member.id=item->>'memberId'
),'[]'::jsonb),true)
where league.season_result is not null and jsonb_typeof(league.season_result->'draftOrder')='array'
  and exists(select 1 from public.ball_knower_live_drafts draft where draft.league_id=league.id and draft.status='completed');
