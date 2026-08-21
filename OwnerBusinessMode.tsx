import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, DollarSign, Heart, MapPin, Shirt, Ticket, UtensilsCrossed, TrendingUp, Users } from 'lucide-react';

const SAVE_KEY='ballknower_owner_business_v2';

export type OwnerTeamBaseline = {
  abbr:string; team:string; stadium:string; capacity:number; valuationB:number; valuationSource:'Forbes 2025 estimate'; stadiumSource:'public stadium capacity'; homeGames2026:number; scheduleSource:'NFL.com 2026 opponents';
};
type Pricing={ticket:number;parking:number;food:number;merch:number};
type OwnerSave={abbr:string;pricing:Pricing;facility:number;marketing:number;staff:number};

const AFC=new Set(['BAL','BUF','CIN','CLE','DEN','HOU','IND','JAX','KC','LV','LAC','MIA','NE','NYJ','PIT','TEN']);
const TEAMS:OwnerTeamBaseline[]=[
['ARI','Arizona Cardinals','State Farm Stadium',63400,5.5],['ATL','Atlanta Falcons','Mercedes-Benz Stadium',71000,6.2],['BAL','Baltimore Ravens','M&T Bank Stadium',71008,6.5],['BUF','Buffalo Bills','New Highmark Stadium',62000,6.1],
['CAR','Carolina Panthers','Bank of America Stadium',74867,5.7],['CHI','Chicago Bears','Soldier Field',61500,8.8],['CIN','Cincinnati Bengals','Paycor Stadium',65515,5.25],['CLE','Cleveland Browns','Huntington Bank Field',67431,6.4],
['DAL','Dallas Cowboys','AT&T Stadium',80000,13],['DEN','Denver Broncos','Empower Field at Mile High',76125,7.3],['DET','Detroit Lions','Ford Field',65000,6.7],['GB','Green Bay Packers','Lambeau Field',81441,6.5],
['HOU','Houston Texans','NRG Stadium',72220,6.6],['IND','Indianapolis Colts','Lucas Oil Stadium',67000,5.9],['JAX','Jacksonville Jaguars','EverBank Stadium',67814,5.4],['KC','Kansas City Chiefs','GEHA Field at Arrowhead Stadium',76416,7.0],
['LV','Las Vegas Raiders','Allegiant Stadium',65000,7.7],['LAC','Los Angeles Chargers','SoFi Stadium',70240,6.9],['LAR','Los Angeles Rams','SoFi Stadium',70240,10.5],['MIA','Miami Dolphins','Hard Rock Stadium',64767,7.5],
['MIN','Minnesota Vikings','U.S. Bank Stadium',66860,6.6],['NE','New England Patriots','Gillette Stadium',64628,9.0],['NO','New Orleans Saints','Caesars Superdome',73208,5.3],['NYG','New York Giants','MetLife Stadium',82500,10.1],
['NYJ','New York Jets','MetLife Stadium',82500,8.8],['PHI','Philadelphia Eagles','Lincoln Financial Field',67594,8.3],['PIT','Pittsburgh Steelers','Acrisure Stadium',68400,7.0],['SF','San Francisco 49ers','Levi’s Stadium',68500,8.6],
['SEA','Seattle Seahawks','Lumen Field',68740,6.8],['TB','Tampa Bay Buccaneers','Raymond James Stadium',65618,6.6],['TEN','Tennessee Titans','Nissan Stadium',69143,5.7],['WAS','Washington Commanders','Northwest Stadium',62000,7.4],
].map(([abbr,team,stadium,capacity,valuationB])=>({abbr:String(abbr),team:String(team),stadium:String(stadium),capacity:Number(capacity),valuationB:Number(valuationB),valuationSource:'Forbes 2025 estimate' as const,stadiumSource:'public stadium capacity' as const,homeGames2026:AFC.has(String(abbr))?8:9,scheduleSource:'NFL.com 2026 opponents' as const}));

