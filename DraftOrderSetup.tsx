import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Gamepad2, ListOrdered, RotateCcw, Sparkles, Users } from 'lucide-react';
import { League, DraftOrderMethod } from './types';
import { useBallKnower } from './BallKnowerContext';

interface Props {
  league: League;
  onGoToDraft: () => void;
  onGoToResults: () => void;
}

const METHOD_COPY: Record<DraftOrderMethod, { title:string; eyebrow:string; body:string; steps:string[] }> = {
  game: {
    eyebrow: 'Competitive',
    title: 'Play the Draft Order Game',
    body: 'Every manager builds a 20-player NFL roster under the same salary cap. Ball Knower simulates a full 17-game season, then awards draft slots by the final results.',
    steps: ['Build a legal roster', 'Submit and lock it', 'Best simulated season earns Pick #1'],
  },
  random: {
    eyebrow: 'Fast and Fair',
    title: 'Random Draft Order',
    body: 'Skip roster building and the season game. One tap gives every league manager equal odds, creates the official order, and locks it immediately.',
    steps: ['Fill every league spot', 'Tap Randomize once', 'Official order locks immediately'],
  },
  commissioner: {
    eyebrow: 'Full Control',
    title: 'Commissioner Assigns Slots',
    body: 'Skip the game and choose the exact manager for Picks 1 through the final slot. Every manager must appear once before the order can be locked.',
    steps: ['Fill every league spot', 'Assign every pick', 'Review and lock the order'],
  },
};

