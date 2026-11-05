import assert from 'node:assert/strict';
import { build } from 'esbuild';

const key='ballknower_solo_my_player_v2',ownerKey='ballknower_cloud_owner_v1',ownerSave='ballknower_owner_career_v3';
const userA={id:'account-a',is_anonymous:false},userB={id:'account-b',is_anonymous:false};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const bundled=await build({entryPoints:['CloudSyncProvider.tsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'transform',plugins:[{name:'cloud-boundaries',setup(b){
 b.onResolve({filter:/^(react(?:\/jsx-runtime)?|lucide-react|\.\/supabase|\.\/accountIdentity|\.\/cloudSyncCoordinator|\.\/userStateCloud|\.\/AccountDeletionRecoveryNotice)$/},args=>({path:args.path,namespace:'cloud-test'}));
 b.onLoad({filter:/.*/,namespace:'cloud-test'},({path})=>({loader:'js',contents:`const s=globalThis.__cloudRecovery; ${
 path==='react'?`export const Fragment='fragment'; export const createElement=(type,props,...children)=>({type,props:{...props,children}}); export const createContext=value=>({Provider:'provider',value});export const useContext=c=>c.value;export const useState=initial=>{const i=s.cursor++;if(!(i in s.hooks))s.hooks[i]=typeof initial==='function'?initial():initial;return[s.hooks[i],value=>{s.hooks[i]=typeof value==='function'?value(s.hooks[i]):value}]};export const useRef=value=>{const i=s.cursor++;return s.hooks[i]??(s.hooks[i]={current:value})};export const useEffect=effect=>{const i=s.cursor++;if(!(i in s.hooks)){s.hooks[i]=true;s.effects.push(effect)}};export default {createElement,Fragment};`:
 path==='react/jsx-runtime'?`export const Fragment='fragment';export const jsx=(type,props)=>({type,props}),jsxs=jsx;`:
 path==='lucide-react'?`export const Cloud='cloud',CloudOff='off',Loader2='loading';`:
 path==='./AccountDeletionRecoveryNotice'?`export const AccountDeletionRecoveryNotice=()=>null;`:
 path==='./supabase'?`export const isCloudConfigured=true;export const ensureOnlineSession=()=>s.ensure();export const supabase={auth:{onAuthStateChange:fn=>{s.auth=fn;return{data:{subscription:{unsubscribe:()=>{s.unsubscribed=true}}}}}}};`:
 path==='./accountIdentity'?`export const hasPendingGuestAccountMerge=()=>s.pendingMerge;export const claimPendingGuestAccountMerge=()=>s.claim();`:
 path==='./cloudSyncCoordinator'?`export const cloudStateFingerprint=raw=>raw;export const registerFullCloudStateFlush=fn=>{s.flush=fn;return()=>{s.flush=null}};export const registerCloudStateCommitted=fn=>{s.committed=fn;return()=>{s.committed=null}};`:
 `export const AGENT_PENDING_RECRUIT_ACTION_KEY='pending-recruit',AGENT_PENDING_SIGNING_KEY='pending-signing';export const loadUserStates=(keys,user)=>{s.reads.push(user);return s.load()};export const saveUserStates=(rows,user)=>{s.writes.push({rows,user});return s.save(rows)};`
 }`}));
}}]});

function fixture(initial={},overrides={}){
 const storage=new Map(Object.entries(initial)),timers=new Map();let timerId=0;
 const s={hooks:[],cursor:0,effects:[],reads:[],writes:[],reloads:0,events:[],pendingMerge:false,ensure:async()=>userA,claim:async()=>{},load:async()=>[],save:async rows=>rows.map(row=>({state_key:row.stateKey,value:row.value,updated_at:new Date().toISOString()})),...overrides};
 globalThis.__cloudRecovery=s;
 globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
 const window=new EventTarget(),document=new EventTarget();document.visibilityState='visible';
 window.setInterval=fn=>{const id=++timerId;timers.set(id,{fn,interval:true});return id};
 window.setTimeout=fn=>{const id=++timerId;timers.set(id,{fn,interval:false});return id};
 window.clearTimeout=window.clearInterval=id=>timers.delete(id);window.location={reload:()=>s.reloads++};
 const dispatch=window.dispatchEvent.bind(window);window.dispatchEvent=event=>{s.events.push(event.type);return dispatch(event)};
 globalThis.window=window;globalThis.document=document;
 const module={exports:{}};new Function('module','exports','console',bundled.outputFiles[0].text)(module,module.exports,{...console,warn:()=>{}});
 const render=()=>{s.cursor=0;return module.exports.CloudSyncProvider({children:'active-game'})};
 render();const cleanup=s.effects.map(effect=>effect());
 return Object.assign(s,{storage,timers,render,window,document,tick:()=>{for(const[id,timer]of[...timers]){if(!timer.interval)timers.delete(id);timer.fn()}},cleanup:()=>cleanup.forEach(fn=>fn?.())});
}