const defaults:OwnerSave={abbr:'PHI',pricing:{ticket:165,parking:45,food:13,merch:125},facility:72,marketing:65,staff:78};
const restore=():OwnerSave=>{try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return defaults;const saved=JSON.parse(raw);return {...defaults,...saved,pricing:{...defaults.pricing,...saved?.pricing}};}catch{return defaults;}};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);

export const OwnerBusinessMode:React.FC<{onBack:()=>void}>=({onBack})=>{
 const initial=useMemo(restore,[]);
 const [abbr,setAbbr]=useState(initial.abbr);
 const [pricing,setPricing]=useState<Pricing>(initial.pricing);
 const [facility,setFacility]=useState(initial.facility);
 const [marketing,setMarketing]=useState(initial.marketing);
 const [staff,setStaff]=useState(initial.staff);
 const team=TEAMS.find(t=>t.abbr===abbr)||TEAMS.find(t=>t.abbr==='PHI')||TEAMS[0];

 useEffect(()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify({abbr,pricing,facility,marketing,staff} satisfies OwnerSave));}catch{}},[abbr,pricing,facility,marketing,staff]);

 const model=useMemo(()=>{
   const affordability=clamp(100-((pricing.ticket-130)*.22+(pricing.parking-35)*.45+(pricing.food-10)*1.8+(pricing.merch-100)*.08),15,100);
   const fanSatisfaction=Math.round(clamp(affordability*.42+facility*.23+marketing*.12+staff*.08+76*.15,0,100));
   const demand=clamp(.72+(fanSatisfaction-60)/170-(pricing.ticket-150)/1100,.45,1.04);
   const attendance=Math.round(Math.min(team.capacity,team.capacity*demand));
   const tickets=attendance*team.homeGames2026*pricing.ticket;
   const parking=attendance*team.homeGames2026*.42*pricing.parking;
   const concessions=attendance*team.homeGames2026*.77*pricing.food*1.9;
   const merch=attendance*team.homeGames2026*.18*pricing.merch;
   const localRevenue=tickets+parking+concessions+merch;
   const opsCost=team.capacity*(facility*125+staff*85)+marketing*850000;
   const operatingContribution=localRevenue-opsCost;
   const valueChange=(fanSatisfaction-70)*.003+(operatingContribution/1000000000)*.04;
   return {fanSatisfaction,attendance,localRevenue,operatingContribution,projectedValue:team.valuationB*(1+valueChange)};
 },[team,pricing,facility,marketing,staff]);

 const slider=(label:string,value:number,min:number,max:number,step:number,setter:(v:number)=>void,icon:React.ReactNode,suffix='')=><label className="block rounded-2xl border border-white/10 bg-black/25 p-4"><div className="mb-3 flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-300">{icon}{label}</span><span className="font-mono text-sm font-black text-[var(--bk-team-accent)]">{suffix==='$'?money(value):`${value}${suffix}`}</span></div><input className="w-full accent-[var(--bk-team-accent)]" type="range" min={min} max={max} step={step} value={value} onChange={e=>setter(Number(e.target.value))}/></label>;

 return <div className="min-h-[100dvh] px-4 py-5 text-white sm:px-8"><div className="mx-auto max-w-6xl">
   <div className="mb-5 flex items-center justify-between gap-4"><button onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 text-xs font-black"><ArrowLeft size={16}/> SOLO</button><div className="text-right"><div className="text-[10px] font-black tracking-[.25em] text-[var(--bk-team-accent)]">OWNER / BUSINESS</div><div className="text-xl font-black">RUN THE FRANCHISE</div></div></div>

   <section className="overflow-hidden rounded-[2rem] border border-[var(--bk-team-accent)]/40 bg-[#090c12]/90 p-5 shadow-2xl sm:p-7"><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-[10px] font-black tracking-[.25em] text-zinc-500">REAL-WORLD BASELINE</div><h2 className="mt-1 text-4xl font-black sm:text-5xl">{team.team}</h2><p className="mt-2 text-sm font-semibold text-zinc-400">{team.stadium} · {team.capacity.toLocaleString()} seats · {team.homeGames2026} designated home games in 2026</p></div><select value={abbr} onChange={e=>setAbbr(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-black px-3 py-3 text-sm font-black">{TEAMS.map(t=><option key={t.abbr} value={t.abbr}>{t.abbr} — {t.team}</option>)}</select></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['FAN SATISFACTION',`${model.fanSatisfaction}/100`,Heart],['PROJECTED ATTENDANCE',model.attendance.toLocaleString(),Users],['LOCAL REVENUE',money(model.localRevenue),DollarSign],['FRANCHISE VALUE',`$${model.projectedValue.toFixed(2)}B`,TrendingUp]].map(([l,v,I]:any)=><div key={l} className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><I size={18} className="text-[var(--bk-team-accent)]"/><div className="mt-3 text-[9px] font-black tracking-wider text-zinc-500">{l}</div><div className="mt-1 text-lg font-black">{v}</div></div>)}</div></div><div className="rounded-3xl border border-white/10 bg-black/30 p-5"><div className="text-xs font-black uppercase tracking-widest text-[var(--bk-team-accent)]">Owner Objective</div><div className="mt-3 text-3xl font-black">KEEP FANS HAPPY.</div><p className="mt-3 text-sm leading-relaxed text-zinc-400">Winning matters, but so do affordability, stadium quality and trust. Raise prices too aggressively and demand falls. Invest wisely and long-term franchise value grows.</p><div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-zinc-400"><b className="text-white">Data transparency:</b> capacity is a public stadium baseline, value uses a 2025 Forbes estimate, and the 2026 home-game count follows the NFL.com home/away opponent list. Revenue, demand and future value are Ball Knower simulation outputs.</div></div></div></section>

   <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><Ticket className="text-[var(--bk-team-accent)]"/><h3 className="text-2xl font-black">STADIUM ECONOMICS</h3></div><div className="space-y-3">{slider('Average ticket',pricing.ticket,60,400,5,v=>setPricing(p=>({...p,ticket:v})),<Ticket size={15}/>,'$')}{slider('Parking',pricing.parking,10,120,5,v=>setPricing(p=>({...p,parking:v})),<MapPin size={15}/>,'$')}{slider('Average food basket',pricing.food,5,35,1,v=>setPricing(p=>({...p,food:v})),<UtensilsCrossed size={15}/>,'$')}{slider('Average merch item',pricing.merch,50,250,5,v=>setPricing(p=>({...p,merch:v})),<Shirt size={15}/>,'$')}</div></section><section className="rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><Building2 className="text-[var(--bk-team-accent)]"/><h3 className="text-2xl font-black">ORGANIZATION</h3></div><div className="space-y-3">{slider('Facilities',facility,25,100,1,setFacility,<Building2 size={15}/>,'%')}{slider('Marketing',marketing,25,100,1,setMarketing,<TrendingUp size={15}/>,'%')}{slider('Staff investment',staff,25,100,1,setStaff,<Users size={15}/>,'%')}</div><div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between text-xs font-black"><span>OPERATING CONTRIBUTION</span><span className={model.operatingContribution>=0?'text-emerald-300':'text-red-300'}>{money(model.operatingContribution)}</span></div><div className="mt-2 text-[11px] leading-relaxed text-zinc-500">Modeled local-business contribution only. National media distributions, debt service, taxes and confidential club expenses are excluded until reliable data is available.</div></div></section></div>

   <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-5 sm:p-6"><div className="flex items-center gap-2"><MapPin className="text-[var(--bk-team-accent)]"/><h3 className="text-2xl font-black">RELOCATION & MARKET STUDY</h3></div><p className="mt-2 max-w-3xl text-sm text-zinc-400">Relocation remains a multi-step owner decision: market study → stadium plan → fan backlash/approval → league vote → rebrand. Market scores stay labeled simulated until the real population, income, corporate-base and stadium data pipeline is connected.</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{['San Antonio','St. Louis','Portland'].map(city=><div key={city} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-lg font-black">{city}</div><div className="mt-2 text-[10px] font-black tracking-wider text-zinc-500">MARKET STUDY</div><div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs font-semibold text-amber-200">Real market inputs pending — no fake opportunity score shown.</div></div>)}</div></section>
  </div></div>;
};

export default OwnerBusinessMode;
