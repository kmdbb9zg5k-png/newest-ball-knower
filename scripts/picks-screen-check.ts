import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isPicksGameLocked,gradePick} from '../picksEngine';
import {withPicksDeadline} from '../picksRequest';
import {createPicksMutationQueue} from '../picksMutationQueue';
import {gamePhase,hasKickoff,initialSlate,parsePicksBoard,scheduleLabel,slateKey,slateLabel,visiblePicksGames} from '../picksBoard';
import {normalizeNflDataRows,matchPredictionKickoff} from '../server/nflPredictionFeed.js';
import {createSportsbookHandler} from '../api/nfl-sportsbook';

const never=()=>new Promise<never>(()=>{});
let signal:AbortSignal;
await assert.rejects(withPicksDeadline(async value=>{signal=value;return never()},15),/timed out/);
assert.equal(signal!.aborted,true,'a native fetch that ignores abort must still have a bounded UI');
await assert.rejects(withPicksDeadline(async()=>({json:never}).json(),15),/timed out/,'response-body parsing must also be bounded');
const controller=new AbortController();const cancelled=withPicksDeadline(never,1000,controller.signal);controller.abort();await assert.rejects(cancelled,{name:'AbortError'});
assert.equal(await withPicksDeadline(async()=>42,100),42);
let invoked=false;await assert.rejects(withPicksDeadline(async()=>{invoked=true},100,controller.signal));assert.equal(invoked,false,'do not send work after cancellation');

// A client-side deadline is not a server-side rollback. Late writes retain ordering.
const mutationQueue=createPicksMutationQueue(15);let finishWrite!:(value:string)=>void;
const writeEvents:string[]=[];
const slow=mutationQueue.run(()=>{writeEvents.push('old-start');return new Promise<string>(resolve=>{finishWrite=value=>{writeEvents.push('old-finish');resolve(value)}})});
await assert.rejects(slow,/timed out/);
const newer=mutationQueue.run(async()=>{writeEvents.push('new-start');return 'new'});
await new Promise(resolve=>setTimeout(resolve,2));assert.deepEqual(writeEvents,['old-start'],'a timeout cannot release a submitted write');
finishWrite('old');assert.equal(await newer,'new');assert.deepEqual(writeEvents,['old-start','old-finish','new-start']);
const anotherSlow=mutationQueue.run(()=>new Promise<string>(resolve=>{finishWrite=resolve}));
await assert.rejects(anotherSlow,/timed out/);
let expiredSent=false;await assert.rejects(mutationQueue.run(async()=>{expiredSent=true}),/timed out/);
finishWrite('done');await mutationQueue.whenIdle();assert.equal(expiredSent,false,'a timed-out queued click must never submit later');
assert.equal(await mutationQueue.run(async()=>7),7,'confirmed completion unblocks the queue');

const now=Date.parse('2026-09-07T20:00:00Z');
const row={game_id:'2026_01_DAL_PHI',season:2026,week:1,game_type:'REG',gameday:'2026-09-10',gametime:null,away_team:'DAL',home_team:'PHI',spread_line:3.5,total_line:44.5};
const normalized=normalizeNflDataRows([row])[0];
assert.equal(normalized.kickoffAt,null,'a date-only source cannot invent a kickoff');
assert.equal(normalized.scheduleDate,'2026-09-10');assert.equal(normalized.week,1);
assert.equal(normalized.id,row.game_id);
const tank={away:'DAL',home:'PHI',gameDate:'20260910',gameTime:'8:20 PM'};
assert.equal(matchPredictionKickoff(normalized,[tank]),'2026-09-10T20:20:00-04:00');
assert.equal(matchPredictionKickoff(normalized,[{...tank,home:'NYG'}]),null);
assert.equal(matchPredictionKickoff(normalized,[{...tank,gameDate:'20260911'}]),null);
assert.equal(matchPredictionKickoff(normalized,[tank,tank]),null,'ambiguous providers must not silently move kickoff');
assert.equal(matchPredictionKickoff(normalized,[{...tank,gameTime_epoch:Date.parse('2026-09-12T01:00:00Z')/1000}]),null,'an epoch/date conflict must be rejected');
const game={id:row.game_id,away:'Dallas Cowboys',home:'Philadelphia Eagles',awayAbbr:'DAL',homeAbbr:'PHI',season:2026,week:1,seasonType:'REG',scheduleDate:'2026-09-10',date:null,status:'Scheduled'};
assert.equal(hasKickoff(game),false);assert.equal(gamePhase(game,now),'upcoming');
assert.match(scheduleLabel(game),/Sep.*10.*Time TBD/);
assert.equal(initialSlate([{...game,week:18,scheduleDate:'2027-01-10'},game],now),slateKey(game));
const final={...game,id:'final',status:'Final'};
const live={...game,id:'live',status:'Live',date:'2026-09-07T19:00:00Z'};
const second={...game,id:'week2',week:2,scheduleDate:'2026-09-17'};
assert.equal(visiblePicksGames([second,game,live,final],slateKey(game),'all','  phi  ',now).length,3);
assert.equal(visiblePicksGames([game,live,final],slateKey(game),'upcoming','',now).length,1);
assert.equal(visiblePicksGames([game,live,final],slateKey(game),'live','',now)[0].id,'live');
assert.equal(visiblePicksGames([game,live,final],slateKey(game),'final','',now)[0].id,'final');
assert.deepEqual(parsePicksBoard({available:true,games:[]}),[]);
for(const invalid of [{},null,{games:{}},{games:[{id:'bad'}]},{games:[game,game]},{games:[{...game,homeSpread:'3'}]}])assert.throws(()=>parsePicksBoard(invalid));

