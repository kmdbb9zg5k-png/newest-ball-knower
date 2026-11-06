\set ON_ERROR_STOP on
begin;
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon')then create role anon nologin;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated')then create role authenticated nologin;end if;
 if not exists(select 1 from pg_roles where rolname='service_role')then create role service_role nologin bypassrls;end if;
end $$;
create schema ball_knower_private;
grant usage on schema public,ball_knower_private to service_role;
create table public.ball_knower_nfl_games(provider_game_id text primary key,season int not null,season_type text not null default 'reg',week_number int not null,away_team text not null,home_team text not null,kickoff_at timestamptz not null,game_status text default 'Scheduled',is_final boolean not null default false,is_live boolean not null default false,final_at timestamptz,provider_updated_at timestamptz,last_polled_at timestamptz,updated_at timestamptz default now());
create table public.ball_knower_player_week_scores(id uuid primary key default gen_random_uuid(),provider_game_id text not null references public.ball_knower_nfl_games,provider_player_id text not null,ball_knower_player_id text,season int not null,season_type text not null,week_number int not null,player_name text not null,team text not null,position text,kickoff_at timestamptz not null,game_status text,is_final boolean not null,stats jsonb not null,fantasy_points jsonb not null,projected_points jsonb not null default '{}'::jsonb,score_revision int not null default 1,provider_updated_at timestamptz,updated_at timestamptz,unique(provider_game_id,provider_player_id));
create table public.ball_knower_stat_corrections(id uuid primary key default gen_random_uuid(),provider_game_id text not null references public.ball_knower_nfl_games,provider_player_id text not null,ball_knower_player_id text,season int not null,week_number int not null,player_name text not null,previous_stats jsonb not null,corrected_stats jsonb not null,previous_points jsonb not null,corrected_points jsonb not null,detected_at timestamptz not null default now());
create table public.ball_knower_leagues(id text primary key,settings jsonb);
create table public.ball_knower_league_members(id text primary key,league_id text not null references public.ball_knower_leagues,roster jsonb not null);
create table public.ball_knower_live_drafts(league_id text primary key,status text);
create table public.ball_knower_weekly_lineups(id uuid primary key default gen_random_uuid(),league_id text not null references public.ball_knower_leagues,member_id text not null references public.ball_knower_league_members,week_number int not null,starters jsonb not null,bench jsonb not null default '[]',unique(league_id,member_id,week_number));
create table public.ball_knower_weekly_scores(id uuid primary key default gen_random_uuid(),league_id text not null references public.ball_knower_leagues,member_id text not null references public.ball_knower_league_members,week_number int not null,live_points numeric not null default 0,projected_points numeric not null default 0,source text,is_final boolean not null default false,score_revision int not null default 1,score_details jsonb not null default '{}',finalized_at timestamptz,last_correction_at timestamptz,updated_at timestamptz,unique(league_id,member_id,week_number));
grant select,insert,update on all tables in schema public to service_role;
\ir ../migrations/20261106021753_atomic_validated_fantasy_scoring.sql

-- No production provider body or credentials are used. These deliberately
-- complete synthetic stat lines exercise the actual PostgreSQL transaction.
create function pg_temp.scoring_row(p_id text,p_team text,p_pos text,p_stats jsonb default '{}') returns jsonb language plpgsql as $$
declare s jsonb;points jsonb;
begin
 s:=case when p_pos='DST' then '{"sacks":0,"interceptions":0,"fumbleRecoveries":0,"defensiveTouchdowns":0,"returnTouchdowns":0,"safeties":0,"blockedKicks":0,"pointsAllowed":0}'::jsonb else '{"passingYards":0,"passingTouchdowns":0,"interceptionsThrown":0,"rushingYards":0,"rushingTouchdowns":0,"receivingYards":0,"receivingTouchdowns":0,"receptions":0,"twoPointConversions":0,"fumblesLost":0,"returnTouchdowns":0,"fieldGoalsMade":0,"fieldGoalsMissed":0,"extraPointsMade":0,"extraPointsMissed":0}'::jsonb end||p_stats;
 points:=jsonb_build_object('standard',ball_knower_private.canonical_fantasy_points(s,p_pos,'standard'),'half_ppr',ball_knower_private.canonical_fantasy_points(s,p_pos,'half_ppr'),'ppr',ball_knower_private.canonical_fantasy_points(s,p_pos,'ppr'));
 return jsonb_build_object('providerPlayerId',p_id,'appPlayerId',case when p_pos='DST' then 'dst-'||lower(p_team) else 'app-'||p_id end,'team',p_team,'position',p_pos,'name','Synthetic fixture '||p_id,'participation','played','stats',s,'points',points);
