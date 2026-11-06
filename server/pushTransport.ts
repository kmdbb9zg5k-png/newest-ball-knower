import {createECDH,createHash,createPrivateKey,sign, type KeyObject} from 'node:crypto';
import {request as httpsRequest} from 'node:https';
import {connect as http2Connect} from 'node:http2';
import webPush from 'web-push';
import {quietHoursRuntimeReady,type PushReadiness} from '../pushContracts';

export type WebSubscription={endpoint:string;keys:{p256dh:string;auth:string}};
export type PushPayload={notificationId:string;title:string;body:string;expiresAt:string;tag:string};
export type DeliveryResult={state:'accepted'|'retry'|'failed'|'invalid';code:string;providerId?:string;retryAfterSeconds?:number};
export type TransportConfiguration={
  web?:{subject:string;publicKey:string;privateKey:string};
  apns?:{keyId:string;teamId:string;key:KeyObject;topic:string;environment:'production'|'sandbox'};
};
export const secretHash=(value:string)=>createHash('sha256').update(value).digest('hex');
const base64=(value:string,length:number)=>/^[A-Za-z0-9_-]+$/.test(value)&&Buffer.from(value,'base64url').length===length&&Buffer.from(value,'base64url').toString('base64url')===value;

/** Exact provider hosts only, no redirects, ports, credentials or arbitrary URLs. */
export function validWebEndpoint(raw:unknown):raw is string{
  if(typeof raw!=='string'||raw.length<30||raw.length>4096)return false;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password||url.hash||(url.port&&url.port!=='443'))return false;
    if(url.hostname==='fcm.googleapis.com')return /^\/(?:fcm\/send|wp)\/[A-Za-z0-9_:-]+$/.test(url.pathname)&&!url.search;
    if(url.hostname==='updates.push.services.mozilla.com')return /^\/wpush\/v[12]\/[A-Za-z0-9_-]+$/.test(url.pathname)&&!url.search;
    if(url.hostname==='web.push.apple.com')return /^\/[A-Za-z0-9_-]+$/.test(url.pathname)&&!url.search;
    return false;
  }catch{return false;}
}

export function validWebSubscription(value:unknown):value is WebSubscription{
  const subscription=value as WebSubscription;
  if(!subscription||!validWebEndpoint(subscription.endpoint)||!subscription.keys||typeof subscription.keys.p256dh!=='string'||typeof subscription.keys.auth!=='string'||!base64(subscription.keys.p256dh,65)||!base64(subscription.keys.auth,16))return false;
  try{const key=Buffer.from(subscription.keys.p256dh,'base64url');const curve=createECDH('prime256v1');curve.generateKeys();return key[0]===4&&Boolean(curve.computeSecret(key));}catch{return false;}
}
export const validApnsToken=(value:unknown):value is string=>typeof value==='string'&&/^[a-fA-F0-9]{64}$/.test(value);

export function readTransportConfiguration(env:NodeJS.ProcessEnv=process.env):TransportConfiguration{
  const configuration:TransportConfiguration={};
  const subject=env.VAPID_SUBJECT||'',publicKey=env.VAPID_PUBLIC_KEY||'',privateKey=env.VAPID_PRIVATE_KEY||'';
  try{
    const contact=new URL(subject);
    const goodContact=contact.protocol==='mailto:'? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.pathname):contact.protocol==='https:'&&!contact.username&&!contact.password&&contact.hostname.includes('.')&&contact.hostname!=='localhost';
    if(goodContact&&base64(publicKey,65)&&base64(privateKey,32)){
      const curve=createECDH('prime256v1');curve.setPrivateKey(Buffer.from(privateKey,'base64url'));
      if(curve.getPublicKey().toString('base64url')===publicKey)configuration.web={subject,publicKey,privateKey};
    }
  }catch{}
  try{
    const keyId=env.APNS_KEY_ID||'',teamId=env.APNS_TEAM_ID||'',topic=env.APNS_TOPIC||'',environment=env.APNS_ENVIRONMENT;
    if(/^[A-Z0-9]{10}$/.test(keyId)&&/^[A-Z0-9]{10}$/.test(teamId)&&topic==='com.ballknower.ios'&&(environment==='production'||environment==='sandbox')){
      const key=createPrivateKey((env.APNS_PRIVATE_KEY||'').replace(/\\n/g,'\n'));
      if(key.asymmetricKeyType==='ec'&&key.asymmetricKeyDetails?.namedCurve==='prime256v1')configuration.apns={keyId,teamId,key,topic,environment};
    }
  }catch{}
  return configuration;
}
export function transportReadiness(configuration:TransportConfiguration):PushReadiness{
  const timezoneReady=quietHoursRuntimeReady();
  return {web:{ready:timezoneReady&&Boolean(configuration.web),publicKey:configuration.web?.publicKey||null},apns:{ready:timezoneReady&&Boolean(configuration.apns)},android:{ready:false}};
}
export function providerResult(transport:'web'|'apns',status:number,reason='',providerId?:string,retryAfter?:string):DeliveryResult{
  if(status>=200&&status<300)return {state:'accepted',code:'provider_accepted',providerId:providerId&&/^[A-Za-z0-9:_-]{1,128}$/.test(providerId)?providerId:undefined};
  if(status===410||(transport==='web'&&status===404)||(transport==='apns'&&['BadDeviceToken','DeviceTokenNotForTopic','Unregistered'].includes(reason)))return {state:'invalid',code:'subscription_invalid'};
  if(status===429||status===408||status>=500){
    const delay=retryAfter&&/^\d+$/.test(retryAfter)?Number(retryAfter):0;
    return {state:'retry',code:status===429?'provider_rate_limited':'provider_unavailable',retryAfterSeconds:delay?Math.min(3600,Math.max(60,delay)):undefined};
  }
  return {state:'failed',code:status===401||status===403?'provider_auth_failed':'provider_rejected'};
}

