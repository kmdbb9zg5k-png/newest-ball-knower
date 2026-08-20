import React, { useMemo, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, ChevronRight, DollarSign, Handshake, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { PLAYERS_DATABASE } from './players';
import { Player } from './types';
import { playerPortraitUrl } from './playerPortraits';

const SAVE_KEY='ballknower_player_agent_v2';
const RECRUIT_COOLDOWN_DAYS=7;

type Pitch='money'|'brand'|'trust'|'winning';
type FutureDeal={totalM:number;annualM:number;years:number;negotiatedAt:string};
type Client={playerId:string;trust:number;careerEarnedM:number|null;careerEarningsSource?:string;futureDeal?:FutureDeal;signedAt:string};
type AgencyState={reputation:number;negotiation:number;brandPower:number;clientCare:number;clients:Client[];wins:number;losses:number;recruitCooldowns:Record<string,string>};
type RecruitState={playerId:string;interest:number;round:number;used:Pitch[];rivalPressure:number;message:string;failed?:boolean};

const fallbackAgency=():AgencyState=>({reputation:34,negotiation:40,brandPower:32,clientCare:58,clients:[],wins:0,losses:0,recruitCooldowns:{}});
const restore=():AgencyState=>{try{const raw=localStorage.getItem(SAVE_KEY)||localStorage.getItem('ballknower_player_agent_v1');if(!raw)return fallbackAgency();const v=JSON.parse(raw);return {...fallbackAgency(),...v,clients:Array.isArray(v?.clients)?v.clients.map((c:any)=>{const source=typeof c.careerEarningsSource==='string'&&c.careerEarningsSource.trim()?c.careerEarningsSource.trim():undefined;return {playerId:String(c.playerId),trust:Number(c.trust)||72,careerEarnedM:source&&Number.isFinite(c.careerEarnedM)?Number(c.careerEarnedM):null,careerEarningsSource:source||'Not yet sourced',futureDeal:c.futureDeal,signedAt:c.signedAt||new Date().toISOString()};}):[],recruitCooldowns:v?.recruitCooldowns&&typeof v.recruitCooldowns==='object'?v.recruitCooldowns:{}};}catch{return fallbackAgency()}};
const persist=(state:AgencyState)=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{}};
const moneyM=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:1}).format(n*1_000_000);
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const cooldownDaysLeft=(until?:string)=>{if(!until)return 0;const ms=new Date(until).getTime()-Date.now();return Math.max(0,Math.ceil(ms/86400000));};

const marketProjection=(p:Player)=>{
  const age=p.age??27;
  const ageFactor=age<=25?1.12:age<=28?1:age<=31?.84:.62;
  const positionPremium=p.position==='QB'?1.55:['WR','EDGE','OT','LT','RT','CB'].includes(p.position)?1.18:1;
  return Math.max(p.salary*1.05,(p.ovr-65)*1.08*ageFactor*positionPremium);
};
const signingDifficulty=(p:Player)=>clamp(Math.round(38+(p.ovr-75)*2.4+(p.salary>20?9:0)+(p.ovr>=90?10:0)),38,92);
const pitchLabel:Record<Pitch,string>={money:'Maximize My Money',brand:'Build My Brand',trust:'Player-First Relationship',winning:'Put Me in Position to Win'};
const pitchImpact=(pitch:Pitch,p:Player,agency:AgencyState)=>{
  const age=p.age??27;
  if(pitch==='money')return 8+agency.negotiation*.09+(p.salary<marketProjection(p)*.72?5:0);
  if(pitch==='brand')return 6+agency.brandPower*.11+(p.ovr>=88?4:0);
  if(pitch==='trust')return 7+agency.clientCare*.12+(age<=25?4:0);
  return 6+agency.reputation*.08+(p.ovr>=85?3:0);
};

