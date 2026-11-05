import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Exercise the real cloud helpers against an account-switching query transport.
const state={user:'account-a',afterEnsure:null,afterWrite:null,queries:[],writes:[],stall:false};
globalThis.__bkUserStateTest=state;
const mock=`
const state=globalThis.__bkUserStateTest;
export async function ensureOnlineSession(){const user={id:state.user};state.afterEnsure?.();return user;}
function makeQuery(table,rpcArgs=null){
 const record={table,filters:{},rows:null,headers:{},signal:null,rpcArgs};state.queries.push(record);
 const query={select(){return query},eq(key,value){record.filters[key]=value;return query},
 maybeSingle(){return {then:query.then}},order(){return query},in(){return query},
 setHeader(key,value){record.headers[key]=value;return query},abortSignal(signal){record.signal=signal;return query},
 upsert(rows){record.rows=Array.isArray(rows)?rows:[rows];return query},
 then(resolve,reject){
   if(state.stall)return new Promise((_,fail)=>{const abort=()=>fail(new Error('Timed out'));if(record.signal?.aborted)abort();else record.signal?.addEventListener('abort',abort,{once:true});}).then(resolve,reject);
   if(rpcArgs){const owner=record.headers.Authorization?.replace('Bearer token-','');if(!owner)throw new Error('Owner RPC token was not captured');const row={user_id:owner,state_key:rpcArgs.p_state_key,value:rpcArgs.p_value};state.writes.push(row);return Promise.resolve({data:[row],error:null}).then(resolve,reject);}
   const allowed=!record.rows||record.rows.every(row=>row.user_id===state.user);
   if(record.rows&&allowed){state.writes.push(...record.rows);state.afterWrite?.();}
   return Promise.resolve(allowed?{data:record.rows?[]:table.endsWith('events')?[]:{value:{account:record.filters.user_id}},error:null}:{data:null,error:new Error('RLS rejected account switch')}).then(resolve,reject);
 }};return query;
}
export const supabase={from:makeQuery,rpc:makeQuery,auth:{async getSession(){return{data:{session:{user:{id:state.user},access_token:'token-'+state.user}},error:null};}}};
`;
const bundled=await build({entryPoints:['userStateCloud.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'account-switch-transport',setup(build){
  build.onResolve({filter:/^\.\/supabase$/},()=>({path:'supabase-test',namespace:'mock'}));
  build.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'ts'}));
}}]});
const cloud=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const event={id:'event-one',occurredAt:Date.now(),kind:'test'};
assert.deepEqual(await cloud.loadUserState('gauntlet_progress_v2','account-a'),{account:'account-a'});
await cloud.saveUserState('fantasy_watchlist',['player-1'],'account-a');
assert.equal(state.writes[0].user_id,'account-a');

state.user='account-b';
const before=state.queries.length;
for(const work of [()=>cloud.loadUserState('gauntlet_progress_v2','account-a'),()=>cloud.saveUserState('fantasy_watchlist',['old-player'],'account-a'),()=>cloud.loadGauntletProgressEvents('account-a'),()=>cloud.saveGauntletProgressEvents([event],'account-a'),()=>cloud.saveUserStates([{stateKey:'solo_career',value:{old:true}}],'account-a'),()=>cloud.loadUserStates(['solo_career'],'account-a')]) {
  await assert.rejects(work,/account changed/);
}
assert.equal(state.queries.length,before,'Queued operations for the old account must fail before making queries');

state.user='account-a';
state.afterEnsure=()=>{state.user='account-b';};
await assert.rejects(()=>cloud.saveUserState('fantasy_watchlist',['old-player'],'account-a'),/RLS/);
assert.equal(state.queries.at(-1).rows[0].user_id,'account-a','A later account switch cannot relabel old payloads with the new user');
state.afterEnsure=null;

state.user='account-a';
state.afterWrite=()=>{state.user='account-b';};
const events=Array.from({length:251},(_,i)=>({...event,id:'event-'+i}));
await assert.rejects(()=>cloud.saveGauntletProgressEvents(events,'account-a'),/RLS/);
assert.equal(state.queries.at(-1).rows[0].user_id,'account-a','Later upload batches stay bound to the original account');
assert(state.writes.every(row=>row.user_id==='account-a'),'No old-account payload was written under account B');

state.user='account-a';
await cloud.saveUserStates([{stateKey:'solo_career',value:{old:true}},{stateKey:'owner_business_career_v1',value:{cloudRevision:1}}],'account-a');
assert.equal(state.queries.at(-1).headers.Authorization,'Bearer token-account-a','Owner auth.uid() must remain the original account after the regular batch changes session');
assert.equal(state.writes.at(-1).user_id,'account-a');

state.user='account-a';state.afterWrite=null;state.stall=true;
const originalTimeout=AbortSignal.timeout;
const deadlines=[];
AbortSignal.timeout=milliseconds=>{deadlines.push(milliseconds);const controller=new AbortController();setTimeout(()=>controller.abort(),5);return controller.signal;};
try {
  await assert.rejects(()=>cloud.saveUserStates([{stateKey:'solo_career',value:{}}],'account-a'),/Timed out/);
  await assert.rejects(()=>cloud.saveUserStates([{stateKey:'owner_business_career_v1',value:{}}],'account-a'),/Timed out/);
  await assert.rejects(()=>cloud.loadUserStates(['solo_career'],'account-a'),/Timed out/);
  await cloud.flushPendingUserStateWrites();
  assert.deepEqual(deadlines,[12000,12000,12000],'Hanging reads, upserts and Owner RPCs need bounded aborts');
} finally {AbortSignal.timeout=originalTimeout;}
delete globalThis.__bkUserStateTest;
console.log('PASS: queued-account isolation, batch races, Owner token binding and bounded read/write/RPC aborts using real cloud helpers.');
