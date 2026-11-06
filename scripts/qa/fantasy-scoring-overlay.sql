\set ON_ERROR_STOP on
-- Run only after the reviewed feature migration in the isolated real-service
-- harness. Existing auth users, league, draft and lineups remain authoritative.
begin;
do $$begin
 if nullif(current_setting('bk.launch_qa_league',true),'')is null or not exists(select 1 from public.ball_knower_league_members where league_id=current_setting('bk.launch_qa_league')and id=current_setting('bk.launch_qa_member_a')and auth_user_id=current_setting('bk.launch_qa_user_a')::uuid)or not exists(select 1 from public.ball_knower_league_members where league_id=current_setting('bk.launch_qa_league')and id=current_setting('bk.launch_qa_member_b')and auth_user_id=current_setting('bk.launch_qa_user_b')::uuid)then raise exception 'Isolated two-manager context required';end if;
 if(select count(*)from public.ball_knower_nfl_games where provider_game_id like 'qa-synthetic-week18-%'and season=2026 and week_number=18)<>16 then raise exception 'Expected synthetic week-18 schedule';end if;
end $$;
-- Advance only the explicitly synthetic fixture games, and roll back afterward.
update public.ball_knower_nfl_games set kickoff_at=clock_timestamp()-interval '3 hours',is_final=false,is_live=false,last_polled_at=null where provider_game_id like 'qa-synthetic-week18-%';
-- Complete structural season coverage: 16 round-robin weeks plus the supplied
-- week18. Move one game to week17 so all eighteen weeks are represented.
do $$declare circle text[]:=array['CHI','ARI','ATL','BAL','BUF','CAR','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','TB','TEN','WAS','SEA'];r int;p int;w int;begin
 for r in 1..16 loop for p in 1..16 loop
  w:=case when r=16 and p=1 then 17 else r end;
  insert into public.ball_knower_nfl_games(provider_game_id,season,season_type,week_number,away_team,home_team,kickoff_at)values('qa-scoring-season-'||r||'-'||p,2026,'reg',w,circle[p],circle[33-p],'2026-09-01T00:00:00Z');
 end loop;circle:=array[circle[1],circle[32]]||circle[2:31];end loop;
