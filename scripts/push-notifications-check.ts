import assert from 'node:assert/strict';
import {createECDH,generateKeyPairSync,verify,randomUUID} from 'node:crypto';
import {readFileSync,mkdtempSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import webPush from 'web-push';
import {createPushHandler} from '../api/push';
import {createPushDeliveryHandler} from '../api/push-delivery';
import {DEFAULT_PUSH_SETTINGS,quietUntil,quietHoursRuntimeReady,validPushSettings} from '../pushContracts';
import {createApnsAuthorization,providerResult,readTransportConfiguration,transportReadiness,validWebEndpoint,validWebSubscription,validApnsToken} from '../server/pushTransport';
import type {PushDatabase} from '../server/pushDatabase';

assert.ok(quietHoursRuntimeReady(),`Node tzdata ${process.versions.tz} misses 2026 timezone changes; update/test the server runtime before enabling delivery.`);
const quiet=(zone:string,instant:string,start=22*60,end=7*60)=>quietUntil({...DEFAULT_PUSH_SETTINGS,quietEnabled:true,timeZone:zone,startMinute:start,endMinute:end},new Date(instant)).toISOString();
assert.equal(quiet('America/New_York','2026-11-06T04:30:00Z'),'2026-11-06T12:00:00.000Z','overnight interval crosses the local date');
assert.equal(quiet('America/New_York','2026-11-06T12:00:00Z'),'2026-11-06T12:00:00.000Z','end minute is inclusive for delivery');
assert.equal(quiet('America/New_York','2026-11-06T16:30:00Z',600,720),'2026-11-06T17:00:00.000Z','same-day interval');
assert.equal(quiet('America/New_York','2026-03-08T06:55:00Z',60,150),'2026-03-08T07:00:00.000Z','spring skip releases at first permitted actual instant');
assert.equal(quiet('America/New_York','2026-11-01T06:10:00Z',60,90),'2026-11-01T06:30:00.000Z','second repeated hour uses wall-clock time');
assert.equal(quiet('America/Vancouver','2026-11-06T06:30:00Z'),'2026-11-06T14:00:00.000Z','Vancouver remains UTC-7 in November 2026');
assert.equal(quiet('America/Edmonton','2026-11-06T06:30:00Z'),'2026-11-06T13:00:00.000Z','Edmonton remains UTC-6 in November 2026');
assert.equal(quiet('Africa/Casablanca','2026-10-15T06:30:00Z'),'2026-10-15T07:00:00.000Z','Morocco changed to UTC in September 2026');
assert.equal(quietUntil(DEFAULT_PUSH_SETTINGS,new Date('2026-11-06T04:30:00Z')).toISOString(),'2026-11-06T04:30:00.000Z');
for(const invalid of [{...DEFAULT_PUSH_SETTINGS,timeZone:'Mars/Olympus'},{...DEFAULT_PUSH_SETTINGS,startMinute:1440},{...DEFAULT_PUSH_SETTINGS,startMinute:420},{...DEFAULT_PUSH_SETTINGS,endMinute:1.5}])assert.equal(validPushSettings(invalid),false);

const curve=createECDH('prime256v1');curve.generateKeys();
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-only-token',keys:{p256dh:curve.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,7).toString('base64url')}};
assert.ok(validWebSubscription(subscription));
assert.ok(validWebEndpoint('https://web.push.apple.com/synthetic-only-token'));
assert.ok(validWebEndpoint('https://updates.push.services.mozilla.com/wpush/v2/synthetic-only-token'));
for(const endpoint of ['http://fcm.googleapis.com/fcm/send/a','https://127.0.0.1/fcm/send/a','https://[::1]/fcm/send/a','https://fcm.googleapis.com.attacker.invalid/fcm/send/a','https://fcm.googleapis.com@127.0.0.1/fcm/send/a','https://fcm.googleapis.com:444/fcm/send/a','https://fcm.googleapis.com/fcm/send/a#fragment','https://fcm.googleapis.com/../metadata','https://web.push.apple.com/a?redirect=http://localhost','https://example.com/push'])assert.equal(validWebEndpoint(endpoint),false,endpoint);
assert.equal(validWebSubscription({...subscription,keys:{...subscription.keys,p256dh:Buffer.alloc(65).toString('base64url')}}),false);
assert.equal(validApnsToken('a'.repeat(64)),true);assert.equal(validApnsToken('localhost'),false);
const vapid=webPush.generateVAPIDKeys();
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const configuration=readTransportConfiguration({VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey,VAPID_SUBJECT:'https://ballknowerofficial.com',APNS_KEY_ID:'ABCDEFGHIJ',APNS_TEAM_ID:'0123456789',APNS_TOPIC:'com.ballknower.ios',APNS_ENVIRONMENT:'production',APNS_PRIVATE_KEY:privateKey.export({format:'pem',type:'pkcs8'}).toString()});
assert.ok(configuration.web&&configuration.apns);
assert.equal(transportReadiness({}).web.ready,false);
assert.equal(readTransportConfiguration({VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:webPush.generateVAPIDKeys().privateKey,VAPID_SUBJECT:'https://ballknowerofficial.com'}).web,undefined,'mismatched keypair cannot advertise readiness');
const authorization=createApnsAuthorization(configuration.apns!,Date.parse('2026-11-06T06:30:00Z'));
const [header,claims,signature]=authorization.split('.');
assert.equal(JSON.parse(Buffer.from(claims,'base64url').toString()).iss,'0123456789');
assert.ok(verify('sha256',Buffer.from(`${header}.${claims}`),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),'APNs ES256 signature is valid IEEE P1363');
assert.equal(providerResult('web',410).state,'invalid');assert.equal(providerResult('apns',400,'BadDeviceToken').state,'invalid');
assert.equal(providerResult('web',403).state,'failed');assert.equal(providerResult('apns',403,'InvalidProviderToken').state,'failed');
assert.equal(providerResult('web',429,'',undefined,'600').retryAfterSeconds,600);assert.equal(providerResult('apns',503).state,'retry');
assert.equal(providerResult('apns',200,'','synthetic-accepted').state,'accepted');

const owner='00000000-0000-4000-8000-000000000001',sessionId='00000000-0000-4000-8000-000000000002',installationId='00000000-0000-4000-8000-000000000003';
const token=(sub=owner,sid:string|undefined=sessionId)=>`synthetic.${Buffer.from(JSON.stringify({sub,session_id:sid})).toString('base64url')}.verified`;
async function invoke(handler:any,{method='GET',query={},body=undefined,authorization=`Bearer ${token()}`}:any={}){
  const response:any={statusCode:200,headers:{},setHeader(key:string,value:string){this.headers[key]=value;},status(code:number){this.statusCode=code;return this;},json(value:any){this.body=value;return this;}};
  await handler({method,query,body,headers:{authorization}},response);return response;
}
let calls:any[]=[],anonymous=false,activeSession=true;
const database:PushDatabase={auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:anonymous}},error:null})},rpc:async(name,args)=>{
  calls.push({name,args});
  if(args.p_data&&(args.p_data as any).sessionId!==sessionId||!activeSession)return {data:null,error:{code:'28000'}};
  if((args.p_data as any)?.id)return {data:{notificationId:(args.p_data as any).id,leagueId:'joined-league',kind:'waiver_result',category:'transactions'},error:null};
  return {data:{ok:true},error:null};
}};
const handler=createPushHandler({database,configuration:()=>configuration});
assert.equal((await invoke(handler,{query:{resource:'config'},authorization:''})).statusCode,200);
assert.equal((await invoke(handler,{query:{resource:'settings'},authorization:''})).statusCode,401);
assert.equal((await invoke(handler,{query:{resource:'settings'},authorization:`Bearer ${token(randomUUID())}`})).statusCode,401,'JWT sub must match verified user');
assert.equal((await invoke(handler,{query:{resource:'settings'},authorization:'synthetic.bad.verified'})).statusCode,401);
anonymous=true;assert.equal((await invoke(handler,{query:{resource:'settings'}})).statusCode,403);anonymous=false;
const subscribe={action:'subscribe',installationId,installationSecret:Buffer.alloc(32,4).toString('base64url'),transport:'web',subscription,label:'Synthetic browser'};
assert.equal((await invoke(handler,{method:'POST',body:subscribe})).statusCode,200);
assert.equal(calls.at(-1).args.p_owner,owner);assert.equal(calls.at(-1).args.p_data.sessionId,sessionId);assert.equal(calls.at(-1).args.p_data.installationSecret,undefined,'raw installation secret never enters RPC');
assert.equal((await invoke(handler,{method:'POST',body:{...subscribe,auth_user_id:randomUUID()}})).statusCode,400,'owner injection rejected');
assert.equal((await invoke(handler,{method:'POST',body:{...subscribe,subscription:{...subscription,endpoint:'http://127.0.0.1/'}}})).statusCode,400);
activeSession=false;assert.equal((await invoke(handler,{method:'POST',body:subscribe})).statusCode,401,'revoked session cannot register');assert.equal((await invoke(handler,{method:'POST',body:{action:'settings',...DEFAULT_PUSH_SETTINGS}})).statusCode,401);activeSession=true;
const target=await invoke(handler,{query:{resource:'notification',id:randomUUID()}});assert.equal(target.body.destination,'waivers');assert.equal(target.body.leagueId,'joined-league');