// A failed first read must not turn absent saves into cloud tombstones.
{
 const f=fixture({[ownerKey]:userA.id});f.load=async()=>{throw new Error('offline fixture')};await settle();
 assert.equal(f.hooks[1],true,'Offline failure releases the playable local shell');f.tick();await settle();assert.equal(f.writes.length,0);
 const pull=deferred();f.load=()=>pull.promise;const before=f.reads.length;
 f.window.dispatchEvent(new Event('online'));f.window.dispatchEvent(new Event('focus'));f.window.dispatchEvent(new Event('ballknower:resume'));await settle();
 assert.equal(f.reads.length,before+1,'Reconnect bursts coalesce into one read');
 pull.resolve([{state_key:'solo_my_player_v2',value:{raw:'{"name":"cloud career"}'},updated_at:new Date().toISOString()}]);await settle();
 assert.equal(f.storage.has(key),false,'Late cloud hydration waits for explicit restore');assert.equal(f.hooks[3],true);assert.equal(f.writes.length,0);
 assert.equal(f.reloads,0,'Ordinary recovery never reloads active gameplay');f.cleanup();
}
// An offline local deletion remains a tombstone across a process restart.
{
 const now=Date.now(),f=fixture({[ownerKey]:userA.id,[`ballknower_cloud_meta_v1:${userA.id}`]:JSON.stringify({[key]:now})},{load:async()=>[{state_key:'solo_my_player_v2',value:{raw:'{"score":9}'},updated_at:new Date(now-5000).toISOString()}]});await settle();
 assert.equal(f.storage.has(key),false);assert.equal(f.writes.length,1);assert.equal(f.writes[0].rows.find(row=>row.stateKey==='solo_my_player_v2').value.raw,null);f.cleanup();
}
// Local choices made during hydration survive the late response.
{
 const f=fixture({[ownerKey]:userA.id,[key]:'{"score":1}'}),pull=deferred();f.load=()=>pull.promise;await settle();
 f.storage.set(key,'{"score":2}');pull.resolve([{state_key:'solo_my_player_v2',value:{raw:'{"score":9}'},updated_at:new Date().toISOString()}]);await settle();
 assert.equal(f.storage.get(key),'{"score":2}');assert.equal(f.writes.length,1);assert.equal(JSON.parse(f.writes[0].rows.find(row=>row.stateKey==='solo_my_player_v2').value.raw).score,2);f.cleanup();
}
// Losing session bootstrap never starts ownership-blind uploads.
{
 const pull=deferred(),f=fixture({[ownerKey]:userA.id},{load:()=>pull.promise});await settle();f.tick();await settle();
 assert.equal(f.hooks[1],true,'A stalled restore releases the local shell after its grace period');
 f.storage.set(key,'{"score":4}');pull.resolve([{state_key:'solo_my_player_v2',value:{raw:'{"score":20}'},updated_at:new Date().toISOString()}]);await settle();
 assert.equal(f.storage.get(key),'{"score":4}');assert.equal(JSON.parse(f.writes[0].rows.find(row=>row.stateKey==='solo_my_player_v2').value.raw).score,4);assert.equal(f.reloads,0);f.cleanup();
}
// Losing session bootstrap never starts ownership-blind uploads.
{
 const f=fixture({[ownerKey]:userA.id,[key]:'private account-a career'},{ensure:async()=>{throw new Error('auth offline')}});await settle();f.tick();await settle();
 assert.equal(f.writes.length,0);assert.equal(f.reads.length,0);
 f.ensure=async()=>userB;f.window.dispatchEvent(new Event('online'));await settle();
 assert.equal(f.storage.get(ownerKey),userB.id);assert.equal(f.storage.has(key),false);assert.equal(f.reloads,1);assert.equal(f.writes.length,0);f.cleanup();
}
// Capture the newest action on backgrounding, then retry its latest snapshot.
{
 const oldTime=Date.now()-5000,f=fixture({[ownerKey]:userA.id,[key]:'{"score":1}',[`ballknower_cloud_meta_v1:${userA.id}`]:JSON.stringify({[key]:oldTime})},{ensure:async()=>{throw new Error('auth offline')}});await settle();
 f.storage.set(key,'{"score":8}');f.tick();await settle();assert.equal(f.writes.length,0);
 const captured=JSON.parse(f.storage.get(`ballknower_cloud_meta_v1:${userA.id}`))[key];assert(captured>oldTime,'Offline Auth does not baseline away local progress');
 f.ensure=async()=>userA;f.load=async()=>[{state_key:'solo_my_player_v2',value:{raw:'{"score":1}'},updated_at:new Date(oldTime).toISOString()}];
 f.window.dispatchEvent(new Event('online'));await settle();assert.equal(f.storage.get(key),'{"score":8}');assert.equal(JSON.parse(f.writes[0].rows.find(row=>row.stateKey==='solo_my_player_v2').value.raw).score,8);f.cleanup();
}
// Capture the newest action on backgrounding, then retry its latest snapshot.
{
 const f=fixture({[ownerKey]:userA.id});await settle();const write=deferred();f.save=()=>write.promise;
 f.storage.set(key,'{"score":1}');f.document.visibilityState='hidden';f.document.dispatchEvent(new Event('visibilitychange'));await settle();
 assert.equal(f.writes.length,1);f.storage.set(key,'{"score":2}');f.tick();await settle();assert.equal(f.writes.length,1,'Only one upload runs at a time');
 write.resolve([{state_key:'solo_my_player_v2',value:{raw:'{"score":1}'},updated_at:new Date().toISOString()}]);await settle();f.save=async rows=>rows.map(row=>({state_key:row.stateKey,value:row.value,updated_at:new Date().toISOString()}));f.tick();await settle();
 assert.equal(JSON.parse(f.writes.at(-1).rows.find(row=>row.stateKey==='solo_my_player_v2').value.raw).score,2);assert.equal(f.reloads,0);f.cleanup();
}
// An old revisioned save response cannot restore data into a new account.
{
 const f=fixture({[ownerKey]:userA.id});await settle();const write=deferred();f.save=()=>write.promise;
 f.storage.set(ownerSave,'{"cloudRevision":0,"cash":10}');f.tick();await settle();assert.equal(f.writes.length,1);
 f.auth('SIGNED_IN',{user:userB});f.tick();await settle();f.storage.set(ownerSave,'{"cloudRevision":7,"cash":99}');
 write.resolve([{state_key:'owner_business_career_v1',value:{cloudRevision:1,cash:10},updated_at:new Date().toISOString()}]);await settle();
 assert.equal(f.storage.get(ownerSave),'{"cloudRevision":7,"cash":99}');assert.equal(f.storage.get(ownerKey),userB.id);assert.equal(f.events.includes('ballknower:owner-cloud-saved'),false);f.cleanup();
}
// Missing acknowledgments reject an identity flush rather than spinning forever.
{
 const f=fixture({[ownerKey]:userA.id});await settle();f.save=async()=>[];f.storage.set(key,'{"score":3}');
 await assert.rejects(f.flush(),/not confirmed/);assert.equal(f.storage.get(key),'{"score":3}');f.cleanup();
}
// StrictMode/unmount cleanup prevents delayed bootstrap work from writing.
{
 const session=deferred(),f=fixture({},{ensure:()=>session.promise});f.cleanup();session.resolve(userA);await settle();
 assert.equal(f.storage.has(ownerKey),false);assert.equal(f.reads.length,0);assert.equal(f.writes.length,0);assert.equal(f.timers.size,0);
}
console.log('PASS actual cloud provider: offline start, ownership gating, staged reconnect, delayed hydration, background capture, write coalescing, missing acknowledgments and stale-account/unmount isolation.');