export const DraftOrderSetup: React.FC<Props> = ({league,onGoToDraft,onGoToResults}) => {
  const {currentUser,updateLeagueSettings,finalizeDraftOrder,autoFillLeagueWithAi,showToast}=useBallKnower();
  const isCommissioner=currentUser?.id===league.commissionerId;
  const method=league.settings?.draftOrderMethod;
  const [choosing,setChoosing]=useState(!method);
  const [busy,setBusy]=useState(false);
  const randomizeLockRef=useRef(false);
  const [orderedIds,setOrderedIds]=useState<string[]>(()=>league.members.map(member=>member.id));
  const openSlots=Math.max(0,league.maxMembers-league.members.length);
  const allMembersAssigned=orderedIds.length===league.members.length&&new Set(orderedIds).size===league.members.length;

  useEffect(()=>{
    setChoosing(!league.settings?.draftOrderMethod);
  },[league.id,league.settings?.draftOrderMethod]);

  useEffect(()=>{
    setOrderedIds(current=>{
      const liveIds=new Set(league.members.map(member=>member.id));
      const kept=current.filter(id=>liveIds.has(id));
      const added=league.members.map(member=>member.id).filter(id=>!kept.includes(id));
      return [...kept,...added];
    });
  },[league.members]);

  const selectMethod=(next:DraftOrderMethod)=>{
    updateLeagueSettings(league.id,{draftOrderMethod:next});
    setChoosing(false);
    setOrderedIds(league.members.map(member=>member.id));
  };

  const swapMember=(slot:number,nextId:string)=>setOrderedIds(current=>{
    const next=[...current];
    const other=next.indexOf(nextId);
    if(other<0)return next;
    [next[slot],next[other]]=[next[other],next[slot]];
    return next;
  });

  const fillCpu=async()=>{
    setBusy(true);
    try{await autoFillLeagueWithAi(league.id);}finally{setBusy(false);}
  };

  const finalizeAssignedOrder=async()=>{
    if(method!=='commissioner')return;
    if(openSlots>0){showToast(`Add ${openSlots} more manager${openSlots===1?'':'s'} before locking the order.`);return;}
    setBusy(true);
    try{
      const success=await finalizeDraftOrder(league.id,'commissioner',orderedIds);
      if(success)onGoToResults();
    }finally{setBusy(false);}
  };

  const randomizeAndLock=async()=>{
    if(randomizeLockRef.current)return;
    if(openSlots>0){showToast(`Add ${openSlots} more manager${openSlots===1?'':'s'} before randomizing the order.`);return;}
    randomizeLockRef.current=true;
    const randomizedIds=secureShuffle(league.members.map(member=>member.id));
    setOrderedIds(randomizedIds);
    setBusy(true);
    let success=false;
    try{
      success=await finalizeDraftOrder(league.id,'random',randomizedIds);
      if(success)onGoToResults();
    }finally{
      if(!success)randomizeLockRef.current=false;
      setBusy(false);
    }
  };

  if(!isCommissioner&&!method){
    return <Shell league={league}>
      <div className="rounded-2xl border border-white/10 bg-[#101318] p-6 text-center">
        <Users className="mx-auto h-7 w-7 text-[#D4AF37]"/>
        <h2 className="mt-3 text-xl font-black uppercase">Waiting for the Commissioner</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">{league.commissionerName} is choosing how this league will decide its fantasy draft order. The selected rules will appear here before anyone has to build a roster.</p>
      </div>
    </Shell>;
  }

  if(!isCommissioner&&method){
    const copy=METHOD_COPY[method];
    return <Shell league={league}>
      <section className="rounded-2xl border border-[#D4AF37]/25 bg-[#101318] p-5">
        <div className="text-[10px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Commissioner Selected</div>
        <h1 className="mt-1 font-display text-3xl font-black uppercase">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{copy.body}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">{copy.steps.map((step,index)=><Step key={step} number={index+1} text={step}/>)}</div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-center text-xs font-bold text-zinc-400">{method==='game'?'Build and submit your roster when the commissioner opens the competition.':'The commissioner will finalize the order after every league spot is filled.'}</div>
      </section>
    </Shell>;
  }

  if(choosing||!method){
    return <Shell league={league}>
      <section className="rounded-2xl border border-[#D4AF37]/30 bg-[#0d1015] p-4 sm:p-6">
        <div className="text-[10px] font-black uppercase tracking-[.22em] text-[#D4AF37]">Commissioner Setup · Step 1</div>
        <h1 className="mt-1 font-display text-3xl font-black uppercase sm:text-4xl">How should draft order be decided?</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Choose one method. The league will only see the steps required for that method—nothing extra.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(Object.keys(METHOD_COPY) as DraftOrderMethod[]).map((item,index)=><MethodCard key={item} method={item} number={index+1} onSelect={()=>selectMethod(item)}/>) }
        </div>
        {method&&<button onClick={()=>setChoosing(false)} className="mt-3 min-h-11 w-full rounded-xl border border-white/10 text-[10px] font-black uppercase text-zinc-300">Keep Current Method</button>}
      </section>
    </Shell>;
  }

  if(method==='game'){
    return <Shell league={league}>
      <section className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[.06] p-4 sm:p-6">
        <div className="flex items-start gap-3"><Gamepad2 className="mt-1 h-6 w-6 shrink-0 text-[#D4AF37]"/><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Selected Method</div><h2 className="mt-1 text-2xl font-black uppercase">Draft Order Game</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">{METHOD_COPY.game.body}</p></div></div>
        <div className="mt-4 grid grid-cols-3 gap-2">{METHOD_COPY.game.steps.map((step,index)=><Step key={step} number={index+1} text={step}/>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={()=>setChoosing(true)} className="min-h-12 rounded-xl border border-white/10 text-[10px] font-black uppercase">Change Method</button><button onClick={onGoToDraft} className="min-h-12 rounded-xl bg-[#D4AF37] px-3 text-[10px] font-black uppercase text-black">Build My Roster <ArrowRight className="ml-1 inline h-4 w-4"/></button></div>
      </section>
    </Shell>;
  }

  const copy=METHOD_COPY[method];
  return <Shell league={league}>
    <section className="rounded-2xl border border-[#D4AF37]/30 bg-[#0d1015] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Selected Method</div><h1 className="mt-1 font-display text-3xl font-black uppercase">{copy.title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{copy.body}</p></div><button onClick={()=>setChoosing(true)} className="min-h-10 shrink-0 rounded-xl border border-white/10 px-3 text-[9px] font-black uppercase">Change</button></div>

      {openSlots>0?<div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[.06] p-3"><div className="text-xs font-black uppercase text-amber-300">Add {openSlots} more manager{openSlots===1?'':'s'} first</div><p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Invite real people or fill the open spots with clearly labeled CPU managers. Draft order cannot be locked while a slot is empty.</p>{isCommissioner&&<button disabled={busy} onClick={()=>void fillCpu()} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-300 text-[10px] font-black uppercase text-[#07100c] disabled:opacity-50"><Sparkles className="mr-1 inline h-4 w-4"/>{busy?'Adding CPU Managers…':`Fill ${openSlots} Open Spot${openSlots===1?'':'s'} With CPU`}</button>}</div>:<div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] p-3 text-xs font-black uppercase text-emerald-300"><CheckCircle2 className="h-4 w-4"/>All {league.members.length} managers are included</div>}

      {method==='random'?<>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4"><div className="text-xs font-black uppercase">One tap. One locked result.</div><p className="mt-1 text-[11px] leading-5 text-zinc-400">Randomize Draft Order can only be completed once. Tapping it creates the official order, locks it immediately, and takes the league straight to results. No rosters or season simulation are required.</p></div>
        <button onClick={()=>void randomizeAndLock()} disabled={busy||openSlots>0} className="mt-4 min-h-14 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase tracking-wider text-black disabled:opacity-35"><Sparkles className="mr-2 inline h-4 w-4"/>{busy?'Randomizing & Locking…':'Randomize Draft Order'}</button>
      </>:<>
        <div className="mt-4 flex items-center justify-between"><div><div className="text-xs font-black uppercase">Assign Every Draft Slot</div><div className="mt-1 text-[10px] text-zinc-500">Choosing a manager swaps them with the current slot.</div></div><button onClick={()=>setOrderedIds(league.members.map(member=>member.id))} className="min-h-10 rounded-xl border border-white/10 px-3 text-[9px] font-black uppercase"><RotateCcw className="mr-1 inline h-3.5 w-3.5"/>Reset</button></div>
        <div className="mt-3 grid grid-cols-2 gap-2">{orderedIds.map((id,index)=><label key={`${index}-${id}`} className="rounded-xl border border-white/10 bg-black/30 p-2"><span className="block text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">Pick #{index+1}</span><select aria-label={`Manager for draft pick ${index+1}`} value={id} onChange={event=>swapMember(index,event.target.value)} className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-white/10 bg-[#15181d] px-2 text-xs font-black uppercase text-white">{league.members.map(member=><option key={member.id} value={member.id}>{member.userName}{member.isAi?' · CPU':''}</option>)}</select></label>)}</div>
      </>}

      {method==='commissioner'&&<button onClick={()=>void finalizeAssignedOrder()} disabled={busy||openSlots>0||!allMembersAssigned} className="mt-4 min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase tracking-wider text-black disabled:opacity-35">{busy?'Saving Draft Order…':'Lock Assigned Draft Order'}<ArrowRight className="ml-1 inline h-4 w-4"/></button>}
    </section>
  </Shell>;
};

const Shell=({league,children}:{league:League;children:React.ReactNode})=><div className="min-h-[calc(100dvh-7rem)] bg-[#07090c] px-3 py-3 text-white sm:px-6"><div className="mx-auto max-w-6xl"><div className="mb-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-[10px] font-black uppercase tracking-[.18em] text-[#D4AF37]">{league.name}</div><div className="mt-1 text-xs font-semibold text-zinc-500">{league.members.length}/{league.maxMembers} managers · {league.code}</div></div><div className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-[9px] font-black uppercase text-zinc-400">Draft Order Setup</div></div>{children}</div></div>;

const MethodCard=({method,number,onSelect}:{method:DraftOrderMethod;number:number;onSelect:()=>void})=>{const copy=METHOD_COPY[method];const Icon=method==='game'?Gamepad2:method==='random'?Sparkles:ListOrdered;return <button onClick={onSelect} className="group rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition hover:border-[#D4AF37]/45 active:scale-[.99]"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#D4AF37] text-black"><Icon className="h-5 w-5"/></div><div><div className="text-[9px] font-black uppercase tracking-[.18em] text-[#D4AF37]">Option {number} · {copy.eyebrow}</div><div className="mt-1 text-base font-black uppercase">{copy.title}</div></div></div><p className="mt-3 text-xs leading-5 text-zinc-400">{copy.body}</p><div className="mt-3 flex items-center justify-between text-[9px] font-black uppercase text-zinc-500"><span>{method==='game'?'Rosters + 17 games':method==='random'?'One tap · Locks immediately':'You control every slot'}</span><span className="text-[#D4AF37]">Choose <ArrowRight className="inline h-3.5 w-3.5"/></span></div></button>};

const Step=({number,text}:{number:number;text:string})=><div className="rounded-xl border border-white/10 bg-black/30 p-2 text-center"><div className="mx-auto grid h-5 w-5 place-items-center rounded-full bg-[#D4AF37] text-[9px] font-black text-black">{number}</div><div className="mt-1 text-[9px] font-black uppercase leading-tight text-zinc-300">{text}</div></div>;

const secureShuffle=(ids:string[])=>{
  const next=[...ids];
  const values=new Uint32Array(1);
  for(let i=next.length-1;i>0;i--){
    const range=i+1;
    const limit=Math.floor(0x1_0000_0000/range)*range;
    let value=limit;
    while(value>=limit){
      crypto.getRandomValues(values);
      value=values[0];
    }
    const j=value%range;
    [next[i],next[j]]=[next[j],next[i]];
  }
  return next;
};