// A stale schedule or provider live flag must not pin Picks to last week.
const auditNow=Date.parse('2026-10-27T23:00:00Z');
const oldGame={...game,id:'old-week',date:'2026-10-22T00:00:00Z',scheduleDate:'2026-10-22',week:7};
const upcomingGame={...game,id:'next-week',date:'2026-10-29T00:00:00Z',scheduleDate:'2026-10-29',week:8};
for(const status of ['Scheduled','Live','In Progress','Halftime','', 'Postponed','Suspended']){
  const stale={...oldGame,status};
  assert.equal(gamePhase(stale,auditNow),'unknown',status);
  assert.equal(isPicksGameLocked(stale,auditNow),true,'stale games remain locked');
  const pick={id:'pick',gameId:stale.id,label:'Home',market:'spread' as const,selection:stale.home,lockedLine:0,lockedAt:'2026-10-21T00:00:00Z'};
  assert.equal(gradePick(pick,{...stale,awayScore:0,homeScore:7}).result,undefined,'do not invent a final result');
  assert.equal(initialSlate([stale,upcomingGame],auditNow),slateKey(upcomingGame));
  assert.deepEqual(visiblePicksGames([stale],slateKey(stale),'live','',auditNow),[]);
  assert.deepEqual(visiblePicksGames([stale],slateKey(stale),'final','',auditNow),[]);
  assert.equal(visiblePicksGames([stale],slateKey(stale),'all','',auditNow).length,1);
}
assert.equal(gamePhase({...oldGame,date:null},auditNow),'unknown');
assert.equal(gamePhase({...oldGame,status:'Final'},auditNow),'final');
const active={...oldGame,status:'In Progress',date:new Date(auditNow-60*60*1000).toISOString()};
assert.equal(gamePhase(active,auditNow),'live');
assert.equal(initialSlate([active,upcomingGame],auditNow),slateKey(active));
assert.equal(gamePhase({...active,status:'Scheduled'},auditNow),'unknown','kickoff alone is not live evidence');
assert.equal(gamePhase({...active,status:'Delayed'},auditNow),'unknown');
assert.equal(gamePhase({...active,date:new Date(auditNow-12*60*60*1000).toISOString()},auditNow),'unknown');

// Endpoint-window tests inject normalized rows; the provider adapter has its own
// CSV/provenance tests and never contacts a paid enrichment service.
let payload:any[]=normalizeNflDataRows([{...row,game_id:'late',week:18,gameday:'2027-01-10'},row]);
let fail=false;
const snapshot='2026-09-07T19:30:00.000Z';
const handler=createSportsbookHandler({now:()=>now,fetchGames:async()=>{if(fail)throw new Error('fixture outage');return Object.assign(payload,{fetchedAt:snapshot,source:'nflverse'})}});
const response=async(query={})=>{
  let body:any;let status:number;const headers:Record<string,string>={};
  const res={setHeader:(name:string,value:string)=>{headers[name]=value},status:(value:number)=>{status=value;return res},json:(value:unknown)=>{body=value;return res}};
  await handler({query},res);return {body,status:status!,headers};
};
let result=await response();assert.equal(result.status,200);assert.equal(result.body.available,true);
assert.equal(result.body.games[0].id,row.game_id,'Week 18 must not appear before Week 1 when times are missing');
assert.equal(result.body.games[0].date,null);assert.equal(result.body.games[0].scheduleDate,'2026-09-10');
assert.equal(result.body.fetchedAt,snapshot,'handler time cannot replace upstream retrieval time');
assert.equal(result.body.live,false);assert.equal(result.body.source,'nflverse');
const history=Array.from({length:110},(_,i)=>({...row,game_id:`saved-${i}`,gameday:'2026-01-01'}));
payload=normalizeNflDataRows([...history,row]);result=await response({gameIds:history.map(g=>g.game_id).join(',')});
assert.equal(result.body.games.length,111,'all requested saved IDs survive the rolling window');
payload=[];result=await response();assert.equal(result.body.available,true);assert.deepEqual(result.body.games,[]);
fail=true;result=await response();assert.equal(result.body.available,false,'provider failure is not a valid empty schedule');
const screen=readFileSync('SportsbookHub.tsx','utf8');
assert.doesNotMatch(screen,/MotionControl|showMotionControl/);assert.match(screen,/void load\(\);void syncPicks\(\)/);
assert.match(screen,/version===revision.current/,'late sync must not overwrite newer choices');
assert.match(screen,/saving.current=true/,'synchronous duplicate-tap guard must precede awaiting verification');
assert.match(screen,/setGames\(\[\]\)/,'failed refresh must not retain selectable stale lines');
assert.match(readFileSync('picksScreen.css','utf8'),/prefers-reduced-motion:reduce/);
console.log('Picks regression checks passed: deadlines, mutation ordering, cancellation, date-only schedule, exact kickoff matching, canonical IDs, sorting, all saved history, real empty/outage, filters and guarded UI state.');
