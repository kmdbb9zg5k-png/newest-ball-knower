import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialSlate,nextPicksKickoffDelay,slateKey} from '../picksBoard';
import handler from '../api/nfl-sportsbook';

const now=Date.parse('2026-09-07T20:00:00Z');
const game={id:'week1',away:'Dallas Cowboys',home:'Philadelphia Eagles',season:2026,week:1,seasonType:'REG',scheduleDate:'2026-09-10',date:null,status:'Scheduled'};
const second={...game,id:'week2',week:2,scheduleDate:'2026-09-17'};
assert.equal(initialSlate([second,game],Date.parse('2026-09-11T00:30:00Z')),slateKey(game),'an evening NFL date must not advance at UTC midnight');
assert.equal(nextPicksKickoffDelay([game],now),null);
assert.equal(nextPicksKickoffDelay([{...game,date:new Date(now+1000).toISOString()}],now),1001);
assert.equal(nextPicksKickoffDelay([{...game,date:new Date(now-1000).toISOString()}],now),null);
assert.equal(nextPicksKickoffDelay([{...game,date:new Date(now+90*86400_000).toISOString()}],now),2_147_483_647,'far-away kickoff must not overflow the browser timer');
const screen=readFileSync('SportsbookHub.tsx','utf8');
assert.match(screen,/setPicks\(next\)/,'state updater must not mutate the ref during React render');
assert.doesNotMatch(screen,/setPicks\(current=>/);
assert.doesNotMatch(screen,/setInterval/,'no permanent per-second board re-render');
assert.match(screen,/isPicksGameLocked\(game\)\|\|saving.current/,'the final click guard must use the actual current time');

const originalFetch=globalThis.fetch;const originalNow=Date.now;const key=process.env.TANK01_API_KEY;const rapid=process.env.RAPIDAPI_KEY;
try{
  delete process.env.TANK01_API_KEY;delete process.env.RAPIDAPI_KEY;Date.now=()=>now;
  const row={game_id:'2026_01_DAL_PHI',season:2026,week:1,game_type:'REG',gameday:'2026-09-10',gametime:null,away_team:'DAL',home_team:'PHI',spread_line:null,total_line:null};
  let rows:unknown[]=[row];
  globalThis.fetch=(async()=>new Response(JSON.stringify({data:rows}))) as typeof fetch;
  const read=async()=>{let body:any;const res={setHeader:()=>{},status:()=>res,json:(value:any)=>{body=value;return res}};await handler({query:{}},res);return body};
  let result=await read();assert.equal(result.available,true);assert.equal(result.games.length,1);assert.equal(result.linesAvailable,false);assert.match(result.warning,/lines are not posted/);
  rows=[];result=await read();assert.equal(result.available,true);assert.deepEqual(result.games,[]);assert.equal(result.warning,null,'empty schedule must not masquerade as schedule with pending lines');
}finally{
  globalThis.fetch=originalFetch;Date.now=originalNow;
  if(key===undefined)delete process.env.TANK01_API_KEY;else process.env.TANK01_API_KEY=key;
  if(rapid===undefined)delete process.env.RAPIDAPI_KEY;else process.env.RAPIDAPI_KEY=rapid;
}
console.log('Picks review regressions passed: NFL timezone, kickoff-driven timers, synchronous ref updates, and distinct empty versus pending-line metadata.');