export const PlayerAgentMode:React.FC<{onBack:()=>void}>=({onBack})=>{
  const [agency,setAgency]=useState<AgencyState>(restore);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [recruit,setRecruit]=useState<RecruitState|null>(null);
  const [filter,setFilter]=useState('ALL');

  const clients=useMemo(()=>agency.clients.map(c=>({client:c,player:PLAYERS_DATABASE.find(p=>p.id===c.playerId)})).filter((x):x is {client:Client;player:Player}=>Boolean(x.player)),[agency.clients]);
  const prospects=useMemo(()=>PLAYERS_DATABASE.filter(p=>p.active!==false&&!agency.clients.some(c=>c.playerId===p.id)&&(filter==='ALL'||p.position===filter)).sort((a,b)=>b.ovr-a.ovr).slice(0,80),[agency.clients,filter]);
  const selected=PLAYERS_DATABASE.find(p=>p.id===selectedId)||null;

  const beginRecruit=(p:Player)=>{
    const daysLeft=cooldownDaysLeft(agency.recruitCooldowns[p.id]);
    if(daysLeft>0){setSelectedId(p.id);setRecruit({playerId:p.id,interest:0,round:1,used:[],rivalPressure:0,failed:true,message:`${p.name} is not taking another meeting with your agency yet. You can approach again in ${daysLeft} day${daysLeft===1?'':'s'}.`});return;}
    const difficulty=signingDifficulty(p);
    const base=clamp(18+agency.reputation*.32+agency.clientCare*.12-difficulty*.22,8,58);
    setSelectedId(p.id);
    setRecruit({playerId:p.id,interest:Math.round(base),round:1,used:[],rivalPressure:Math.round(30+difficulty*.55),message:`${p.name} is listening, but you need to give him a reason to trust your agency.`});
  };

  const makePitch=(pitch:Pitch)=>{
    if(!selected||!recruit||recruit.failed||recruit.playerId!==selected.id||recruit.used.includes(pitch))return;
    const impact=pitchImpact(pitch,selected,agency);
    const repeatPenalty=recruit.round>2?2:0;
    const rivalSwing=(recruit.rivalPressure/100)*4;
    const nextInterest=clamp(Math.round(recruit.interest+impact-repeatPenalty-rivalSwing),0,100);
    const threshold=signingDifficulty(selected);
    let message=`${selected.name} liked the ${pitchLabel[pitch].toLowerCase()} pitch. Interest is now ${nextInterest}%.`;
    if(nextInterest>=threshold)message=`You have enough momentum to ask ${selected.name} to sign. Rival agencies are still in the room.`;
    setRecruit({...recruit,interest:nextInterest,round:recruit.round+1,used:[...recruit.used,pitch],message});
  };

  const askToSign=()=>{
    if(!selected||!recruit||recruit.failed)return;
    const threshold=signingDifficulty(selected);
    const agencyEdge=(agency.reputation+agency.negotiation+agency.clientCare)/30;
    const rivalPenalty=recruit.rivalPressure/18;
    const won=recruit.interest+agencyEdge-rivalPenalty>=threshold;
    if(won){
      const cooldowns={...agency.recruitCooldowns};delete cooldowns[selected.id];
      const next:AgencyState={...agency,reputation:clamp(agency.reputation+(selected.ovr>=90?5:3),0,100),clients:[...agency.clients,{playerId:selected.id,trust:72,careerEarnedM:null,careerEarningsSource:'Not yet sourced',signedAt:new Date().toISOString()}],wins:agency.wins+1,recruitCooldowns:cooldowns};
      setAgency(next);persist(next);setRecruit(null);setSelectedId(null);
    }else{
      const until=new Date(Date.now()+RECRUIT_COOLDOWN_DAYS*86400000).toISOString();
      const next:AgencyState={...agency,losses:agency.losses+1,recruitCooldowns:{...agency.recruitCooldowns,[selected.id]:until}};
      setAgency(next);persist(next);
      setRecruit({...recruit,failed:true,message:`${selected.name} chose another agency. You cannot immediately spam another meeting — recruiting reopens in ${RECRUIT_COOLDOWN_DAYS} days.`});
    }
  };

  const negotiateExtension=(p:Player,c:Client)=>{
    if(c.futureDeal)return;
    const projected=marketProjection(p);
    const years=p.age&&p.age>=30?2:4;
    const annualM=Number((projected*(.92+agency.negotiation/500)).toFixed(1));
    const deal:FutureDeal={totalM:Number((annualM*years).toFixed(1)),annualM,years,negotiatedAt:new Date().toISOString()};
    const nextClients=agency.clients.map(x=>x.playerId===p.id?{...x,futureDeal:deal,trust:clamp(x.trust+4,0,100)}:x);
    const next={...agency,negotiation:clamp(agency.negotiation+2,0,100),reputation:clamp(agency.reputation+1,0,100),clients:nextClients};
    setAgency(next);persist(next);
  };

  return <div className="min-h-[100dvh] px-4 py-5 text-white sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="mb-5 flex items-center justify-between gap-4"><button onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 text-xs font-black"><ArrowLeft size={16}/> SOLO</button><div className="text-right"><div className="text-[10px] font-black tracking-[.25em] text-violet-300">PLAYER REPRESENTATION</div><div className="text-xl font-black">AGENT MODE</div></div></div>
    <section className="overflow-hidden rounded-[2rem] border border-violet-300/25 bg-[#090c12]/90 p-5 shadow-2xl sm:p-7"><div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><div><div className="text-[10px] font-black tracking-[.26em] text-violet-300">BUILD YOUR AGENCY</div><h1 className="mt-2 text-4xl font-black leading-none sm:text-6xl">THE PLAYER HAS TO<br/>CHOOSE YOU.</h1><p className="mt-4 max-w-3xl text-sm font-semibold leading-relaxed text-zinc-400">Recruit real NFL players from their current Ball Knower roster/contract baseline. Elite players are harder to win over. Your reputation, negotiation skill, brand power and client care affect whether they choose your agency.</p></div><div className="rounded-3xl border border-white/10 bg-black/30 p-5"><div className="text-xs font-black tracking-wider text-violet-300">AGENCY REPUTATION</div><div className="mt-2 text-5xl font-black">{agency.reputation}</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs">{[['Negotiation',agency.negotiation],['Brand',agency.brandPower],['Client Care',agency.clientCare],['Clients',clients.length]].map(([l,v])=><div key={String(l)} className="rounded-xl bg-white/5 p-3"><div className="text-zinc-500">{l}</div><div className="mt-1 font-black text-white">{v}</div></div>)}</div></div></div></section>

    {clients.length>0&&<section className="mt-5 rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><BriefcaseBusiness className="text-violet-300"/><h2 className="text-2xl font-black">YOUR CLIENTS</h2></div><div className="grid gap-3 md:grid-cols-2">{clients.map(({client,player})=><div key={player.id} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center gap-3"><img src={playerPortraitUrl(player)} alt="" className="h-14 w-14 rounded-xl bg-white/5 object-cover"/><div className="min-w-0 flex-1"><div className="font-black">{player.name}</div><div className="text-xs text-zinc-500">{player.team} · {player.position} · {player.ovr} OVR</div></div><div className="text-right"><div className="text-[9px] font-black text-zinc-500">TRUST</div><div className="font-black text-emerald-300">{client.trust}%</div></div></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-white/5 p-3"><div className="text-zinc-500">Current 2026 cap hit</div><div className="mt-1 font-black">{moneyM(player.salary)}</div><div className="mt-1 text-[9px] text-zinc-600">{player.salarySource||'Current data source'}</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-zinc-500">Career earnings before takeover</div><div className="mt-1 font-black">{client.careerEarnedM==null?'SOURCE NEEDED':moneyM(client.careerEarnedM)}</div><div className="mt-1 text-[9px] text-zinc-600">{client.careerEarningsSource||'Not yet sourced'}</div></div></div>{client.futureDeal?<div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs"><div className="font-black text-emerald-300">ACTIVE BALL KNOWER EXTENSION</div><div className="mt-1 text-zinc-300">{client.futureDeal.years} years · {moneyM(client.futureDeal.totalM)} total · {moneyM(client.futureDeal.annualM)}/yr</div></div>:<button onClick={()=>negotiateExtension(player,client)} className="mt-3 min-h-11 w-full rounded-xl bg-violet-400 px-4 text-xs font-black text-black">NEGOTIATE MARKET EXTENSION</button>}</div>)}</div></section>}

    <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black tracking-[.22em] text-violet-300">RECRUITING BOARD</div><h2 className="mt-1 text-3xl font-black">WHO CAN YOU CONVINCE?</h2></div><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-3 text-sm font-black">{['ALL','QB','RB','WR','TE','OT','EDGE','DT','LB','CB','S','K'].map(x=><option key={x}>{x}</option>)}</select></div><div className="mt-5 grid gap-3 md:grid-cols-2">{prospects.slice(0,24).map(p=>{const difficulty=signingDifficulty(p);const days=cooldownDaysLeft(agency.recruitCooldowns[p.id]);return <button key={p.id} onClick={()=>beginRecruit(p)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-violet-300/40"><img src={playerPortraitUrl(p)} alt="" className="h-16 w-16 rounded-xl bg-white/5 object-cover"/><div className="min-w-0 flex-1"><div className="truncate font-black">{p.name}</div><div className="text-xs text-zinc-500">{p.team} · {p.position} · Age {p.age??'—'}</div><div className="mt-1 text-[10px] text-zinc-600">2026 cap hit {moneyM(p.salary)} · {p.salarySource||'current data'}</div></div><div className="text-right"><div className="text-xl font-black text-violet-300">{p.ovr}</div><div className="text-[9px] font-black text-zinc-500">{days>0?`${days}D COOLDOWN`:`SIGN DIFF ${difficulty}`}</div></div></button>})}</div></section>

    {selected&&recruit&&<div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"><div className="mx-auto mt-[max(3rem,env(safe-area-inset-top))] max-w-2xl rounded-[2rem] border border-violet-300/30 bg-[#0d1118] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><img src={playerPortraitUrl(selected)} alt="" className="h-16 w-16 rounded-2xl bg-white/5 object-cover"/><div><div className="text-[10px] font-black tracking-wider text-violet-300">RECRUITING MEETING · ROUND {recruit.round}</div><div className="text-2xl font-black">{selected.name}</div><div className="text-xs text-zinc-500">{selected.team} · {selected.position} · {selected.ovr} OVR</div></div></div><button onClick={()=>{setRecruit(null);setSelectedId(null)}} className="min-h-11 rounded-full border border-white/10 px-3 py-2 text-xs font-black">CLOSE</button></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/5 p-3"><div className="text-[9px] font-black text-zinc-500">INTEREST</div><div className="mt-1 text-2xl font-black text-emerald-300">{recruit.interest}%</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-[9px] font-black text-zinc-500">RIVAL PRESSURE</div><div className="mt-1 text-2xl font-black text-amber-300">{recruit.rivalPressure}%</div></div><div className="rounded-xl bg-white/5 p-3"><div className="text-[9px] font-black text-zinc-500">TARGET</div><div className="mt-1 text-2xl font-black text-violet-300">{signingDifficulty(selected)}%</div></div></div><div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-semibold leading-relaxed text-zinc-300">“{recruit.message}”</div>{!recruit.failed&&<><div className="mt-5 grid gap-3 sm:grid-cols-2">{(['money','brand','trust','winning'] as Pitch[]).map(pitch=>{const used=recruit.used.includes(pitch);const icons={money:DollarSign,brand:Sparkles,trust:Handshake,winning:Star};const I=icons[pitch];return <button disabled={used} key={pitch} onClick={()=>makePitch(pitch)} className="min-h-11 rounded-2xl border border-white/10 bg-white/5 p-4 text-left disabled:opacity-35"><I size={18} className="text-violet-300"/><div className="mt-2 font-black">{pitchLabel[pitch]}</div><div className="mt-1 text-xs text-zinc-500">{pitch==='money'?'Sell your contract-negotiation edge and guaranteed-money strategy.':pitch==='brand'?'Pitch endorsements, visibility and long-term off-field value.':pitch==='trust'?'Promise hands-on representation and player-first decisions.':'Sell roster fit, career legacy and championship leverage.'}</div></button>})}</div><button disabled={recruit.interest<Math.max(35,signingDifficulty(selected)-18)} onClick={askToSign} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-400 px-5 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-35"><ShieldCheck size={18}/> ASK HIM TO SIGN <ChevronRight size={18}/></button></>}</div></div>}
  </div></div>;
};

export default PlayerAgentMode;