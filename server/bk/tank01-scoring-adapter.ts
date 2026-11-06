import {normalizeTeam} from './nflverse-csv.js';
import {canonicalFantasyPoints,DEFENSE_SCORING_FIELDS,PLAYER_SCORING_FIELDS,strictStatNumber,validateCanonicalStats,validateScoringSnapshot,type CanonicalScoreRow,type CanonicalScoringSnapshot,type ScoringIdentity} from './fantasy-canonical-scoring.js';

type Json=Record<string,unknown>;
export type Tank01ScoringContract={id:string;sourceTimestampBasis:'provider_payload'|'http_last_modified';sourceTimestampField?:string;pointsAllowedPolicy:'exclude_opponent_defense_scores_and_conversions';nonparticipationField?:string};
export type Tank01GameContext={canonicalGameId:string;providerGameId:string;season:number;week:number;away:string;home:string;kickoffAt:string};
export type Tank01Identity=ScoringIdentity&{verified:true;contractId:string};
const obj=(value:unknown):Json=>value&&typeof value==='object'&&!Array.isArray(value)?value as Json:{};
const fail=(code:string):never=>{throw Error(code);};
const alias=(row:Json,keys:string[],normalize:(value:unknown)=>string|null):string=>{
 const values=keys.filter(key=>row[key]!==undefined).map(key=>normalize(row[key]));
 if(!values.length||values.some(value=>!value)||new Set(values).size!==1)fail('ambiguous_provider_identity_alias');
 return values[0]!;
};
const identifier=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value.trim():typeof value==='number'&&Number.isSafeInteger(value)&&value>0?String(value):null;
const sourceTeam=(value:unknown)=>typeof value==='string'?normalizeTeam(value.trim().toUpperCase()):null;
const sourcePosition=(value:unknown)=>typeof value==='string'&&/^[A-Za-z/ ]{1,12}$/.test(value)?value.trim().toUpperCase():null;
const paths=(group:string,fields:string[])=>fields.flatMap(field=>[`${group}.${field}`,`${group.toLowerCase()}.${field}`,field]);
const PLAYER_PATHS:Record<string,string[]>={
 passingYards:paths('Passing',['passYds','passingYards']),passingTouchdowns:paths('Passing',['passTD','passingTDs','passingTouchdowns']),interceptionsThrown:paths('Passing',['int','interceptions','interceptionsThrown']),
 passingAttempts:paths('Passing',['passAttempts','passingAttempts']),passingCompletions:paths('Passing',['passCompletions','passingCompletions']),
 rushingYards:paths('Rushing',['rushYds','rushingYards']),rushingTouchdowns:paths('Rushing',['rushTD','rushingTDs','rushingTouchdowns']),rushingAttempts:paths('Rushing',['rushAttempts','rushingAttempts','carries']),
 receivingYards:paths('Receiving',['recYds','receivingYards']),receivingTouchdowns:paths('Receiving',['recTD','receivingTDs','receivingTouchdowns']),receptions:paths('Receiving',['receptions']),targets:paths('Receiving',['targets']),
 fumblesLost:paths('Defense',['fumblesLost']),returnTouchdowns:['returnTD','returnTouchdowns'],twoPointConversions:['twoPointConversion','twoPointConversions'],
 fieldGoalsMade:paths('Kicking',['fgMade','fieldGoalsMade']),fieldGoalsMissed:paths('Kicking',['fgMissed','fieldGoalsMissed']),fieldGoalsAttempted:paths('Kicking',['fgAttempts','fgAtt','fieldGoalsAttempted']),
 extraPointsMade:paths('Kicking',['xpMade','extraPointsMade']),extraPointsMissed:paths('Kicking',['xpMissed','extraPointsMissed']),extraPointsAttempted:paths('Kicking',['xpAttempts','xpAtt','extraPointsAttempted']),
};
const DEFENSE_PATHS:Record<string,string[]>={sacks:['sacks'],interceptions:['defensiveInterceptions','interceptions'],fumbleRecoveries:['fumblesRecovered','fumbleRecoveries'],defensiveTouchdowns:['defTD','defensiveTouchdowns'],returnTouchdowns:['returnTD','returnTouchdowns'],safeties:['safeties'],blockedKicks:['blockKick','blockedKicks'],pointsAllowed:['ptsAllowed','pointsAllowed']};
const at=(row:Json,path:string):unknown=>path.split('.').reduce<unknown>((value,key)=>obj(value)[key],row);
function readStat(row:Json,key:string,possiblePaths:string[]):number|undefined{
 const present=possiblePaths.map(path=>at(row,path)).filter(value=>value!==undefined);
 if(!present.length)return undefined;
 const parsed=present.map(value=>strictStatNumber(value,key));
 if(parsed.some(value=>value===undefined))fail(`invalid_provider_stat:${key}`);
 if(new Set(parsed).size!==1)fail(`conflicting_provider_stat:${key}`);
 return parsed[0];
}
function mappedStats(row:Json,position:string){
 const mapping=position==='DST'?DEFENSE_PATHS:PLAYER_PATHS,stats:Record<string,number>={};
 for(const [key,candidates]of Object.entries(mapping)){
  const value=readStat(row,key,candidates);if(value!==undefined)stats[key]=value;
 }
 if(position!=='DST'){
  const categorized=[readStat(row,'twoPointConversions',paths('Passing',['passingTwoPointConversion'])),readStat(row,'twoPointConversions',paths('Rushing',['rushingTwoPointConversion'])),readStat(row,'twoPointConversions',paths('Receiving',['receivingTwoPointConversion']))];
  if(categorized.some(value=>value!==undefined)){
   if(categorized.some(value=>value===undefined))fail('incomplete_two_point_components');
   const total=categorized.reduce((sum,value)=>sum+value!,0);
   if(stats.twoPointConversions!==undefined&&stats.twoPointConversions!==total)fail('conflicting_two_point_total');
   stats.twoPointConversions=total;
  }
 }
 return validateCanonicalStats(stats,position);
}
const list=(value:unknown):Json[]=>Array.isArray(value)?value.map(obj):Object.values(obj(value)).map(obj);
const iso=(value:unknown):string|null=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null;
};
/** Source omission is never evidence of zero or nonparticipation. No name joins. */
export function adaptTank01ScoringSnapshot(input:{body:unknown;game:Tank01GameContext;identities:Tank01Identity[];contract:Tank01ScoringContract;retrievedAt:string;httpLastModified:string|null;nowMs?:number}):CanonicalScoringSnapshot{
 const box=obj(input.body),{game,contract}=input;
 if(contract.pointsAllowedPolicy!=='exclude_opponent_defense_scores_and_conversions')fail('unverified_defense_points_allowed_policy');
 if(alias(box,['gameID','gameId'],identifier)!==game.providerGameId)fail('provider_game_identity_unverified');
 const status=String(box.gameStatus??'').trim();
 const final=/^final(?:\s*(?:[/:-]\s*)?(?:\d*ot|overtime))?$|^(?:completed|closed|game over)$/i.test(status);
 const live=/^(?:q[1-4]|halftime|overtime|in progress|live)$/i.test(status);
 if(!final&&!live)fail('unsupported_scoring_game_status');
 const payloadTimestamp=contract.sourceTimestampBasis==='provider_payload'&&contract.sourceTimestampField?iso(at(box,contract.sourceTimestampField)):null;
 const sourceUpdatedAt=contract.sourceTimestampBasis==='provider_payload'?payloadTimestamp:contract.sourceTimestampBasis==='http_last_modified'?iso(input.httpLastModified):null;
 if(!sourceUpdatedAt)fail('provider_publication_time_unavailable');
 const registry=new Map<string,Tank01Identity>(),appIds=new Set<string>();
 for(const identity of input.identities){
  if(!identity.verified||identity.contractId!==contract.id||registry.has(identity.providerPlayerId)||appIds.has(identity.appPlayerId))fail('unverified_identity_registry');
  registry.set(identity.providerPlayerId,identity);appIds.add(identity.appPlayerId);
 }
 const players:CanonicalScoreRow[]=[],seen=new Set<string>();
 function add(raw:Json,id:string,team:string,position:string){
  const identity=registry.get(id);
  if(!id||seen.has(id))fail('duplicate_or_missing_provider_identity');seen.add(id);
  if(!identity||identity.team!==team||identity.position!==position)fail('player_identity_unverified');
  const didNotPlay=contract.nonparticipationField&&at(raw,contract.nonparticipationField)===true;
  const stats=mappedStats(raw,position);
  const points=Object.fromEntries((['standard','half_ppr','ppr']as const).map(format=>[format,canonicalFantasyPoints(stats,position,format)])) as CanonicalScoreRow['points'];
  players.push({...identity,stats,participation:didNotPlay?'verified_did_not_play':'played',points});
 }
 for(const row of list(box.playerStats??box.players)){
  const position=alias(row,['pos','position'],sourcePosition);
  if(!['QB','RB','FB','WR','TE','K'].includes(position))continue;
  const team=alias(row,['teamAbv','team'],sourceTeam);
  if(!team)fail('invalid_provider_team');
  add(row,alias(row,['playerID','playerId'],identifier),team,position);
 }
 const defense=obj(box.DST);
 for(const [side,expectedTeam]of [['away',game.away],['home',game.home]]){
  const row=obj(defense[side]),team=alias(row,['teamAbv','team'],sourceTeam);
  if(team!==expectedTeam)fail('defense_team_identity_unverified');
  add(row,`DST:${team}`,team,'DST');
 }
 return validateScoringSnapshot({schemaVersion:1,source:'tank01',contractId:contract.id,...game,status:final?'final':'in_progress',sourceUpdatedAt,sourceTimestampBasis:contract.sourceTimestampBasis,retrievedAt:input.retrievedAt,players},input.nowMs);
}
export const tank01RequiredCoverage={player:[...PLAYER_SCORING_FIELDS],defense:[...DEFENSE_SCORING_FIELDS]};
