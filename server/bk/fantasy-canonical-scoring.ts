import {createHash} from 'node:crypto';
import {normalizeTeam} from './nflverse-csv.js';

export const PLAYER_SCORING_FIELDS=['passingYards','passingTouchdowns','interceptionsThrown','rushingYards','rushingTouchdowns','receivingYards','receivingTouchdowns','receptions','twoPointConversions','fumblesLost','returnTouchdowns','fieldGoalsMade','fieldGoalsMissed','extraPointsMade','extraPointsMissed'] as const;
export const DEFENSE_SCORING_FIELDS=['sacks','interceptions','fumbleRecoveries','defensiveTouchdowns','returnTouchdowns','safeties','blockedKicks','pointsAllowed'] as const;
export type PlayerStats=Record<typeof PLAYER_SCORING_FIELDS[number],number>&Partial<Record<'passingAttempts'|'passingCompletions'|'rushingAttempts'|'targets'|'fieldGoalsAttempted'|'extraPointsAttempted',number>>;
export type DefenseStats=Record<typeof DEFENSE_SCORING_FIELDS[number],number>;
export type ScoringFormat='standard'|'half_ppr'|'ppr';
export type ScoringWeights=Partial<Record<'passYards'|'passTd'|'interception'|'rushYards'|'rushTd'|'recYards'|'recTd'|'reception'|'fumbleLost'|'fieldGoal'|'extraPoint'|'dstSack'|'dstTurnover'|'dstTd',number>>;
export type ScoringIdentity={providerPlayerId:string;appPlayerId:string;team:string;position:'QB'|'RB'|'FB'|'WR'|'TE'|'K'|'DST';name:string};
export type CanonicalScoreRow=ScoringIdentity&{stats:PlayerStats|DefenseStats;participation:'played'|'verified_did_not_play';points:Record<ScoringFormat,number>};
export type CanonicalScoringSnapshot={schemaVersion:1;source:'tank01';contractId:string;providerGameId:string;canonicalGameId:string;season:number;week:number;away:string;home:string;kickoffAt:string;status:'in_progress'|'final';sourceUpdatedAt:string;sourceTimestampBasis:'provider_payload'|'http_last_modified';retrievedAt:string;players:CanonicalScoreRow[]};
const fail=(code:string):never=>{throw Error(code);};
// Exact decimal arithmetic matches PostgreSQL numeric, including negative
// half-cent custom weights. Convert only the final rounded cents to Number.
const decimal=(value:number|string)=>{
 const [mantissa,exponent='0']=String(value).toLowerCase().split('e');
 const negative=mantissa.startsWith('-'),[whole,fraction='']=mantissa.replace(/^[-+]/,'').split('.');
 let numerator=BigInt((whole||'0')+fraction)*(negative?-1n:1n),scale=fraction.length-Number(exponent);
 if(scale<0){numerator*=10n**BigInt(-scale);scale=0;}return {numerator,scale};
};
const sumProducts=(terms:[number,number|string][])=>{
 const products=terms.map(([a,b])=>{const x=decimal(a),y=decimal(b);return {numerator:x.numerator*y.numerator,scale:x.scale+y.scale};});
 const scale=Math.max(0,...products.map(p=>p.scale)),denominator=10n**BigInt(scale);
 const total=products.reduce((sum,p)=>sum+p.numerator*10n**BigInt(scale-p.scale),0n),absolute=total<0n?-total:total;
 const cents=(absolute*200n+denominator)/(denominator*2n);return Number(total<0n?-cents:cents)/100;
};
export const strictStatNumber=(value:unknown,field:string):number|undefined=>{
 if(typeof value!=='number'&&typeof value!=='string')return undefined;
 if(typeof value==='string'&&!/^-?\d+(?:\.\d+)?$/.test(value.trim()))return undefined;
 const parsed=Number(value);
 if(!Number.isFinite(parsed)||Math.abs(parsed)>10_000||(!field.endsWith('Yards')&&parsed<0))return undefined;
 if(field==='sacks'?!Number.isInteger(parsed*2):!Number.isInteger(parsed))return undefined;
 return parsed;
};
export function validateCanonicalStats(value:unknown,position:string):PlayerStats|DefenseStats{
 if(!value||typeof value!=='object'||Array.isArray(value))fail('invalid_stat_line');
 const raw=value as Record<string,unknown>,fields=position==='DST'?DEFENSE_SCORING_FIELDS:PLAYER_SCORING_FIELDS;
 for(const key of fields)if(strictStatNumber(raw[key],key)===undefined)fail(`missing_or_invalid_stat:${key}`);
 const allowed=position==='DST'?[...DEFENSE_SCORING_FIELDS]:[...PLAYER_SCORING_FIELDS,'passingAttempts','passingCompletions','rushingAttempts','targets','fieldGoalsAttempted','extraPointsAttempted'];
 for(const [key,cell]of Object.entries(raw))if(!allowed.includes(key)||strictStatNumber(cell,key)===undefined)fail(`invalid_stat:${key}`);
 if(position!=='DST'){
  if(raw.passingCompletions!==undefined&&raw.passingAttempts!==undefined&&Number(raw.passingCompletions)>Number(raw.passingAttempts))fail('inconsistent_pass_attempts');
  for(const [made,missed,attempts]of [['fieldGoalsMade','fieldGoalsMissed','fieldGoalsAttempted'],['extraPointsMade','extraPointsMissed','extraPointsAttempted']])
   if(raw[attempts]!==undefined&&Number(raw[made])+Number(raw[missed])!==Number(raw[attempts]))fail('inconsistent_kicking_attempts');
 }
 // Do not preserve unrecognized provider fields in public canonical statistics.
 return Object.fromEntries(allowed.filter(key=>raw[key]!==undefined).map(key=>[key,Number(raw[key])])) as PlayerStats|DefenseStats;
}
export function canonicalFantasyPoints(statsValue:PlayerStats|DefenseStats,position:string,format:ScoringFormat,custom:ScoringWeights={}):number{
 const stats=validateCanonicalStats(statsValue,position);
 const weightKeys=['passYards','passTd','interception','rushYards','rushTd','recYards','recTd','reception','fumbleLost','fieldGoal','extraPoint','dstSack','dstTurnover','dstTd'];
 for(const [key,value]of Object.entries(custom as Record<string,unknown>)){if(!weightKeys.includes(key)||(typeof value!=='number'&&typeof value!=='string')||(typeof value==='string'&&(value.length>500||!/^[-]?\d+(?:\.\d+)?$/.test(value)))||!Number.isFinite(Number(value))||Math.abs(Number(value))>100)fail('invalid_scoring_weight');}
 const w=(name:keyof ScoringWeights,fallback:number):number|string=>custom[name]===undefined?fallback:custom[name];
 if(position==='DST'){
  const s=stats as DefenseStats,pa=s.pointsAllowed;
  const allowed=pa===0?10:pa<=6?7:pa<=13?4:pa<=20?1:pa<=27?0:pa<=34?-1:-4;
  return sumProducts([[s.sacks,w('dstSack',1)],[s.interceptions+s.fumbleRecoveries,w('dstTurnover',2)],[s.defensiveTouchdowns+s.returnTouchdowns,w('dstTd',6)],[s.safeties,2],[s.blockedKicks,2],[allowed,1]]);
 }
 const s=stats as PlayerStats;
 return sumProducts([[s.passingYards,w('passYards',0.04)],[s.passingTouchdowns,w('passTd',4)],[s.interceptionsThrown,w('interception',-2)],[s.rushingYards,w('rushYards',0.1)],[s.rushingTouchdowns,w('rushTd',6)],[s.receivingYards,w('recYards',0.1)],[s.receivingTouchdowns,w('recTd',6)],[s.receptions,w('reception',format==='ppr'?1:format==='half_ppr'?0.5:0)],[s.twoPointConversions,2],[s.fumblesLost,w('fumbleLost',-2)],[s.returnTouchdowns,6],[s.fieldGoalsMade,w('fieldGoal',3)],[s.fieldGoalsMissed,-1],[s.extraPointsMade,w('extraPoint',1)],[s.extraPointsMissed,-1]]);
}
const iso=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value));
/** Complete rows only; absent players never acquire fabricated zero scores. */
export function validateScoringSnapshot(snapshot:CanonicalScoringSnapshot,nowMs=Date.now()):CanonicalScoringSnapshot{
 if(snapshot.schemaVersion!==1||snapshot.source!=='tank01'||!/^tank01-[a-z0-9-]{1,80}$/.test(snapshot.contractId)||!snapshot.canonicalGameId||snapshot.canonicalGameId.length>150||!/^\d{8}_[A-Z]{2,3}@[A-Z]{2,3}$/.test(snapshot.providerGameId))fail('invalid_snapshot_identity');
 if(snapshot.season!==2026||!Number.isInteger(snapshot.week)||snapshot.week<1||snapshot.week>18||normalizeTeam(snapshot.away)!==snapshot.away||normalizeTeam(snapshot.home)!==snapshot.home||snapshot.away===snapshot.home)fail('invalid_snapshot_game');
 if(!['in_progress','final'].includes(snapshot.status)||!['provider_payload','http_last_modified'].includes(snapshot.sourceTimestampBasis))fail('invalid_snapshot_status');
 if(!iso(snapshot.kickoffAt)||!iso(snapshot.sourceUpdatedAt)||!iso(snapshot.retrievedAt))fail('missing_source_timestamp');
 const kickoff=Date.parse(snapshot.kickoffAt),source=Date.parse(snapshot.sourceUpdatedAt),retrieved=Date.parse(snapshot.retrievedAt);
 if(source<kickoff||source>retrieved+60_000||retrieved>nowMs+60_000||nowMs-retrieved>60_000||snapshot.status==='in_progress'&&retrieved-source>5*60_000)fail('invalid_source_freshness');
 const dateParts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(kickoff)).map(part=>[part.type,part.value]));
 const providerId=`${dateParts.year}${dateParts.month}${dateParts.day}_${snapshot.away}@${snapshot.home}`;
 if(snapshot.providerGameId!==providerId)fail('provider_game_mismatch');
 if(!Array.isArray(snapshot.players)||!snapshot.players.length||snapshot.players.length>250)fail('invalid_snapshot_coverage');
 const providerIds=new Set<string>(),appIds=new Set<string>(),dstTeams=new Set<string>();
 const players=snapshot.players.map(row=>{
  if(!row.providerPlayerId||row.providerPlayerId.length>100||!row.appPlayerId||row.appPlayerId.length>150||providerIds.has(row.providerPlayerId)||appIds.has(row.appPlayerId)||![snapshot.away,snapshot.home].includes(row.team)||!['QB','RB','FB','WR','TE','K','DST'].includes(row.position)||!row.name||row.name.length>150)fail('ambiguous_player_identity');
  providerIds.add(row.providerPlayerId);appIds.add(row.appPlayerId);
  if(!['played','verified_did_not_play'].includes(row.participation))fail('participation_unverified');
  if(row.participation==='verified_did_not_play'&&snapshot.status!=='final')fail('nonparticipation_before_final');
  const stats=validateCanonicalStats(row.stats,row.position);
  if(row.participation==='verified_did_not_play'&&Object.values(stats).some(value=>value!==0))fail('nonparticipation_nonzero');
  if(row.position==='DST'){
   if(row.providerPlayerId!==`DST:${row.team}`||row.appPlayerId!==`dst-${row.team.toLowerCase()}`||row.participation!=='played')fail('invalid_defense_identity');dstTeams.add(row.team);
  }
  const points=Object.fromEntries((['standard','half_ppr','ppr']as const).map(format=>[format,canonicalFantasyPoints(stats,row.position,format)])) as Record<ScoringFormat,number>;
  if(JSON.stringify(points)!==JSON.stringify(row.points)){
   for(const format of ['standard','half_ppr','ppr'] as const)if(row.points?.[format]!==points[format])fail('score_arithmetic_mismatch');
  }
  return {...row,stats,points};
 }).sort((a,b)=>a.providerPlayerId.localeCompare(b.providerPlayerId));
 if(dstTeams.size!==2)fail('incomplete_defense_coverage');
 if(!players.some(row=>row.position!=='DST'&&row.team===snapshot.away)||!players.some(row=>row.position!=='DST'&&row.team===snapshot.home))fail('incomplete_team_coverage');
 return {...snapshot,players};
}
/** Hash only canonical scoring content; retrieval time is not a stat revision. */
export function scoringContentHash(snapshot:CanonicalScoringSnapshot):string{
 return createHash('sha256').update(JSON.stringify({version:snapshot.schemaVersion,source:snapshot.source,contractId:snapshot.contractId,game:snapshot.canonicalGameId,providerGame:snapshot.providerGameId,status:snapshot.status,players:snapshot.players.map(({providerPlayerId,appPlayerId,team,position,participation,stats,points})=>({providerPlayerId,appPlayerId,team,position,participation,stats,points})).sort((a,b)=>a.providerPlayerId.localeCompare(b.providerPlayerId))})).digest('hex');
}
