import assert from 'node:assert/strict';
import {newDash, pressDash, stepDash, combineAthlete, FINISH, RESULT_KEY, readResults, saveResult, bestResult} from '../combine/dash.js';
const athlete=combineAthlete({id:'wr-test',name:'Test Receiver',position:'WR',speed:94,attributes:{athleticism:90}});
function run(speed,dt=1/120,held=true,reaction=.12){const s=newDash({...athlete,speed,acceleration:speed});pressDash(s,1.5);while(s.phase==='set')stepDash(s,dt);stepDash(s,reaction);pressDash(s);s.held=held;for(let i=0;i<10000&&s.phase==='running';i++)stepDash(s,dt);assert.equal(s.phase,'finished');assert.equal(s.distance,FINISH);assert(s.splits[0]<s.splits[1]&&s.splits[1]<s.splits[2]);return s;}
const times=[30,60,90,120,144].map(hz=>run(94,1/hz).clock);assert(Math.max(...times)-Math.min(...times)<.00001,'Refresh-rate dependent finish');
assert(run(95).clock<run(70).clock,'Speed ratings must matter');assert(run(94).clock<run(94,1/120,false).clock,'Holding sprint must matter');assert(run(94).clock<run(94,1/120,true,.9).clock,'Launch quality must matter');
assert(run(99).clock>4&&run(99).clock<4.5);assert(run(50).clock>5.6);
const early=newDash(athlete);pressDash(early);pressDash(early);stepDash(early,10);assert.equal(early.phase,'false-start');assert.equal(early.distance,0);assert.equal(early.splits[2],null);
let value='broken';const storage={getItem:()=>value,setItem:(key,v)=>{assert.equal(key,RESULT_KEY);value=v}};assert.deepEqual(readResults(storage),[]);
const a={context:'solo-a',playerId:'wr',name:'Receiver',position:'WR',date:1,splits:[1.6,2.6,4.6]};assert(saveResult(a,storage));assert(saveResult({...a,context:'standalone',splits:[1.5,2.5,4.5]},storage));assert(saveResult({...a,splits:[1.5,2.5,4.55]},storage));assert.equal(bestResult(readResults(storage),'solo-a','wr').splits[2],4.55);assert.equal(bestResult(readResults(storage),'solo-b','wr'),null);assert(!saveResult({...a,splits:[3,2,1]},storage));assert(!saveResult(a,{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}));
const input={id:'prospect-1',name:'Prospect',position:'LT',grade:90};assert.deepEqual(combineAthlete(input),combineAthlete(input));assert(combineAthlete(input).speed<70);
console.log('PASS exact 40 yards, refresh independence, ratings, effort, launch, false starts, corrupt/blocked storage, best records and franchise isolation.',times.map(n=>n.toFixed(5)));
