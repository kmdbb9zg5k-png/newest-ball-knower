import assert from 'node:assert/strict';
import {build} from 'esbuild';
const modules={
  '@supabase/supabase-js':'export const createClient=()=>null;',
  '@capacitor/core':'export const Capacitor={isNativePlatform:()=>false};',
  './cloudSyncCoordinator':'export const flushAllCloudStateBeforeIdentityChange=async()=>{};',
};
const result=await build({entryPoints:['supabase.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'auth-transport-test',setup(build){
  build.onResolve({filter:/.*/},args=>modules[args.path]?{path:args.path,namespace:'mock'}:undefined);
  build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:modules[args.path],loader:'ts'}));
}}]});
const {resilientSupabaseFetch}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const originalFetch=globalThis.fetch,originalTimeout=globalThis.setTimeout;
let calls=0;const delays=[];
try {
  globalThis.setTimeout=(callback,delay,...args)=>{delays.push(delay);return originalTimeout(callback,0,...args);};
  globalThis.fetch=async(_url,options)=>{calls++;return new Promise((_,reject)=>{
    const abort=()=>reject(new DOMException('Aborted','AbortError'));
    if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
  });};
  await assert.rejects(()=>resilientSupabaseFetch('https://gpnboygoosrmeydwjpvk.supabase.co/auth/v1/signup',{method:'POST'}),/Aborted/);
  assert.equal(calls,1,'Timed-out authentication writes must never be automatically retried');
  assert.deepEqual(delays,[15000],'Anonymous bootstrap authentication must have a bounded timeout');
  calls=0;delays.length=0;
  await assert.rejects(()=>resilientSupabaseFetch('https://gpnboygoosrmeydwjpvk.supabase.co/rest/v1/table'),/Aborted/);
  assert.equal(calls,3,'Read retry policy must remain intact');
  assert.deepEqual(delays.filter(ms=>ms>=8000),[8000,8000,8000]);
  calls=0;delays.length=0;
  const controller=new AbortController();
  globalThis.fetch=async(_url,options)=>{calls++;assert.equal(options.signal,controller.signal,'State-write abort signal must pass through');return new Response('{}',{status:200});};
  await resilientSupabaseFetch('https://gpnboygoosrmeydwjpvk.supabase.co/rest/v1/table',{method:'POST',signal:controller.signal});
  assert.equal(calls,1);assert.deepEqual(delays,[],'Do not impose auth timeouts on storage uploads or other writes');
} finally {globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimeout;}
console.log('PASS: auth writes abort without retry, read retries stay bounded, and caller write/upload signals are preserved.');
