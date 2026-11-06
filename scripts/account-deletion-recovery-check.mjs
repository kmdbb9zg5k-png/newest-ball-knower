import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { build } from 'esbuild';

// Actual API + actual JWS verifier, with synthetic Apple keys and all external
// services replaced. No real account, provider token or deletion is used.
const appleKey=generateKeyPairSync('rsa',{modulusLength:2048});
const wrongKey=generateKeyPairSync('rsa',{modulusLength:2048});
const clientKey=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const originalEnv={...process.env},originalFetch=globalThis.fetch,originalTimeout=AbortSignal.timeout;
Object.assign(process.env,{SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key',APPLE_OAUTH_CLIENT_ID:'web-service',APPLE_NATIVE_CLIENT_ID:'com.ballknower.ios',APPLE_TEAM_ID:'synthetic-team',APPLE_KEY_ID:'synthetic-key',APPLE_PRIVATE_KEY:clientKey.privateKey.export({format:'pem',type:'pkcs8'}).toString()});
const state={};globalThis.__deletionTest=state;
const bundled=await build({entryPoints:['api/account-delete.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'account-deletion-services',setup(b){
 b.onResolve({filter:/^@supabase\/supabase-js$/},args=>({path:args.path,namespace:'deletion-test'}));
 b.onLoad({filter:/.*/,namespace:'deletion-test'},()=>({loader:'js',contents:`const s=globalThis.__deletionTest;export const createClient=()=>({
 auth:{getUser:async()=>({data:{user:s.user},error:s.authError}),admin:{signOut:async(token,scope)=>{s.calls.push(['sign-out',token,scope]);return{error:s.signOutError}},deleteUser:async id=>{s.calls.push(['delete-user',id]);return{error:null}}}},
 storage:{from:()=>({
  list:async(prefix,options)=>{
   s.calls.push(['avatar-list',prefix]);const base=prefix===s.user.id?'':prefix.slice(s.user.id.length+1)+'/';const entries=new Map();
   for(const file of s.avatars){if(!file.startsWith(base))continue;const rest=file.slice(base.length),name=rest.split('/')[0];entries.set(name,{id:rest.includes('/')?null:name,name});}
   return{data:[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(options.offset||0,(options.offset||0)+options.limit),error:null};
  },
  remove:async paths=>{s.calls.push(['avatar-remove',paths]);s.avatars=s.avatars.filter(name=>!paths.includes(s.user.id+'/'+name));return{error:null}}
 })}
 });`}));
}}]});
const module={exports:{}};new Function('module','exports','require','console',bundled.outputFiles[0].text)(module,module.exports,await import('node:module').then(m=>m.createRequire(import.meta.url)),{...console,warn:()=>{}});
const handler=module.exports.default;
const nonce='a'.repeat(64),subject='linked-apple-subject',clientId='com.ballknower.ios';
function reset(){
 Object.assign(state,{calls:[],avatars:[],user:{id:'synthetic-user',app_metadata:{providers:['apple']},identities:[{id:subject,provider:'apple',identity_data:{sub:subject}}]},authError:null,signOutError:null,tokenError:false,revokeError:false,claims:{},header:{},invalidSignature:false,tokenTimeout:false});
}
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function idToken(){
 const now=Math.floor(Date.now()/1000),header=encode({alg:'RS256',kid:'test-apple-key',...state.header});
 const payload=encode({iss:'https://appleid.apple.com',aud:clientId,sub:subject,iat:now,exp:now+300,nonce:createHash('sha256').update(nonce).digest('hex'),...state.claims});
 const signature=sign('RSA-SHA256',Buffer.from(`${header}.${payload}`),state.invalidSignature?wrongKey.privateKey:appleKey.privateKey).toString('base64url');
 return `${header}.${payload}.${signature}`;
}
globalThis.fetch=async(url,init)=>{
 const path=String(url);state.calls.push([path,init?.body?.toString()]);
 if(path.endsWith('/auth/token')){
  if(state.tokenTimeout)return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}));
  return new Response(JSON.stringify(state.tokenError?{error:'invalid_grant'}:{id_token:idToken(),refresh_token:'synthetic-apple-refresh'}),{status:state.tokenError?400:200});
 }
 if(path.endsWith('/auth/keys'))return new Response(JSON.stringify({keys:[{...appleKey.publicKey.export({format:'jwk'}),kid:'test-apple-key',alg:'RS256',use:'sig'}]}));
 if(path.endsWith('/auth/revoke'))return new Response('{}',{status:state.revokeError?503:200});
 throw new Error('Unexpected external request: '+path);
};
const authorization={authorizationCode:'synthetic-one-use-code',nonce,user:subject};
async function request(body={confirmation:'DELETE',appleAuthorization:authorization}){
 let status=0,payload;const res={setHeader(){},status(code){status=code;return this},json(value){payload=value;return value}};
 await handler({method:'POST',headers:{authorization:'Bearer synthetic-access'},body},res);
 return {status,payload};
}
try{
 reset();state.avatars=[...Array.from({length:151},(_,i)=>`avatar-${i}.webp`),'legacy/photo.webp','legacy/deep/photo.jpg'];
 const success=await request();assert.equal(success.status,200);assert.equal(success.payload.appleAuthorizationRevoked,true);assert.equal(success.payload.manualAppleRevokeRequired,false);assert.equal(state.avatars.length,0,'Deletion removes more than one page of owned avatar objects');
 const order=state.calls.map(call=>call[0]);assert(order.indexOf('https://appleid.apple.com/auth/revoke')<order.indexOf('delete-user'));assert(order.indexOf('sign-out')<order.indexOf('delete-user'));
 assert.equal(state.calls.find(call=>call[0]==='sign-out')[2],'global');
 const tokenRequest=new URLSearchParams(state.calls.find(call=>call[0].endsWith('/auth/token'))[1]);assert.equal(tokenRequest.get('client_id'),clientId);assert.equal(tokenRequest.get('grant_type'),'authorization_code');assert.equal(tokenRequest.has('redirect_uri'),false,'Native Apple authorization has no web redirect URI');
 for(const claims of [{sub:'another-user'},{nonce:'other-nonce'},{aud:'other-app'},{iss:'https://evil.invalid'},{exp:0},{iat:Math.floor(Date.now()/1000)+600},{iat:0}]){
  reset();state.claims=claims;const result=await request();assert.equal(result.status,409,JSON.stringify(claims));assert(!state.calls.some(call=>call[0]==='delete-user'||call[0].endsWith('/auth/revoke')),'Invalid identity cannot revoke authorization or delete an account');
 }
 for(const failure of ['invalidSignature','tokenError']){
  reset();state[failure]=true;assert.equal((await request()).status,409);assert(!state.calls.some(call=>call[0]==='delete-user'));
 }
 for(const header of [{alg:'none'},{alg:'HS256'},{kid:'unknown-rotated-key'},{crit:['unexpected']}]){
  reset();state.header=header;assert.equal((await request()).status,409);assert(!state.calls.some(call=>call[0]==='delete-user'));
 }
 reset();state.tokenError=true;assert.equal((await request()).status,409,'A replayed/used authorization code fails closed when Apple rejects the exchange');
 reset();state.revokeError=true;assert.equal((await request()).status,409,'Native recovery must confirm revocation before deleting');assert(!state.calls.some(call=>call[0]==='delete-user'));
 reset();state.tokenTimeout=true;AbortSignal.timeout=()=>{const controller=new AbortController();setTimeout(()=>controller.abort(),15);return controller.signal};assert.equal((await request()).status,409);assert(!state.calls.some(call=>call[0]==='delete-user'));AbortSignal.timeout=originalTimeout;
 reset();const missing=await request({confirmation:'DELETE'});assert.equal(missing.status,200);assert.equal(missing.payload.appleAuthorizationRevoked,false);assert.equal(missing.payload.manualAppleRevokeRequired,true);assert.equal(missing.payload.appleRevocationReason,'missing_provider_token');
 reset();delete process.env.APPLE_PRIVATE_KEY;const config=await request();assert.equal(config.status,200);assert.equal(config.payload.appleAuthorizationRevoked,false);assert.equal(config.payload.manualAppleRevokeRequired,true);assert.equal(config.payload.appleRevocationReason,'server_config_missing');process.env.APPLE_PRIVATE_KEY=clientKey.privateKey.export({format:'pem',type:'pkcs8'}).toString();
 reset();state.revokeError=true;const deferred=await request({confirmation:'DELETE',providerToken:'synthetic-browser-provider-token'});assert.equal(deferred.status,200);assert.equal(deferred.payload.manualAppleRevokeRequired,true,'Existing browser deletion remains available during a provider outage and accurately requires manual removal');
 reset();state.signOutError=new Error('signout unavailable');assert.equal((await request({confirmation:'DELETE'})).status,500);assert(!state.calls.some(call=>call[0]==='delete-user'));
 reset();state.authError=new Error('expired');assert.equal((await request()).status,401);assert.equal(state.calls.length,0);
 reset();assert.equal((await request({confirmation:'NO'})).status,400);assert.equal(state.calls.length,0);
}finally{
 globalThis.fetch=originalFetch;AbortSignal.timeout=originalTimeout;
 for(const name of Object.keys(process.env))if(!(name in originalEnv))delete process.env[name];Object.assign(process.env,originalEnv);
}
console.log('PASS actual account-deletion API: signed Apple identity/nonce/account/audience/issuer/time/algorithm checks, code replay/provider timeout failure, safe missing-config fallback, complete avatar cleanup and global refresh-session revocation; services mocked.');