end $$;
create temp table scoring_fixture(snapshot jsonb);
insert into scoring_fixture select jsonb_build_object('schemaVersion',1,'source','tank01','contractId','tank01-fixture-v1','canonicalGameId','espn-canonical-fixture','providerGameId','20261102_CHI@SEA','season',2026,'week',8,'away','CHI','home','SEA','kickoffAt','2026-11-03T01:15:00Z','status','final','sourceUpdatedAt',clock_timestamp(),'sourceTimestampBasis','provider_payload','retrievedAt',clock_timestamp(),'players',jsonb_build_array(
 pg_temp.scoring_row('qb','CHI','QB','{"passingYards":100}'),pg_temp.scoring_row('rb1','CHI','RB','{"rushingYards":20}'),pg_temp.scoring_row('rb2','CHI','RB','{"rushingYards":20}'),pg_temp.scoring_row('wr1','SEA','WR','{"receptions":2,"receivingYards":20}'),pg_temp.scoring_row('wr2','SEA','WR','{"receptions":2,"receivingYards":20}'),pg_temp.scoring_row('te','CHI','TE','{"receptions":2,"receivingYards":20}'),pg_temp.scoring_row('flex','SEA','WR','{"receptions":2,"receivingYards":20}'),pg_temp.scoring_row('k','SEA','K','{"fieldGoalsMade":1,"extraPointsMade":1}'),pg_temp.scoring_row('DST:CHI','CHI','DST','{"sacks":2,"pointsAllowed":17}'),pg_temp.scoring_row('DST:SEA','SEA','DST','{"pointsAllowed":34}')
));
grant all on scoring_fixture to service_role;
insert into public.ball_knower_nfl_games(provider_game_id,season,week_number,away_team,home_team,kickoff_at)values('espn-canonical-fixture',2026,8,'CHI','SEA','2026-11-03T01:15:00Z');
-- Complete 272-game/32-team schedule. Round one becomes week eight so
-- the CHI-at-SEA fixture remains the sole source-polled game in this run.
do $$declare circle text[]:=array['CHI','ARI','ATL','BAL','BUF','CAR','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','TB','TEN','WAS','SEA'];r int;p int;w int;begin
 for r in 1..17 loop
  w:=case r when 1 then 8 when 8 then 1 else r end;
  for p in 1..16 loop
   if not(r=1 and p=1)then insert into public.ball_knower_nfl_games(provider_game_id,season,week_number,away_team,home_team,kickoff_at,is_final)values('schedule-fixture-'||w||'-'||p,2026,w,circle[p],circle[33-p],'2026-09-01T00:00:00Z',w=8);end if;
  end loop;
  circle:=array[circle[1],circle[32]]||circle[2:31];
 end loop;
