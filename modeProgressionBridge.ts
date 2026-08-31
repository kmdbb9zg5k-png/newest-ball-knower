import{claimPendingVerifiedModeMilestones,gradeVerifiedPredictionPicks}from'./modeProgressionCloud';

let started=false;let claiming=false;let claimTimer=0;let gradeTimer=0;

async function claimVerifiedMilestones(){
  if(claiming||typeof window==='undefined'||!navigator.onLine)return;claiming=true;
  try{await claimPendingVerifiedModeMilestones()}catch(error){console.warn('Verified milestone claim deferred',error)}finally{claiming=false;}
}
async function gradePredictions(){try{if(navigator.onLine)await gradeVerifiedPredictionPicks()}catch(error){console.warn('Verified prediction grading deferred',error)}}

export function startModeProgressionBridge(){
  if(started||typeof window==='undefined')return;started=true;
  window.setTimeout(()=>void claimVerifiedMilestones(),1200);
  claimTimer=window.setInterval(()=>void claimVerifiedMilestones(),4000);
  window.setTimeout(()=>void gradePredictions(),5000);
  gradeTimer=window.setInterval(()=>void gradePredictions(),5*60*1000);
  window.addEventListener('online',()=>{void claimVerifiedMilestones();void gradePredictions()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){void claimVerifiedMilestones();void gradePredictions()}});
}
