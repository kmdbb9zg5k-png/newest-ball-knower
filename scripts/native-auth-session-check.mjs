import assert from 'node:assert/strict';
import { build } from 'esbuild';

const state={platform:'ios',callback:'ballknower://auth/callback?code=test-code',error:null,calls:[],listeners:{},exchangeError:null};
globalThis.__nativeAuthTest=state;
globalThis.window={dispatchEvent:event=>state.calls.push(['event',event.detail?.status||event.type]),location:{reload:()=>state.calls.push(['reload'])}};
const bundled=await build({entryPoints:['nativeAuth.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{
 name:'auth-boundaries',setup(b){
  b.onResolve({filter:/^@capacitor\/(app|browser|core)$|^@ball-knower\/native-auth-session$|^\.\/supabase$/},args=>({path:args.path,namespace:'auth-test'}));
  b.onLoad({filter:/.*/,namespace:'auth-test'},({path})=>({loader:'js',contents:`const s=globalThis.__nativeAuthTest; ${
   path==='@capacitor/core'?`export const Capacitor={isNativePlatform:()=>s.platform!=='web',getPlatform:()=>s.platform};`:
   path==='@capacitor/app'?`export const App={addListener:async(name,fn)=>{if(s.listenerError===name)throw Error('listener failed');s.listeners[name]=fn;return{remove:async()=>{delete s.listeners[name];s.removals=(s.removals||0)+1}}},getLaunchUrl:async()=>null};`:
   path==='@capacitor/browser'?`export const Browser={open:async options=>{s.calls.push(['browser',options])},close:async()=>{s.calls.push(['close'])},addListener:async(name,fn)=>{s.listeners[name]=fn;return{remove:async()=>{delete s.listeners[name];s.removals=(s.removals||0)+1}}}};`:
   path==='@ball-knower/native-auth-session'?`export const NativeAuthSession={authenticate:async options=>{s.calls.push(['auth-session',options]);if(s.error)throw s.error;return {url:s.callback}},authorizeAppleForDeletion:async options=>{s.calls.push(['apple-deletion',options]);if(s.deletionError)throw s.deletionError;return{authorizationCode:'one-use-apple-code',user:'linked-apple-user'}}};`:
   `export const supabase={auth:{exchangeCodeForSession:async code=>{s.calls.push(['exchange',code]);if(s.exchangeWait)await s.exchangeWait;return {error:s.exchangeError}},setSession:async session=>{s.calls.push(['session',session]);return {error:null}},startAutoRefresh:()=>s.calls.push(['refresh-start']),stopAutoRefresh:()=>s.calls.push(['refresh-stop'])}};`
  }`}));
 }
}]});
const auth=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const authorizeUrl='https://gpnboygoosrmeydwjpvk.supabase.co/auth/v1/authorize?provider=apple';
await auth.initializeNativeAuthCallback();
assert.equal(await auth.openNativeAuthUrl(authorizeUrl),true);
assert.deepEqual(state.calls.map(c=>c[0]),['auth-session','exchange','reload']);
assert.equal(state.calls[1][1],'test-code');
for(const invalid of ['ballknower://auth/callback-evil?code=x','ballknower://auth.evil/callback?code=x','ballknower://user@auth/callback?code=x','ballknower://auth:123/callback?code=x','https://auth/callback?code=x','not a URL','ballknower://auth/callback#error=access_denied','ballknower://auth/callback']){
 state.calls=[];state.callback=invalid;
 await assert.rejects(auth.openNativeAuthUrl(authorizeUrl));
 assert.deepEqual(state.calls.map(c=>c[0]),['auth-session']);
}
state.callback='ballknower://auth/callback?code=bad';state.exchangeError=new Error('expired');state.calls=[];
await assert.rejects(auth.openNativeAuthUrl(authorizeUrl));
assert.ok(!state.calls.some(c=>c[0]==='reload'));
state.exchangeError=null;state.error={code:'AUTH_CANCELLED'};state.calls=[];
assert.equal(await auth.openNativeAuthUrl(authorizeUrl),false);
assert.deepEqual(state.calls.map(c=>c[0]),['auth-session','event']);
assert.equal(state.calls[1][1],'cancelled');
state.error={code:'AUTH_START_FAILED'};state.calls=[];
await assert.rejects(auth.openNativeAuthUrl(authorizeUrl));
state.error=null;state.callback='ballknower://auth/callback#access_token=test-access&refresh_token=test-refresh';state.calls=[];
await assert.rejects(auth.openNativeAuthUrl(authorizeUrl),/start sign-in again/);
assert.deepEqual(state.calls.map(c=>c[0]),['auth-session'],'Unbound implicit-token links cannot force a native account switch');
state.platform='android';state.calls=[];
assert.equal(await auth.openNativeAuthUrl(authorizeUrl),true);
assert.deepEqual(state.calls,[['browser',{url:authorizeUrl,presentationStyle:'fullscreen'}]]);
await assert.rejects(auth.openNativeAuthUrl(authorizeUrl),/already in progress/);
state.listeners.browserFinished();
assert.equal(state.calls.at(-1)[1],'cancelled');
await auth.openNativeAuthUrl(authorizeUrl);
state.listeners.appUrlOpen({url:'ballknower://auth/callback?code=android-code'});
await new Promise(resolve=>setImmediate(resolve));
assert.ok(state.calls.some(c=>c[0]==='exchange'&&c[1]==='android-code'));
assert.ok(state.calls.some(c=>c[0]==='close'));
// Native delivery and appUrlOpen can race for the same one-use PKCE code.
state.platform='ios';state.callback='ballknower://auth/callback?code=racing-code';state.calls=[];
let releaseExchange;state.exchangeWait=new Promise(resolve=>{releaseExchange=resolve});
const racing=auth.openNativeAuthUrl(authorizeUrl);
state.listeners.appUrlOpen({url:state.callback});state.listeners.appUrlOpen({url:state.callback});state.listeners.browserFinished();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(state.calls.filter(c=>c[0]==='exchange').length,1);
await assert.rejects(auth.openNativeAuthUrl(authorizeUrl),/already in progress/);
assert.ok(!state.calls.some(c=>c[0]==='event'&&c[1]==='cancelled'),'Browser dismissal during exchange is not cancellation');
releaseExchange();await racing;state.exchangeWait=null;
assert.equal(state.calls.filter(c=>c[0]==='reload').length,1,'Duplicate callback delivery causes only one account reload');
state.calls=[];state.listeners.appStateChange({isActive:false});state.listeners.appStateChange({isActive:true});
assert.deepEqual(state.calls,[['refresh-stop'],['refresh-start'],['event','ballknower:resume']]);
state.calls=[];const deletion=await auth.requestAppleDeletionAuthorization();
assert.equal(deletion.authorizationCode,'one-use-apple-code');assert.equal(deletion.nonce.length,64);
const {createHash}=await import('node:crypto');
assert.equal(state.calls[0][1].nonce,createHash('sha256').update(deletion.nonce).digest('hex'));
state.deletionError={code:'AUTH_CANCELLED'};await assert.rejects(auth.requestAppleDeletionAuthorization(),/cancelled/);state.deletionError=null;
// Partially installed listeners are cleaned up and initialization can retry.
state.listenerError='appStateChange';state.removals=0;
const retryAuth=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text+'\n// separate listener initialization').toString('base64')}`);
await assert.rejects(retryAuth.initializeNativeAuthCallback(),/listener failed/);assert.equal(state.removals,2);
state.listenerError=null;await retryAuth.initializeNativeAuthCallback();assert.equal(typeof state.listeners.appUrlOpen,'function');
state.platform='web';state.calls=[];
assert.equal(await auth.openNativeAuthUrl(authorizeUrl),false);
assert.deepEqual(state.calls,[]);
assert.equal(await auth.requestAppleDeletionAuthorization(),null);
console.log('Native auth behavior passed: iOS session/PKCE, cancellation/retry, strict callbacks, once-only duplicate delivery, lifecycle refresh, listener recovery, nonce-bound Apple deletion authorization, Android and web.');