end $$;
update public.ball_knower_nfl_games set week_number=18 where provider_game_id='schedule-fixture-17-1';
insert into ball_knower_private.fantasy_scoring_contracts(contract_id,source)values('tank01-fixture-v1','tank01');
insert into ball_knower_private.fantasy_scoring_identities select 'tank01-fixture-v1',2026,r->>'providerPlayerId',r->>'appPlayerId',r->>'name',r->>'team',r->>'position','2026-01-01'::timestamptz,'2027-03-01'::timestamptz,'synthetic fixture proof only',true,clock_timestamp(),clock_timestamp()+interval '1 day' from scoring_fixture,jsonb_array_elements(snapshot->'players')r;
-- Effective-dated identity evidence preserves old-team corrections after a trade.
update ball_knower_private.fantasy_scoring_identities set team_effective_until='2026-11-04'where provider_player_id='qb';
insert into ball_knower_private.fantasy_scoring_identities select contract_id,season,provider_player_id,app_player_id,canonical_name,'WAS',position,'2026-11-04'::timestamptz,'2027-03-01'::timestamptz,evidence_reference,active,verified_at,valid_until from ball_knower_private.fantasy_scoring_identities where provider_player_id='qb';
-- The other fifteen week-eight games already have verified final state.
insert into ball_knower_private.fantasy_scoring_state(canonical_game_id,contract_id,provider_game_id,source_updated_at,source_timestamp_basis,retrieved_at,content_fingerprint,is_final,revision)
 select provider_game_id,'tank01-fixture-v1','fixture-other-game',clock_timestamp(),'provider_payload',clock_timestamp(),'fixture-final',true,1 from public.ball_knower_nfl_games where week_number=8 and provider_game_id<>'espn-canonical-fixture';
insert into public.ball_knower_leagues values('league-fixture','{"nflSeason":2026,"scoringFormat":"ppr"}');
insert into public.ball_knower_live_drafts values('league-fixture','completed');
insert into public.ball_knower_league_members select id,'league-fixture',(select jsonb_agg(jsonb_build_object('id',r->>'appPlayerId','name',r->>'name','team',r->>'team','position',r->>'position'))from scoring_fixture,jsonb_array_elements(snapshot->'players')r)from unnest(array['manager-1','manager-2'])id;
insert into public.ball_knower_weekly_lineups(league_id,member_id,week_number,starters)values
 ('league-fixture','manager-1',8,'{"QB":"app-qb","RB1":"app-rb1","RB2":"app-rb2","WR1":"app-wr1","WR2":"app-wr2","TE":"app-te","FLEX":"app-flex","K":"app-k","DST":"dst-chi"}'),
 ('league-fixture','manager-2',8,'{"QB":"app-qb"}');
insert into public.ball_knower_weekly_scores(league_id,member_id,week_number,live_points,projected_points)values('league-fixture','manager-1',8,0,123.45);
update public.ball_knower_weekly_scores set score_details=jsonb_build_object('hasProjectedTotal',true,'players',(select jsonb_agg(jsonb_build_object('slot',slot,'playerId',player,'projectedPoints',case when slot='QB'then 0 else 15 end,'projectionAvailable',true))from jsonb_each_text((select starters from public.ball_knower_weekly_lineups where member_id='manager-1'))e(slot,player)))where member_id='manager-1';
set local role service_role;
do $$declare s jsonb;result jsonb;begin
 select snapshot into s from scoring_fixture;
 begin perform public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('a',64));raise exception 'Unapproved contract accepted';exception when others then if sqlerrm='Unapproved contract accepted'then raise;end if;end;
 if exists(select 1 from public.ball_knower_player_week_scores)then raise exception 'Unapproved contract wrote scores';end if;
end $$;
reset role;
update ball_knower_private.fantasy_scoring_contracts set approved_at=clock_timestamp(),evidence='{"identityNamespaceVerified":true,"zeroSemanticsVerified":true,"rareEventsVerified":true,"liveCadenceVerified":true,"correctionLifecycleVerified":true,"sourcePublicationTimeVerified":true,"sourceTimestampBasis":"provider_payload","sourceTimestampField":"updatedAt","pointsAllowedPolicy":"exclude_opponent_defense_scores_and_conversions"}';
savepoint poll_rotation;
update public.ball_knower_nfl_games set kickoff_at=clock_timestamp()-interval '2 hours'where provider_game_id in('schedule-fixture-1-1','schedule-fixture-1-2');
set local role service_role;
do $$declare a jsonb;b jsonb;begin
 a:=public.claim_ball_knower_fantasy_scoring_work('tank01-fixture-v1');b:=public.claim_ball_knower_fantasy_scoring_work('tank01-fixture-v1');
 if jsonb_array_length(a->'games')<>2 or jsonb_array_length(b->'games')<>1 then raise exception 'Uncommitted invalid games starved later source work';end if;
 if exists(select 1 from public.ball_knower_player_week_scores)or exists(select 1 from public.ball_knower_nfl_games where provider_updated_at is not null)then raise exception 'Poll attempt fabricated scoring freshness';end if;