end $$;
create temp table qa_scoring_players(app_id text primary key,provider_id text,team text,position text,name text);
insert into qa_scoring_players select distinct r->>'id',case when r->>'position'='DST'then 'DST:'||upper(r->>'team')else 'qa-fixture:'||(r->>'id')end,upper(r->>'team'),r->>'position',r->>'name'from public.ball_knower_league_members m,jsonb_array_elements(m.roster)r where m.league_id=current_setting('bk.launch_qa_league')and r->>'position'in('QB','RB','FB','WR','TE','K','DST');
-- One extra synthetic QB per team proves both-sided box coverage even when
-- neither drafted roster has an offensive player from that team.
insert into qa_scoring_players select 'qa-scoring-qb-'||lower(team),'qa-fixture:qb:'||team,team,'QB','Synthetic Scoring QB '||team from(select away_team team from public.ball_knower_nfl_games where provider_game_id like 'qa-synthetic-week18-%'union select home_team from public.ball_knower_nfl_games where provider_game_id like 'qa-synthetic-week18-%')t;
insert into qa_scoring_players select 'dst-'||lower(team),'DST:'||team,team,'DST',team||' D/ST'from(select away_team team from public.ball_knower_nfl_games where provider_game_id like 'qa-synthetic-week18-%'union select home_team from public.ball_knower_nfl_games where provider_game_id like 'qa-synthetic-week18-%')t on conflict do nothing;
insert into ball_knower_private.draft_order_game_players(player_id,position_group,salary,ovr,player_json,active)select app_id,'QB',1,75,jsonb_build_object('id',app_id,'name',name,'team',team,'position','QB'),true from qa_scoring_players where app_id like 'qa-scoring-qb-%';
insert into ball_knower_private.fantasy_scoring_contracts(contract_id,source,approved_at,evidence)values('tank01-real-schema-fixture','tank01',clock_timestamp(),'{"identityNamespaceVerified":true,"zeroSemanticsVerified":true,"rareEventsVerified":true,"liveCadenceVerified":true,"correctionLifecycleVerified":true,"sourcePublicationTimeVerified":true,"sourceTimestampBasis":"provider_payload","sourceTimestampField":"updatedAt","pointsAllowedPolicy":"exclude_opponent_defense_scores_and_conversions"}');
insert into ball_knower_private.fantasy_scoring_identities(contract_id,season,provider_player_id,app_player_id,canonical_name,team,position,team_effective_from,team_effective_until,evidence_reference,active,verified_at,valid_until)select 'tank01-real-schema-fixture',2026,provider_id,app_id,name,team,position,'2026-01-01','2027-03-01','synthetic isolated schema fixture only',true,clock_timestamp(),clock_timestamp()+interval '1 day'from qa_scoring_players;
create function pg_temp.qa_scoring_row(p_id text,p_team text,p_position text,p_name text,p_stats jsonb default '{}')returns jsonb language plpgsql as $$
declare s jsonb;begin
 s:=case when p_position='DST'then '{"sacks":1,"interceptions":0,"fumbleRecoveries":0,"defensiveTouchdowns":0,"returnTouchdowns":0,"safeties":0,"blockedKicks":0,"pointsAllowed":17}'::jsonb else '{"passingYards":0,"passingTouchdowns":0,"interceptionsThrown":0,"rushingYards":0,"rushingTouchdowns":0,"receivingYards":0,"receivingTouchdowns":0,"receptions":0,"twoPointConversions":0,"fumblesLost":0,"returnTouchdowns":0,"fieldGoalsMade":0,"fieldGoalsMissed":0,"extraPointsMade":0,"extraPointsMissed":0}'::jsonb end||case p_position when 'QB'then '{"passingYards":100}'::jsonb when 'RB'then '{"rushingYards":20}'::jsonb when 'FB'then '{"rushingYards":20}'::jsonb when 'WR'then '{"receptions":2,"receivingYards":20}'::jsonb when 'TE'then '{"receptions":2,"receivingYards":20}'::jsonb when 'K'then '{"fieldGoalsMade":1,"extraPointsMade":1}'::jsonb else '{}'::jsonb end||p_stats;
 return jsonb_build_object('providerPlayerId',p_id,'appPlayerId',(select app_id from qa_scoring_players where provider_id=p_id),'team',p_team,'position',p_position,'name',p_name,'participation','played','stats',s,'points',jsonb_build_object('standard',ball_knower_private.canonical_fantasy_points(s,p_position,'standard'),'half_ppr',ball_knower_private.canonical_fantasy_points(s,p_position,'half_ppr'),'ppr',ball_knower_private.canonical_fantasy_points(s,p_position,'ppr')));
end $$;
create temp table qa_scoring_snapshots(snapshot jsonb);
insert into qa_scoring_snapshots select jsonb_build_object('schemaVersion',1,'source','tank01','contractId','tank01-real-schema-fixture','canonicalGameId',g.provider_game_id,'providerGameId',to_char(g.kickoff_at at time zone 'America/New_York','YYYYMMDD')||'_'||g.away_team||'@'||g.home_team,'season',2026,'week',18,'away',g.away_team,'home',g.home_team,'kickoffAt',g.kickoff_at,'status','final','sourceUpdatedAt',clock_timestamp(),'sourceTimestampBasis','provider_payload','retrievedAt',clock_timestamp(),'players',(select jsonb_agg(pg_temp.qa_scoring_row(p.provider_id,p.team,p.position,p.name)order by p.provider_id)from qa_scoring_players p where p.team in(g.away_team,g.home_team)))from public.ball_knower_nfl_games g where g.provider_game_id like 'qa-synthetic-week18-%';
grant select on qa_scoring_players,qa_scoring_snapshots to service_role;
-- Seed saved forecasts, including available numeric zero, through fixture admin.
insert into public.ball_knower_weekly_scores(league_id,member_id,week_number,live_points,projected_points,score_details)select l.league_id,l.member_id,18,0,99,jsonb_build_object('hasProjectedTotal',true,'players',(select jsonb_agg(jsonb_build_object('slot',slot,'playerId',player,'projectedPoints',case when slot='QB'then 0 else 12 end,'projectionAvailable',true))from jsonb_each_text(l.starters)e(slot,player)))from public.ball_knower_weekly_lineups l where l.league_id=current_setting('bk.launch_qa_league')and l.week_number=18 on conflict(league_id,member_id,week_number)do update set projected_points=excluded.projected_points,score_details=excluded.score_details;
-- An incomplete submitted lineup cannot acquire a certified total or final.
savepoint incomplete_nine;
update public.ball_knower_weekly_lineups set starters=starters-'FLEX'where league_id=current_setting('bk.launch_qa_league')and member_id=current_setting('bk.launch_qa_member_a')and week_number=18;
set local role service_role;
do $$declare s jsonb;begin
 for s in select snapshot from qa_scoring_snapshots loop perform public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('c',64));end loop;
 if exists(select 1 from public.ball_knower_weekly_scores where league_id=current_setting('bk.launch_qa_league')and member_id=current_setting('bk.launch_qa_member_a')and week_number=18 and(is_final or score_details->'pointsAvailable'='true'::jsonb))then raise exception 'Incomplete nine-slot real lineup acquired certified score';end if;
