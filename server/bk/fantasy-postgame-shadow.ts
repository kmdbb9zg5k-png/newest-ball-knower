import {fetchBoundedText} from './bounded-fetch.js';
import {csvRecords,normalizeTeam,requireColumns} from './nflverse-csv.js';
import {normalizeNflversePredictionRows,normalizeCompletedPredictionIds} from '../nflPredictionFeed.js';
import {scoreFantasyPlayer,type FantasyStatLine} from '../../fantasyLiveScoring.js';

/** Diagnostic only. This module has no database client, API route or write path. */
export type ShadowTable={rows:Record<string,string>[];fetchedAt:string;sourceUpdatedAt:string|null};
export type ShadowSources={players:ShadowTable;teams:ShadowTable;schedule:ShadowTable;completion:ShadowTable};
export type ShadowIdentity={id:string;gsisId?:string|null;position:string;active?:boolean};
const SEASON=2026;
export const POSTGAME_SHADOW_URLS={
  players:'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2026.csv',
  teams:'https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_2026.csv',
  schedule:'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',
  completion:'https://api.github.com/repos/nflverse/nflverse-pbp-internal/contents/released_games.csv?ref=main',
} as const;

const PLAYER_FIELDS={passingAttempts:'attempts',passingCompletions:'completions',passingYards:'passing_yards',passingTouchdowns:'passing_tds',interceptionsThrown:'passing_interceptions',rushingAttempts:'carries',rushingYards:'rushing_yards',rushingTouchdowns:'rushing_tds',targets:'targets',receptions:'receptions',receivingYards:'receiving_yards',receivingTouchdowns:'receiving_tds',fumblesLost:'fumbles_lost_total',returnTouchdowns:'special_teams_tds',fieldGoalsMade:'fg_made',fieldGoalsAttempted:'fg_att',extraPointsMade:'pat_made',extraPointsAttempted:'pat_att'} as const;
const TEAM_FIELDS={sacks:'def_sacks',interceptions:'def_interceptions',fumbleRecoveries:'fumble_recovery_opp',defensiveTouchdowns:'def_tds',returnTouchdowns:'special_teams_tds',safeties:'def_safeties'} as const;
const YARD_FIELDS=new Set(['passingYards','rushingYards','receivingYards']);
const number=(value:unknown):number|undefined=>{
  if(typeof value!=='string'&&typeof value!=='number')return undefined;
  if(!/^-?\d+(?:\.\d+)?$/.test(String(value).trim()))return undefined;
  const parsed=Number(value);return Number.isFinite(parsed)?parsed:undefined;
};
const stat=(value:unknown,key:string)=>{
  const parsed=number(value);
  if(parsed===undefined||Math.abs(parsed)>2_000||(!YARD_FIELDS.has(key)&&parsed<0)
    ||(key==='sacks'?!Number.isInteger(parsed*2):!Number.isInteger(parsed)))return undefined;
  return parsed;
};
const sum=(row:Record<string,string>,fields:string[],key:string)=>{
  const parts=fields.map(field=>stat(row[field],key));
  return parts.every(value=>value!==undefined)?parts.reduce((total,value)=>total+value!,0):undefined;
};

export function mapPostgameShadowPlayer(row:Record<string,string>){
  const stats:Record<string,number>={},missingFields:string[]=[];
  for(const [key,field] of Object.entries(PLAYER_FIELDS)){
    const value=stat(row[field],key);if(value===undefined)missingFields.push(field);else stats[key]=value;
  }
  for(const [key,fields] of Object.entries({
    twoPointConversions:['passing_2pt_conversions','rushing_2pt_conversions','receiving_2pt_conversions'],
    fieldGoalsMissed:['fg_missed','fg_blocked'],extraPointsMissed:['pat_missed','pat_blocked'],
  })){
    const value=sum(row,fields,key);if(value===undefined)missingFields.push(...fields.filter(field=>stat(row[field],key)===undefined));else stats[key]=value;
  }
  if(stats.passingCompletions>stats.passingAttempts)missingFields.push('passing_completions_exceed_attempts');
  for(const [made,missed,attempted] of [['fieldGoalsMade','fieldGoalsMissed','fieldGoalsAttempted'],['extraPointsMade','extraPointsMissed','extraPointsAttempted']]){
    if([stats[made],stats[missed],stats[attempted]].every(value=>value!==undefined)&&stats[made]+stats[missed]!==stats[attempted])missingFields.push(`${attempted}_inconsistent`);
  }
  return {stats,missingFields:[...new Set(missingFields)]};
}

