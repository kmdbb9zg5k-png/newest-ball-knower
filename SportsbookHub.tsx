import React,{useEffect,useMemo,useState} from 'react';
import {Check,RefreshCw,Search,Target,X} from 'lucide-react';
import {ModeGuide} from './ModeGuide';

type Game={id:string;date?:string;status?:string;away:string;home:string;spread?:number|null;overUnder?:number|null};
type PickMarket='spread'|'total';
type Pick={id:string;gameId:string;label:string;market:PickMarket;selection:string;lockedLine:number};

const STORAGE_KEY='ball-knower-weekly-picks-v2';
const isValidPick=(value:any):value is Pick=>Boolean(value&&typeof value==='object'&&typeof value.id==='string'&&typeof value.gameId==='string'&&typeof value.label==='string'&&(value.market==='spread'||value.market==='total')&&typeof value.selection==='string'&&Number.isFinite(value.lockedLine));

export const SportsbookHub:React.FC=()=>{
  const [games,setGames]=useState<Game[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [updated,setUpdated]=useState<Date|null>(null);
  const [picks,setPicks]=useState<Pick[]>(()=>{try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(parsed)?parsed.filter(isValidPick):[]}catch{return []}});

  const load=async()=>{setLoading(true);setError('');try{const response=await fetch('/api/nfl-sportsbook',{cache:'no-store'});if(!response.ok)throw new Error('Lines feed unavailable');const data=await response.json();if(data?.available===false)throw new Error(data?.warning||'NFL lines feed temporarily unavailable');setGames(Array.isArray(data?.games)?data.games:[]);setUpdated(new Date())}catch(err){setError(err instanceof Error?err.message:'Could not load NFL lines.')}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(picks))}catch{}},[picks]);

  const visible=useMemo(()=>games.filter(game=>`${game.away} ${game.home}`.toLowerCase().includes(query.toLowerCase())),[games,query]);
  const choose=(pick:Pick)=>setPicks(current=>current.some(item=>item.id===pick.id)?current.filter(item=>item.id!==pick.id):[...current.filter(item=>item.gameId!==pick.gameId),pick]);
  const selected=(id:string)=>picks.some(item=>item.id===id);

  return <div className="min-h-[calc(100dvh-7rem)] px-3 py-4 sm:px-6 sm:py-6"><div className="mx-auto max-w-5xl">
    <header className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.24em] text-[var(--bk-team-accent)]">Make the call</div><h1 className="mt-1 text-3xl font-black uppercase sm:text-5xl">Picks</h1><p className="mt-1 max-w-xl text-xs font-semibold text-zinc-500">Pick one outcome per NFL game. No wagering — this is about proving you know ball.</p></div><div className="flex gap-2"><ModeGuide storageKey="bk-guide-picks-v2" title="Picks" summary="Choose one football outcome per game. Your saved line is locked with the pick so it can be graded later." steps={["Choose a spread or an Over/Under total.","Selecting another outcome for the same game replaces the old one.","Refresh before locking a pick because posted lines can move."]}/><button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Refresh picks"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></div></header>

    <section className="mt-3 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[#0c0f13]/95 p-3 shadow-xl"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[var(--bk-team-accent)]"><Target className="h-4 w-4"/>Your Picks</div><div className="text-[10px] font-bold text-zinc-500">{picks.length} selected</div></div>{picks.length?<div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">{picks.map(pick=><button key={pick.id} onClick={()=>choose(pick)} className="flex shrink-0 items-center gap-2 rounded-xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-3 py-2 text-[11px] font-black text-white"><Check className="h-3.5 w-3.5 text-[var(--bk-team-accent)]"/><span>{pick.label}</span><X className="h-3 w-3 text-zinc-500"/></button>)}</div>:<div className="mt-2 text-xs font-semibold text-zinc-600">Tap an outcome below to make a pick.</div>}</section>

    <div className="sticky top-[112px] z-20 mt-3 flex gap-2 border-y border-white/10 bg-black/90 py-2 backdrop-blur sm:top-[112px]"><label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#111] px-3"><Search className="h-4 w-4 text-zinc-600"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search team" className="w-full bg-transparent text-sm outline-none"/></label><div className="hidden rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-[9px] font-bold text-zinc-600 sm:block">{updated?`Updated ${updated.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:'Not loaded'}</div></div>

    {error&&<div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">{error}</div>}

    <section className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1014]">{loading&&!games.length?<div className="p-6 text-center text-sm text-zinc-600">Loading NFL lines…</div>:error&&!games.length?<div className="p-6 text-center"><div className="text-sm font-black text-zinc-300">NFL lines are temporarily unavailable.</div><div className="mt-2 text-xs font-semibold text-zinc-600">Use Refresh to try again. An outage is never shown as a valid empty board.</div></div>:!visible.length?<div className="p-6 text-center text-sm text-zinc-600">No NFL lines match that search.</div>:visible.map(game=>{
      const spreadLine=game.spread;const totalLine=game.overUnder;
      const spreadLabel=spreadLine==null?'Spread —':`${game.home} ${spreadLine>0?'+':''}${spreadLine}`;
      const spreadId=`${game.id}-spread-home-${spreadLine}`;
      const overId=`${game.id}-total-over-${totalLine}`;const underId=`${game.id}-total-under-${totalLine}`;
      return <article key={game.id} className="border-b border-white/5 px-3 py-2.5 last:border-0">
        <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-[13px] font-black sm:text-sm">{game.away} <span className="text-zinc-600">@</span> {game.home}</div><div className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wide text-zinc-600">{game.date?new Date(game.date).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Date TBD'} · {game.status||'Scheduled'}</div></div></div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button disabled={spreadLine==null} onClick={()=>spreadLine!=null&&choose({id:spreadId,gameId:game.id,label:spreadLabel,market:'spread',selection:game.home,lockedLine:spreadLine})} className={`min-h-10 rounded-xl border px-2 text-[10px] font-black ${selected(spreadId)?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-black':'border-white/10 bg-black/25 text-zinc-200 disabled:opacity-35'}`}>{spreadLabel}</button>
          <button disabled={totalLine==null} onClick={()=>totalLine!=null&&choose({id:overId,gameId:game.id,label:`Over ${totalLine}`,market:'total',selection:'over',lockedLine:totalLine})} className={`min-h-10 rounded-xl border px-2 text-[10px] font-black ${selected(overId)?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-black':'border-white/10 bg-black/25 text-zinc-200 disabled:opacity-35'}`}>O {totalLine??'—'}</button>
          <button disabled={totalLine==null} onClick={()=>totalLine!=null&&choose({id:underId,gameId:game.id,label:`Under ${totalLine}`,market:'total',selection:'under',lockedLine:totalLine})} className={`min-h-10 rounded-xl border px-2 text-[10px] font-black ${selected(underId)?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-black':'border-white/10 bg-black/25 text-zinc-200 disabled:opacity-35'}`}>U {totalLine??'—'}</button>
        </div>
      </article>})}</section>
    <p className="mt-3 text-center text-[9px] font-semibold text-zinc-700">Lines are informational and can change. Ball Knower does not accept or facilitate wagers.</p>
  </div></div>;
};
