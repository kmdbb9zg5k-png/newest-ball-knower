import React,{useMemo,useState} from 'react';
import {ArrowRightLeft,CalendarDays,Medal,ShieldCheck,Star} from 'lucide-react';
import {League,Player} from './types';
import {getPlayerOvr} from './evaluation';
import {analyzeTrade} from './leagueIntelligence';

const offense=new Set(['QB','RB','FB','WR','TE','OT','LT','RT','OG','LG','RG','C']);
const defense=new Set(['EDGE','DT','DE','NT','LB','CB','S','FS','SS']);

function weeklyPlayers(league:League){
 const result=league.seasonResult;if(!result)return [];
 const weeks=[...new Set(result.games.map(g=>g.week))].sort((a,b)=>a-b);
 return weeks.map(week=>{
  const winners=new Set(result.games.filter(g=>g.week===week).map(g=>g.winnerId));
  const pool=league.members.filter(m=>winners.has(m.id)).flatMap(m=>(m.roster||[]).map(p=>({m,p,score:getPlayerOvr(p)+(p.position==='QB'?2:0)}))).sort((a,b)=>b.score-a.score);
  const winner=pool[0];return winner?{week,memberId:winner.m.id,memberName:winner.m.userName,player:winner.p}:null;
 }).filter(Boolean) as {week:number;memberId:string;memberName:string;player:Player}[];
}

function allBallKnowerTeam(league:League){
 const pool=league.members.flatMap(m=>(m.roster||[]).map(p=>({m,p,score:getPlayerOvr(p)+(m.teamRatings?.overall||0)*.04})));
 const pick=(label:string,test:(p:Player)=>boolean,count=1)=>pool.filter(x=>test(x.p)).sort((a,b)=>b.score-a.score).slice(0,count).map(x=>({label,...x}));
 return [
  ...pick('QB',p=>p.position==='QB'),...pick('RB',p=>['RB','FB'].includes(p.position)),...pick('WR',p=>p.position==='WR',2),...pick('TE',p=>p.position==='TE'),...pick('OL',p=>['OT','LT','RT','OG','LG','RG','C'].includes(p.position),4),
  ...pick('DL / EDGE',p=>['EDGE','DT','DE','NT'].includes(p.position),3),...pick('LB',p=>p.position==='LB',2),...pick('CB',p=>p.position==='CB',2),...pick('S',p=>['S','FS','SS'].includes(p.position),2),...pick('K',p=>p.position==='K'),...pick('P',p=>p.position==='P')
 ];
}

