import {normalizeTeam} from './nflverse-csv.js';

export const TANK01_HOST='tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
const SEASON=2026;
type Json=Record<string,any>;
export type ProbeIdentity={id:string;name:string;sourceName?:string;team:string;position:string;providerId?:string|null;gsisId?:string|null;active?:boolean};
export type ProbeChoice={id:string;providerGameId:string;week:number;away:string;home:string;date:string};
const object=(value:unknown):Json=>value&&typeof value==='object'&&!Array.isArray(value)?value as Json:{};
const list=(value:unknown):Json[]=>Array.isArray(value)?value.map(object):Object.values(object(value)).filter(item=>item&&typeof item==='object'&&!Array.isArray(item));
const cleanName=(value:unknown)=>String(value||'').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
const team=(value:unknown)=>normalizeTeam(String(value||'').trim().toUpperCase());
const position=(value:unknown)=>{const valueText=String(value||'').toUpperCase();return valueText==='FB'?'RB':valueText==='PK'?'K':valueText;};
const number=(value:unknown):number|undefined=>{
 if(typeof value!=='string'&&typeof value!=='number')return undefined;
 if(!/^-?\d+(?:\.\d+)?$/.test(String(value).trim()))return undefined;
 const parsed=Number(value);return Number.isFinite(parsed)&&Math.abs(parsed)<=10_000?parsed:undefined;
};
const at=(row:Json,path:string)=>path.split('.').reduce<any>((value,key)=>object(value)[key],row);
const first=(row:Json,paths:string[])=>paths.map(path=>at(row,path)).find(value=>value!==undefined&&value!==null&&value!=='');
const paths=(category:string,names:string[])=>names.flatMap(name=>[`${category}.${name}`,`${category.toLowerCase()}.${name}`,name]);
const PLAYER_FIELDS:Record<string,string[]>={
 passingYards:paths('Passing',['passYds','passingYards']),passingTouchdowns:paths('Passing',['passTD','passingTDs','passingTouchdowns']),interceptionsThrown:paths('Passing',['int','interceptions','interceptionsThrown']),
 passingAttempts:paths('Passing',['passAttempts','passingAttempts','att']),passingCompletions:paths('Passing',['passCompletions','passingCompletions','completions','cmp']),
 rushingYards:paths('Rushing',['rushYds','rushingYards']),rushingTouchdowns:paths('Rushing',['rushTD','rushingTDs','rushingTouchdowns']),rushingAttempts:paths('Rushing',['rushAttempts','rushingAttempts','carries']),
 receivingYards:paths('Receiving',['recYds','receivingYards']),receivingTouchdowns:paths('Receiving',['recTD','receivingTDs','receivingTouchdowns']),receptions:paths('Receiving',['receptions']),targets:paths('Receiving',['targets']),
 fumblesLost:paths('Defense',['fumblesLost']),returnTouchdowns:['returnTD','returnTouchdowns','specialTeamsTD'],twoPointConversions:['twoPointConversion','twoPointConversions'],
 fieldGoalsMade:paths('Kicking',['fgMade','fieldGoalsMade']),fieldGoalsMissed:paths('Kicking',['fgMissed','fieldGoalsMissed']),fieldGoalsAttempted:paths('Kicking',['fgAttempts','fgAtt','fieldGoalsAttempted']),
 extraPointsMade:paths('Kicking',['xpMade','extraPointsMade']),extraPointsMissed:paths('Kicking',['xpMissed','extraPointsMissed']),extraPointsAttempted:paths('Kicking',['xpAttempts','xpAtt','extraPointsAttempted']),
};
const DEFENSE_FIELDS:Record<string,string[]>={sacks:['sacks'],interceptions:['defensiveInterceptions','interceptions'],fumbleRecoveries:['fumblesRecovered','fumbleRecoveries'],defensiveTouchdowns:['defTD','defensiveTouchdowns'],returnTouchdowns:['returnTD','returnTouchdowns'],safeties:['safeties'],blockedKicks:['blockKick','blockedKicks'],pointsAllowed:['ptsAllowed','pointsAllowed']};
const fieldValue=(row:Json,key:string,mapping:Record<string,string[]>)=>{
 const direct=first(row,mapping[key]);if(direct!==undefined)return direct;
 if(key!=='twoPointConversions')return undefined;
 const parts=[first(row,paths('Passing',['passingTwoPointConversion'])),first(row,paths('Rushing',['rushingTwoPointConversion'])),first(row,paths('Receiving',['receivingTwoPointConversion']))];
 return parts.every(value=>number(value)!==undefined)?parts.reduce<number>((sum,value)=>sum+number(value)!,0):undefined;
};
function coverage(rows:Json[],mapping:Record<string,string[]>){
 return Object.fromEntries(Object.keys(mapping).map(key=>{
  const values=rows.map(row=>fieldValue(row,key,mapping));
  const valid=(value:unknown)=>{
   const parsed=number(value);if(parsed===undefined)return false;
   if(['standard','half_ppr','ppr'].includes(key))return true;
   if(!key.endsWith('Yards')&&parsed<0)return false;
   return key==='sacks'?Number.isInteger(parsed*2):Number.isInteger(parsed);
  };
  return [key,{rows:rows.length,present:values.filter(value=>value!==undefined).length,valid:values.filter(valid).length,zero:values.filter(value=>valid(value)&&number(value)===0).length,missing:values.filter(value=>value===undefined).length,invalid:values.filter(value=>value!==undefined&&!valid(value)).length}];
 }));
}
function identitiesSummary(rows:Json[],identities:ProbeIdentity[]){
 const seen=new Set<string>();
 const summary={rows:rows.length,missingProviderId:0,duplicateProviderId:0,provisionalProviderIdMatches:0,gsisMatches:0,unmapped:0,ambiguous:0,conflicting:0,inactive:0,nameTeamDiagnosticMatches:0};
 for(const row of rows){
  const id=String(row.playerID||row.playerId||'').trim(),gsis=String(row.gsis_id||row.gsisId||'').trim();
  if(!id)summary.missingProviderId++;else if(seen.has(id))summary.duplicateProviderId++;else seen.add(id);
  const candidates=identities.filter(identity=>gsis?identity.gsisId===gsis:Boolean(id)&&String(identity.providerId||'')===id);
  const named=identities.filter(identity=>cleanName(identity.sourceName||identity.name)===cleanName(row.longName||row.playerName)&&team(identity.team)===team(row.teamAbv||row.team));
  if(named.length===1)summary.nameTeamDiagnosticMatches++;
  if(!candidates.length){summary.unmapped++;continue;}
  if(candidates.length!==1){summary.ambiguous++;continue;}
  const identity=candidates[0],sourcePosition=position(row.pos||row.position),sourceTeam=team(row.teamAbv||row.team);
  if(sourceTeam&&sourceTeam!==team(identity.team)||sourcePosition&&sourcePosition!==position(identity.position)||cleanName(row.longName||row.playerName)&&![cleanName(identity.name),cleanName(identity.sourceName)].includes(cleanName(row.longName||row.playerName))){summary.conflicting++;continue;}
  if(identity.active!==true){summary.inactive++;continue;}
  if(gsis)summary.gsisMatches++;else summary.provisionalProviderIdMatches++;
 }
 return {...summary,providerIdNamespaceVerified:false,nameTeamUsedForIdentity:false};
}

