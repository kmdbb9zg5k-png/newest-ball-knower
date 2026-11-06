-- Reviewed-source scoring foundation only. No provider activation, identity
-- approvals, schedule replacement, league progression, or historical backfill.
create table if not exists ball_knower_private.fantasy_scoring_contracts (
 contract_id text primary key check(contract_id ~ '^tank01-[a-z0-9-]{1,80}$'),
 source text not null check(source='tank01'),
 approved_at timestamptz,
 evidence jsonb not null default '{}'::jsonb
);
create table if not exists ball_knower_private.fantasy_scoring_identities (
 contract_id text not null references ball_knower_private.fantasy_scoring_contracts(contract_id),
 season integer not null check(season=2026),
 provider_player_id text not null,
 app_player_id text not null,
 canonical_name text not null check(length(btrim(canonical_name))>0),
 team text not null,
 position text not null check(position in('QB','RB','FB','WR','TE','K','DST')),
 team_effective_from timestamptz not null,
 team_effective_until timestamptz not null check(team_effective_until>team_effective_from),
 evidence_reference text not null check(length(btrim(evidence_reference))>0),
 active boolean not null,
 verified_at timestamptz not null,
 valid_until timestamptz not null check(valid_until>verified_at and valid_until<=verified_at+interval '7 days'),
 primary key(contract_id,season,provider_player_id,team_effective_from),
 unique(contract_id,season,app_player_id,team_effective_from)
);
create table if not exists ball_knower_private.fantasy_scoring_state (
 canonical_game_id text primary key references public.ball_knower_nfl_games(provider_game_id),
 contract_id text not null references ball_knower_private.fantasy_scoring_contracts(contract_id),
 provider_game_id text not null,
 source_updated_at timestamptz not null,
 source_timestamp_basis text not null check(source_timestamp_basis in('provider_payload','http_last_modified')),
 retrieved_at timestamptz not null,
 content_fingerprint text not null,
 is_final boolean not null,
 revision integer not null default 1
);
create table if not exists ball_knower_private.fantasy_scoring_receipts (
 id uuid primary key default gen_random_uuid(),
 canonical_game_id text not null references public.ball_knower_nfl_games(provider_game_id),
 contract_id text not null references ball_knower_private.fantasy_scoring_contracts(contract_id),
 source_updated_at timestamptz not null,
 content_fingerprint text not null,
 caller_content_hash text not null,
 received_at timestamptz not null default clock_timestamp(),
 revision integer not null,
 rows_written integer not null,
 corrections integer not null,
 weekly_scores_written integer not null,
 is_final boolean not null,
 unique(canonical_game_id,source_updated_at)
);
alter table ball_knower_private.fantasy_scoring_contracts enable row level security;
alter table ball_knower_private.fantasy_scoring_identities enable row level security;
alter table ball_knower_private.fantasy_scoring_state enable row level security;
alter table ball_knower_private.fantasy_scoring_receipts enable row level security;
revoke all on ball_knower_private.fantasy_scoring_contracts,ball_knower_private.fantasy_scoring_identities,ball_knower_private.fantasy_scoring_state,ball_knower_private.fantasy_scoring_receipts from public,anon,authenticated;
grant select,insert,update on ball_knower_private.fantasy_scoring_contracts,ball_knower_private.fantasy_scoring_identities,ball_knower_private.fantasy_scoring_state,ball_knower_private.fantasy_scoring_receipts to service_role;
create table if not exists ball_knower_private.fantasy_scoring_poll_attempts (
 canonical_game_id text primary key references public.ball_knower_nfl_games(provider_game_id),
 attempted_at timestamptz not null,
 next_attempt_at timestamptz not null
);
alter table ball_knower_private.fantasy_scoring_poll_attempts enable row level security;
revoke all on ball_knower_private.fantasy_scoring_poll_attempts from public,anon,authenticated;
grant select,insert,update on ball_knower_private.fantasy_scoring_poll_attempts to service_role;
alter table public.ball_knower_player_week_scores add column if not exists scoring_contract_id text,
 add column if not exists source_retrieved_at timestamptz,
 add column if not exists source_timestamp_basis text,
 add column if not exists participation_status text;

-- The database recalculates every format/custom total from validated canonical
-- stats. A caller-supplied fantasy_points number is never the scoring authority.
create or replace function ball_knower_private.canonical_fantasy_points(p_stats jsonb,p_position text,p_format text,p_custom jsonb default '{}'::jsonb)
returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare
 v_key text; v_value numeric; v_pa numeric; v_points numeric;
 v_fields text[]:=case when p_position='DST' then array['sacks','interceptions','fumbleRecoveries','defensiveTouchdowns','returnTouchdowns','safeties','blockedKicks','pointsAllowed'] else array['passingYards','passingTouchdowns','interceptionsThrown','rushingYards','rushingTouchdowns','receivingYards','receivingTouchdowns','receptions','twoPointConversions','fumblesLost','returnTouchdowns','fieldGoalsMade','fieldGoalsMissed','extraPointsMade','extraPointsMissed'] end;