export const IntelligenceExtras:React.FC<{league:League}>=({league})=>{
 const [mode,setMode]=useState<'weekly'|'allteam'|'trade'>('weekly');
 const [proposer,setProposer]=useState(league.members[0]?.id||'');const[recipient,setRecipient]=useState(league.members[1]?.id||'');const[offer,setOffer]=useState('');const[request,setRequest]=useState('');
 const weekly=useMemo(()=>weeklyPlayers(league),[league]);const allTeam=useMemo(()=>allBallKnowerTeam(league),[league]);
 const proposerMember=league.members.find(m=>m.id===proposer);const recipientMember=league.members.find(m=>m.id===recipient);
 const analysis=useMemo(()=>analyzeTrade(league,proposer,recipient,offer?[offer]:[],request?[request]:[]),[league,proposer,recipient,offer,request]);
 return <section className="mt-6 space-y-4 rounded-[1.75rem] border border-white/10 bg-[#0b0e12] p-4 sm:p-6">
  <div><div className="text-[9px] font-black uppercase tracking-[.22em] text-[#D4AF37]">Intelligence Studio</div><h3 className="mt-1 text-2xl font-black uppercase">Awards + Trade Lab</h3></div>
  <div className="flex gap-2 overflow-x-auto">{[['weekly','Weekly Awards',<CalendarDays className="h-4 w-4"/>],['allteam','All-BK Team',<Star className="h-4 w-4"/>],['trade','Trade Lab',<ArrowRightLeft className="h-4 w-4"/>]].map(([id,label,icon])=><button key={String(id)} onClick={()=>setMode(id as any)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-[10px] font-black uppercase ${mode===id?'bg-white text-black':'border border-white/10 text-zinc-400'}`}>{icon as React.ReactNode}{label as string}</button>)}</div>

  {mode==='weekly'&&<div className="space-y-2">{weekly.length?weekly.map(w=><div key={w.week} className="flex items-center justify-between gap-3 rounded-2xl bg-[#101318] p-4"><div><div className="text-[9px] font-black uppercase text-[#D4AF37]">Week {w.week} Player of the Week</div><div className="mt-1 font-black uppercase">{w.player.name}</div><div className="text-[10px] text-zinc-500">{w.memberName} · {w.player.position}</div></div><div className="text-2xl font-black">{w.player.ovr}</div></div>):<Empty text="Weekly awards unlock once games are played."/>}</div>}

  {mode==='allteam'&&<div className="space-y-3"><div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-400"><Medal className="h-4 w-4 text-[#D4AF37]"/>The best roster pieces across the entire league</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{allTeam.map((x,i)=><div key={`${x.label}-${x.p.id}-${i}`} className="rounded-2xl bg-[#101318] p-4"><div className="text-[9px] font-black uppercase text-[#D4AF37]">{x.label}</div><div className="mt-1 text-sm font-black uppercase">{x.p.name}</div><div className="mt-1 flex justify-between text-[10px] text-zinc-500"><span>{x.m.userName}</span><span>{x.p.ovr} OVR</span></div></div>)}</div>{!allTeam.length&&<Empty text="The All-Ball-Knower Team appears after rosters are submitted."/>}</div>}

  {mode==='trade'&&<div className="space-y-4"><div className="grid gap-2 md:grid-cols-2"><select value={proposer} onChange={e=>{setProposer(e.target.value);setOffer('')}} className="min-h-11 rounded-xl bg-[#101318] px-3 text-xs font-bold">{league.members.map(m=><option key={m.id} value={m.id}>{m.userName}</option>)}</select><select value={recipient} onChange={e=>{setRecipient(e.target.value);setRequest('')}} className="min-h-11 rounded-xl bg-[#101318] px-3 text-xs font-bold">{league.members.filter(m=>m.id!==proposer).map(m=><option key={m.id} value={m.id}>{m.userName}</option>)}</select><select value={offer} onChange={e=>setOffer(e.target.value)} className="min-h-11 rounded-xl bg-[#101318] px-3 text-xs"><option value="">Player from {proposerMember?.userName||'Team A'}</option>{(proposerMember?.roster||[]).map(p=><option key={p.id} value={p.id}>{p.name} · {p.ovr} · ${p.salary}M</option>)}</select><select value={request} onChange={e=>setRequest(e.target.value)} className="min-h-11 rounded-xl bg-[#101318] px-3 text-xs"><option value="">Player from {recipientMember?.userName||'Team B'}</option>{(recipientMember?.roster||[]).map(p=><option key={p.id} value={p.id}>{p.name} · {p.ovr} · ${p.salary}M</option>)}</select></div>{offer&&request?<div className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-black uppercase text-[#D4AF37]">Ball Knower Trade Analyzer</div><div className="mt-1 text-lg font-black uppercase">{analysis.winner==='even'?'Even Deal':`${analysis.winner==='proposer'?proposerMember?.userName:recipientMember?.userName} projects ahead`}</div></div><div className="text-center"><div className="text-3xl font-black">{analysis.fairness}%</div><div className="text-[8px] font-black uppercase text-zinc-500">Fairness</div></div></div><p className="mt-3 text-xs text-zinc-400">{analysis.explanation}</p><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label={`${proposerMember?.userName} OVR`} value={`${analysis.proposerOvrDelta>=0?'+':''}${analysis.proposerOvrDelta}`}/><Mini label={`${recipientMember?.userName} OVR`} value={`${analysis.recipientOvrDelta>=0?'+':''}${analysis.recipientOvrDelta}`}/><Mini label="A Cap Change" value={`${analysis.proposerCapDelta>=0?'+':''}$${analysis.proposerCapDelta}M`}/><Mini label="B Cap Change" value={`${analysis.recipientCapDelta>=0?'+':''}$${analysis.recipientCapDelta}M`}/></div></div>:<Empty text="Choose one player from each team to analyze the deal before sending it."/>}</div>}
 </section>;
};
const Mini=({label,value}:{label:string;value:string})=><div className="rounded-xl bg-black/30 p-3 text-center"><div className="truncate text-[8px] font-black uppercase text-zinc-600">{label}</div><div className="mt-1 text-sm font-black">{value}</div></div>;
const Empty=({text}:{text:string})=><div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-xs text-zinc-600"><ShieldCheck className="mx-auto mb-2 h-5 w-5"/>{text}</div>;