/** Aggregates only: never returns provider rows, names, raw stat values or credentials. */
export function summarizeProviderCoverage(boxValue:unknown,projectionValue:unknown,identities:ProbeIdentity[],choice:ProbeChoice){
 const box=object(boxValue),projection=object(projectionValue),players=list(box.playerStats||box.players),defenses=['away','home'].flatMap(side=>Object.keys(object(box.DST?.[side])).length?[object(box.DST[side])]:[]);
 const projected=list(projection.playerProjections||projection.players),defenseProjected=list(projection.teamDefenseProjections||projection.defenses);
 const byPosition=Object.fromEntries(['QB','RB','WR','TE','K','OTHER'].map(group=>{
  const rows=players.filter(row=>{const pos=position(row.pos||row.position);return group==='OTHER'?!['QB','RB','WR','TE','K'].includes(pos):pos===group;});
  return [group,{rows:rows.length,fields:coverage(rows,PLAYER_FIELDS)}];
 }));
 const projectionFormats={standard:['fantasyPointsDefault.standard','fantasyPoints.standard'],half_ppr:['fantasyPointsDefault.halfPPR','fantasyPointsDefault.half_ppr','fantasyPoints.halfPPR','fantasyPoints.half_ppr'],ppr:['fantasyPointsDefault.PPR','fantasyPointsDefault.ppr','fantasyPoints.PPR','fantasyPoints.ppr']};
 return {box:{playerRows:players.length,defenseRows:defenses.length,byPosition,defenseFields:coverage(defenses,DEFENSE_FIELDS),identities:identitiesSummary(players,identities),
  statusPresent:typeof box.gameStatus==='string',reportedFinal:/^final(?:\s*(?:[/:-]\s*)?(?:\d*ot|overtime))?$|^(?:completed|closed|game over)$/i.test(String(box.gameStatus||'')),
  gameIdentityPresent:Boolean(box.gameID||box.gameId),gameIdentityMatches:[box.gameID,box.gameId].some(value=>value===choice.providerGameId),
  upstreamTimestampFieldPresent:['updatedAt','lastUpdated','lastUpdatedAt','timestamp','providerUpdatedAt'].some(key=>box[key]!==undefined)},
 projections:{playerRows:projected.length,defenseRows:defenseProjected.length,fields:coverage(projected,projectionFormats),defenseNumericPoints:defenseProjected.filter(row=>number(row.fantasyPointsDefault)!==undefined).length,identities:identitiesSummary(projected,identities),
  reportedSeasonPresent:projection.season!==undefined,reportedSeasonMatches:Number(projection.season)===SEASON,reportedWeekPresent:projection.week!==undefined,reportedWeekMatches:Number(projection.week)===choice.week}};
}
