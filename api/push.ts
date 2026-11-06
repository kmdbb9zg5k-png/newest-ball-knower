import type {Request,Response} from 'express';
import {notificationDestination} from '../fantasyNotificationRouting.js';
import {UUID_PATTERN,validPushSettings,quietHoursRuntimeReady} from '../pushContracts.js';
import {createPushDatabase,pushRpc,type PushDatabase} from '../server/pushDatabase.js';
import {readTransportConfiguration,transportReadiness,secretHash,validApnsToken,validWebSubscription,type TransportConfiguration} from '../server/pushTransport.js';

type Dependencies={database?:PushDatabase|null;configuration?:()=>TransportConfiguration};
const validInstallation=(value:any)=>value&&UUID_PATTERN.test(value.installationId)&&typeof value.installationSecret==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value.installationSecret);
const validIntent=(value:any)=>Number.isSafeInteger(value.intentRevision)&&value.intentRevision>0&&typeof value.intentId==='string'&&UUID_PATTERN.test(value.intentId)&&(value.expectedEpoch===null||typeof value.expectedEpoch==='string'&&UUID_PATTERN.test(value.expectedEpoch));
const knownKeys=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
export const maxDuration=30;

export function createPushHandler(dependencies:Dependencies={}){
  return async function handler(req:Request,res:Response){
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(!['GET','POST'].includes(req.method||'')){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
    const configuration=(dependencies.configuration||readTransportConfiguration)();
    const resource=typeof req.query?.resource==='string'?req.query.resource:'';
    if(req.method==='GET'&&resource==='config')return res.status(200).json(transportReadiness(configuration));
    const database=dependencies.database===undefined?createPushDatabase():dependencies.database;
    if(!database)return res.status(503).json({error:'Push notification services are not configured.'});
    const authorization=String(req.headers.authorization||'');
    if(!/^Bearer [A-Za-z0-9._-]{20,8192}$/.test(authorization))return res.status(401).json({error:'Sign in to manage push notifications.'});
    try{
      const auth=await database.auth.getUser(authorization.slice(7));
      if(auth.error||!auth.data.user)return res.status(401).json({error:'Sign in again to manage push notifications.'});
      if(auth.data.user.is_anonymous)return res.status(403).json({error:'Create a permanent account to enable push notifications.'});
      const owner=auth.data.user.id;
      // Decode only AFTER getUser verifies the JWT. Existing user alone does not prove the session survived global sign-out.
      let claims:{sub?:string;session_id?:string};
      try{claims=JSON.parse(Buffer.from(authorization.slice(7).split('.')[1],'base64url').toString('utf8'));}catch{return res.status(401).json({error:'Sign in again to manage push notifications.'});}
      if(claims.sub!==owner||!claims.session_id||!UUID_PATTERN.test(claims.session_id))return res.status(401).json({error:'Sign in again to manage push notifications.'});
      const manage=(action:string,data:Record<string,unknown>={})=>pushRpc(database,'manage_ball_knower_push',{p_owner:owner,p_action:action,p_data:{...data,sessionId:claims.session_id}});
      if(req.method==='GET'){
        if(resource==='settings'||resource==='devices')return res.status(200).json(await manage(resource));
        if(resource==='notification'&&typeof req.query.id==='string'&&UUID_PATTERN.test(req.query.id)){
          const notification=await manage('notification',{id:req.query.id});
          if(!notification)return res.status(404).json({error:'This notification is no longer available in your leagues.'});
          return res.status(200).json({notificationId:notification.notificationId,leagueId:notification.leagueId,destination:notificationDestination(notification)});
        }
        return res.status(400).json({error:'Unknown push resource.'});
      }
      const body=req.body;
      if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>12_000)return res.status(400).json({error:'Invalid push request.'});
      if(body.action==='settings'){
        if(!knownKeys(body,['action','quietEnabled','timeZone','startMinute','endMinute'])||!validPushSettings(body))return res.status(400).json({error:'Choose a valid timezone and different start and end times.'});
        return res.status(200).json(await manage('save-settings',{quietEnabled:body.quietEnabled,timeZone:body.timeZone,startMinute:body.startMinute,endMinute:body.endMinute}));
      }
      if(body.action==='revoke-device'){
        if(!knownKeys(body,['action','deviceId'])||typeof body.deviceId!=='string'||!UUID_PATTERN.test(body.deviceId))return res.status(400).json({error:'Invalid device.'});
        return res.status(200).json(await manage('revoke-device',{deviceId:body.deviceId}));
      }
      if(!validInstallation(body))return res.status(400).json({error:'Invalid installation.'});
      const installation={installationId:body.installationId,installationSecretHash:secretHash(body.installationSecret)};
      if(body.action==='installation'){
        if(!knownKeys(body,['action','installationId','installationSecret']))return res.status(400).json({error:'Invalid push request.'});
        return res.status(200).json(await manage('installation',installation));
      }
      const intent={intentRevision:body.intentRevision,intentId:body.intentId,expectedEpoch:body.expectedEpoch};
      if(body.action==='unsubscribe'){
        if(!validIntent(body)||!knownKeys(body,['action','installationId','installationSecret','intentRevision','intentId','expectedEpoch']))return res.status(400).json({error:'Invalid push request.'});
        return res.status(200).json(await manage('unsubscribe',{...installation,...intent}));
      }
      if(body.action==='subscribe'){
        if(!quietHoursRuntimeReady())return res.status(503).json({error:'Push delivery is awaiting a server update.'});
        if(!validIntent(body)||!knownKeys(body,['action','installationId','installationSecret','transport','subscription','token','label','restore','intentRevision','intentId','expectedEpoch'])||body.restore!==undefined&&typeof body.restore!=='boolean'||typeof body.label!=='string'||body.label.trim().length<1||body.label.length>60)return res.status(400).json({error:'Invalid device details.'});
        if(body.transport==='web'){
          if(!configuration.web)return res.status(503).json({error:'Browser push is not configured yet.'});
          if(!validWebSubscription(body.subscription))return res.status(400).json({error:'This browser push subscription is not supported.'});
          const {endpoint,keys:{p256dh,auth}}=body.subscription;
          return res.status(200).json(await manage('subscribe',{...installation,...intent,restore:body.restore===true,transport:'web',payload:{endpoint,keys:{p256dh,auth}},label:body.label.trim()}));
        }
        if(body.transport==='apns'){
          if(!configuration.apns)return res.status(503).json({error:'iPhone push is not configured yet.'});
          if(!validApnsToken(body.token))return res.status(400).json({error:'Invalid iPhone device registration.'});
          return res.status(200).json(await manage('subscribe',{...installation,...intent,restore:body.restore===true,transport:'apns',payload:{token:body.token.toLowerCase()},label:body.label.trim()}));
        }
      }
      return res.status(400).json({error:'Unknown push action.'});
    }catch(error:any){
      // Database and provider exceptions may contain secret endpoints. Never log/return them.
      const code=String(error?.code||'');
      if(code==='BK002')return res.status(409).json({error:'Device settings changed while this request was in progress. Check this device and try again.',code:'push_state_changed'});
      if(code==='BK001')return res.status(409).json({error:'Push was disabled for this installation. Enable it again to receive alerts.',code:'push_reenable_required'});
      if(code==='28000')return res.status(401).json({error:'This session has ended. Sign in again.'});
      if(code==='42501')return res.status(403).json({error:'This installation belongs to another account or device.'});
      if(code==='23505')return res.status(409).json({error:'This push registration belongs to a different installation. Disable its old registration before enabling it here.'});
      if(code==='22023')return res.status(400).json({error:'Push settings could not be saved. Check your choices or remove an unused device.'});
      return res.status(503).json({error:'Push settings could not be reached. Try again.'});
    }
  };
}
export default createPushHandler();
