import type {Request,Response} from 'express';
import {timingSafeEqual} from 'node:crypto';
import {quietUntil,quietHoursRuntimeReady,type PushSettings} from '../pushContracts';
import {createPushDatabase,pushRpc,type PushDatabase} from '../server/pushDatabase';
import {readTransportConfiguration,sendApns,sendWebPush,type DeliveryResult,type PushPayload,type TransportConfiguration,type WebSubscription} from '../server/pushTransport';

export const maxDuration=60;
type Prepared={state:string;transport:'web'|'apns';subscription:WebSubscription&{token:string};payload:PushPayload;quietHours:PushSettings};
type Dependencies={database?:PushDatabase|null;configuration?:()=>TransportConfiguration;secret?:()=>string|undefined;now?:()=>Date;send?: (prepared:Prepared,id:string,configuration:TransportConfiguration)=>Promise<DeliveryResult>};
const sameSecret=(actual:string,expected:string)=>{const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);};

export function createPushDeliveryHandler(dependencies:Dependencies={}){
  return async function handler(req:Request,res:Response){
    res.setHeader('Cache-Control','no-store');
    const secret=(dependencies.secret||(()=>process.env.CRON_SECRET))();
    if(!secret||!sameSecret(String(req.headers.authorization||''),`Bearer ${secret}`))return res.status(401).json({error:'Unauthorized'});
    if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'});}
    if(!quietHoursRuntimeReady())return res.status(503).json({ok:false,code:'push_timezone_runtime_unavailable',accepted:0});
    const configuration=(dependencies.configuration||readTransportConfiguration)();
    const transports=[...(configuration.web?['web']:[]),...(configuration.apns?['apns']:[])];
    if(!transports.length)return res.status(503).json({ok:false,code:'push_transport_unconfigured',accepted:0});
    const database=dependencies.database===undefined?createPushDatabase():dependencies.database;
    if(!database)return res.status(503).json({ok:false,code:'push_database_unconfigured',accepted:0});
    const now=dependencies.now||(()=>new Date());
    const counts={claimed:0,accepted:0,deferred:0,suppressed:0,retry:0,failed:0,stale:0};
    let persistenceFailures=0;
    try{
      const claims=await pushRpc(database,'claim_ball_knower_push',{p_limit:12,p_transports:transports,p_now:now().toISOString()}) as {id:string;claim_token:string}[];
      counts.claimed=claims.length;
      let cursor=0;
      const run=async()=>{
        while(cursor<claims.length){
          const claim=claims[cursor++];
          try{
            const prepared=await pushRpc(database,'prepare_ball_knower_push',{p_id:claim.id,p_claim:claim.claim_token,p_now:now().toISOString()}) as Prepared;
            if(prepared.state!=='ready'){
              if(prepared.state==='suppressed')counts.suppressed++;else counts.stale++;
              continue;
            }
            // Node Intl uses the deployment's tzdata; do not depend on older DB tzdata.
            const instant=now(),availableAt=quietUntil(prepared.quietHours,instant);
            let result:DeliveryResult|{state:'deferred';code:'quiet_hours';availableAt:string};
            if(availableAt>instant)result={state:'deferred',code:'quiet_hours',availableAt:availableAt.toISOString()};
            else if(dependencies.send)result=await dependencies.send(prepared,claim.id,configuration);
            else if(prepared.transport==='web'&&configuration.web)result=await sendWebPush(prepared.subscription,prepared.payload,configuration.web);
            else if(prepared.transport==='apns'&&configuration.apns)result=await sendApns(prepared.subscription.token,prepared.payload,claim.id,configuration.apns);
            else result={state:'retry',code:'transport_unconfigured'};
            const recorded=await pushRpc(database,'finish_ball_knower_push',{p_id:claim.id,p_claim:claim.claim_token,p_result:result,p_now:now().toISOString()});
            if(!recorded){counts.stale++;continue;}
            if(result.state==='accepted')counts.accepted++;
            else if(result.state==='deferred')counts.deferred++;
            else if(result.state==='retry')counts.retry++;
            else counts.failed++;
          }catch{
            // An expired lease recovers failed persistence. No raw provider/token logging.
            persistenceFailures++;
          }
        }
      };
      await Promise.all(Array.from({length:6},run));
      return res.status(persistenceFailures?503:200).json({ok:persistenceFailures===0,...counts,persistenceFailures,transports});
    }catch{return res.status(503).json({ok:false,code:'push_queue_unavailable',...counts,persistenceFailures});}
  };
}
export default createPushDeliveryHandler();