end $$;
reset role;
rollback to savepoint poll_rotation;
savepoint incomplete_schedule;
delete from public.ball_knower_nfl_games where provider_game_id='schedule-fixture-1-1';
set local role service_role;
do $$declare s jsonb;begin
 select snapshot into s from scoring_fixture;perform public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('a',64));
 if(select is_final from public.ball_knower_weekly_scores where member_id='manager-1')then raise exception 'Incomplete season schedule certified week final';end if;
end $$;
reset role;
rollback to savepoint poll_rotation;
update public.ball_knower_nfl_games set kickoff_at=clock_timestamp()-interval '2 hours'where provider_game_id in('schedule-fixture-1-1','schedule-fixture-1-2');
set local role service_role;
do $$declare a jsonb;b jsonb;begin
 a:=public.claim_ball_knower_fantasy_scoring_work('tank01-fixture-v1');b:=public.claim_ball_knower_fantasy_scoring_work('tank01-fixture-v1');
 if jsonb_array_length(a->'games')<>2 or jsonb_array_length(b->'games')<>1 then raise exception 'Uncommitted invalid games starved later source work';end if;
 if exists(select 1 from public.ball_knower_player_week_scores)or exists(select 1 from public.ball_knower_nfl_games where provider_updated_at is not null)then raise exception 'Poll attempt fabricated scoring freshness';end if;
end $$;
reset role;
rollback to savepoint poll_rotation;
savepoint incomplete_schedule;
set local role service_role;
do $$declare s jsonb;r jsonb;begin
 select snapshot into s from scoring_fixture;
 r:=public.claim_ball_knower_fantasy_scoring_work('tank01-fixture-v1');if jsonb_array_length(r->'games')<>1 or jsonb_array_length(r#>'{games,0,identities}')<>10 or r#>>'{games,0,game,providerGameId}'<>'20261102_CHI@SEA'then raise exception 'Bounded approved source work was incorrect';end if;
 r:=public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('a',64));
 if r->>'status'<>'committed' or (r->>'playerRows')::int<>10 or (r->>'weeklyScores')::int<>1 then raise exception 'Initial atomic receipt incorrect: %',r;end if;
 if (select live_points from public.ball_knower_weekly_scores where member_id='manager-1')<>31 or not(select is_final from public.ball_knower_weekly_scores where member_id='manager-1')then raise exception 'Complete nine-slot total/finalization failed';end if;
 if exists(select 1 from public.ball_knower_weekly_scores where member_id='manager-2')then raise exception 'Incomplete lineup finalized or acquired fake zero';end if;
 if (select projected_points from public.ball_knower_weekly_scores where member_id='manager-1')<>123.45 or (select score_details->'hasProjectedTotal' from public.ball_knower_weekly_scores where member_id='manager-1')<>'true'::jsonb or not exists(select 1 from public.ball_knower_weekly_scores s,jsonb_array_elements(s.score_details->'players')d where s.member_id='manager-1'and d->>'slot'='QB'and d->'projectedPoints'='0'::jsonb and d->'projectionAvailable'='true'::jsonb)then raise exception 'Pregame numeric/per-player/zero projection metadata changed';end if;
 r:=public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('a',64));if r->>'status'<>'duplicate' or(select count(*)from ball_knower_private.fantasy_scoring_receipts)<>1 then raise exception 'Duplicate snapshot changed receipt ledger';end if;
 -- One later publication corrects a final QB from 100 to 125 yards.
 s:=jsonb_set(s,'{sourceUpdatedAt}',to_jsonb((s->>'sourceUpdatedAt')::timestamptz+interval '1 second'));
 s:=jsonb_set(s,'{players,0}',pg_temp.scoring_row('qb','CHI','QB','{"passingYards":125}'));
 r:=public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('b',64));
 if (r->>'statCorrections')::int<>1 or(select count(*)from public.ball_knower_stat_corrections)<>1 or(select live_points from public.ball_knower_weekly_scores where member_id='manager-1')<>32 or(select score_revision from public.ball_knower_player_week_scores where provider_player_id='qb')<>2 then raise exception 'Final correction failed or duplicated';end if;
 perform public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('b',64));if(select count(*)from public.ball_knower_stat_corrections)<>1 then raise exception 'Repeated correction duplicated audit';end if;
 r:=public.commit_ball_knower_fantasy_scoring_snapshot((select snapshot from scoring_fixture),repeat('a',64));if r->>'status'<>'stale_ignored'then raise exception 'Older source overwrote correction';end if;
 -- Same publication with changed arithmetic is rejected.
 begin perform public.commit_ball_knower_fantasy_scoring_snapshot(jsonb_set(s,'{players,0}',pg_temp.scoring_row('qb','CHI','QB','{"passingYards":150}')),repeat('c',64));raise exception 'Conflicting publication accepted';exception when others then if sqlerrm='Conflicting publication accepted'then raise;end if;end;
 s:=jsonb_set(jsonb_set(s,'{status}','"in_progress"'),'{sourceUpdatedAt}',to_jsonb((s->>'sourceUpdatedAt')::timestamptz+interval '1 second'));
 r:=public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('d',64));if r->>'status'<>'nonfinal_ignored'then raise exception 'Late nonfinal snapshot overwrote final';end if;
