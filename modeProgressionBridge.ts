import{claimPendingVerifiedModeMilestones,gradeVerifiedPredictionPicks,syncVerifiedModeSnapshot}from'./modeProgressionCloud';

const OWNER_KEY='ballknower_owner_career_v3';
const AGENT_KEY='ballknower_player_agent_v4';
let started=false;let running=false;let timer=0;let gradeTimer=0;
const lastSent=new Map<string,string>();

function readJson(key:string){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}}
function stable(value:unknown){try{return JSON.stringify(value)}catch{return''}}

async function syncOne(mode:'owner'|'agent',snapshot:Record<string,unknown>){
  const fingerprint=stable(snapshot);if(!fingerprint||lastSent.get(mode)===fingerprint)return;
  await syncVerifiedModeSnapshot(mode,snapshot);lastSent.set(mode,fingerprint);
}

async function syncNow(){
  if(running||typeof window==='undefined'||!navigator.onLine)return;running=true;
  try{
    const owner=readJson(OWNER_KEY);
    if(owner?.ownerName)await syncOne('owner',{
      seasonsCompleted:Math.max(0,Math.trunc(Number(owner.seasonsCompleted)||0)),
      playoffAppearances:Math.max(0,Math.trunc(Number(owner.playoffAppearances)||0)),
      conferenceTitles:Math.max(0,Math.trunc(Number(owner.conferenceTitles)||0)),
      championships:Math.max(0,Math.trunc(Number(owner.championships)||0)),
    });
    const agent=readJson(AGENT_KEY);
    if(agent?.profile)await syncOne('agent',{
      signedClients:Math.max(0,Math.trunc(Number(agent.signedClients)||0)),
      resolvedTrades:Array.isArray(agent.clients)?agent.clients.filter((client:any)=>client?.tradeRequest?.status==='resolved').length:0,
      dealCount:Array.isArray(agent.dealHistory)?agent.dealHistory.length:0,
      promisesKept:Math.max(0,Math.trunc(Number(agent.promisesKept)||0)),
    });
    await claimPendingVerifiedModeMilestones();
  }catch(error){console.warn('Verified mode progression sync deferred',error)}finally{running=false;}
}

async function gradePredictions(){try{if(navigator.onLine)await gradeVerifiedPredictionPicks()}catch(error){console.warn('Verified prediction grading deferred',error)}}

export function startModeProgressionBridge(){
  if(started||typeof window==='undefined')return;started=true;
  window.setTimeout(()=>void syncNow(),1200);
  timer=window.setInterval(()=>void syncNow(),4000);
  window.setTimeout(()=>void gradePredictions(),5000);
  gradeTimer=window.setInterval(()=>void gradePredictions(),5*60*1000);
  window.addEventListener('online',()=>{void syncNow();void gradePredictions()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){void syncNow();void gradePredictions()}});
}
