const MAX_SAMPLES=720,MAX_EVENTS=400,SAMPLE_SECONDS=.25;
const round=(value,scale=100)=>Math.round((Number(value)||0)*scale);
const safeText=(value,limit=120)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,limit);
const reportId=()=>{const bytes=crypto.getRandomValues(new Uint8Array(6));return`bk_${Date.now().toString(36)}_${[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('')}`};

/** Records bounded gameplay state. It never reads screen, camera, microphone, account, clipboard, location, or user agent. */
export function createGameplayReplayRecorder(getState,options={}){
 const id=reportId(),startedAt=new Date().toISOString(),samples=[],events=[];
 let nextSampleAt=-1,lastSubmittedUrl='';
 const environment=options.environment||(()=>({viewport:[Math.max(1,Math.round(innerWidth)),Math.max(1,Math.round(innerHeight))],pixelRatio:Math.min(3,Math.max(1,Number(devicePixelRatio)||1))})),fetchImpl=options.fetchImpl,requestTimeoutMs=Math.max(500,Number(options.requestTimeoutMs)||4500);
 function event(type,data={}){
  const state=getState();
  events.push({t:round(state.simTime,1000),type:safeText(type,40),data:Object.fromEntries(Object.entries(data).slice(0,8).map(([key,value])=>[safeText(key,32),typeof value==='number'?round(value,1000):safeText(value,80)]))});
  if(events.length>MAX_EVENTS)events.shift();
 }
 function sample(force=false){
  const state=getState(),time=Math.max(0,Number(state.simTime)||0);
  if(!force&&time<nextSampleAt)return;
  nextSampleAt=time+SAMPLE_SECONDS;
  samples.push({t:round(time,1000),ph:safeText(state.phase,12),m:state.mode==='pass'?'p':'r',pl:Number(state.selected)||0,d:[Number(state.drive?.down)||1,Number(state.drive?.ball)||0,Number(state.drive?.toGo)||0,round(state.drive?.clock,100)],i:[round(state.input?.x),round(state.input?.z),state.input?.sprint?1:0,state.assist?1:0],df:safeText(state.defense,32),c:Number(state.carrierIndex??-1),sk:safeText(state.lastSkill,24),p:(state.players||[]).slice(0,22).map(player=>[round(player.x),round(player.z),round(player.vx),round(player.vz),safeText(player.action,24),Number.isInteger(player.engagedWith)?player.engagedWith:-1,player.hasBall?1:0,player.fallen?1:0])});
  if(samples.length>MAX_SAMPLES)samples.shift();
 }
 function payload(note=''){
  sample(true);const env=environment();
  return{version:1,id,createdAt:new Date().toISOString(),startedAt,privacy:'gameplay-state-only',note:safeText(note,500),viewport:Array.isArray(env.viewport)?env.viewport.slice(0,2).map(value=>Math.max(1,Math.round(Number(value)||1))):[1,1],pixelRatio:Math.min(3,Math.max(1,Number(env.pixelRatio)||1)),graphics:'high',samplePeriodMs:SAMPLE_SECONDS*1000,events:events.slice(),samples:samples.slice()};
 }
 async function submit(note=''){
  const body=JSON.stringify(payload(note)),fallback='https://ballknowerofficial.com/api/gameplay-report',hostname=globalThis.location?.hostname||'',endpoints=Array.isArray(options.endpoints)&&options.endpoints.length?options.endpoints:hostname==='ball-knower-gameplay-qa.vercel.app'?['/api/gameplay-report',fallback]:['/api/gameplay-report'];let response,result={},lastError=null;
  for(const endpoint of endpoints){const controller=new AbortController();let timerId=0;const timeout=new Promise((_,reject)=>{timerId=setTimeout(()=>{controller.abort();reject(new Error('Upload timed out'))},requestTimeoutMs)});try{const request=fetchImpl||globalThis.fetch;response=await Promise.race([request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:controller.signal}),timeout]);clearTimeout(timerId);result=await response.json().catch(()=>({}));if(response.ok)break;lastError=new Error(safeText(result.error,120)||`Report failed (${response.status||0})`);if(response.status!==404&&response.status<500)break}catch(error){clearTimeout(timerId);controller.abort();lastError=error;response=null}if(endpoint===endpoints.at(-1))break}
  if(!response?.ok)throw new Error(safeText(lastError?.message,120)||safeText(result.error,120)||`Report failed (${response?.status||0})`);
  lastSubmittedUrl=safeText(result.reviewUrl||result.url,1000);return{...result,id:result.id||id,reviewUrl:lastSubmittedUrl};
 }
 return{id,event,sample,payload,submit,get lastSubmittedUrl(){return lastSubmittedUrl}};
}