begin
 if jsonb_typeof(p_stats) is distinct from 'object' or p_format not in('standard','half_ppr','ppr') or p_position not in('QB','RB','FB','WR','TE','K','DST') then raise exception 'Invalid canonical scoring input';end if;
 foreach v_key in array v_fields loop
  if jsonb_typeof(p_stats->v_key) is distinct from 'number' then raise exception 'Required canonical stat unavailable';end if;
 end loop;
 for v_key in select jsonb_object_keys(p_stats) loop
  if not(v_key=any(v_fields||case when p_position='DST'then array[]::text[]else array['passingAttempts','passingCompletions','rushingAttempts','targets','fieldGoalsAttempted','extraPointsAttempted']end))or jsonb_typeof(p_stats->v_key) is distinct from 'number' then raise exception 'Invalid canonical stat';end if;
  v_value:=(p_stats->>v_key)::numeric;
  if abs(v_value)>10000 or (v_key not like '%Yards' and v_value<0) or (v_key='sacks' and trunc(v_value*2)<>v_value*2) or (v_key<>'sacks' and trunc(v_value)<>v_value) then raise exception 'Invalid canonical stat';end if;
 end loop;
 if p_stats ? 'passingCompletions' and p_stats ? 'passingAttempts' and (p_stats->>'passingCompletions')::numeric>(p_stats->>'passingAttempts')::numeric then raise exception 'Inconsistent canonical attempts';end if;
 if p_stats ? 'fieldGoalsAttempted' and (p_stats->>'fieldGoalsMade')::numeric+(p_stats->>'fieldGoalsMissed')::numeric<>(p_stats->>'fieldGoalsAttempted')::numeric then raise exception 'Inconsistent canonical attempts';end if;
 if p_stats ? 'extraPointsAttempted' and (p_stats->>'extraPointsMade')::numeric+(p_stats->>'extraPointsMissed')::numeric<>(p_stats->>'extraPointsAttempted')::numeric then raise exception 'Inconsistent canonical attempts';end if;
 if jsonb_typeof(p_custom) is distinct from 'object' then raise exception 'Invalid custom scoring';end if;
 for v_key in select jsonb_object_keys(p_custom) loop
  if v_key not in('passYards','passTd','interception','rushYards','rushTd','recYards','recTd','reception','fumbleLost','fieldGoal','extraPoint','dstSack','dstTurnover','dstTd')or jsonb_typeof(p_custom->v_key) not in('number','string')or (p_custom->>v_key)!~'^[-]?[0-9]+([.][0-9]+)?$'or abs((p_custom->>v_key)::numeric)>100 then raise exception 'Invalid custom scoring';end if;
 end loop;
 if p_position='DST' then
  v_pa:=(p_stats->>'pointsAllowed')::numeric;
  v_points:=(p_stats->>'sacks')::numeric*coalesce((p_custom->>'dstSack')::numeric,1)
   +((p_stats->>'interceptions')::numeric+(p_stats->>'fumbleRecoveries')::numeric)*coalesce((p_custom->>'dstTurnover')::numeric,2)
   +((p_stats->>'defensiveTouchdowns')::numeric+(p_stats->>'returnTouchdowns')::numeric)*coalesce((p_custom->>'dstTd')::numeric,6)
   +(p_stats->>'safeties')::numeric*2+(p_stats->>'blockedKicks')::numeric*2
   +case when v_pa=0 then 10 when v_pa<=6 then 7 when v_pa<=13 then 4 when v_pa<=20 then 1 when v_pa<=27 then 0 when v_pa<=34 then -1 else -4 end;
 else
  v_points:=(p_stats->>'passingYards')::numeric*coalesce((p_custom->>'passYards')::numeric,.04)
   +(p_stats->>'passingTouchdowns')::numeric*coalesce((p_custom->>'passTd')::numeric,4)
   +(p_stats->>'interceptionsThrown')::numeric*coalesce((p_custom->>'interception')::numeric,-2)
   +(p_stats->>'rushingYards')::numeric*coalesce((p_custom->>'rushYards')::numeric,.1)
   +(p_stats->>'rushingTouchdowns')::numeric*coalesce((p_custom->>'rushTd')::numeric,6)
   +(p_stats->>'receivingYards')::numeric*coalesce((p_custom->>'recYards')::numeric,.1)
   +(p_stats->>'receivingTouchdowns')::numeric*coalesce((p_custom->>'recTd')::numeric,6)
   +(p_stats->>'receptions')::numeric*coalesce((p_custom->>'reception')::numeric,case p_format when 'ppr' then 1 when 'half_ppr' then .5 else 0 end)
   +(p_stats->>'twoPointConversions')::numeric*2+(p_stats->>'fumblesLost')::numeric*coalesce((p_custom->>'fumbleLost')::numeric,-2)
   +(p_stats->>'returnTouchdowns')::numeric*6+(p_stats->>'fieldGoalsMade')::numeric*coalesce((p_custom->>'fieldGoal')::numeric,3)
   -(p_stats->>'fieldGoalsMissed')::numeric+(p_stats->>'extraPointsMade')::numeric*coalesce((p_custom->>'extraPoint')::numeric,1)-(p_stats->>'extraPointsMissed')::numeric;
 end if;
 return round(v_points,2);
