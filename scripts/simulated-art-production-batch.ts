import 'dotenv/config';
import { setTimeout as wait } from 'node:timers/promises';
import { defaultAppearance } from '../solo/appearance';
import { SOLO_PLAYERS_DATABASE } from '../soloUniverse';

const origin=String(process.env.SIMULATED_PLAYER_ART_API_ORIGIN||'https://ballknowerofficial.com').replace(/\/$/,'');
const adminKey=String(process.env.SIMULATED_PLAYER_ART_ADMIN_KEY||'');
const command=String(process.argv[2]||'status');
const approvedLocal=new Set<string>([
  'bk-001-eli-rodriguez','solo-brk-02','solo-slc-02','solo-brk-05','solo-slc-05','solo-brk-10','solo-slc-10','solo-brk-15','solo-slc-15',
  'solo-brk-21','solo-slc-20','solo-brk-30','solo-slc-30','solo-brk-38','solo-slc-38','solo-brk-46','solo-slc-45','solo-brk-52','solo-slc-52',
]);

if(!adminKey)throw new Error('SIMULATED_PLAYER_ART_ADMIN_KEY is required. Never paste it into chat or commit it.');

async function post(body:Record<string,unknown>) {
  const response=await fetch(`${origin}/api/simulated-player-art`,{method:'POST',headers:{'content-type':'application/json','x-ball-knower-art-key':adminKey},body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({error:`HTTP ${response.status}`}));
  if(!response.ok)throw new Error(String(result?.detail||result?.error||`HTTP ${response.status}`));
  return result;
}

const jobs=SOLO_PLAYERS_DATABASE.filter(player=>!approvedLocal.has(player.id)).map(player=>({
  playerId:player.id,team:player.team,variant:'home',position:player.position,name:player.name,number:player.jerseyNumber,
  age:player.age,heightInches:player.heightInches,weightLbs:player.weightLbs,appearance:defaultAppearance(player),attempt:0,
}));

async function status() {console.log(JSON.stringify(await post({action:'status'}),null,2));}

async function submit() {
  let submitted=0;
  for(let index=0;index<jobs.length;index+=16){
    const result=await post({action:'submit-batch',qualityTier:'economy',jobs:jobs.slice(index,index+16)});
    submitted+=Number(result.submitted||0);
    console.log(JSON.stringify({submitted,total:jobs.length,batchId:result.batchId,budget:result.budget}));
    if(result.budgetExhausted)break;
  }
  console.log(JSON.stringify({submissionComplete:true,submitted,expected:jobs.length},null,2));
}

async function syncOnce() {console.log(JSON.stringify(await post({action:'sync-open-batches'}),null,2));}

async function watch() {
  for(;;){
    const result=await post({action:'sync-open-batches'});
    console.log(JSON.stringify(result));
    if(result.status==='idle')break;
    await wait(30_000);
  }
}

if(command==='status')await status();
else if(command==='submit')await submit();
else if(command==='sync')await syncOnce();
else if(command==='watch')await watch();
else throw new Error('Use: status, submit, sync, or watch.');

