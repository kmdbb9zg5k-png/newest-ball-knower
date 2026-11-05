import {fetchBoundedText} from './bounded-fetch.js';
import {csvRecords,normalizeTeam} from './nflverse-csv.js';
import {normalizeFantasySchedule} from './fantasy-schedule-sync.js';
import {NFLVERSE_PREDICTION_URL,NFLVERSE_COMPLETED_URL,normalizeNflversePredictionRows,normalizeCompletedPredictionIds} from '../nflPredictionFeed.js';

const HOST='tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com',SEASON=2026;
const VERCEL_TRANSPORT_QUERY_KEYS=new Set(['x-vercel-protection-bypass','x-vercel-set-bypass-cookie','_vercel_share']);
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

export function selectProbeGame(rows:Record<string,string>[],completedRows:Record<string,string>[],schedulePublished:string|null,completionPublished:string|null,now:number,requestedId?:string):ProbeChoice{
 normalizeFantasySchedule(rows,SEASON);
 const scheduleTime=Date.parse(schedulePublished||''),completionTime=Date.parse(completionPublished||'');
 if(!Number.isFinite(scheduleTime)||!Number.isFinite(completionTime)||scheduleTime<completionTime||Math.max(scheduleTime,completionTime)>now+60_000)throw Error('completion_publication_unverified');
 const completed=new Set(normalizeCompletedPredictionIds(completedRows));
 const choices=normalizeNflversePredictionRows(rows,now,SEASON).filter(game=>game.seasonType==='REG'&&game.week<=18&&completed.has(game.id)&&game.publishedResult&&game.kickoffAt&&Date.parse(game.kickoffAt)<now).sort((a,b)=>Date.parse(b.kickoffAt)-Date.parse(a.kickoffAt)||a.id.localeCompare(b.id));
 const game=requestedId?choices.find(game=>game.id===requestedId):choices[0];
 if(!game)throw Error('completed_game_unavailable');
 // Provider game IDs use Eastern schedule dates; these values come from the validated fixed source.
 return {id:game.id,providerGameId:`${game.scheduleDate.replace(/-/g,'')}_${game.awayAbbr}@${game.homeAbbr}`,week:game.week,away:game.awayAbbr,home:game.homeAbbr,date:game.scheduleDate};
}

async function loadChoice(fetchImpl:typeof fetch,now:number,requestedId?:string){
 const [schedule,completion]=await Promise.all([fetchBoundedText(NFLVERSE_PREDICTION_URL,{fetchImpl,maxBytes:8_000_000,timeoutMs:8_000,accept:'text/csv',allowedRedirectHosts:['github.com','release-assets.githubusercontent.com']}),fetchBoundedText(NFLVERSE_COMPLETED_URL,{fetchImpl,maxBytes:500_000,timeoutMs:8_000,accept:'application/vnd.github.raw+json'})]);
 return {choice:selectProbeGame(csvRecords(schedule.text),csvRecords(completion.text),schedule.sourceUpdatedAt,completion.sourceUpdatedAt,now,requestedId),sourceTiming:{schedulePublishedAt:schedule.sourceUpdatedAt,completionPublishedAt:completion.sourceUpdatedAt}};
}
async function providerRequest(path:'/getNFLBoxScore'|'/getNFLProjections',params:Record<string,string>,key:string,fetchImpl:typeof fetch){
 let status:number|null=null;
 const url=new URL(`https://${HOST}${path}`);Object.entries(params).forEach(([name,value])=>url.searchParams.set(name,value));
 try{
  const response=await fetchBoundedText(url.href,{maxBytes:path==='/getNFLBoxScore'?2_000_000:4_000_000,timeoutMs:8_000,fetchImpl:(async(input,init)=>{
   if(new URL(String(input)).hostname!==HOST)throw Error('unexpected_provider_host');
   const result=await fetchImpl(input,{...init,headers:{Accept:'application/json','x-rapidapi-key':key,'x-rapidapi-host':HOST}});status=result.status;return result;
  }) as typeof fetch});
  const payload=JSON.parse(response.text),body=object(payload).body??payload;
  if(object(payload).error||Number(object(payload).statusCode)>=400)return {ok:false,status,reason:'provider_payload_error',body:null,sourceUpdatedAt:response.sourceUpdatedAt};
  return {ok:true,status,reason:null,body,sourceUpdatedAt:response.sourceUpdatedAt};
 }catch{
  return {ok:false,status,reason:status===401||status===403?'provider_authentication_failed':status===429?'provider_rate_limited':'provider_response_unavailable_or_invalid',body:null,sourceUpdatedAt:null};
 }
}

export function createScoringProviderProbe(deps:{identities:ProbeIdentity[];env?:NodeJS.ProcessEnv;fetchImpl?:typeof fetch;now?:()=>number;loadChoice?:typeof loadChoice}){
 const env=deps.env??process.env,fetcher=deps.fetchImpl??fetch,now=deps.now??Date.now;
 return async(req:any,res:any)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(env.VERCEL_ENV!=='preview')return res.status(404).json({error:'Not found'});
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const requestedId=req.query?.gameId;
  // Deployment protection validates these transport credentials before routing.
  // Ignore their values; never copy them into a provider request or response.
  if(Object.keys(req.query||{}).some(key=>key!=='gameId'&&!VERCEL_TRANSPORT_QUERY_KEYS.has(key))||requestedId!==undefined&&(typeof requestedId!=='string'||!/^2026_(?:0[1-9]|1[0-8])_[A-Z]{2,3}_[A-Z]{2,3}$/.test(requestedId)))return res.status(400).json({error:'Invalid completed-game choice'});
  const base={mode:'preview_read_only_provider_probe',scoringAvailable:false,activationCertified:false,writes:0,season:SEASON};
  const key=env.TANK01_API_KEY||env.RAPIDAPI_KEY;
  if(!key)return res.status(503).json({...base,providerConfigured:false,providerRequests:0,reason:'existing_server_key_unavailable'});
  let selection:Awaited<ReturnType<typeof loadChoice>>;
  try{selection=await(deps.loadChoice??loadChoice)(fetcher,now(),requestedId);}catch{return res.status(503).json({...base,providerConfigured:true,providerRequests:0,reason:'trusted_completed_game_unavailable'});}
  const [box,projection]=await Promise.all([providerRequest('/getNFLBoxScore',{gameID:selection.choice.providerGameId,playByPlay:'false',fantasyPoints:'true'},key,fetcher),providerRequest('/getNFLProjections',{week:String(selection.choice.week)},key,fetcher)]);
  return res.status(200).json({...base,providerConfigured:true,providerRequests:2,capturedAt:new Date(now()).toISOString(),game:selection.choice,sourceTiming:selection.sourceTiming,
   boxRequest:{ok:box.ok,status:box.status,reason:box.reason,sourceUpdatedAt:box.sourceUpdatedAt},projectionRequest:{ok:projection.ok,status:projection.status,reason:projection.reason,sourceUpdatedAt:projection.sourceUpdatedAt},
   coverage:summarizeProviderCoverage(box.body,projection.body,deps.identities,selection.choice),limitations:['single_completed_game_not_live_lifecycle_proof','provider_id_namespace_and_current_roster_crosswalk_need_review','missing_fields_are_not_zero','dst_points_allowed_policy_and_rare_events_unverified','projection_week_metadata_may_be_absent','no_database_corrections_or_league_finalization_tested']});
 };
}