end $$;
reset role;
-- Re-evaluate both real submitted lineups on a later identical publication;
-- the new receipt advances freshness without inventing a correction/revision.
update public.ball_knower_weekly_lineups set starters=(select starters from public.ball_knower_weekly_lineups where member_id='manager-1')where member_id='manager-2';
set local role service_role;
do $$declare s jsonb;r jsonb;k text;bad jsonb;begin
 select snapshot into s from scoring_fixture;
 if ball_knower_private.canonical_fantasy_points((pg_temp.scoring_row('qb','CHI','QB','{"passingYards":250,"passingTouchdowns":2,"interceptionsThrown":1,"rushingYards":25,"rushingTouchdowns":1,"receptions":3,"receivingYards":30}'))->'stats','QB','ppr','{"passTd":6,"reception":2}')<>37.5 then raise exception 'Custom SQL scoring diverged from TypeScript';end if;
 begin perform ball_knower_private.canonical_fantasy_points((pg_temp.scoring_row('DST:CHI','CHI','DST')->'stats')-'pointsAllowed','DST','ppr');raise exception 'Missing PA became shutout';exception when others then if sqlerrm<>'Required canonical stat unavailable'then raise;end if;end;
 -- Strict required-field/null handling is enforced in SQL as well as TypeScript.
 for k in select jsonb_object_keys(s#>'{players,0,stats}')loop
  begin perform ball_knower_private.canonical_fantasy_points((s#>'{players,0,stats}')-k,'QB','ppr');raise exception 'Missing stat accepted';exception when others then if sqlerrm<>'Required canonical stat unavailable'then raise;end if;end;
 end loop;
 begin perform ball_knower_private.canonical_fantasy_points(jsonb_set(s#>'{players,0,stats}','{fumblesLost}','null'),'QB','ppr');raise exception 'Null stat accepted';exception when others then if sqlerrm<>'Required canonical stat unavailable'then raise;end if;end;
 for k in select unnest(array['season','week','away','home','kickoffAt','providerGameId'])loop
  begin perform public.commit_ball_knower_fantasy_scoring_snapshot(s-k,repeat('f',64));raise exception 'Missing canonical game field accepted';exception when others then if sqlerrm='Missing canonical game field accepted'then raise;end if;end;
 end loop;
 -- Source verification cannot be replaced by a matching name or roster string.
 bad:=jsonb_set(jsonb_set(s,'{sourceUpdatedAt}',to_jsonb((s->>'sourceUpdatedAt')::timestamptz+interval '3 seconds')),'{players,0,providerPlayerId}','"unknown-provider"');
 begin perform public.commit_ball_knower_fantasy_scoring_snapshot(bad,repeat('f',64));raise exception 'Unverified identity accepted';exception when others then if sqlerrm<>'Scoring identity lacks source verification'then raise;end if;end;
 s:=jsonb_set(s,'{sourceUpdatedAt}',to_jsonb((s->>'sourceUpdatedAt')::timestamptz+interval '2 seconds'));
 s:=jsonb_set(s,'{players,0}',pg_temp.scoring_row('qb','CHI','QB','{"passingYards":125}'));
 r:=public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('b',64));
 if (r->>'revision')::int<>2 or (r->>'statCorrections')::int<>0 or (r->>'weeklyScores')::int<>2 or (select count(*)from public.ball_knower_weekly_scores where is_final)<>2 or (select min(live_points)from public.ball_knower_weekly_scores)<>32 then raise exception 'Second manager or heartbeat idempotence failed';end if;
 if(select score_revision from public.ball_knower_player_week_scores where provider_player_id='qb')<>2 then raise exception 'Heartbeat fabricated stat revision';end if;
end $$;
reset role;
-- Force a failure at the last receipt insert, after player/correction/weekly
-- writes, and prove the entire RPC transaction rolls back via a subtransaction.
create function pg_temp.reject_scoring_receipt()returns trigger language plpgsql as $$begin raise exception 'Fixture receipt failure';end $$;
create trigger fixture_receipt_failure before insert on ball_knower_private.fantasy_scoring_receipts for each row execute function pg_temp.reject_scoring_receipt();
set local role service_role;
do $$declare s jsonb;begin
 select snapshot into s from scoring_fixture;
 s:=jsonb_set(s,'{sourceUpdatedAt}',to_jsonb((s->>'sourceUpdatedAt')::timestamptz+interval '3 seconds'));
 s:=jsonb_set(s,'{players,0}',pg_temp.scoring_row('qb','CHI','QB','{"passingYards":150}'));
 begin perform public.commit_ball_knower_fantasy_scoring_snapshot(s,repeat('e',64));raise exception 'Receipt failure did not abort';exception when others then if sqlerrm<>'Fixture receipt failure'then raise;end if;end;
 if(select count(*)from ball_knower_private.fantasy_scoring_receipts)<>3 or(select count(*)from public.ball_knower_stat_corrections)<>1 or(select live_points from public.ball_knower_weekly_scores where member_id='manager-1')<>32 or(select stats->>'passingYards'from public.ball_knower_player_week_scores where provider_player_id='qb')<>'125' then raise exception 'Failed receipt left partial writes';end if;
end $$;
reset role;
drop trigger fixture_receipt_failure on ball_knower_private.fantasy_scoring_receipts;
-- Non-service roles cannot invoke the writer, and private ledgers stay private.
set local role authenticated;
do $$begin begin perform public.commit_ball_knower_fantasy_scoring_snapshot('{}',repeat('f',64));raise exception 'Authenticated role invoked scorer';exception when insufficient_privilege then null;end;end $$;
reset role;
do $$begin
 if has_table_privilege('authenticated','ball_knower_private.fantasy_scoring_receipts','SELECT')or has_table_privilege('anon','ball_knower_private.fantasy_scoring_state','SELECT')then raise exception 'Private scoring ledger exposed';end if;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ball_knower_private' and c.relname='fantasy_scoring_receipts' and c.relrowsecurity)then raise exception 'Receipt RLS missing';end if;
end $$;
rollback;
select 'fantasy scoring PostgreSQL integration passed: atomic receipts, correction replay, stale/final guards, nine-slot completeness, projections and role isolation' as result;