end $$;
reset role;
rollback to savepoint incomplete_nine;
set local role service_role;
do $$declare s jsonb;r jsonb;last_game text;begin
 select max(snapshot->>'canonicalGameId')into last_game from qa_scoring_snapshots;
 for s in select case when snapshot->>'canonicalGameId'=last_game then jsonb_set(snapshot,'{status}','"in_progress"')else snapshot end from qa_scoring_snapshots loop r:=public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('a',64));if r->>'status'<>'committed'then raise exception 'Real-schema snapshot failed';end if;end loop;
 if(select count(*)from public.ball_knower_weekly_scores where league_id=current_setting('bk.launch_qa_league')and week_number=18 and not is_final and score_details->'pointsAvailable'='true'::jsonb)<>2 then raise exception 'One nonfinal contributing game certified real manager totals';end if;
 select jsonb_set(snapshot,'{sourceUpdatedAt}',to_jsonb((snapshot->>'sourceUpdatedAt')::timestamptz+interval '1 second'))into s from qa_scoring_snapshots where snapshot->>'canonicalGameId'=last_game;
 perform public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('d',64));
 if(select count(*)from public.ball_knower_weekly_scores where league_id=current_setting('bk.launch_qa_league')and week_number=18 and is_final and score_details->'pointsAvailable'='true'::jsonb and score_details->'hasProjectedTotal'='true'::jsonb and projected_points=99)<>2 then raise exception 'Real-schema two-manager completion/projection preservation failed';end if;
 if not exists(select 1 from ball_knower_private.player_provider_identities where provider_player_id like 'qa-fixture:%')then raise exception 'Actual legacy identity trigger was not exercised';end if;
end $$;
reset role;
create temp table qa_scoring_before as select member_id,live_points from public.ball_knower_weekly_scores where league_id=current_setting('bk.launch_qa_league')and week_number=18;
grant select on qa_scoring_before to service_role;
set local role service_role;
do $$declare s jsonb;corrected jsonb;r jsonb;p jsonb;rows jsonb:='[]';target text;begin
 select starters->>'QB'into target from public.ball_knower_weekly_lineups where league_id=current_setting('bk.launch_qa_league')and member_id=current_setting('bk.launch_qa_member_a')and week_number=18;
 select snapshot into s from qa_scoring_snapshots where exists(select 1 from jsonb_array_elements(snapshot->'players')entry where entry->>'appPlayerId'=target);
 for p in select value from jsonb_array_elements(s->'players')loop
  if p->>'appPlayerId'=target then p:=pg_temp.qa_scoring_row(p->>'providerPlayerId',p->>'team',p->>'position',p->>'name','{"passingYards":125}');end if;rows:=rows||jsonb_build_array(p);
 end loop;
 corrected:=jsonb_set(jsonb_set(s,'{players}',rows),'{sourceUpdatedAt}',to_jsonb((s->>'sourceUpdatedAt')::timestamptz+interval '2 seconds'));
 r:=public.commit_ball_knower_fantasy_scoring_snapshot(corrected,repeat('b',64));if(r->>'statCorrections')::int<>1 then raise exception 'Real-schema final correction receipt failed';end if;
 r:=public.commit_ball_knower_fantasy_scoring_snapshot(corrected,repeat('b',64));if r->>'status'<>'duplicate'then raise exception 'Real-schema correction replay duplicated';end if;
 r:=public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('a',64));if r->>'status'<>'stale_ignored'then raise exception 'Real-schema stale snapshot accepted';end if;
 if not exists(select 1 from public.ball_knower_weekly_scores score join qa_scoring_before b using(member_id)where score.league_id=current_setting('bk.launch_qa_league')and score.week_number=18 and score.member_id=current_setting('bk.launch_qa_member_a')and score.live_points=b.live_points+1)then raise exception 'Real-schema correction did not update manager total atomically';end if;
 if(select count(*)from public.ball_knower_stat_corrections where provider_player_id='qa-fixture:'||target)<>1 then raise exception 'Real-schema correction audit duplicated';end if;
