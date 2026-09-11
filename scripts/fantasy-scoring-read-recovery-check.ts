import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createScoringDatabaseFetch} from '../api/fantasy-live-scoring';

const origin='https://fixture.invalid';
const table=origin+'/rest/v1/ball_knower_nfl_games';
const ok=()=>new Response(JSON.stringify([{week_number:1}]),{headers:{'content-type':'application/json'}});
const gateway=()=>new Response('Gateway Timeout',{status:504});
const trace:Record<string,unknown>[]=[];
let calls=0;
const wrapped=createScoringDatabaseFetch(origin,{
  request:async()=>{calls++;return calls===1?gateway():ok();},log:event=>trace.push(event),
});
const db=createClient(origin,'fixture-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:wrapped}});
const recovered=await db.from('ball_knower_nfl_games').select('week_number');
assert.equal(recovered.error,null);
assert.deepEqual(recovered.data,[{week_number:1}]);assert.equal(calls,2);
assert.equal(trace[0].retry,true);assert.equal(trace[1].recovered,true);

for(const method of ['POST','PATCH','DELETE','PUT']){
  calls=0;
  const fetchImpl=createScoringDatabaseFetch(origin,{request:async()=>{calls++;return gateway();},log:()=>{}});
  const result=await fetchImpl(table,{method,body:'{}'});
  assert.equal(result.status,504);assert.equal(calls,1,method+' must never be replayed');
}
// Exercise the installed Supabase client, not only the transport helper.
calls=0;
const writeDb=createClient(origin,'fixture-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:createScoringDatabaseFetch(origin,{request:async()=>{calls++;return gateway();},log:()=>{}})}});
const write=await writeDb.from('ball_knower_weekly_scores').upsert({league_id:'fixture'});
assert.ok(write.error);assert.equal(write.status,504);assert.equal(calls,1);
for(const url of [origin+'/rest/v1/rpc/process_due_job','https://other.invalid/rest/v1/ball_knower_nfl_games']){
  calls=0;const f=createScoringDatabaseFetch(origin,{request:async()=>{calls++;return gateway();},log:()=>{}});
  assert.equal((await f(url,{method:'GET'})).status,504);assert.equal(calls,1,'RPC and foreign-origin requests cannot be automatically replayed');
}
for(const status of [200,400,401,403,404,406,429,500]){
  calls=0;const f=createScoringDatabaseFetch(origin,{request:async()=>{calls++;return new Response('fixture',{status});},log:()=>{}});
  assert.equal((await f(table)).status,status);assert.equal(calls,1,'Only configured gateway statuses qualify for an extra read');
}
for(const method of ['GET','HEAD']){
  calls=0;const f=createScoringDatabaseFetch(origin,{request:async()=>{calls++;return calls===1?gateway():new Response(method==='HEAD'?null:'[]',{status:200});},log:()=>{}});
  assert.equal((await f(new Request(table,{method}))).status,200);assert.equal(calls,2);
}
// A single invocation cannot multiply retry load across parallel table reads.
calls=0;
const concurrent=createScoringDatabaseFetch(origin,{request:async()=>{calls++;return gateway();},log:()=>{}});
const parallel=await Promise.all([concurrent(table),concurrent(table)]);
assert.equal(calls,3);assert.ok(parallel.every(result=>result.status===504));
assert.equal((await concurrent(table)).status,504);assert.equal(calls,4,'Retry budget stays consumed');

let time=0;calls=0;
const expired=createScoringDatabaseFetch(origin,{now:()=>time,request:async()=>{calls++;time=21_000;return gateway();},log:()=>{}});
assert.equal((await expired(table)).status,504);assert.equal(calls,1,'Late invocation cannot start another read');
const abort=new AbortController();calls=0;
const cancelled=createScoringDatabaseFetch(origin,{request:async()=>{calls++;abort.abort();return gateway();},log:()=>{}});
assert.equal((await cancelled(table,{signal:abort.signal})).status,504);assert.equal(calls,1);

// The added retry budget includes receiving the entire response, not only headers.
calls=0;const start=Date.now();
const stalled=createScoringDatabaseFetch(origin,{retryTimeoutMs:20,request:async()=>{calls++;return calls===1?gateway():new Response(new ReadableStream({start(){}}),{status:200});},log:()=>{}});
const failed=await stalled(table);
assert.equal(failed.status,504);assert.equal(calls,2);assert.ok(Date.now()-start<500);
assert.match(await failed.text(),/unavailable/);

const logs:Record<string,unknown>[]=[];calls=0;
const redacted=createScoringDatabaseFetch(origin,{request:async()=>{calls++;return gateway();},log:event=>logs.push(event)});
await redacted(table+'?auth_user_id=eq.private-user&token=private-token',{headers:{authorization:'Bearer private-secret'}});
assert.doesNotMatch(JSON.stringify(logs),/private-user|private-token|private-secret|authorization|fixture.invalid/);
assert.ok(logs.every(event=>event.operation==='ball_knower_nfl_games'));
const source=readFileSync(new URL('../api/fantasy-live-scoring.ts',import.meta.url),'utf8');
assert.ok(source.includes('global:{fetch:createScoringDatabaseFetch(supabaseUrl)}'),'Real scoring client must use the tested transport');
console.log('Scoring read recovery passed: actual SDK read recovery and write failure, one shared retry, gateway-only eligibility, RPC/origin exclusion, abort/window/body deadlines, and redacted operation diagnostics.');