/** generateRequestDetails encrypts; our request adds a hard deadline and never follows redirects. */
export async function sendWebPush(subscription:WebSubscription,payload:PushPayload,configuration:NonNullable<TransportConfiguration['web']>,timeoutMs=7000):Promise<DeliveryResult>{
  if(!validWebSubscription(subscription))return {state:'invalid',code:'subscription_invalid'};
  const ttl=Math.max(0,Math.min(86_400,Math.floor((Date.parse(payload.expiresAt)-Date.now())/1000)));
  if(ttl<=0)return {state:'failed',code:'expired'};
  let details:ReturnType<typeof webPush.generateRequestDetails>;
  try{details=webPush.generateRequestDetails(subscription,JSON.stringify(payload),{vapidDetails:configuration,TTL:ttl,urgency:'normal',topic:secretHash(payload.notificationId).slice(0,32)});}catch{return {state:'failed',code:'web_push_encoding_failed'};}
  return new Promise(resolve=>{
    const finish=(result:DeliveryResult)=>{clearTimeout(timer);resolve(result);};
    const request=httpsRequest(details.endpoint,{method:details.method,headers:details.headers},response=>{
      let bytes=0;
      response.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>8192)request.destroy();});
      response.on('end',()=>finish(providerResult('web',response.statusCode||0,'',undefined,String(response.headers['retry-after']||''))));
      response.on('error',()=>finish({state:'retry',code:'provider_network_error'}));
    });
    const timer=setTimeout(()=>{request.destroy();finish({state:'retry',code:'provider_timeout'});},timeoutMs);
    request.on('error',()=>finish({state:'retry',code:'provider_network_error'}));
    request.end(details.body);
  });
}

export function createApnsAuthorization(configuration:NonNullable<TransportConfiguration['apns']>,now=Date.now()){
  const header=Buffer.from(JSON.stringify({alg:'ES256',kid:configuration.keyId})).toString('base64url');
  const body=Buffer.from(JSON.stringify({iss:configuration.teamId,iat:Math.floor(now/1000)})).toString('base64url');
  const unsigned=`${header}.${body}`;
  return `${unsigned}.${sign('sha256',Buffer.from(unsigned),{key:configuration.key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
}

export async function sendApns(token:string,payload:PushPayload,receiptId:string,configuration:NonNullable<TransportConfiguration['apns']>,timeoutMs=7000):Promise<DeliveryResult>{
  if(!validApnsToken(token))return {state:'invalid',code:'subscription_invalid'};
  if(Date.parse(payload.expiresAt)<=Date.now())return {state:'failed',code:'expired'};
  return new Promise(resolve=>{
    const origin=configuration.environment==='sandbox'?'https://api.sandbox.push.apple.com':'https://api.push.apple.com';
    const client=http2Connect(origin);
    let settled=false;
    const finish=(result:DeliveryResult)=>{if(settled)return;settled=true;clearTimeout(timer);client.destroy();resolve(result);};
    const timer=setTimeout(()=>finish({state:'retry',code:'provider_timeout'}),timeoutMs);
    client.on('error',()=>finish({state:'retry',code:'provider_network_error'}));
    client.on('connect',()=>{
      try{
        const request=client.request({':method':'POST',':path':`/3/device/${token.toLowerCase()}`,authorization:`bearer ${createApnsAuthorization(configuration)}`,'apns-topic':configuration.topic,'apns-push-type':'alert','apns-priority':'10','apns-id':receiptId,'apns-collapse-id':payload.notificationId,'apns-expiration':String(Math.floor(Date.parse(payload.expiresAt)/1000)),'content-type':'application/json'});
        let status=0,providerId='',retryAfter='',body='';
        request.on('response',headers=>{status=Number(headers[':status']);providerId=String(headers['apns-id']||'');retryAfter=String(headers['retry-after']||'');});
        request.on('data',(chunk:Buffer)=>{body+=chunk.toString();if(body.length>8192)finish({state:'retry',code:'provider_response_invalid'});});
        request.on('error',()=>finish({state:'retry',code:'provider_network_error'}));
        request.on('end',()=>{let reason='';try{reason=JSON.parse(body).reason||'';}catch{}finish(providerResult('apns',status,reason,providerId,retryAfter));});
        request.end(JSON.stringify({aps:{alert:{title:payload.title,body:payload.body},sound:'default'},notificationId:payload.notificationId,expiresAt:payload.expiresAt}));
      }catch{finish({state:'failed',code:'apns_encoding_failed'});}
    });
  });
}