let sent=0,receipts:any[]=[];
const now=new Date('2026-11-06T06:30:00Z');
const deliveryDatabase:PushDatabase={auth:database.auth,rpc:async(name,args)=>{
  if(name==='claim_ball_knower_push')return {data:[{id:installationId,claim_token:sessionId}],error:null};
  if(name==='prepare_ball_knower_push')return {data:{state:'ready',transport:'web',subscription,payload:{notificationId:randomUUID(),title:'Synthetic only',body:'Synthetic only',expiresAt:'2026-11-07T06:30:00Z',tag:'synthetic'},quietHours:{...DEFAULT_PUSH_SETTINGS,quietEnabled:true}},error:null};
  receipts.push(args.p_result);return {data:true,error:null};
}};
const delivery=createPushDeliveryHandler({database:deliveryDatabase,configuration:()=>configuration,secret:()=> 'synthetic-cron-secret',now:()=>now,send:async()=>{sent++;return {state:'accepted',code:'provider_accepted'};}});
assert.equal((await invoke(delivery)).statusCode,401);
let delivered=await invoke(delivery,{authorization:'Bearer synthetic-cron-secret'});assert.equal(sent,0,'quiet hours never contact a provider');assert.equal(delivered.body.deferred,1);assert.equal(receipts[0].availableAt,'2026-11-06T07:00:00.000Z');
const daytime=createPushDeliveryHandler({database:deliveryDatabase,configuration:()=>configuration,secret:()=> 'synthetic-cron-secret',now:()=>new Date('2026-11-06T12:00:00Z'),send:async()=>{sent++;return {state:'accepted',code:'provider_accepted'};}});
delivered=await invoke(daytime,{authorization:'Bearer synthetic-cron-secret'});assert.equal(delivered.body.accepted,1);assert.equal(sent,1);
const unconfigured=createPushDeliveryHandler({database:deliveryDatabase,configuration:()=>({}),secret:()=> 'synthetic-cron-secret'});assert.equal((await invoke(unconfigured,{authorization:'Bearer synthetic-cron-secret'})).statusCode,503);