end $$;
revoke all on function ball_knower_private.canonical_fantasy_points(jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function ball_knower_private.canonical_fantasy_points(jsonb,text,text,jsonb) to service_role;

create or replace function public.commit_ball_knower_fantasy_scoring_snapshot(p_snapshot jsonb,p_content_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_game public.ball_knower_nfl_games%rowtype;v_state ball_knower_private.fantasy_scoring_state%rowtype;v_contract ball_knower_private.fantasy_scoring_contracts%rowtype;
 v_prior public.ball_knower_player_week_scores%rowtype;v_weekly public.ball_knower_weekly_scores%rowtype;v_lineup record;v_identity record;v_player record;
 v_row jsonb;v_stats jsonb;v_points jsonb;v_source timestamptz;v_retrieved timestamptz;v_final boolean;v_fingerprint text;v_revision integer;
 v_changed boolean;v_rows integer:=0;v_corrections integer:=0;v_weekly_rows integer:=0;v_receipt uuid;
 v_seen_provider text[]:='{}';v_seen_app text[]:='{}';v_dst text[]:='{}';v_team text;v_format text;v_custom jsonb;
 v_slot text;v_player_id text;v_roster_player jsonb;v_details jsonb;v_detail jsonb;v_prior_detail jsonb;v_total numeric;v_actual numeric;v_complete boolean;v_all_final boolean;v_week_final boolean;v_schedule_complete boolean;v_bye boolean;v_expected_position text;
 v_nfl_teams text[]:=array['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
 v_required text[]:=array['QB','RB1','RB2','WR1','WR2','TE','FLEX','K','DST'];
begin
 if current_user<>'service_role' then raise exception 'Service role required';end if;
 if jsonb_typeof(p_snapshot)is distinct from 'object'or jsonb_typeof(p_snapshot->'season')is distinct from 'number'or p_snapshot->>'season'is distinct from '2026'or jsonb_typeof(p_snapshot->'week')is distinct from 'number'or coalesce(p_snapshot->>'week','')!~'^(?:[1-9]|1[0-8])$'or jsonb_typeof(p_snapshot->'away')is distinct from 'string'or jsonb_typeof(p_snapshot->'home')is distinct from 'string'or jsonb_typeof(p_snapshot->'kickoffAt')is distinct from 'string'or jsonb_typeof(p_snapshot->'providerGameId')is distinct from 'string'or p_snapshot->>'schemaVersion' is distinct from '1' or p_snapshot->>'source' is distinct from 'tank01' or jsonb_typeof(p_snapshot->'players') is distinct from 'array' or jsonb_array_length(p_snapshot->'players') not between 4 and 250 or p_content_hash is null or p_content_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid scoring snapshot';end if;
 select * into v_contract from ball_knower_private.fantasy_scoring_contracts where contract_id=p_snapshot->>'contractId';
 if not found or v_contract.approved_at is null or coalesce(v_contract.evidence->>'sourceTimestampBasis','') not in('provider_payload','http_last_modified') or(v_contract.evidence->>'sourceTimestampBasis'='provider_payload' and nullif(v_contract.evidence->>'sourceTimestampField','')is null)or not coalesce(v_contract.evidence @> '{"identityNamespaceVerified":true,"zeroSemanticsVerified":true,"rareEventsVerified":true,"liveCadenceVerified":true,"correctionLifecycleVerified":true,"sourcePublicationTimeVerified":true,"pointsAllowedPolicy":"exclude_opponent_defense_scores_and_conversions"}'::jsonb,false) then raise exception 'Scoring source contract is not approved';end if;
 v_source:=(p_snapshot->>'sourceUpdatedAt')::timestamptz;v_retrieved:=(p_snapshot->>'retrievedAt')::timestamptz;v_final:=p_snapshot->>'status'='final';
 if p_snapshot->>'sourceTimestampBasis' is distinct from v_contract.evidence->>'sourceTimestampBasis' then raise exception 'Source publication basis changed';end if;
 if coalesce(p_snapshot->>'status','') not in('in_progress','final') or coalesce(p_snapshot->>'sourceTimestampBasis','') not in('provider_payload','http_last_modified') or v_source is null or v_retrieved is null or v_source>v_retrieved+interval '1 minute' or v_retrieved>clock_timestamp()+interval '1 minute' or v_retrieved<clock_timestamp()-interval '1 minute' or (not v_final and v_source<v_retrieved-interval '5 minutes') then raise exception 'Unverified source publication time';end if;
 -- Serialize each week, then lock its canonical game. Parallel games cannot
 -- overwrite a weekly aggregate calculated before another game's commit.
 perform pg_advisory_xact_lock(hashtext('fantasy-scoring:'||(p_snapshot->>'season')||':'||(p_snapshot->>'week')));
 select * into v_game from public.ball_knower_nfl_games where provider_game_id=p_snapshot->>'canonicalGameId' for update;
 if not found or v_game.season<>2026 or v_game.season_type<>'reg' or v_game.season is distinct from(p_snapshot->>'season')::integer or v_game.week_number is distinct from(p_snapshot->>'week')::integer or v_game.away_team is distinct from p_snapshot->>'away' or v_game.home_team is distinct from p_snapshot->>'home' or v_game.kickoff_at is distinct from(p_snapshot->>'kickoffAt')::timestamptz or v_source<v_game.kickoff_at or to_char(v_game.kickoff_at at time zone 'America/New_York','YYYYMMDD')||'_'||v_game.away_team||'@'||v_game.home_team is distinct from p_snapshot->>'providerGameId' then raise exception 'Canonical game mismatch';end if;
 v_fingerprint:=md5(jsonb_build_object('schemaVersion',p_snapshot->'schemaVersion','source',p_snapshot->'source','contractId',p_snapshot->'contractId','canonicalGameId',p_snapshot->'canonicalGameId','providerGameId',p_snapshot->'providerGameId','status',p_snapshot->'status','players',(select jsonb_agg(jsonb_build_object('providerPlayerId',r->'providerPlayerId','appPlayerId',r->'appPlayerId','team',r->'team','position',r->'position','participation',r->'participation','stats',r->'stats','points',r->'points')order by r->>'providerPlayerId')from jsonb_array_elements(p_snapshot->'players')r))::text);
 select * into v_state from ball_knower_private.fantasy_scoring_state where canonical_game_id=v_game.provider_game_id for update;
 if found then
  if v_state.contract_id<>v_contract.contract_id or v_state.provider_game_id<>p_snapshot->>'providerGameId' then raise exception 'Scoring source identity changed';end if;
  if v_source<v_state.source_updated_at then return jsonb_build_object('status','stale_ignored','writes',0);end if;
  if v_source=v_state.source_updated_at then
   if v_fingerprint<>v_state.content_fingerprint then raise exception 'Conflicting source publication';end if;
   return jsonb_build_object('status','duplicate','revision',v_state.revision,'writes',0);
  end if;
  if v_state.is_final and not v_final then return jsonb_build_object('status','nonfinal_ignored','writes',0);end if;
 end if;
 if v_game.is_final and not v_final then return jsonb_build_object('status','nonfinal_ignored','writes',0);end if;
 v_revision:=case when v_state.canonical_game_id is null then 1 when v_state.content_fingerprint=v_fingerprint then v_state.revision else v_state.revision+1 end;
 for v_row in select value from jsonb_array_elements(p_snapshot->'players') loop
  if nullif(v_row->>'providerPlayerId','') is null or nullif(v_row->>'appPlayerId','') is null or v_row->>'providerPlayerId'=any(v_seen_provider) or v_row->>'appPlayerId'=any(v_seen_app) or nullif(v_row->>'name','') is null or coalesce(v_row->>'team','') not in(v_game.away_team,v_game.home_team) or coalesce(v_row->>'position','') not in('QB','RB','FB','WR','TE','K','DST') or coalesce(v_row->>'participation','') not in('played','verified_did_not_play') then raise exception 'Invalid scoring identity';end if;
  select * into v_identity from ball_knower_private.fantasy_scoring_identities where contract_id=v_contract.contract_id and season=v_game.season and provider_player_id=v_row->>'providerPlayerId' and app_player_id=v_row->>'appPlayerId' and team=v_row->>'team' and position=v_row->>'position' and v_game.kickoff_at>=team_effective_from and v_game.kickoff_at<team_effective_until and active and verified_at<=clock_timestamp()+interval '1 minute' and valid_until>clock_timestamp();
  if not found or(select count(*)from ball_knower_private.fantasy_scoring_identities i where i.contract_id=v_contract.contract_id and i.season=v_game.season and i.provider_player_id=v_row->>'providerPlayerId' and v_game.kickoff_at>=i.team_effective_from and v_game.kickoff_at<i.team_effective_until and i.active and i.verified_at<=clock_timestamp()+interval '1 minute' and i.valid_until>clock_timestamp())<>1 then raise exception 'Scoring identity lacks source verification';end if;
  v_seen_provider:=array_append(v_seen_provider,v_row->>'providerPlayerId');v_seen_app:=array_append(v_seen_app,v_row->>'appPlayerId');v_stats:=v_row->'stats';
  v_points:=jsonb_build_object('standard',ball_knower_private.canonical_fantasy_points(v_stats,v_row->>'position','standard'),'half_ppr',ball_knower_private.canonical_fantasy_points(v_stats,v_row->>'position','half_ppr'),'ppr',ball_knower_private.canonical_fantasy_points(v_stats,v_row->>'position','ppr'));
  if v_points is distinct from v_row->'points' then raise exception 'Scoring arithmetic mismatch';end if;
  if v_row->>'participation'='verified_did_not_play' and (not v_final or exists(select 1 from jsonb_each(v_stats)e where (e.value#>>'{}')::numeric<>0)) then raise exception 'Invalid nonparticipation evidence';end if;
  if v_row->>'position'='DST' then
   if v_row->>'providerPlayerId'<>'DST:'||(v_row->>'team') or v_row->>'appPlayerId'<>'dst-'||lower(v_row->>'team') or v_row->>'participation'<>'played' then raise exception 'Invalid defense identity';end if;
   v_dst:=array_append(v_dst,v_row->>'team');
  end if;
  select * into v_prior from public.ball_knower_player_week_scores where provider_game_id=v_game.provider_game_id and provider_player_id=v_row->>'providerPlayerId' for update;
  if found and (v_prior.ball_knower_player_id is distinct from v_row->>'appPlayerId' or v_prior.team is distinct from v_row->>'team' or v_prior.position is distinct from v_row->>'position') then raise exception 'Saved player identity changed';end if;
  if v_prior.id is not null and (v_prior.scoring_contract_id is not null and v_prior.scoring_contract_id<>v_contract.contract_id) then raise exception 'Saved scoring contract changed';end if;
  v_changed:=v_prior.id is not null and (v_prior.stats is distinct from v_stats or v_prior.fantasy_points is distinct from v_points);
  if v_prior.is_final and v_changed then
   insert into public.ball_knower_stat_corrections(provider_game_id,provider_player_id,ball_knower_player_id,season,week_number,player_name,previous_stats,corrected_stats,previous_points,corrected_points)
   values(v_game.provider_game_id,v_row->>'providerPlayerId',v_row->>'appPlayerId',v_game.season,v_game.week_number,v_row->>'name',v_prior.stats,v_stats,v_prior.fantasy_points,v_points);
   v_corrections:=v_corrections+1;
  end if;
  insert into public.ball_knower_player_week_scores(provider_game_id,provider_player_id,ball_knower_player_id,season,season_type,week_number,player_name,team,position,kickoff_at,game_status,is_final,stats,fantasy_points,score_revision,provider_updated_at,updated_at,scoring_contract_id,source_retrieved_at,source_timestamp_basis,participation_status)
  values(v_game.provider_game_id,v_row->>'providerPlayerId',v_row->>'appPlayerId',v_game.season,v_game.season_type,v_game.week_number,v_row->>'name',v_row->>'team',v_row->>'position',v_game.kickoff_at,case when v_final then 'Final' else 'In Progress' end,v_final,v_stats,v_points,coalesce(v_prior.score_revision,1)+case when v_changed then 1 else 0 end,v_source,clock_timestamp(),v_contract.contract_id,v_retrieved,p_snapshot->>'sourceTimestampBasis',v_row->>'participation')
  on conflict(provider_game_id,provider_player_id) do update set stats=excluded.stats,fantasy_points=excluded.fantasy_points,game_status=excluded.game_status,is_final=excluded.is_final,score_revision=excluded.score_revision,provider_updated_at=excluded.provider_updated_at,source_retrieved_at=excluded.source_retrieved_at,source_timestamp_basis=excluded.source_timestamp_basis,participation_status=excluded.participation_status,scoring_contract_id=excluded.scoring_contract_id,updated_at=excluded.updated_at;
  if not exists(select 1 from public.ball_knower_player_week_scores s where s.provider_game_id=v_game.provider_game_id and s.provider_player_id=v_row->>'providerPlayerId' and s.ball_knower_player_id=v_row->>'appPlayerId' and s.team=v_row->>'team' and s.position=v_row->>'position')then raise exception 'Saved identity trigger disagrees with source registry';end if;
  -- projected_points and pregame projection snapshots are intentionally omitted.
  v_rows:=v_rows+1;
 end loop;
 if cardinality(v_dst)<>2 or not(v_game.away_team=any(v_dst) and v_game.home_team=any(v_dst)) or not exists(select 1 from jsonb_array_elements(p_snapshot->'players')r where r->>'team'=v_game.away_team and r->>'position'<>'DST') or not exists(select 1 from jsonb_array_elements(p_snapshot->'players')r where r->>'team'=v_game.home_team and r->>'position'<>'DST') then raise exception 'Incomplete game scoring coverage';end if;
 if exists(select 1 from public.ball_knower_player_week_scores s where s.provider_game_id=v_game.provider_game_id and not(s.provider_player_id=any(v_seen_provider))) then raise exception 'Snapshot omitted a previously scored player';end if;
 update public.ball_knower_nfl_games set game_status=case when v_final then 'Final' else 'In Progress' end,is_final=v_final,is_live=not v_final,final_at=case when v_final then coalesce(final_at,v_source) else null end,provider_updated_at=v_source,last_polled_at=v_retrieved,updated_at=clock_timestamp() where provider_game_id=v_game.provider_game_id;
 insert into ball_knower_private.fantasy_scoring_state(canonical_game_id,contract_id,provider_game_id,source_updated_at,source_timestamp_basis,retrieved_at,content_fingerprint,is_final,revision)
 values(v_game.provider_game_id,v_contract.contract_id,p_snapshot->>'providerGameId',v_source,p_snapshot->>'sourceTimestampBasis',v_retrieved,v_fingerprint,v_final,v_revision)
 on conflict(canonical_game_id) do update set source_updated_at=excluded.source_updated_at,source_timestamp_basis=excluded.source_timestamp_basis,retrieved_at=excluded.retrieved_at,content_fingerprint=excluded.content_fingerprint,is_final=excluded.is_final,revision=excluded.revision;
 -- A verified bye needs the complete regular-season schedule; an empty weekly
 -- lookup alone is insufficient. All 32 teams must have exactly 17 games.
 select count(*)=272 and count(distinct week_number)=18 and bool_and(away_team=any(v_nfl_teams)and home_team=any(v_nfl_teams)and away_team<>home_team and week_number between 1 and 18) and count(distinct away_team||'|'||home_team||'|'||week_number::text)=272
  and (select count(*)=32 and min(n)=17 and max(n)=17 from(select team,count(*)n from(select away_team team from public.ball_knower_nfl_games where season=v_game.season and season_type='reg' union all select home_team from public.ball_knower_nfl_games where season=v_game.season and season_type='reg')t group by team)c)
  and(select max(n)=1 from(select team,week_number,count(*)n from(select away_team team,week_number from public.ball_knower_nfl_games where season=v_game.season and season_type='reg'union all select home_team,week_number from public.ball_knower_nfl_games where season=v_game.season and season_type='reg')tw group by team,week_number)tc)
 into v_schedule_complete from public.ball_knower_nfl_games where season=v_game.season and season_type='reg';
 select count(*)>0 and bool_and(g.is_final and coalesce(s.is_final,false)) into v_week_final
 from public.ball_knower_nfl_games g left join ball_knower_private.fantasy_scoring_state s on s.canonical_game_id=g.provider_game_id
 where g.season=v_game.season and g.season_type='reg' and g.week_number=v_game.week_number;
 v_week_final:=coalesce(v_week_final,false) and coalesce(v_schedule_complete,false);
 for v_lineup in
  select l.*,m.roster,league.settings from public.ball_knower_weekly_lineups l
   join public.ball_knower_league_members m on m.id=l.member_id and m.league_id=l.league_id
   join public.ball_knower_leagues league on league.id=l.league_id
   where l.week_number=v_game.week_number and league.settings->>'nflSeason'=v_game.season::text
    and exists(select 1 from public.ball_knower_live_drafts d where d.league_id=league.id and d.status='completed')
   order by l.league_id,l.member_id for update of l
 loop
  v_format:=case regexp_replace(lower(coalesce(v_lineup.settings->>'scoringFormat','ppr')),'[^a-z]','','g') when 'standard' then 'standard' when 'halfppr' then 'half_ppr' else 'ppr' end;
  v_custom:=coalesce(v_lineup.settings->'customScoring','{}'::jsonb);v_details:='[]'::jsonb;v_total:=0;v_complete:=true;v_all_final:=true;v_seen_app:='{}';
  select * into v_weekly from public.ball_knower_weekly_scores where league_id=v_lineup.league_id and member_id=v_lineup.member_id and week_number=v_game.week_number for update;
  foreach v_slot in array v_required loop
   v_player_id:=v_lineup.starters->>v_slot;v_roster_player:=null;v_actual:=null;v_bye:=false;v_player:=null;
   select e into v_roster_player from jsonb_array_elements(coalesce(v_lineup.roster,'[]'::jsonb))e where e->>'id'=v_player_id;
   if nullif(v_player_id,'') is null or v_roster_player is null or v_player_id=any(v_seen_app) then v_complete:=false;v_all_final:=false;continue;end if;
   v_seen_app:=array_append(v_seen_app,v_player_id);v_expected_position:=v_roster_player->>'position';
   if coalesce(v_expected_position,'') not in('QB','RB','FB','WR','TE','K','DST') or (v_slot='QB' and v_expected_position<>'QB') or (v_slot in('RB1','RB2') and v_expected_position not in('RB','FB')) or (v_slot in('WR1','WR2') and v_expected_position<>'WR') or (v_slot='TE' and v_expected_position<>'TE') or (v_slot='FLEX' and v_expected_position not in('RB','FB','WR','TE')) or (v_slot='K' and v_expected_position<>'K') or (v_slot='DST' and v_expected_position<>'DST') then v_complete:=false;v_all_final:=false;continue;end if;
   v_team:=case upper(v_roster_player->>'team') when 'LA' then 'LAR' when 'WSH' then 'WAS' when 'JAC' then 'JAX' else upper(v_roster_player->>'team') end;
   if (select count(*) from public.ball_knower_nfl_games g where g.season=v_game.season and g.season_type='reg' and g.week_number=v_game.week_number and v_team in(g.away_team,g.home_team))>1 or (select count(*) from public.ball_knower_player_week_scores s where s.ball_knower_player_id=v_player_id and s.season=v_game.season and s.season_type='reg' and s.week_number=v_game.week_number)>1 then v_complete:=false;v_all_final:=false;continue;end if;
   select s.*,g.game_status as actual_game_status,g.is_live,g.kickoff_at as actual_kickoff
    into v_player from public.ball_knower_player_week_scores s
    join public.ball_knower_nfl_games g on g.provider_game_id=s.provider_game_id
    join ball_knower_private.fantasy_scoring_state state on state.canonical_game_id=g.provider_game_id
    where s.ball_knower_player_id=v_player_id and s.season=v_game.season and s.season_type='reg' and s.week_number=v_game.week_number and s.team=v_team and s.position=v_expected_position
     and s.scoring_contract_id=state.contract_id and s.provider_updated_at=state.source_updated_at;
   if found then
    v_actual:=ball_knower_private.canonical_fantasy_points(v_player.stats,v_player.position,v_format,v_custom);
    v_all_final:=v_all_final and v_player.is_final;
   else
    select coalesce(v_schedule_complete,false) and v_team in('ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS') and not exists(select 1 from public.ball_knower_nfl_games g where g.season=v_game.season and g.season_type='reg' and g.week_number=v_game.week_number and v_team in(g.away_team,g.home_team)) into v_bye;
    if v_bye then v_actual:=0;else v_complete:=false;v_all_final:=false;end if;
   end if;
   if v_actual is not null then v_total:=v_total+v_actual;end if;
   select d into v_prior_detail from jsonb_array_elements(case when jsonb_typeof(v_weekly.score_details->'players')='array' then v_weekly.score_details->'players' else '[]'::jsonb end)d where d->>'slot'=v_slot and d->>'playerId'=v_player_id limit 1;
   v_detail:=coalesce(v_prior_detail,'{}'::jsonb)||jsonb_build_object('slot',v_slot,'playerId',v_player_id,'playerName',v_roster_player->>'name','team',v_team,'position',v_expected_position,'points',v_actual,'pointsAvailable',v_actual is not null,'projectedPoints',case when v_prior_detail->'projectionAvailable'='true'::jsonb and jsonb_typeof(v_prior_detail->'projectedPoints')='number' then v_prior_detail->'projectedPoints' else 'null'::jsonb end,'projectionAvailable',coalesce(v_prior_detail->'projectionAvailable'='true'::jsonb and jsonb_typeof(v_prior_detail->'projectedPoints')='number',false),'isBye',v_bye,'isFinal',case when v_bye then true when v_actual is not null then v_player.is_final else false end,'status',case when v_bye then 'Bye' when v_actual is not null then v_player.actual_game_status else 'Statistics unavailable' end);
   v_details:=v_details||jsonb_build_array(v_detail);
  end loop;
  v_complete:=v_complete and jsonb_array_length(v_details)=9;
  -- Partial sums are explicitly unavailable; preserve any prior total until
  -- every starter has a verified row or a proved schedule bye.
  if not v_complete then continue;end if;
  if v_weekly.is_final and not(v_all_final and coalesce(v_week_final,false)) then continue;end if;
  v_changed:=v_weekly.id is not null and (v_weekly.live_points is distinct from round(v_total,2) or v_weekly.score_details->'players' is distinct from v_details or v_weekly.is_final is distinct from(v_all_final and coalesce(v_week_final,false)));
  insert into public.ball_knower_weekly_scores(league_id,member_id,week_number,live_points,source,is_final,score_revision,score_details,finalized_at,last_correction_at,updated_at)
  values(v_lineup.league_id,v_lineup.member_id,v_game.week_number,round(v_total,2),'tank01_validated',v_all_final and coalesce(v_week_final,false),coalesce(v_weekly.score_revision,1)+case when v_changed then 1 else 0 end,jsonb_build_object('season',v_game.season,'seasonType','reg','format',v_format,'pointsAvailable',true,'hasProjectedTotal',not exists(select 1 from jsonb_array_elements(v_details)d where d->'projectionAvailable' is distinct from 'true'::jsonb),'players',v_details),case when v_all_final and coalesce(v_week_final,false) then coalesce(v_weekly.finalized_at,clock_timestamp()) else null end,case when v_weekly.is_final and v_weekly.live_points is distinct from round(v_total,2) then clock_timestamp() else v_weekly.last_correction_at end,clock_timestamp())
  on conflict(league_id,member_id,week_number) do update set live_points=excluded.live_points,source=excluded.source,is_final=excluded.is_final,score_revision=excluded.score_revision,score_details=excluded.score_details,finalized_at=excluded.finalized_at,last_correction_at=excluded.last_correction_at,updated_at=excluded.updated_at;
  -- Preserve pregame projected_points and the submitted lineup. No automatic
  -- starter assignment, roster edits, lineup finalization or league progression.
  v_weekly_rows:=v_weekly_rows+1;
 end loop;
 insert into ball_knower_private.fantasy_scoring_receipts(canonical_game_id,contract_id,source_updated_at,content_fingerprint,caller_content_hash,revision,rows_written,corrections,weekly_scores_written,is_final)
 values(v_game.provider_game_id,v_contract.contract_id,v_source,v_fingerprint,p_content_hash,v_revision,v_rows,v_corrections,v_weekly_rows,v_final) returning id into v_receipt;
 return jsonb_build_object('status','committed','receiptId',v_receipt,'revision',v_revision,'playerRows',v_rows,'statCorrections',v_corrections,'weeklyScores',v_weekly_rows,'isFinal',v_final);
end $$;
revoke all on function public.commit_ball_knower_fantasy_scoring_snapshot(jsonb,text) from public,anon,authenticated;
grant execute on function public.commit_ball_knower_fantasy_scoring_snapshot(jsonb,text) to service_role;

-- Service-only work claim: private contract/identity tables need not be exposed
-- through PostgREST. No approved contract is inserted by this migration.
create or replace function public.claim_ball_knower_fantasy_scoring_work(p_contract_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_contract ball_knower_private.fantasy_scoring_contracts%rowtype;v_games jsonb;v_item jsonb;
begin
 if current_user<>'service_role'then raise exception 'Service role required';end if;
 select * into v_contract from ball_knower_private.fantasy_scoring_contracts where contract_id=p_contract_id;
 if not found or v_contract.approved_at is null or coalesce(v_contract.evidence->>'sourceTimestampBasis','') not in('provider_payload','http_last_modified') or(v_contract.evidence->>'sourceTimestampBasis'='provider_payload' and nullif(v_contract.evidence->>'sourceTimestampField','')is null)or not coalesce(v_contract.evidence @> '{"identityNamespaceVerified":true,"zeroSemanticsVerified":true,"rareEventsVerified":true,"liveCadenceVerified":true,"correctionLifecycleVerified":true,"sourcePublicationTimeVerified":true,"pointsAllowedPolicy":"exclude_opponent_defense_scores_and_conversions"}'::jsonb,false)then raise exception 'Scoring source contract is not approved';end if;
 if not pg_try_advisory_xact_lock(hashtext('fantasy-source-poll-queue'))then return jsonb_build_object('contract',jsonb_build_object('id',p_contract_id),'games','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('game',jsonb_build_object('canonicalGameId',g.provider_game_id,'providerGameId',to_char(g.kickoff_at at time zone 'America/New_York','YYYYMMDD')||'_'||g.away_team||'@'||g.home_team,'season',g.season,'week',g.week_number,'away',g.away_team,'home',g.home_team,'kickoffAt',to_char(g.kickoff_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),'identities',(select coalesce(jsonb_agg(jsonb_build_object('providerPlayerId',i.provider_player_id,'appPlayerId',i.app_player_id,'team',i.team,'position',i.position,'name',i.canonical_name,'verified',true,'contractId',i.contract_id)),'[]'::jsonb)from ball_knower_private.fantasy_scoring_identities i where i.contract_id=p_contract_id and i.season=g.season and i.team in(g.away_team,g.home_team) and g.kickoff_at>=i.team_effective_from and g.kickoff_at<i.team_effective_until and i.active and i.verified_at<=clock_timestamp()+interval '1 minute' and i.valid_until>clock_timestamp()))),'[]'::jsonb)into v_games
 from(select game.* from public.ball_knower_nfl_games game left join ball_knower_private.fantasy_scoring_poll_attempts attempt on attempt.canonical_game_id=game.provider_game_id where game.season=2026 and game.season_type='reg' and game.kickoff_at<=clock_timestamp() and game.kickoff_at>clock_timestamp()-interval '7 days' and coalesce(attempt.next_attempt_at,'-infinity'::timestamptz)<=clock_timestamp() and(game.last_polled_at is null or game.last_polled_at<clock_timestamp()-case when game.is_final then interval '30 minutes'else interval '4 minutes'end)order by game.is_final,attempt.attempted_at nulls first,game.kickoff_at limit 2)g;
 -- Attempts rotate independently of source/score freshness. Invalid or repeated
 -- payloads cannot occupy the oldest last_polled_at slots forever.
 for v_item in select value from jsonb_array_elements(v_games)loop
  insert into ball_knower_private.fantasy_scoring_poll_attempts(canonical_game_id,attempted_at,next_attempt_at)values(v_item#>>'{game,canonicalGameId}',clock_timestamp(),clock_timestamp()+interval '5 minutes')on conflict(canonical_game_id)do update set attempted_at=excluded.attempted_at,next_attempt_at=excluded.next_attempt_at;
 end loop;
 return jsonb_build_object('contract',jsonb_build_object('id',v_contract.contract_id,'sourceTimestampBasis',v_contract.evidence->>'sourceTimestampBasis','pointsAllowedPolicy',v_contract.evidence->>'pointsAllowedPolicy','sourceTimestampField',v_contract.evidence->>'sourceTimestampField','nonparticipationField',v_contract.evidence->>'nonparticipationField'),'games',v_games);
end $$;
revoke all on function public.claim_ball_knower_fantasy_scoring_work(text)from public,anon,authenticated;
grant execute on function public.claim_ball_knower_fantasy_scoring_work(text)to service_role;
