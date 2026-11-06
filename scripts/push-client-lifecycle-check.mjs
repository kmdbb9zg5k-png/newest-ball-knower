import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.argv[2]||process.cwd(),require=createRequire(root+'/package.json');
const {transformSync}=require('esbuild'),contracts=await import(pathToFileURL(root+'/pushContracts.ts').href);
const source=transformSync(readFileSync(root+'/pushClient.ts','utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
const ownerA='11111111-1111-4111-8111-111111111111',ownerB='22222222-2222-4222-8222-222222222222',key='ballknower_push_installation_v1';
const initialIntent='44444444-4444-4444-8444-444444444444',initialEpoch='55555555-5555-4555-8555-555555555555';
const readiness={web:{ready:true,publicKey:'BA'},apns:{ready:false},android:{ready:false}};
const response=(body={ok:true},ok=true)=>({ok,json:async()=>body});
function runtime({delayUnsubscribe=false,delayRegistration=false,delayFirstSubscribe=false,absent=false}={}){
 const records=new Map([[key,JSON.stringify({installationId:'33333333-3333-4333-8333-333333333333',installationSecret:'a'.repeat(43),ownerId:ownerA,enabled:!absent,intentRevision:1,intentId:initialIntent,epoch:absent?null:initialEpoch})]]);
 let current={user:{id:ownerA,is_anonymous:false},access_token:'synthetic_A'},activeSubscription,subscribeCalls=0,unsubscribeCalls=0;
 let server=absent?null:{owner:ownerA,enabled:true,revision:1,intentId:initialIntent,epoch:initialEpoch};
 const gates={},requests=[];
 const createSubscription=()=>({options:{},unsubscribe:async()=>{activeSubscription=null;return true;},toJSON:()=>({endpoint:'synthetic-endpoint',keys:{}})});
 activeSubscription=absent?null:createSubscription();
 const registration={active:true,pushManager:{getSubscription:async()=>activeSubscription,subscribe:async()=>activeSubscription=createSubscription()},getNotifications:async()=>[]};
 const fakeSupabase={auth:{getSession:async()=>({data:{session:current}})}};
 const apply=(body,owner)=>{
   if(body.action==='unsubscribe'&&server&&server.owner!==owner)return response({ok:true,epoch:server.epoch});
   if(server&&(body.intentRevision<server.revision||body.intentRevision===server.revision&&(body.intentId!==server.intentId||server.enabled!==(body.action==='subscribe'))||body.expectedEpoch!==null&&body.expectedEpoch!==server.epoch))return response({error:'Synthetic installation intent changed',code:'push_state_changed'},false);
   server={owner,enabled:body.action==='subscribe',revision:body.intentRevision,intentId:body.intentId,epoch:server?.epoch||randomUUID()};
   return response({ok:true,epoch:server.epoch});
 };
 const apiFetch=async(_url,init)=>{
   const body=JSON.parse(init.body),owner=init.headers.Authorization==='Bearer synthetic_A'?ownerA:init.headers.Authorization.replace('Bearer synthetic_','');requests.push(body);
   if(body.action==='installation')return response({epoch:server?.epoch||null,revision:server?.revision||0});
   if(body.action==='unsubscribe'&&delayUnsubscribe&&++unsubscribeCalls===1)return new Promise((resolve,reject)=>{
     gates.releaseUnsubscribe=()=>resolve(apply(body,owner));
     gates.abortUnsubscribe=()=>reject(new Error('Synthetic HTTP deadline; DB result remains unknown'));
     gates.commitUnsubscribe=()=>apply(body,owner);
   });
   if(body.action==='subscribe'&&delayFirstSubscribe&&++subscribeCalls===1)return new Promise((resolve,reject)=>{
     gates.failFirstSubscribe=()=>resolve(response({error:'Synthetic old request failure'},false));
     gates.abortFirstSubscribe=()=>reject(new Error('Synthetic HTTP deadline; DB result remains unknown'));
     gates.commitFirstSubscribe=()=>apply(body,owner);
   });
   return apply(body,owner);
 };
 const module={exports:{}};
 const context={module,exports:module.exports,require:name=>name==='@capacitor/core'?{Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'}}:name==='./supabase'?{supabase:fakeSupabase}:name==='./pushContracts'?contracts:(()=>{throw Error(name)})(),crypto:{randomUUID},localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)},window:{isSecureContext:true,PushManager:function(){},Notification:{},dispatchEvent:()=>true},Notification:{permission:'granted'},navigator:{userAgent:'Chrome',serviceWorker:{getRegistration:async()=>delayRegistration?new Promise(resolve=>{gates.releaseRegistration=()=>resolve(registration);}):registration,register:async()=>registration}},fetch:apiFetch,AbortSignal,Event,CustomEvent:class{},atob,btoa,setTimeout,clearTimeout};
 vm.runInNewContext(source,context);
 return {api:module.exports,gates,requests,setOwner:id=>current={user:{id,is_anonymous:false},access_token:'synthetic_'+id},state:()=>({installation:JSON.parse(records.get(key)),subscribed:!!activeSubscription,serverEnabled:server?.enabled,serverOwner:server?.owner})};
}
async function reached(predicate){for(let n=0;n<300&&!predicate();n++)await Promise.resolve();assert.ok(predicate(),'Test did not reach deferred boundary');}
// Actual transpiled client with synthetic browser/server I/O; SQL tests independently exercise the real fence.
{
 const h=runtime({delayUnsubscribe:true}),old=h.api.disablePush(ownerA,'synthetic_A');
 await reached(()=>h.gates.releaseUnsubscribe);h.setOwner(ownerB);const next=h.api.enablePush(ownerB,readiness);
 h.gates.releaseUnsubscribe();await Promise.all([old,next]);const after=h.state();
 assert.equal(after.installation.ownerId,ownerB);assert.equal(after.installation.enabled,true);assert.equal(after.serverOwner,ownerB);assert.equal(after.serverEnabled,true);
}
{
 const h=runtime({delayRegistration:true}),old=h.api.disablePush(ownerA,'synthetic_A');
 await reached(()=>h.gates.releaseRegistration);h.setOwner(ownerB);const next=h.api.enablePush(ownerB,readiness);
 h.gates.releaseRegistration();await Promise.all([old,next]);const after=h.state();
 assert.equal(after.installation.ownerId,ownerB);assert.equal(after.installation.enabled,true);assert.equal(after.subscribed,true);
}
{
 const h=runtime({delayFirstSubscribe:true}),old=h.api.enablePush(ownerA,readiness).catch(error=>error);
 await reached(()=>h.gates.failFirstSubscribe);const next=h.api.enablePush(ownerA,readiness);
 h.gates.failFirstSubscribe();await Promise.all([old,next]);const after=h.state();
 assert.equal(after.installation.enabled,true);assert.equal(after.serverEnabled,true);
 assert.equal(h.requests.filter(body=>body.action==='unsubscribe').length,0,'stale old enable cannot enqueue cleanup against newer intent');
}
{
 const h=runtime({delayUnsubscribe:true}),old=h.api.disablePush(ownerA,'synthetic_A');
 await reached(()=>h.gates.releaseUnsubscribe);const next=h.api.enablePush(ownerA,readiness);
 h.gates.releaseUnsubscribe();await Promise.all([old,next]);const after=h.state();
 assert.equal(after.installation.enabled,true);assert.equal(after.serverEnabled,true,'newer same-owner enable follows old server mutation');
}
{
 const h=runtime({delayUnsubscribe:true}),old=h.api.disablePush(ownerA,'synthetic_A');
 await reached(()=>h.gates.abortUnsubscribe);h.gates.abortUnsubscribe();await old;
 await h.api.enablePush(ownerA,readiness);h.gates.commitUnsubscribe();
 assert.equal(h.state().serverEnabled,true,'old DB commit after client HTTP deadline must not revoke a newer enable');
 await h.api.disablePush(ownerA,'synthetic_A');assert.equal(h.state().serverEnabled,false);
 await h.api.enablePush(ownerA,readiness);assert.equal(h.state().serverEnabled,true,'fresh explicit action recovers after ambiguous write');
}
{
 const h=runtime({delayFirstSubscribe:true,absent:true}),old=h.api.enablePush(ownerA,readiness).catch(error=>error);
 await reached(()=>h.gates.abortFirstSubscribe);const off=h.api.disablePush(ownerA,'synthetic_A');
 h.gates.abortFirstSubscribe();await Promise.all([old,off]);h.gates.commitFirstSubscribe();
 assert.equal(h.state().installation.enabled,false);assert.equal(h.state().subscribed,false);assert.equal(h.state().serverEnabled,false,'disabled tombstone must beat first delayed subscribe');
}
{
const owner='11111111-1111-4111-8111-111111111111',key='ballknower_push_installation_v1',epoch='44444444-4444-4444-8444-444444444444';
const initial={installationId:'33333333-3333-4333-8333-333333333333',installationSecret:'a'.repeat(43),ownerId:owner,enabled:true,intentRevision:10,intentId:'55555555-5555-4555-8555-555555555555',epoch};
const records=new Map([[key,JSON.stringify(initial)]]),server={revision:10,intentId:initial.intentId,enabled:true,epoch},calls=[];
const response=value=>({ok:true,json:async()=>value});
let releaseOldFence,releaseOldLocal,failOldEnable,releaseTransport,holdTransport=false,subscription;
let sharedTransport=Promise.resolve();
const locks={request:(_name,operation)=>{const result=sharedTransport.catch(()=>undefined).then(operation);sharedTransport=result.catch(()=>undefined);return result;}};
const newSubscription=()=>({options:{},unsubscribe:async()=>{if(holdTransport){holdTransport=false;await new Promise(resolve=>{releaseTransport=resolve;});}subscription=null;return true;},toJSON:()=>({endpoint:'synthetic-endpoint',keys:{}})});
subscription=newSubscription();
const registration={active:true,getNotifications:async()=>[],pushManager:{getSubscription:async()=>subscription,subscribe:async()=>subscription=newSubscription()}};
function client(tab,{delayFence=false,delayLocal=false,delaySubscribe=false,withLocks=false}={}){
 let delayed=false,localDelayed=false,subscribeDelayed=false;
 const fetch=async(_url,init)=>{
  const body=JSON.parse(init.body);
  if(body.action==='installation'){
   if(delayFence&&!delayed){delayed=true;return new Promise(resolve=>{releaseOldFence=()=>resolve(response({epoch:server.epoch,revision:server.revision}));});}
   return response({epoch:server.epoch,revision:server.revision});
  }
  calls.push({tab,action:body.action,revision:body.intentRevision});
  if(body.action==='subscribe'&&delaySubscribe&&!subscribeDelayed){subscribeDelayed=true;return new Promise(resolve=>{failOldEnable=()=>resolve({ok:false,json:async()=>({error:'Synthetic old enable failure'})});});}
  if(body.intentRevision<server.revision||body.intentRevision===server.revision&&body.intentId!==server.intentId||body.expectedEpoch!==server.epoch)return {ok:false,json:async()=>({error:'Synthetic stale intent',code:'push_state_changed'})};
  Object.assign(server,{revision:body.intentRevision,intentId:body.intentId,enabled:body.action==='subscribe'});
  return response({epoch:server.epoch,id:'synthetic'});
 };
 const module={exports:{}};
 const context={module,exports:module.exports,require:name=>name==='@capacitor/core'?{Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'}}:name==='./supabase'?{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:owner,is_anonymous:false},access_token:'synthetic'}}})}}}:name==='./pushContracts'?contracts:(()=>{throw Error(name)})(),localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)},crypto:{randomUUID,getRandomValues:array=>webcrypto.getRandomValues(array)},window:{isSecureContext:true,PushManager:function(){},Notification:{},dispatchEvent:()=>true},Notification:{permission:'granted'},navigator:{...(withLocks?{locks}:{}),userAgent:'Chrome',serviceWorker:{getRegistration:async()=>{if(delayLocal&&!localDelayed){localDelayed=true;return new Promise(resolve=>{releaseOldLocal=()=>resolve(registration);});}return registration;},register:async()=>registration}},fetch,AbortSignal,Event,CustomEvent:class{},atob,btoa,setTimeout,clearTimeout};
 vm.runInNewContext(source,context);return module.exports;
}
const oldTab=client('old-tab',{delayFence:true}),newTab=client('new-tab');
const pending=oldTab.disablePush(owner,'synthetic');
for(let n=0;n<100&&!releaseOldFence;n++)await Promise.resolve();
if(!releaseOldFence)throw Error('Old tab did not reach fence read');
await newTab.enablePush(owner,{web:{ready:true,publicKey:'BA'},apns:{ready:false},android:{ready:false}});
const before={serverEnabled:server.enabled,localEnabled:JSON.parse(records.get(key)).enabled};
releaseOldFence();await pending;
assert.equal(before.serverEnabled,true);assert.equal(server.enabled,true,'an old tab must not promote its disable over a newer tab intent');assert.equal(JSON.parse(records.get(key)).enabled,true);assert.equal(calls.filter(call=>call.tab==='old-tab').length,0);
// A failed Enable in a different tab cannot allocate cleanup after the new tab succeeds.
records.set(key,JSON.stringify(initial));Object.assign(server,{revision:10,intentId:initial.intentId,enabled:true,epoch});
const failedTab=client('old-enable',{delaySubscribe:true}),enabledTab=client('new-enable');
const failed=failedTab.enablePush(owner,{web:{ready:true,publicKey:'BA'},apns:{ready:false},android:{ready:false}}).catch(error=>error);
await reached(()=>failOldEnable);await enabledTab.enablePush(owner,{web:{ready:true,publicKey:'BA'},apns:{ready:false},android:{ready:false}});failOldEnable();await failed;
assert.equal(server.enabled,true);assert.equal(JSON.parse(records.get(key)).enabled,true);assert.equal(calls.filter(call=>call.tab==='old-enable'&&call.action==='unsubscribe').length,0);
// Without Web Locks, recheck the shared intent after asynchronous local subscription reads.
records.set(key,JSON.stringify(initial));Object.assign(server,{revision:10,intentId:initial.intentId,enabled:true,epoch});subscription=newSubscription();
const delayedLocalTab=client('old-local',{delayLocal:true}),newLocalTab=client('new-local');
const localOff=delayedLocalTab.disablePush(owner,'synthetic');await reached(()=>releaseOldLocal);
await newLocalTab.enablePush(owner,{web:{ready:true,publicKey:'BA'},apns:{ready:false},android:{ready:false}});releaseOldLocal();await localOff;
assert.equal(server.enabled,true);assert.equal(JSON.parse(records.get(key)).enabled,true);assert.ok(subscription,'old tab local unsubscribe cannot remove the new transport');
// When a local unsubscribe is already in flight, origin-wide Web Locks order the newer registration after it.
records.set(key,JSON.stringify(initial));Object.assign(server,{revision:10,intentId:initial.intentId,enabled:true,epoch});subscription=newSubscription();holdTransport=true;
const lockedOld=client('locked-old',{withLocks:true}),lockedNew=client('locked-new',{withLocks:true});
const lockedOff=lockedOld.disablePush(owner,'synthetic');await reached(()=>releaseTransport);
let newerFinished=false;const lockedOn=lockedNew.enablePush(owner,{web:{ready:true,publicKey:'BA'},apns:{ready:false},android:{ready:false}}).then(()=>{newerFinished=true;});
for(let n=0;n<30;n++)await Promise.resolve();assert.equal(newerFinished,false,'new transport waits for cross-tab local unsubscribe');
releaseTransport();await Promise.all([lockedOff,lockedOn]);assert.equal(server.enabled,true);assert.equal(JSON.parse(records.get(key)).enabled,true);assert.ok(subscription);



}
console.log('Push client lifecycle passed: account changes, serialized transports, same-owner mutations, delayed DB commits after HTTP deadlines, stale cleanup, first-registration cancellation and shared-tab intent fencing. Synthetic I/O only.');