export function mapPostgameShadowDefense(row:Record<string,string>){
  const stats:Record<string,number>={},missingFields:string[]=[];
  for(const [key,field] of Object.entries(TEAM_FIELDS)){
    const value=stat(row[field],key);if(value===undefined)missingFields.push(field);else stats[key]=value;
  }
  const blocked=sum(row,['def_punt_blocks','def_pat_blocks','def_fg_blocks'],'blockedKicks');
  if(blocked===undefined)missingFields.push(...['def_punt_blocks','def_pat_blocks','def_fg_blocks'].filter(field=>stat(row[field],'blockedKicks')===undefined));
  else stats.blockedKicks=blocked;
  // An opponent scoreboard is not the agreed fantasy-D/ST points-allowed policy.
  missingFields.push('points_allowed_policy');
  return {stats,missingFields};
}

const unsupported=[
  'postgame_only_no_live_stats',
  'dst_points_allowed_policy_unresolved',
  'special_teams_touchdown_and_recovery_parity_unverified',
  'absent_player_rows_have_no_participation_or_zero_score_proof',
  'pregame_projections_unavailable',
  'correction_receipts_and_atomic_league_finalization_not_implemented',
];

/** Candidate arithmetic is useful for comparison, never an activation decision. */
export function evaluatePostgameShadow(sources:ShadowSources,identities:ShadowIdentity[],now=Date.now()){
  requireColumns(sources.players.rows,['player_id','position','game_id','season','season_type','team']);
  requireColumns(sources.teams.rows,['game_id','season','season_type','team','opponent_team']);
  const games=normalizeNflversePredictionRows(sources.schedule.rows,now,SEASON);
  const gameById=new Map<string,any>(games.map((game:any)=>[game.id,game]));
  const completed=new Set<string>(normalizeCompletedPredictionIds(sources.completion.rows));
  const issues:string[]=[];
  if(games.length<272||new Set(games.flatMap((game:any)=>[game.awayAbbr,game.homeAbbr])).size!==32)issues.push('incomplete_2026_schedule');
  const sourceTiming=Object.fromEntries(Object.entries(sources).map(([key,source])=>{
    const fetched=Date.parse(source.fetchedAt),published=Date.parse(source.sourceUpdatedAt??'');
    const retrievalValid=Number.isFinite(fetched)&&fetched<=now+60_000&&now-fetched<=24*60*60*1000;
    const publicationValid=Number.isFinite(published)&&published<=now+60_000;
    if(!retrievalValid)issues.push(`${key}_retrieval_unverified`);
    if(!publicationValid)issues.push(`${key}_publication_unverified`);
    return [key,{fetchedAt:source.fetchedAt,sourceUpdatedAt:source.sourceUpdatedAt,retrievalValid,publicationValid}];
  }));
  const completionPublished=Date.parse(sources.completion.sourceUpdatedAt??'');
  const publicationOrderVerified=Number.isFinite(completionPublished)&&['players','teams','schedule'].every(key=>{
    const published=Date.parse(sources[key as keyof ShadowSources].sourceUpdatedAt??'');
    return Number.isFinite(published)&&published>=completionPublished;
  });
  if(!publicationOrderVerified)issues.push('statistics_or_scores_older_than_completion_evidence');
  const crosswalk=new Map<string,ShadowIdentity[]>();
  for(const identity of identities){
    if(!identity.gsisId)continue;
    const existing=crosswalk.get(identity.gsisId)||[];existing.push(identity);crosswalk.set(identity.gsisId,existing);
  }
  const identityCollisions=[...crosswalk].filter(([,rows])=>rows.length!==1).map(([id])=>id);
  if(identityCollisions.length)issues.push('identity_crosswalk_collision');
  const appCounts=new Map<string,number>();
  for(const identity of identities.filter(item=>item.gsisId))appCounts.set(identity.id,(appCounts.get(identity.id)||0)+1);
  if([...appCounts.values()].some(count=>count>1))issues.push('app_identity_crosswalk_collision');
  const teamKeys=new Set<string>();
  const activePositions=new Set(['QB','RB','FB','WR','TE','K']);
  const rows=sources.players.rows.filter(row=>Number(row.season)===SEASON&&row.season_type==='REG'&&activePositions.has(row.position));
  const teamRows=sources.teams.rows.filter(row=>Number(row.season)===SEASON&&row.season_type==='REG');
  const playerKeyCounts=new Map<string,number>();
  for(const row of rows){const key=`${row.game_id}|${row.player_id}`;playerKeyCounts.set(key,(playerKeyCounts.get(key)||0)+1);}
  const completionFor=(id:string)=>{
    const game=gameById.get(id);
    return Boolean(game&&game.seasonType==='REG'&&completed.has(id)&&game.publishedResult&&game.kickoffAt&&Date.parse(game.kickoffAt)<now&&publicationOrderVerified&&Object.values(sourceTiming).every(value=>value.retrievalValid&&value.publicationValid));
  };
  const players=rows.map(row=>{
    const mapped=mapPostgameShadowPlayer(row),problems=[...mapped.missingFields];
    const key=`${row.game_id}|${row.player_id}`;
    if(!row.player_id||playerKeyCounts.get(key)!==1)problems.push('duplicate_or_missing_player_identity');
    const candidates=crosswalk.get(row.player_id)||[];
    const identity=candidates.length===1?candidates[0]:undefined;
    if(!identity)problems.push(candidates.length?'ambiguous_player_crosswalk':'unmapped_player_crosswalk');
    else if(identity.active!==true)problems.push('inactive_player_crosswalk');
    else if(appCounts.get(identity.id)!==1)problems.push('ambiguous_app_crosswalk');
    else if((identity.position==='FB'?'RB':identity.position)!==(row.position==='FB'?'RB':row.position))problems.push('position_crosswalk_conflict');
    const game=gameById.get(row.game_id),team=normalizeTeam(row.team);
    if(!game||!team||![game.awayAbbr,game.homeAbbr].includes(team))problems.push('game_or_team_conflict');
    if(!completionFor(row.game_id))problems.push('final_publication_unverified');
    const candidatePoints=problems.length?null:Object.fromEntries((['standard','half_ppr','ppr'] as const).map(format=>[format,scoreFantasyPlayer(mapped.stats as FantasyStatLine,format).total]));
    return {gameId:row.game_id,sourcePlayerId:row.player_id,appPlayerId:identity?.id??null,position:row.position,candidatePoints,problems};
  });
  const defenses=teamRows.map(row=>{
    const team=normalizeTeam(row.team),opponent=normalizeTeam(row.opponent_team),mapped=mapPostgameShadowDefense(row);
    const problems=[...mapped.missingFields],key=`${row.game_id}|${team}`;
    if(teamKeys.has(key))problems.push('duplicate_team_stats');teamKeys.add(key);
    const game=gameById.get(row.game_id);
    if(!game||!team||!opponent||team===opponent||![game.awayAbbr,game.homeAbbr].includes(team)||![game.awayAbbr,game.homeAbbr].includes(opponent))problems.push('game_or_team_conflict');
    if(!completionFor(row.game_id))problems.push('final_publication_unverified');
    return {gameId:row.game_id,appPlayerId:team?`dst-${team.toLowerCase()}`:null,candidatePoints:null,problems};
  });
  const gameCoverage=[...new Set([...players,...defenses].map(row=>row.gameId))].map(gameId=>({
    gameId,completionVerified:completionFor(gameId),playerRows:players.filter(row=>row.gameId===gameId).length,
    teamRows:defenses.filter(row=>row.gameId===gameId).length,
  }));
  if(gameCoverage.some(game=>game.teamRows!==2))issues.push('paired_team_statistics_incomplete');
  const problemCounts:Record<string,number>={};
  for(const row of [...players,...defenses])for(const problem of row.problems)problemCounts[problem]=(problemCounts[problem]||0)+1;
  return {mode:'read_only_shadow' as const,live:false,scoringAvailable:false,writes:0,season:SEASON,
    generatedAt:new Date(now).toISOString(),sourceTiming,publicationOrderVerified,unsupported,issues,identityCollisions,
    summary:{playerRows:players.length,playerCandidates:players.filter(row=>row.candidatePoints!==null).length,
      unmappedPlayers:new Set(players.filter(row=>row.problems.includes('unmapped_player_crosswalk')).map(row=>row.sourcePlayerId)).size,
      defenseRows:defenses.length,defenseCandidates:0,games:gameCoverage.length,problemCounts},
    gameCoverage,players,defenses};
}

export async function loadPostgameShadowSources(fetchImpl:typeof fetch=fetch,now:()=>number=Date.now):Promise<ShadowSources>{
  const pairs=await Promise.all(Object.entries(POSTGAME_SHADOW_URLS).map(async([kind,url])=>{
    const manifest=kind==='completion';
    const result=await fetchBoundedText(url,{fetchImpl,maxBytes:kind==='players'?16_000_000:manifest?500_000:8_000_000,
      timeoutMs:12_000,accept:manifest?'application/vnd.github.raw+json':'text/csv',
      allowedRedirectHosts:manifest?[]:['github.com','release-assets.githubusercontent.com']});
    return [kind,{rows:csvRecords(result.text),fetchedAt:new Date(now()).toISOString(),sourceUpdatedAt:result.sourceUpdatedAt}];
  }));
  return Object.fromEntries(pairs) as ShadowSources;
}
