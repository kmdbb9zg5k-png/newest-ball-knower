import React,{useEffect,useMemo,useState} from 'react';
import {Bandage,CheckCircle2,Gavel,RefreshCw,ShieldAlert} from 'lucide-react';
import {League} from './types';
import {useBallKnower} from './BallKnowerContext';
import {createInjury,fetchSeasonOperations,processWaiverClaim,WaiverClaim} from './fantasySeasonCloud';

export const FantasySeasonAdmin:React.FC<{league:League}>=({league})=>{
  const {currentUser,showToast}=useBallKnower();
  const isCommissioner=currentUser?.id===league.commissionerId;
  const [claims,setClaims]=useState<WaiverClaim[]>([]); const [busy,setBusy]=useState(false);
  const pending=useMemo(()=>claims.filter(c=>c.status==='pending').sort((a,b)=>a.priority-b.priority||a.createdAt.localeCompare(b.createdAt)),[claims]);
  const refresh=async()=>{try{const data=await fetchSeasonOperations(league.id);setClaims([...data.claims]);}catch(e:any){showToast(e?.message||'Could not load commissioner queue.');}};
  useEffect(()=>{if(isCommissioner)void refresh();},[league.id,isCommissioner]);
  if(!isCommissioner)return null;

  const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await fn();await refresh();}catch(e:any){showToast(e?.message||'Commissioner operation failed.');}finally{setBusy(false);}};
  const processAll=()=>run(async()=>{
    const seen=new Set<string>();
    for(const claim of pending){if(seen.has(claim.playerId))continue;seen.add(claim.playerId);try{await processWaiverClaim(claim.id);}catch{/* keep processing the rest */}}
    showToast('Waiver run completed. Rosters that changed were reopened for validation.');
  });
  const generateInjuries=()=>run(async()=>{
    if(league.settings?.injuriesEnabled===false)throw new Error('Injuries are disabled in league settings.');
    let created=0;
    for(const member of league.members){
      const roster=member.roster||[]; if(!roster.length)continue;
      const roll=Math.random(); if(roll>0.22)continue;
      const player=roster[Math.floor(Math.random()*roster.length)];
      const severe=Math.random(); const severity=severe>.97?'season_ending':severe>.82?'major':severe>.5?'moderate':'minor';
      const weeks=severity==='season_ending'?17:severity==='major'?4:severity==='moderate'?2:1;
      await createInjury(league.id,member.id,player,severity,weeks);created++;
    }
    showToast(created?`${created} weekly injury report item${created===1?'':'s'} generated.`:'No new injuries this week.');
  });

  return <div className="mt-5 rounded-2xl border border-[#D4AF37]/20 bg-[#0d1015] p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-black uppercase text-[#D4AF37]"><Gavel className="h-4 w-4"/>Season Commissioner Tools</div><p className="mt-1 text-[11px] text-zinc-500">Run waivers and generate the weekly injury report from one controlled panel.</p></div><button onClick={()=>void refresh()} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-[10px] font-black uppercase text-zinc-400"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-xl bg-black/30 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase"><CheckCircle2 className="h-4 w-4 text-emerald-400"/>Waiver Run</div><div className="mt-2 text-[11px] text-zinc-500">{pending.length} pending claim{pending.length===1?'':'s'} · lowest priority number wins first.</div><button disabled={!pending.length||busy} onClick={processAll} className="mt-3 min-h-11 w-full rounded-xl bg-white text-[10px] font-black uppercase text-black disabled:opacity-30">Process Pending Waivers</button></div>
      <div className="rounded-xl bg-black/30 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase"><Bandage className="h-4 w-4 text-red-400"/>Weekly Injury Roll</div><div className="mt-2 text-[11px] text-zinc-500">Uses league injury settings and creates minor through season-ending reports.</div><button disabled={busy} onClick={generateInjuries} className="mt-3 min-h-11 w-full rounded-xl border border-red-500/20 bg-red-500/5 text-[10px] font-black uppercase text-red-300 disabled:opacity-30"><ShieldAlert className="mr-2 inline h-3.5 w-3.5"/>Generate Weekly Injuries</button></div>
    </div>
  </div>;
};
