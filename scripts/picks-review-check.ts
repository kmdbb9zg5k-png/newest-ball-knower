import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialSlate,nextPicksKickoffDelay,slateKey} from '../picksBoard';
import {createSportsbookHandler} from '../api/nfl-sportsbook';

const now=Date.parse('2026-09-07T20:00:00Z');
const game={id:'week1',away:'Dallas Cowboys',home:'Philadelphia Eagles',season:2026,week:1,seasonType:'REG',scheduleDate:'2026-09-10',date:null,status:'Scheduled'};
const second={...game,id:'week2',week:2,scheduleDate:'2026-09-17'};
assert.equal(initialSlate([second,game],Date.parse('2026-09-11T00:30:00Z')),slateKey(game),'an evening NFL date must not advance at UTC midnight');
assert.equal(nextPicksKickoffDelay([game],now),null);
assert.equal(nextPicksKickoffDelay([{...game,date:new Date(now+1000).toISOString()}],now),1001);
assert.equal(nextPicksKickoffDelay([{...game,date:new Date(now-1000).toISOString()}],now),null);
assert.equal(nextPicksKickoffDelay([{...game,date:new Date(now+90*86400_000).toISOString()}],now),2_147_483_647,'far-away kickoff must not overflow the browser timer');
assert.equal(nextPicksKickoffDelay([{...game,status:'Live',date:new Date(now-3600_000).toISOString()}],now),11*3600_000+1,'expire stale live labels without a permanent polling timer');
const screen=readFileSync('SportsbookHub.tsx','utf8');
assert.match(screen,/setPicks\(next\)/,'state updater must not mutate the ref during React render');
assert.doesNotMatch(screen,/setPicks\(current=>/);
assert.doesNotMatch(screen,/setInterval/,'no permanent per-second board re-render');
assert.match(screen,/isPicksGameLocked\(game(?:,Date\.now\(\))?\)\|\|saving.current/,'the final click guard must use the actual current time');

let rows:any[]=[{...game,kickoffAt:null,total:null,homeSpread:null,awaySpread:null}];
const handler=createSportsbookHandler({now:()=>now,fetchGames:async()=>rows});
const read=async()=>{let body:any;const res={setHeader:()=>{},status:()=>res,json:(value:any)=>{body=value;return res}};await handler({query:{}},res);return body};
let result=await read();assert.equal(result.available,true);assert.equal(result.games.length,1);assert.equal(result.linesAvailable,false);assert.match(result.warning,/lines are not posted/);
rows=[];result=await read();assert.equal(result.available,true);assert.deepEqual(result.games,[]);assert.equal(result.warning,null,'empty schedule must not masquerade as schedule with pending lines');
console.log('Picks review regressions passed: NFL timezone, kickoff-driven timers, synchronous ref updates, and distinct empty versus pending-line metadata.');