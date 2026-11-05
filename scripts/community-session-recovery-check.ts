import assert from 'node:assert/strict';
import {readFootballResult,saveFootballResult,clearFootballResult,type PendingFootballResult} from '../footballResultRecovery';
import {readMiniResult,saveMiniResult,clearMiniResult,validMiniResultStats} from '../communityResultRecovery';

const values=new Map<string,string>();
const storage:Storage={
  get length(){return values.size;},
  key:(index:number)=>Array.from(values.keys())[index]??null,
  clear:()=>{values.clear();},
  getItem:(key:string)=>values.get(key)??null,
  setItem:(key:string,value:string)=>{values.set(key,value);},
  removeItem:(key:string)=>{values.delete(key);},
};
const drive:PendingFootballResult={attempt:{token:'original-token',drive:1,deadline:new Date(Date.now()-1000).toISOString(),seed:42,team:'JCY',opponent:'BRK'},stats:{points:7,yards:75,plays:8},expired:false,expiresAt:new Date(Date.now()+86400000).toISOString()};
assert.equal(saveFootballResult('account-a','match-a',drive,storage),true);
assert.deepEqual(readFootballResult('account-a','match-a',storage),drive,'A late save retry preserves the received stats and original token even after the attempt deadline');
assert.equal(readFootballResult('account-b','match-a',storage),null,'Another account never sees the pending result');
assert.equal(readFootballResult('account-a','match-b',storage),null,'A different match cannot inherit the drive');
assert.equal(readFootballResult('','match-a',storage),null,'Guests cannot restore an account-bound online result');
clearFootballResult('account-a','match-a',storage);assert.equal(readFootballResult('account-a','match-a',storage),null);
saveFootballResult('account-a','match-a',{...drive,expiresAt:'invalid'},storage);assert.equal(readFootballResult('account-a','match-a',storage),null,'Malformed cache expires safely');
saveFootballResult('account-a','match-a',{...drive,stats:{points:999,yards:75,plays:8}},storage);assert.equal(readFootballResult('account-a','match-a',storage),null,'Invalid score payloads cannot restore an attempt');

const drill={token:'event-token',seed:42,stats:{time:4.5,split10:1.5,split20:2.6},expiresAt:new Date(Date.now()+86400000).toISOString()};
assert.equal(saveMiniResult('account-a','competition:event:dash',drill,storage),true);
assert.deepEqual(readMiniResult('account-a','competition:event:dash',storage),drill,'A failed competition save retains the exact completed attempt');
assert.equal(readMiniResult('account-b','competition:event:dash',storage),null);
assert.equal(readMiniResult('account-a','competition:event:bench',storage),null,'A drill token cannot be applied to a different drill');
clearMiniResult('account-a','competition:event:dash',storage);assert.equal(readMiniResult('account-a','competition:event:dash',storage),null);
assert.equal(validMiniResultStats([]),false);assert.equal(validMiniResultStats({}),false);assert.equal(validMiniResultStats({time:Infinity}),false);
const blocked={getItem:()=>{throw Error('Storage disabled');},setItem:()=>{throw Error('Quota exceeded');},removeItem:()=>{throw Error('Storage disabled');}} as unknown as Storage;
assert.equal(saveFootballResult('a','m',drive,blocked),false);assert.equal(readFootballResult('a','m',blocked),null);
assert.equal(saveMiniResult('a','e',drill,blocked),false);assert.equal(readMiniResult('a','e',blocked),null);
assert.doesNotThrow(()=>clearFootballResult('a','m',blocked));assert.doesNotThrow(()=>clearMiniResult('a','e',blocked));
console.log('PASS account/match/drill isolation, exact pending-result recovery after deadline, cache validation and unavailable-storage behavior. No backend or real users exercised.');
