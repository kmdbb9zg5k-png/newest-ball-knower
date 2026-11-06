import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=process.argv[2]||process.cwd();
const require=createRequire(root+'/package.json');
const {transformSync}=require('esbuild');
const contracts=await import(pathToFileURL(root+'/pushContracts.ts').href);
const source=transformSync(readFileSync(root+'/pushClient.ts','utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
const ownerA='11111111-1111-4111-8111-111111111111',ownerB='22222222-2222-4222-8222-222222222222',key='ballknower_push_installation_v1';
const readiness={web:{ready:true,publicKey:'BA'},apns:{ready:false},android:{ready:false}};
const response=(ok=true)=>({ok,json:async()=>ok?{ok:true}:{error:'Synthetic old request failure'}});
function runtime({delayUnsubscribe=false,delayRegistration=false,delayFirstSubscribe=false}={}){
  const records=new Map([[key,JSON.stringify({installationId:'33333333-3333-4333-8333-333333333333',installationSecret:'a'.repeat(43),ownerId:ownerA,enabled:true})]]);
  let current={user:{id:ownerA,is_anonymous:false},access_token:'synthetic_A'},activeSubscription,serverEnabled=true,subscribeCalls=0;
  const gates={};
  const createSubscription=()=>({options:{},unsubscribe:async()=>{activeSubscription=null;return true;},toJSON:()=>({endpoint:'synthetic-endpoint',keys:{}})});
  activeSubscription=createSubscription();
  const registration={active:true,pushManager:{getSubscription:async()=>activeSubscription,subscribe:async()=>activeSubscription=createSubscription()},getNotifications:async()=>[]};
  const fakeSupabase={auth:{getSession:async()=>({data:{session:current}})}};
  const apiFetch=async(_url,init)=>{
    const body=JSON.parse(init.body);
    if(body.action==='unsubscribe'){
      if(delayUnsubscribe)return new Promise(resolve=>{gates.releaseUnsubscribe=()=>{serverEnabled=false;resolve(response());};});
      serverEnabled=false;return response();
    }
    if(body.action==='subscribe'){
      if(delayFirstSubscribe&&++subscribeCalls===1)return new Promise(resolve=>{gates.failFirstSubscribe=()=>resolve(response(false));});
      serverEnabled=true;
    }
    return response();
  };
  const module={exports:{}};
  const context={module,exports:module.exports,require:name=>name==='@capacitor/core'?{Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'}}:name==='./supabase'?{supabase:fakeSupabase}:name==='./pushContracts'?contracts:(()=>{throw Error(name)})(),localStorage:{getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,v)},window:{isSecureContext:true,PushManager:function(){},Notification:{},dispatchEvent:()=>true},Notification:{permission:'granted'},navigator:{userAgent:'Chrome',serviceWorker:{getRegistration:async()=>delayRegistration?new Promise(resolve=>{gates.releaseRegistration=()=>resolve(registration);}):registration,register:async()=>registration}},fetch:apiFetch,AbortSignal,Event,CustomEvent:class{},atob,btoa,setTimeout,clearTimeout};
  vm.runInNewContext(source,context);
  return {api:module.exports,gates,setOwner:id=>current={user:{id,is_anonymous:false},access_token:'synthetic_'+id},state:()=>({installation:JSON.parse(records.get(key)),subscribed:!!activeSubscription,serverEnabled})};
}
async function reached(predicate){for(let n=0;n<100&&!predicate();n++)await Promise.resolve();assert.ok(predicate(),'Test did not reach deferred boundary');}
// Exercise actual transpiled client code with synthetic browser I/O, no browser or provider sends.
const observed=[];
{
 const h=runtime({delayUnsubscribe:true}),old=h.api.disablePush(ownerA,'synthetic_A');
 await reached(()=>h.gates.releaseUnsubscribe);h.setOwner(ownerB);await h.api.enablePush(ownerB,readiness);
 const before=h.state();h.gates.releaseUnsubscribe();await old;const after=h.state();
 assert.equal(after.installation.ownerId,ownerB);assert.equal(after.installation.enabled,true);
 observed.push({case:'late old disable HTTP result',before:{owner:before.installation.ownerId,enabled:before.installation.enabled},after:{owner:after.installation.ownerId,enabled:after.installation.enabled}});
}
{
 const h=runtime({delayRegistration:true}),old=h.api.disablePush(ownerA,'synthetic_A');
 await reached(()=>h.gates.releaseRegistration);h.setOwner(ownerB);const next=h.api.enablePush(ownerB,readiness);
 const before=h.state();h.gates.releaseRegistration();await Promise.all([old,next]);const after=h.state();
 assert.equal(after.installation.ownerId,ownerB);assert.equal(after.installation.enabled,true);assert.equal(after.subscribed,true);
 observed.push({case:'late old disable local transport',before:{owner:before.installation.ownerId,enabled:before.installation.enabled,subscribed:before.subscribed},after:{owner:after.installation.ownerId,enabled:after.installation.enabled,subscribed:after.subscribed}});
}
{
 const h=runtime({delayFirstSubscribe:true}),old=h.api.enablePush(ownerA,readiness).catch(error=>error);
 await reached(()=>h.gates.failFirstSubscribe);await h.api.enablePush(ownerA,readiness);
 const before=h.state();h.gates.failFirstSubscribe();await old;const after=h.state();
 assert.equal(after.installation.enabled,true);assert.equal(after.serverEnabled,true);
 observed.push({case:'late old enable cleanup, same owner',before:{enabled:before.installation.enabled,serverEnabled:before.serverEnabled},after:{enabled:after.installation.enabled,serverEnabled:after.serverEnabled}});
}
console.log('Push client lifecycle passed: late old-account HTTP results, serialized local transports and stale same-owner enable cleanup preserve the newer opt-in. Synthetic I/O only.');
