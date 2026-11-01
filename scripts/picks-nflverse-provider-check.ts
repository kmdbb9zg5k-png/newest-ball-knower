import assert from 'node:assert/strict';
import {fetchCanonicalPredictionGames,normalizeNflversePredictionRows,gradeCanonicalPrediction,NFLVERSE_PREDICTION_URL,NFLVERSE_COMPLETED_URL,applyPredictionCompletion,normalizeCompletedPredictionIds} from '../server/nflPredictionFeed.js';
import {resetNflverseCache,nflverseCsv} from '../server/bk/nflverse-csv';
const now=Date.parse('2026-11-01T12:00:00Z');
const base={game_id:'2026_01_DAL_PHI',season:'2026',game_type:'REG',week:'1',gameday:'2026-09-10',gametime:'20:20',away_team:'DAL',home_team:'PHI',away_score:'17',home_score:'24',result:'7',total:'41',spread_line:'3.5',total_line:'44.5',espn:'401873001'};
const normalize=(row:Record<string,string>)=>normalizeNflversePredictionRows([row],now)[0];
const candidate=normalize(base);assert.equal(candidate.final,false,'Arithmetic alone does not prove completion');assert.equal(candidate.homeScore,null);
assert.equal(gradeCanonicalPrediction({market:'total',selection:'over',lockedLine:0},candidate),null);
const final=applyPredictionCompletion([candidate],new Set([base.game_id]),now)[0];assert.equal(final.final,true);assert.equal(final.completionConfirmed,true);assert.equal(Object.hasOwn(final,'publishedResult'),false);assert.equal(final.kickoffAt,'2026-09-11T00:20:00.000Z');
assert.equal(final.homeSpread,-3.5);assert.equal(final.awaySpread,3.5);assert.equal(final.total,44.5);assert.equal(final.live,false);
assert.equal(normalize({...base,spread_line:'-2.5'}).homeSpread,2.5);assert.equal(normalize({...base,spread_line:'0'}).awaySpread,0);
const empty=normalize({...base,away_score:'',home_score:'',result:'',total:'',spread_line:'NA',total_line:''});
assert.equal(empty.final,false);assert.equal(empty.awayScore,null);assert.equal(empty.homeScore,null);assert.equal(empty.total,null);assert.equal(empty.homeSpread,null);
for(const patch of [{home_score:''},{result:''},{total:''},{result:'6'},{total:'40'},{gameday:'2026-12-01'}]){
 const game=normalize({...base,...patch});assert.equal(game.final,false);assert.equal(game.homeScore,null);assert.equal(gradeCanonicalPrediction({market:'total',selection:'over',lockedLine:0},game),null);
}
assert.equal(normalize({...base,gameday:'2026-12-01',gametime:'20:20'}).kickoffAt,'2026-12-02T01:20:00.000Z');
assert.equal(normalize({...base,gametime:''}).kickoffAt,null);
for(const patch of [{away_score:'-1'},{home_score:'1.5'},{spread_line:'Infinity'},{total_line:'401'},{game_id:'2026_01_NYG_PHI'},{week:'99'},{home_team:'???'},{gameday:'2026-02-30'},{gameday:'2027-09-01'},{gametime:'13:99'}])assert.throws(()=>normalize({...base,...patch}));
assert.throws(()=>normalizeNflversePredictionRows([base,base],now),/duplicate/);
assert.throws(()=>normalizeNflversePredictionRows([{game_id:base.game_id}],now),/schema/);
assert.equal(gradeCanonicalPrediction({gameId:'old-provider',market:'spread',selection:final.home,lockedLine:-7},final),'push');
assert.equal(gradeCanonicalPrediction({market:'spread',selection:'PHI',lockedLine:-6.5},final),'win');
assert.equal(gradeCanonicalPrediction({market:'total',selection:'over',lockedLine:42},final),'loss');
assert.equal(gradeCanonicalPrediction({market:'total',selection:'under',lockedLine:41},final),'push');
assert.ok(final.aliases.includes('espn-401873001'));assert.ok(final.aliases.includes('20260910_DAL@PHI'));
const alias=normalize({...base,game_id:'2026_01_LA_JAX',away_team:'LA',home_team:'JAX'});
assert.ok(alias.aliases.includes('20260910_LAR@JAC'));assert.equal(alias.awayAbbr,'LAR');
const teams='ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
const rows=Array.from({length:272},(_,index)=>{const week=Math.floor(index/16)+1;const away=teams[(index%16)*2],home=teams[(index%16)*2+1];return {...base,game_id:`2026_${String(week).padStart(2,'0')}_${away}_${home}`,week:String(week),away_team:away,home_team:home,espn:String(1000+index)}});
const headers=Object.keys(base);const csv=[headers.join(','),...rows.map(row=>headers.map(key=>row[key as keyof typeof row]).join(','))].join('\n');
let calls=0,clock=now;
resetNflverseCache();
const manifest='game_id\n'+rows.map(row=>row.game_id).join('\n');
const manifestResponse=(body=manifest)=>new Response(body,{headers:{'last-modified':'Fri, 30 Oct 2026 03:31:17 GMT'}});
const scheduleResponse=(body=csv)=>new Response(body,{headers:{'last-modified':'Sat, 31 Oct 2026 11:00:00 GMT'}});
assert.throws(()=>normalizeCompletedPredictionIds([{game_id:'bad'}]),/manifest/);
assert.throws(()=>normalizeCompletedPredictionIds([{game_id:base.game_id},{game_id:base.game_id}]),/manifest/);
const request=(async(target:RequestInfo|URL,init?:RequestInit)=>{calls++;assert.ok([NFLVERSE_PREDICTION_URL,NFLVERSE_COMPLETED_URL].includes(String(target)));assert.equal(init?.redirect,'manual');assert.equal(new Headers(init?.headers).get('authorization'),null);if(String(target)===NFLVERSE_COMPLETED_URL){assert.equal(new Headers(init?.headers).get('accept'),'application/vnd.github.raw+json');return manifestResponse();}assert.equal(new Headers(init?.headers).get('x-rapidapi-key'),null);return new Response(csv,{headers:{'last-modified':'Sat, 31 Oct 2026 11:00:00 GMT'}})}) as typeof fetch;
const first=await fetchCanonicalPredictionGames({fetchImpl:request,now:()=>clock});assert.equal(first.length,272);assert.equal(first.fetchedAt,new Date(now).toISOString());assert.equal(first.sourceUpdatedAt,'2026-10-31T11:00:00.000Z');assert.equal(first.live,false);assert.equal(first.completionAvailable,true);assert.equal(first.filter(g=>g.final).length,272);
clock+=240000;const cached=await fetchCanonicalPredictionGames({fetchImpl:request,now:()=>clock});assert.equal(calls,2);assert.equal(cached.fetchedAt,first.fetchedAt,'Cache hits must not refresh provenance timestamps');
resetNflverseCache();await assert.rejects(fetchCanonicalPredictionGames({fetchImpl:async()=>new Response(csv.split('\n').slice(0,3).join('\n')),now:()=>clock}),/incomplete/);
resetNflverseCache();await assert.rejects(fetchCanonicalPredictionGames({fetchImpl:async()=>new Response('',{status:302,headers:{location:'https://attacker.example/steal'}}),now:()=>clock}),/redirect/);
resetNflverseCache();
let failManifest=true,scheduleCalls=0,manifestCalls=0;
const recovery=async(target:RequestInfo|URL)=>{
 if(String(target)===NFLVERSE_COMPLETED_URL){manifestCalls++;return failManifest?new Response('',{status:503}):manifestResponse()}
 scheduleCalls++;return scheduleResponse();
};
let pending=await fetchCanonicalPredictionGames({fetchImpl:recovery,now:()=>clock});
assert.equal(pending.completionAvailable,false);assert.ok(pending.every(g=>!g.final&&g.homeScore===null));assert.equal(pending[0].homeSpread,-3.5,'Completion failure must preserve lines');
failManifest=false;clock+=30001;
pending=await fetchCanonicalPredictionGames({fetchImpl:recovery,now:()=>clock});assert.equal(scheduleCalls,1,'Completion recovery should reuse cached scores only when their publication ordering is verified');assert.equal(manifestCalls,2);assert.ok(pending.every(g=>g.final));
resetNflverseCache();
const incompleteManifest=await fetchCanonicalPredictionGames({fetchImpl:async(target)=>String(target)===NFLVERSE_COMPLETED_URL?manifestResponse('game_id\n2025_01_DAL_PHI'):scheduleResponse(),now:()=>clock});
assert.equal(incompleteManifest.completionAvailable,true);assert.ok(incompleteManifest.every(g=>!g.final&&g.homeScore===null));
resetNflverseCache();
// The manifest can confirm completion while a cached score snapshot predates it.
// Even consistent arithmetic must stay pending until a newer score publication arrives.
let orderClock=now,orderScheduleCalls=0,newScores=false;
const orderedRequest=async(target:RequestInfo|URL)=>{
 if(String(target)===NFLVERSE_COMPLETED_URL)return manifestResponse();
 orderScheduleCalls++;return new Response(csv,{headers:{'last-modified':newScores?'Sat, 31 Oct 2026 11:00:00 GMT':'Thu, 29 Oct 2026 11:00:00 GMT'}});
};
let ordered=await fetchCanonicalPredictionGames({fetchImpl:orderedRequest,now:()=>orderClock});
assert.equal(ordered.scorePublicationVerified,false);assert.ok(ordered.every(g=>!g.final&&g.homeScore===null));
newScores=true;orderClock+=300001;
ordered=await fetchCanonicalPredictionGames({fetchImpl:orderedRequest,now:()=>orderClock});assert.equal(orderScheduleCalls,2);assert.equal(ordered.scorePublicationVerified,true);assert.ok(ordered.every(g=>g.final));
resetNflverseCache();
const missingPublication=await fetchCanonicalPredictionGames({fetchImpl:async(target)=>String(target)===NFLVERSE_COMPLETED_URL?new Response(manifest):scheduleResponse(),now:()=>clock});
assert.equal(missingPublication.scorePublicationVerified,false);assert.ok(missingPublication.every(g=>!g.final&&g.homeScore===null));
resetNflverseCache();
let unsafeRequests=0;
await assert.rejects(nflverseCsv('https://api.github.com/repos/attacker/repo/contents/released_games.csv?ref=main',normalizeCompletedPredictionIds,300000,async()=>{unsafeRequests++;return manifestResponse()},()=>clock,'completed-games-v2'),/invalid_nflverse_source/);
assert.equal(unsafeRequests,0);
const redirectedManifest=await fetchCanonicalPredictionGames({fetchImpl:async(target)=>String(target)===NFLVERSE_COMPLETED_URL?new Response('',{status:302,headers:{location:'https://raw.githubusercontent.com/nflverse/nflverse-pbp-internal/main/released_games.csv'}}):scheduleResponse(),now:()=>clock});
assert.equal(redirectedManifest.completionAvailable,false);assert.ok(redirectedManifest.every(g=>!g.final));
resetNflverseCache();
console.log('Picks nflverse provider checks passed: validated results, locked lines, spread signs, aliases, dates, provenance, coverage, confined network and cache.');
