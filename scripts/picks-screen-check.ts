import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withPicksDeadline} from '../picksRequest';
import {gamePhase,hasKickoff,initialSlate,parsePicksBoard,scheduleLabel,slateKey,visiblePicksGames} from '../picksBoard';
import {normalizeNflDataRows,matchPredictionKickoff} from '../server/nflPredictionFeed.js';
import handler from '../api/nfl-sportsbook';

const never=()=>new Promise<never>(()=>{});
let signal:AbortSignal;
await assert.rejects(withPicksDeadline(async value=>{signal=value;return never()},15),/timed out/);
assert.equal(signal!.aborted,true,'a native fetch that ignores abort must still have a bounded UI');
await assert.rejects(withPicksDeadline(async()=>({json:never}).json(),15),/timed out/,'response-body parsing must also be bounded');
const controller=new AbortController();const cancelled=withPicksDeadline(never,1000,controller.signal);controller.abort();await assert.rejects(cancelled,{name:'AbortError'});
assert.equal(await withPicksDeadline(async()=>42,100),42);
let invoked=false;await assert.rejects(withPicksDeadline(async()=>{invoked=true},100,controller.signal));assert.equal(invoked,false,'do not send work after cancellation');

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

const originalFetch=globalThis.fetch;const originalNow=Date.now;const key=process.env.TANK01_API_KEY;const rapid=process.env.RAPIDAPI_KEY;
try{
  delete process.env.TANK01_API_KEY;delete process.env.RAPIDAPI_KEY;Date.now=()=>now;
  let payload:unknown={data:[{...row,game_id:'late',week:18,gameday:'2027-01-10'},row]};
  globalThis.fetch=(async()=>new Response(JSON.stringify(payload),{status:200})) as typeof fetch;
  const response=async(query={})=>{
    let body:any;let status:number;const headers:Record<string,string>={};
    const res={setHeader:(name:string,value:string)=>{headers[name]=value},status:(value:number)=>{status=value;return res},json:(value:unknown)=>{body=value;return res}};
    await handler({query},res);return {body,status:status!,headers};
  };
  let result=await response();assert.equal(result.status,200);assert.equal(result.body.available,true);
  assert.equal(result.body.games[0].id,row.game_id,'Week 18 must not appear before Week 1 when times are missing');
  assert.equal(result.body.games[0].date,null);assert.equal(result.body.games[0].scheduleDate,'2026-09-10');
  const history=Array.from({length:110},(_,i)=>({...row,game_id:`saved-${i}`,gameday:'2026-01-01'}));
  payload={data:[...history,row]};result=await response({gameIds:history.map(g=>g.game_id).join(',')});
  assert.equal(result.body.games.length,111,'all requested saved IDs survive the rolling window');
  payload={data:[]};result=await response();assert.equal(result.body.available,true);assert.deepEqual(result.body.games,[]);
  payload={unexpected:'provider schema drift'};result=await response();assert.equal(result.body.available,false,'malformed/outage responses are not valid empty schedules');

  // Exercise the real canonical enrichment path without network or paid credentials.
  process.env.TANK01_API_KEY='isolated-test-fixture';let tankCalls=0;
  globalThis.fetch=(async input=>{
    const url=String(input);
    if(url.includes('api.nfldata.org'))return new Response(JSON.stringify({data:[row]}));
    assert.ok(url.includes('/getNFLGamesForWeek'));
    tankCalls++;assert.ok(url.includes('week=1'));assert.ok(url.includes('season=2026'));
    return new Response(JSON.stringify({body:[tank]}));
  }) as typeof fetch;
  result=await response();assert.equal(result.body.games[0].id,row.game_id);assert.equal(result.body.games[0].date,'2026-09-11T00:20:00.000Z');
  await response();assert.equal(tankCalls,1,'a warm refresh must reuse schedule-only enrichment');
}finally{
  globalThis.fetch=originalFetch;Date.now=originalNow;
  if(key===undefined)delete process.env.TANK01_API_KEY;else process.env.TANK01_API_KEY=key;
  if(rapid===undefined)delete process.env.RAPIDAPI_KEY;else process.env.RAPIDAPI_KEY=rapid;
}
const screen=readFileSync('SportsbookHub.tsx','utf8');
assert.match(screen,/showMotionControl=\{false\}/);assert.match(screen,/void load\(\);void syncPicks\(\)/);
assert.match(screen,/version===revision.current/,'late sync must not overwrite newer choices');
assert.match(screen,/saving.current=true/,'synchronous duplicate-tap guard must precede awaiting verification');
assert.match(screen,/setGames\(\[\]\)/,'failed refresh must not retain selectable stale lines');
assert.match(readFileSync('picksScreen.css','utf8'),/prefers-reduced-motion:reduce/);
console.log('Picks regression checks passed: deadlines, cancellation, date-only schedule, exact kickoff matching, canonical IDs, sorting, all saved history, real empty/outage, filters and guarded UI state.');
