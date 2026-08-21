import React,{useEffect,useMemo,useState} from 'react';
import {Bandage,CheckCircle2,Gavel,RefreshCw,ShieldAlert} from 'lucide-react';
import {League} from './types';
import {useBallKnower} from './BallKnowerContext';
import {fetchNextInjuryWeek,fetchSeasonOperations,generateWeeklyInjuries,processWaiverClaim,WaiverClaim} from './fantasySeasonCloud';

export const FantasySeasonAdmin:React.FC<{league:League}>=({league})=>{
  const {currentUser,showToast}=useBallKnower();
  const isCommissioner=currentUser?.id===league.commissionerId;
  const [claims,setClaims]=useState<WaiverClaim[]>([]); const [busy,setBusy]=useState(false); const [injuryWeek,setInjuryWeek]=useState(1);
  const pending=useMemo(()=>claims.filter(c=>c.status==='pending').sort((a,b)=>a.priority-b.priority||a.createdAt.localeCompare(b.createdAt)),[claims]);
  const refresh=async(isCurrent:()=>boolean=()=>true)=>{try{const [data,nextWeek]=await Promise.all([fetchSeasonOperations(league.id),fetchNextInjuryWeek(league.id)]);if(isCurrent()){setClaims([...data.claims]);setInjuryWeek(nextWeek);}}catch(e:any){if(isCurrent())showToast(e?.message||'Could not load commissioner queue.');}};
  useEffect(()=>{if(!isCommissioner)return;let active=true;void refresh(()=>active);return()=>{active=false;};},[league.id,isCommissioner]);
  if(!isCommissioner)return null;

  const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);try{await fn();await refresh();}catch(e:any){showToast(e?.message||'Commissioner operation failed.');}finally{setBusy(false);}};
  const processAll=()=>run(async()=>{
    const seen=new Set<string>(); const failed:string[]=[]; let processed=0;
    for(const claim of pending){if(seen.has(claim.playerId))continue;seen.add(claim.playerId);try{await processWaiverClaim(claim.id);processed++;}catch{failed.push(claim.id);}}
    if(failed.length){showToast(`${processed} waiver claim${processed===1?'':'s'} processed; ${failed.length} failed and remain in the queue.`);return;}
    showToast(processed?'Waiver run completed. Rosters that changed were reopened for validation.':'No pending waiver claims were processed.');
  });
  const generateInjuries=()=>run(async()=>{
    if(league.settings?.injuriesEnabled===false)throw new Error('Injuries are disabled in league settings.');
    const result=await generateWeeklyInjuries(league.id,injuryWeek);
    if(result.reused){showToast(`Week ${result.week} injury report was already generated. Reused the saved report with ${result.created} item${result.created===1?'':'s'}.`);return;}
    showToast(result.created?`Week ${result.week}: ${result.created} injury report item${result.created===1?'':'s'} generated.`:`Week ${result.week}: no new injuries.`);
  });

  return <section className="relative mt-5 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#070a0f] p-4 shadow-[0_28px_70px_rgba(0,0,0,.48)] sm:p-5">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_-5%,rgb(var(--bk-team-primary-rgb)/.34),transparent_38%),radial-gradient(ellipse_at_90%_4%,rgb(var(--bk-team-secondary-rgb)/.22),transparent_34%),linear-gradient(145deg,rgba(255,255,255,.045),transparent_28%,rgba(0,0,0,.5)_72%)]"/>
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-60 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,.28)_0_1px,transparent_2px),radial-gradient(circle_at_82%_0%,rgba(255,255,255,.22)_0_1px,transparent_2px)] bg-[length:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent)]"/>
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-8%] bottom-[-5.5rem] h-44 rotate-[-2deg] rounded-[50%] border-t border-white/10 bg-[repeating-linear-gradient(90deg,transparent_0_34px,rgba(255,255,255,.035)_35px_36px),linear-gradient(180deg,rgba(255,255,255,.025),rgba(0,0,0,.5))] shadow-[0_-20px_70px_rgb(var(--bk-team-primary-rgb)/.12)]"/>
    <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/5 bg-white/[.02] blur-sm"/>
    <div className="relative z-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[var(--bk-team-accent)]"><Gavel className="h-4 w-4"/>Season Commissioner Tools</div><p className="mt-1 max-w-xl text-[11px] font-semibold text-zinc-400">Run waivers and generate each weekly injury report once, with retry-safe server receipts.</p></div><button onClick={()=>void refresh()} aria-label="Refresh commissioner tools" className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 text-[10px] font-black uppercase text-zinc-300 shadow-lg backdrop-blur-md transition hover:border-white/20 hover:bg-white/5"><RefreshCw className="h-3.5 w-3.5"/>Refresh</button></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-[0_16px_40px_rgba(0,0,0,.28)] backdrop-blur-md"><div className="flex items-center gap-2 text-xs font-black uppercase"><CheckCircle2 className="h-4 w-4 text-emerald-400"/>Waiver Run</div><div className="mt-2 text-[11px] leading-relaxed text-zinc-400">{pending.length} pending claim{pending.length===1?'':'s'} · lowest priority number wins first.</div><button disabled={!pending.length||busy} onClick={processAll} className="mt-3 min-h-11 w-full rounded-xl bg-white text-[10px] font-black uppercase tracking-wide text-black shadow-lg transition hover:bg-zinc-100 disabled:opacity-30">Process Pending Waivers</button></div>
        <div className="rounded-2xl border border-red-500/15 bg-black/35 p-4 shadow-[0_16px_40px_rgba(0,0,0,.28)] backdrop-blur-md"><div className="flex items-center gap-2 text-xs font-black uppercase"><Bandage className="h-4 w-4 text-red-400"/>Week {injuryWeek} Injury Roll</div><div className="mt-2 text-[11px] leading-relaxed text-zinc-400">Runs inside Supabase so retries for the same week return the saved report instead of creating duplicate injuries.</div><button disabled={busy||injuryWeek>17} onClick={generateInjuries} className="mt-3 min-h-11 w-full rounded-xl border border-red-500/25 bg-red-500/10 text-[10px] font-black uppercase tracking-wide text-red-200 transition hover:bg-red-500/15 disabled:opacity-30"><ShieldAlert className="mr-2 inline h-3.5 w-3.5"/>{injuryWeek>17?'Regular Season Complete':`Generate Week ${injuryWeek} Injuries`}</button></div>
      </div>
    </div>
  </section>;
};
