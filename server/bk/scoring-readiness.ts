import {fetchBoundedText} from './bounded-fetch.js';
import {summarizeProviderCoverage,TANK01_HOST,type ProbeIdentity} from './scoring-provider-coverage.js';

// Confirmed in nflverse games.csv and released_games.csv on 2026-11-06.
// A fixed completed game prevents this endpoint becoming an arbitrary paid proxy.
export const READINESS_GAME={id:'2026_08_CHI_SEA',providerGameId:'20261102_CHI@SEA',week:8,away:'CHI',home:'SEA',date:'2026-11-02'};
const MAX_WINDOW_MS=60*60_000;
type Dependencies={identities:ProbeIdentity[];env?:NodeJS.ProcessEnv;fetchImpl?:typeof fetch;now?:()=>number;log?:(event:Record<string,unknown>)=>void};
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

async function requestProvider(path:'/getNFLBoxScore'|'/getNFLProjections',params:Record<string,string>,key:string,fetcher:typeof fetch){
 let status:number|null=null;
 const url=new URL(`https://${TANK01_HOST}${path}`);
 for(const [name,value]of Object.entries(params))url.searchParams.set(name,value);
 try{
  const result=await fetchBoundedText(url.href,{maxBytes:4_000_000,timeoutMs:8_000,fetchImpl:async(input,init)=>{
   // No redirects: credentials may only be sent to this fixed provider origin.
   if(new URL(String(input)).origin!==`https://${TANK01_HOST}`)throw Error('invalid_provider_origin');
   const response=await fetcher(input,{...init,headers:{Accept:'application/json','x-rapidapi-key':key,'x-rapidapi-host':TANK01_HOST}});
   status=response.status;return response;
  }});
  const payload=object(JSON.parse(result.text));
  if(payload.error||Number(payload.statusCode)>=400)return {ok:false,status,reason:'provider_payload_error',body:null,sourceUpdatedAt:result.sourceUpdatedAt};
  return {ok:true,status,reason:null,body:payload.body??payload,sourceUpdatedAt:result.sourceUpdatedAt};
 }catch{
  return {ok:false,status,reason:status===401||status===403?'provider_authentication_failed':status===429?'provider_rate_limited':'provider_response_unavailable_or_invalid',body:null,sourceUpdatedAt:null};
 }
}

/** Protected, temporarily enabled read-only diagnostic. No database import or writer. */
export function createScoringReadinessHandler(deps:Dependencies){
 const env=deps.env??process.env,clock=deps.now??Date.now,fetcher=deps.fetchImpl??fetch;
 return async(req:any,res:any)=>{
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,code:'method_not_allowed'});}
  if(!env.CRON_SECRET||req.headers?.authorization!==`Bearer ${env.CRON_SECRET}`)return res.status(401).json({ok:false,code:'unauthorized'});
  // No request input can influence a provider call, identity selection or deadline.
  if(Object.keys(req.query??{}).length)return res.status(400).json({ok:false,code:'query_not_allowed'});
  const now=clock(),until=Date.parse(env.TANK01_READINESS_ENABLED_UNTIL??'');
  const base={mode:'read_only_tank01_readiness',scoringAvailable:false,activationCertified:false,writes:0};
  if(env.VERCEL_ENV!=='production'||!Number.isFinite(until)||until<=now||until-now>MAX_WINDOW_MS)
   return res.status(200).json({...base,enabled:false,providerRequests:0,code:'diagnostic_disabled'});
  const key=env.TANK01_API_KEY;
  if(!key)return res.status(503).json({...base,enabled:true,providerRequests:0,code:'existing_server_key_unavailable'});
  const [box,projection]=await Promise.all([
   requestProvider('/getNFLBoxScore',{gameID:READINESS_GAME.providerGameId,playByPlay:'false',fantasyPoints:'true'},key,fetcher),
   requestProvider('/getNFLProjections',{week:String(READINESS_GAME.week)},key,fetcher),
  ]);
  const event={...base,enabled:true,providerRequests:2,capturedAt:new Date(clock()).toISOString(),game:READINESS_GAME,
   boxRequest:{ok:box.ok,status:box.status,reason:box.reason,sourceUpdatedAt:box.sourceUpdatedAt},
   projectionRequest:{ok:projection.ok,status:projection.status,reason:projection.reason,sourceUpdatedAt:projection.sourceUpdatedAt},
   coverage:summarizeProviderCoverage(box.body,projection.body,deps.identities,READINESS_GAME)};
  // Only this constructed aggregate is logged. No provider bodies, raw errors,
  // credentials, names, identifiers or raw player stat values enter the log.
  (deps.log??(value=>console.info('fantasy-scoring-readiness',JSON.stringify(value))))(event);
  return res.status(200).json({...base,enabled:true,providerRequests:2,capturedAt:event.capturedAt,logged:true});
 };
}