end $$;
reset role;
-- Failure at the last receipt insert must roll back player, correction and
-- weekly writes through the actual deployed table triggers and foreign keys.
create function pg_temp.qa_reject_scoring_receipt()returns trigger language plpgsql as $$begin raise exception 'Fixture receipt failure';end $$;
create trigger qa_fixture_scoring_receipt_failure before insert on ball_knower_private.fantasy_scoring_receipts for each row execute function pg_temp.qa_reject_scoring_receipt();
set local role service_role;
do $$declare s jsonb;p jsonb;rows jsonb:='[]';target text;receipts bigint;state_before jsonb;player_before jsonb;weekly_before jsonb;begin
 select count(*)into receipts from ball_knower_private.fantasy_scoring_receipts;
 select starters->>'QB'into target from public.ball_knower_weekly_lineups where league_id=current_setting('bk.launch_qa_league')and member_id=current_setting('bk.launch_qa_member_a')and week_number=18;
 select snapshot into s from qa_scoring_snapshots where exists(select 1 from jsonb_array_elements(snapshot->'players')entry where entry->>'appPlayerId'=target);
 for p in select value from jsonb_array_elements(s->'players')loop
  if p->>'appPlayerId'=target then p:=pg_temp.qa_scoring_row(p->>'providerPlayerId',p->>'team',p->>'position',p->>'name','{"passingYards":150}');end if;rows:=rows||jsonb_build_array(p);
 end loop;
 s:=jsonb_set(jsonb_set(s,'{players}',rows),'{sourceUpdatedAt}',to_jsonb((s->>'sourceUpdatedAt')::timestamptz+interval '3 seconds'));
 select to_jsonb(state)into state_before from ball_knower_private.fantasy_scoring_state state where canonical_game_id=s->>'canonicalGameId';
 select to_jsonb(score)into player_before from public.ball_knower_player_week_scores score where provider_game_id=s->>'canonicalGameId'and provider_player_id='qa-fixture:'||target;
 select to_jsonb(score)into weekly_before from public.ball_knower_weekly_scores score where league_id=current_setting('bk.launch_qa_league')and member_id=current_setting('bk.launch_qa_member_a')and week_number=18;
 begin perform public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('e',64));raise exception 'Receipt failure accepted';exception when others then if sqlerrm<>'Fixture receipt failure'then raise;end if;end;
 if state_before is distinct from(select to_jsonb(state)from ball_knower_private.fantasy_scoring_state state where canonical_game_id=s->>'canonicalGameId')or player_before is distinct from(select to_jsonb(score)from public.ball_knower_player_week_scores score where provider_game_id=s->>'canonicalGameId'and provider_player_id='qa-fixture:'||target)or weekly_before is distinct from(select to_jsonb(score)from public.ball_knower_weekly_scores score where league_id=current_setting('bk.launch_qa_league')and member_id=current_setting('bk.launch_qa_member_a')and week_number=18)or(select count(*)from ball_knower_private.fantasy_scoring_receipts)<>receipts or(select count(*)from public.ball_knower_stat_corrections where provider_player_id='qa-fixture:'||target)<>1 or not exists(select 1 from public.ball_knower_weekly_scores score join qa_scoring_before b using(member_id)where score.league_id=current_setting('bk.launch_qa_league')and score.member_id=current_setting('bk.launch_qa_member_a')and score.week_number=18 and score.live_points=b.live_points+1)then raise exception 'Failed real-schema receipt left partial writes';end if;
end $$;
reset role;
rollback;
select 'real-schema scoring overlay passed: actual legacy trigger/FK, two managers, final/correction/stale replay, incomplete-nine/nonfinal guards, saved forecasts and atomic receipt rollback; all fixture writes rolled back' as result;
