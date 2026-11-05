import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build, transformSync } from 'esbuild';
import { loadGauntletProgress, mergeGauntletProgress, mergeGauntletProgressEvents, compactGauntletProgressForCloud } from '../gauntletEngine.ts';

const empty={xp:0,level:1,currentStreak:0,longestStreak:0,totalCorrect:0,totalAnswered:0,highScores:{},daily:{}};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return{promise,resolve}};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
// Run the actual queued merge callback from ChallengesHub. A late read is
// intentionally returned even after switching; the caller must still refuse it.
const source=readFileSync('ChallengesHub.tsx','utf8');
const callback=source.slice(source.indexOf('  const applyProgress=useCallback('),source.indexOf('  useEffect(()=>{const local=loadGauntletProgress'))+'\nglobalThis.apply=applyProgress;';
for(const switchAccount of [false,true]){
 const read=deferred(),calls=[],progressOwnerRef={current:'account-a'};let current='account-a';
 const context=vm.createContext({userId:'account-a',progressOwnerRef,progressCloudQueueRef:{current:Promise.resolve()},useCallback:fn=>fn,loadGauntletProgress:()=>empty,mergeGauntletProgress,mergeGauntletProgressEvents,compactGauntletProgressForCloud,setProgress:()=>{},saveGauntletProgress:()=>{},assertUserStateAccount:async expected=>{assert.equal(expected,current,'account changed')},saveGauntletProgressEvents:async(_events,expected)=>{calls.push(['events',expected]);assert.equal(expected,current)},loadUserState:async(_key,expected)=>{calls.push(['read',expected]);return read.promise},loadGauntletProgressEvents:async expected=>{calls.push(['event-read',expected]);await read.promise;return[]},saveUserState:async(_key,_value,expected)=>{calls.push(['save',expected]);assert.equal(expected,current)},console:{warn:()=>{}}});
 vm.runInContext(transformSync(callback,{loader:'ts',format:'cjs'}).code,context);context.apply(empty);await settle();
 if(switchAccount){current='account-b';progressOwnerRef.current=current;}
 read.resolve(empty);await context.progressCloudQueueRef.current;
 assert.equal(calls.filter(call=>call[0]==='save').length,switchAccount?0:1,'A delayed Gauntlet merge cannot write A progress to B');
 for(const call of calls)assert.equal(call[1],'account-a');
}

const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
const state={};globalThis.__guestClaimBoundary=state;
const bundle=await build({entryPoints:['accountIdentity.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'guest-claim-boundaries',setup(b){
 b.onResolve({filter:/^\.\/(supabase|userStateCloud|nativeAuth|cloudSyncCoordinator)$/},args=>({path:args.path,namespace:'claim-test'}));
 b.onLoad({filter:/.*/,namespace:'claim-test'},({path})=>({loader:'js',contents:`const s=globalThis.__guestClaimBoundary; ${
 path==='./supabase'?`export const ensureOnlineSession=async()=>s.user;export const supabase={rpc:(name,args)=>({setHeader:(header,value)=>{s.calls.push(['rpc',value]);return Promise.resolve({data:{guest_user_id:'guest-a',guest_gauntlet_v2:null,guest_gauntlet_v1:null},error:null})}})};`:
 path==='./cloudSyncCoordinator'?`export const flushAllCloudStateBeforeIdentityChange=async()=>{};`:
 path==='./nativeAuth'?`export const ballKnowerAuthRedirect=()=>'',isNativeBallKnower=()=>false,openNativeAuthUrl=async()=>false;`:
 `export const assertUserStateAccount=async expected=>{if(expected!==s.user.id)throw Error('account changed');return{access_token:'token-'+expected}};export const loadUserState=async(key,expected)=>{s.calls.push(['read',expected]);return s.read.promise};export const loadGauntletProgressEvents=async expected=>{s.calls.push(['events',expected]);await s.read.promise;return[]};export const saveUserState=async(key,value,expected)=>s.calls.push(['save',expected]);export const saveGauntletProgressEvents=async()=>{};export const flushPendingUserStateWrites=async()=>{};`
 }`}));
}}]});
const module={exports:{}};new Function('module','exports',bundle.outputFiles[0].text)(module,module.exports);
for(const switchAccount of [false,true]){
 storage.clear();storage.set('ballknower_pending_guest_merge_v1',JSON.stringify({token:'synthetic-claim',guestUserId:'guest-a',preparedAt:Date.now()}));
 Object.assign(state,{calls:[],user:{id:'account-a',is_anonymous:false},read:deferred()});
 const claim=module.exports.claimPendingGuestAccountMerge(state.user);await settle();
 if(switchAccount)state.user={id:'account-b',is_anonymous:false};state.read.resolve(empty);
 if(switchAccount)await assert.rejects(claim,/account changed/);else await claim;
 assert.equal(state.calls.filter(call=>call[0]==='save').length,switchAccount?0:1);
 assert.equal(state.calls[0][1],'Bearer token-account-a','The claim RPC stays bound to its initiating account');
 if(switchAccount)assert(storage.has('ballknower_pending_guest_merge_v1'),'An interrupted claim retains its retry/recovery receipt');
}
console.log('PASS actual Gauntlet queue and guest claim flow: expected owner propagated through deferred reads/writes, pinned claim token and no late A-to-B progress writes.');