// Execute the real service worker in a VM with browser-facing events, no network.
const events:Record<string,(event:any)=>void>={},opened:string[]=[],posted:any[]=[],shown:any[]=[];
let clients:any[]=[];
const self={addEventListener:(kind:string,listener:any)=>{events[kind]=listener;},registration:{showNotification:async(...args:any[])=>shown.push(args)},location:{origin:'https://ballknowerofficial.com'},clients:{matchAll:async()=>clients,openWindow:async(url:string)=>opened.push(url)}};
vm.runInNewContext(readFileSync(new URL('../public/push-worker.js',import.meta.url),'utf8'),{self,URL,Date});
assert.equal(events.fetch,undefined,'push worker cannot cache stale app code');
const notificationId=randomUUID(),expiresAt=new Date(Date.now()+60_000).toISOString();
let pending:Promise<any>=Promise.resolve();
events.push({data:{json:()=>({notificationId,expiresAt,title:'Synthetic',body:'Test'})},waitUntil:(value:Promise<any>)=>pending=value});await pending;assert.equal(shown.length,1);
clients=[{url:'https://ballknowerofficial.com/terms.html',focus:async()=>assert.fail('legal page must not receive app push tap')}];
events.notificationclick({notification:{close(){},data:{notificationId,expiresAt}},waitUntil:(value:Promise<any>)=>pending=value});await pending;assert.equal(opened.length,1);assert.ok(opened[0].includes(notificationId));
clients=[{url:'https://ballknowerofficial.com/',focus:async()=>{},postMessage:(value:any)=>posted.push(value)}];
events.notificationclick({notification:{close(){},data:{notificationId,expiresAt}},waitUntil:(value:Promise<any>)=>pending=value});await pending;assert.equal(posted[0].notificationId,notificationId);assert.equal(opened.length,1);

// Synthetic disposable keys exercise file permissions; no deployment credentials are generated.
const directory=mkdtempSync(join(tmpdir(),'bk-vapid-test-'));
try{
  const generated=spawnSync(process.execPath,['scripts/generate-push-vapid.mjs',directory,'https://ballknowerofficial.com'],{encoding:'utf8'});
  assert.equal(generated.status,0,generated.stderr);assert.equal(statSync(join(directory,'VAPID_PRIVATE_KEY')).mode&0o777,0o600);
  const privateValue=readFileSync(join(directory,'VAPID_PRIVATE_KEY'),'utf8');assert.ok(!generated.stdout.includes(privateValue),'private key cannot reach stdout');
  assert.notEqual(spawnSync(process.execPath,['scripts/generate-push-vapid.mjs',directory,'https://ballknowerofficial.com'],{encoding:'utf8'}).status,0,'generator cannot overwrite provisioned keys');
  assert.notEqual(spawnSync(process.execPath,['scripts/generate-push-vapid.mjs',join(process.cwd(),'forbidden-keys'),'https://ballknowerofficial.com'],{encoding:'utf8'}).status,0,'generator refuses Git checkout');
}finally{rmSync(directory,{recursive:true,force:true});}
console.log(`Push checks passed: verified session/owner, endpoint allowlist, crypto/readiness, quiet hours/DST/2026 tzdata (${process.versions.tz}), cron outcomes, service-worker taps and private key files. No real pushes sent.`);
