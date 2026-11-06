import assert from 'node:assert/strict';
import { build } from 'esbuild';

const storage=new Map(),state={};globalThis.__deletionClientTest=state;
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
globalThis.window={dispatchEvent:()=>true};
const bundled=await build({entryPoints:['supabase.ts'],bundle:true,write:false,format:'cjs',platform:'node',logOverride:{'empty-import-meta':'silent'},plugins:[{name:'deletion-client-boundaries',setup(b){
 b.onResolve({filter:/^@supabase\/supabase-js$|^@capacitor\/core$|^\.\/cloudSyncCoordinator$|^\.\/nativeAuth$/},args=>({path:args.path,namespace:'deletion-client'}));
 b.onLoad({filter:/.*/,namespace:'deletion-client'},({path})=>({loader:'js',contents:`const s=globalThis.__deletionClientTest; ${
 path==='@capacitor/core'?`export const Capacitor={isNativePlatform:()=>false};`:
 path==='./cloudSyncCoordinator'?`export const flushAllCloudStateBeforeIdentityChange=async()=>{s.calls.push('flush');if(s.switchDuringFlush)s.session={user:{id:'account-b',app_metadata:{},identities:[]},access_token:'token-b'}};`:
 path==='./nativeAuth'?`export const requestAppleDeletionAuthorization=async()=>{s.calls.push('apple-reauthorization');if(s.switchDuringApple)s.session={user:{id:'account-b',app_metadata:{},identities:[]},access_token:'token-b'};return{authorizationCode:'one-use-code',nonce:'a'.repeat(64),user:'apple-a'}};`:
 `export const createClient=()=>({auth:{getSession:async()=>({data:{session:s.session},error:null}),signOut:async()=>{s.calls.push('sign-out');s.noticeBeforeSignOut=localStorage.getItem('ballknower_account_deletion_followup_v1');return{error:null}}}});`
 }`}));
}}]});
const module={exports:{}};new Function('module','exports',bundled.outputFiles[0].text)(module,module.exports);const api=module.exports;
function reset(){storage.clear();Object.assign(state,{calls:[],switchDuringFlush:false,switchDuringApple:false,switchDuringRequest:false,fetchError:false,session:{user:{id:'account-a',app_metadata:{providers:['apple']},identities:[{provider:'apple'}]},access_token:'token-a'},response:{ok:true,appleAuthorizationRevoked:false,manualAppleRevokeRequired:true},status:200,noticeBeforeSignOut:null});}
const originalFetch=globalThis.fetch;
globalThis.fetch=async(_url,init)=>{state.calls.push('request');if(state.fetchError)throw new Error('unknown commit');state.body=JSON.parse(init.body);state.authorization=new Headers(init.headers).get('Authorization');if(state.switchDuringRequest)state.session={user:{id:'account-b',app_metadata:{},identities:[]},access_token:'token-b'};return new Response(JSON.stringify(state.response),{status:state.status});};
try{
 reset();const result=await api.deleteBallKnowerAccount('account-a');assert.equal(result.manualAppleRevokeRequired,true);assert.deepEqual(state.calls,['flush','apple-reauthorization','request','sign-out']);assert.equal(state.noticeBeforeSignOut,'apple_removal_required','The Apple follow-up survives the deliberate account reload');assert.equal(state.authorization,'Bearer token-a');assert.equal(state.body.appleAuthorization.authorizationCode,'one-use-code');
 reset();state.switchDuringFlush=true;await assert.rejects(api.deleteBallKnowerAccount('account-a'),/account changed/);assert.deepEqual(state.calls,['flush'],'Confirmation cannot silently switch its target while cloud flushing');
 reset();state.switchDuringApple=true;await assert.rejects(api.deleteBallKnowerAccount('account-a'),/account changed/);assert(!state.calls.includes('request'));
 reset();state.switchDuringRequest=true;const changed=await api.deleteBallKnowerAccount('account-a');assert.equal(changed.sessionChanged,true);assert(!state.calls.includes('sign-out'),'Completing an older authorized deletion cannot sign out the new account');assert.equal(state.authorization,'Bearer token-a');
 reset();await assert.rejects(api.deleteBallKnowerAccount('account-b'),/account changed/);assert.equal(state.calls.length,0);
 reset();state.response={};await assert.rejects(api.deleteBallKnowerAccount('account-a'),/could not be confirmed/);assert(!state.calls.includes('sign-out'));assert.equal(storage.size,0,'An unconfirmed response cannot show a deletion-complete notice');
 reset();state.fetchError=true;await assert.rejects(api.deleteBallKnowerAccount('account-a'),/could not be confirmed/);assert.equal(state.calls.filter(call=>call==='request').length,1,'An uncertain deletion request never retries automatically');assert(!state.calls.includes('sign-out'));
 reset();state.response={ok:true,appleAuthorizationRevoked:false,manualAppleRevokeRequired:false};assert.equal((await api.deleteBallKnowerAccount('account-a')).manualAppleRevokeRequired,true,'Missing or contradictory Apple status never means revoked');
 reset();state.response={ok:true,appleAuthorizationRevoked:true,manualAppleRevokeRequired:false};assert.equal((await api.deleteBallKnowerAccount('account-a')).manualAppleRevokeRequired,false);assert.equal(storage.size,0);
}finally{globalThis.fetch=originalFetch;}
console.log('PASS actual account-deletion client: confirmation owner, account-switch refusal, one-use native authorization, persistent Apple follow-up before reload and truthful completion status.');
