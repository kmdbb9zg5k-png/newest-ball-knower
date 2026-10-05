import assert from 'node:assert/strict';
import { build } from 'esbuild';

const state={platform:'ios',callback:'ballknower://auth/callback?code=test-code',error:null,calls:[],listeners:{},exchangeError:null};
globalThis.__nativeAuthTest=state;
globalThis.window={dispatchEvent:event=>state.calls.push(['event',event.detail.status]),location:{reload:()=>state.calls.push(['reload'])}};
const bundled=await build({entryPoints:['nativeAuth.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{
 name:'auth-boundaries',setup(b){
  b.onResolve({filter:/^@capacitor\/(app|browser|core)$|^@ball-knower\/native-auth-session$|^\.\/supabase$/},args=>({path:args.path,namespace:'auth-test'}));
  b.onLoad({filter:/.*/,namespace:'auth-test'},({path})=>({loader:'js',contents:`const s=globalThis.__nativeAuthTest; ${
   path==='@capacitor/core'?`export const Capacitor={isNativePlatform:()=>s.platform!=='web',getPlatform:()=>s.platform};`:
   path==='@capacitor/app'?`export const App={addListener:async(name,fn)=>{s.listeners[name]=fn},getLaunchUrl:async()=>null};`:
   path==='@capacitor/browser'?`export const Browser={open:async options=>{s.calls.push(['browser',options])},close:async()=>{s.calls.push(['close'])},addListener:async(name,fn)=>{s.listeners[name]=fn}};`:
   path==='@ball-knower/native-auth-session'?`export const NativeAuthSession={authenticate:async options=>{s.calls.push(['auth-session',options]);if(s.error)throw s.error;return {url:s.callback}}};`:
   `export const supabase={auth:{exchangeCodeForSession:async code=>{s.calls.push(['exchange',code]);return {error:s.exchangeError}},setSession:async session=>{s.calls.push(['session',session]);return {error:null}}}};`
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
await auth.openNativeAuthUrl(authorizeUrl);
assert.deepEqual(state.calls.map(c=>c[0]),['auth-session','session','reload']);
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
state.platform='web';state.calls=[];
assert.equal(await auth.openNativeAuthUrl(authorizeUrl),false);
assert.deepEqual(state.calls,[]);
console.log('Native auth behavior passed: iOS session/PKCE, cancellation/retry, provider errors, strict callbacks, legacy email tokens, Android and web.');
