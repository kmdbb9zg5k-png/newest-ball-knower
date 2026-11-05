import assert from 'node:assert/strict';
import { build } from 'esbuild';

const state={user:{id:'account-a'},session:{user:{id:'account-a'},access_token:'token-a'},calls:[]};
globalThis.__userStateAccountTest=state;
const bundled=await build({entryPoints:['userStateCloud.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'account-boundaries',setup(b){
 b.onResolve({filter:/^\.\/supabase$/},args=>({path:args.path,namespace:'account-test'}));
 b.onLoad({filter:/.*/,namespace:'account-test'},()=>({loader:'js',contents:`const s=globalThis.__userStateAccountTest;
 export const ensureOnlineSession=async()=>s.user;
 function builder(kind,payload){const call={kind,payload,headers:{},filters:[]};const b={select:()=>b,in:()=>b,eq:(...filter)=>{call.filters.push(filter);return b},maybeSingle:()=>b,order:()=>b,setHeader:(name,value)=>{call.headers[name]=value;return b},then:resolve=>{s.calls.push(call);if(s.switchAfterFirst&&s.calls.length===1)s.session={user:{id:'account-b'},access_token:'token-b'};return Promise.resolve({data:[],error:null}).then(resolve)}};return b}
 export const supabase={auth:{getSession:async()=>({data:{session:s.session},error:null})},from:table=>({select:()=>builder('read',table),upsert:rows=>builder('upsert',rows)}),rpc:(name,args)=>builder(name,args)};`}));
}}]});
const module={exports:{}};new Function('module','exports',bundled.outputFiles[0].text)(module,module.exports);const api=module.exports;
state.switchAfterFirst=true;
await api.saveUserStates([{stateKey:'solo_career',value:{raw:'a'}},{stateKey:'owner_business_career_v1',value:{cloudRevision:0}}],'account-a');
assert.equal(state.calls.length,2);
for(const call of state.calls)assert.equal(call.headers.Authorization,'Bearer token-a','A batch cannot adopt another account token between regular and revisioned saves');
assert.equal(state.calls[0].payload[0].user_id,'account-a');
state.calls=[];state.user={id:'account-b'};
await assert.rejects(api.saveUserStates([{stateKey:'solo_career',value:{raw:'a'}}],'account-a'),/account changed/);
await assert.rejects(api.loadUserStates(['solo_career'],'account-a'),/account changed/);
assert.equal(state.calls.length,0,'A mismatched owner cannot dispatch any save or restore');
state.user={id:'account-a'};state.session={user:{id:'account-a'},access_token:'token-a'};state.switchAfterFirst=false;
await api.loadUserStates(['solo_career'],'account-a');
assert.deepEqual(state.calls[0].filters,[['user_id','account-a']]);
assert.equal(state.calls[0].headers.Authorization,'Bearer token-a');
console.log('PASS actual user-state client: explicit read owner, pinned bearer across batched/Owner writes and rejected cross-account requests.');
