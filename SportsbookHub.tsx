import React,{useEffect,useMemo,useState} from 'react';
import {Check,RefreshCw,Search,Target,X} from 'lucide-react';
import {ModeGuide} from './ModeGuide';
import {gradePick,isPicksGameLocked,normalizeSavedPick,normalizeSpread,PicksGame,SavedPick,spreadLabel} from './picksEngine';
import {deleteVerifiedPredictionPick,gradeVerifiedPredictionPicks,loadVerifiedPredictionPicks,saveVerifiedPredictionPick,VerifiedPredictionPick} from './modeProgressionCloud';

type Game=PicksGame;
type Pick=SavedPick;

const STORAGE_KEY='ball-knower-weekly-picks-v3';
const LEGACY_STORAGE_KEY='ball-knower-weekly-picks-v2';
const mergeVerifiedPicks=(local:Pick[],verified:VerifiedPredictionPick[]):Pick[]=>{
  const verifiedGames=new Set(verified.map(pick=>pick.gameId));
  const historicalLocal=local.filter(pick=>Boolean(pick.result)&&!verifiedGames.has(pick.gameId));
  return[...verified.map(pick=>normalizeSavedPick(pick)).filter((pick):pick is Pick=>Boolean(pick)),...historicalLocal];
};

export const SportsbookHub:React.FC=()=>{
  const [games,setGames]=useState<Game[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [updated,setUpdated]=useState<Date|null>(null);
  const [busyGame,setBusyGame]=useState('');
  const [picks,setPicks]=useState<Pick[]>(()=>{try{const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY)||'[]');return Array.isArray(parsed)?parsed.map(normalizeSavedPick).filter((pick):pick is Pick=>Boolean(pick)):[]}catch{return []}});

  const load=async()=>{
    setLoading(true);setError('');
    try{
      let activePicks=picks;
      try{
        const verified=await gradeVerifiedPredictionPicks();activePicks=mergeVerifiedPicks(activePicks,verified);setPicks(activePicks);
      }catch(syncError){
        console.warn('Verified Picks sync unavailable',syncError);
        try{const verified=await loadVerifiedPredictionPicks();activePicks=mergeVerifiedPicks(activePicks,verified);setPicks(activePicks)}catch{}
      }
      const ungradedIds=[...new Set(activePicks.filter(pick=>!pick.result).map(pick=>pick.gameId))];const params=ungradedIds.length?`?gameIds=${encodeURIComponent(ungradedIds.join(','))}`:'';const response=await fetch(`/api/nfl-sportsbook${params}`,{cache:'no-store'});if(!response.ok)throw new Error('Lines feed unavailable');const data=await response.json();if(data?.available===false)throw new Error(data?.warning||'NFL lines feed temporarily unavailable');setGames(Array.isArray(data?.games)?data.games:[]);setUpdated(new Date())
    }catch(err){setError(err instanceof Error?err.message:'Could not load NFL lines.')}finally{setLoading(false)}
  };
  useEffect(()=>{void load()},[]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(picks))}catch{}},[picks]);
  useEffect(()=>{if(!games.length)return;setPicks(current=>current.map(pick=>{const game=games.find(item=>item.id===pick.gameId);return game?gradePick(pick,game):pick}))},[games]);

  const visible=useMemo(()=>games.filter(game=>`${game.away} ${game.home}`.toLowerCase().includes(query.toLowerCase())),[games,query]);
  const choose=async(game:Game,pick:Omit<Pick,'lockedAt'>)=>{
    if(isPicksGameLocked(game)||busyGame===game.id)return;setBusyGame(game.id);setError('');
    try{
      const current=picks.find(item=>item.gameId===game.id);
      const verified=current?.id===pick.id
        ?await deleteVerifiedPredictionPick(game.id)
        :await saveVerifiedPredictionPick({id:pick.id,gameId:pick.gameId,label:pick.label,market:pick.market,selection:pick.selection,lockedLine:pick.lockedLine});
      setPicks(existing=>mergeVerifiedPicks(existing,verified));
    }catch(err){setError(err instanceof Error?err.message:'Could not verify that pick.')}finally{setBusyGame('')}
  };
  const selected=(id:string)=>picks.some(item=>item.id===id);

  return <div className="min-h-[calc(100dvh-7rem)] px-3 py-4 sm:px-6 sm:py-6"><div className="mx-auto max-w-5xl">
    <header className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.24em] text-[var(--bk-team-accent)]">Make the call</div><h1 className="mt-1 text-3xl font-black uppercase sm:text-5xl">Picks</h1><p className="mt-1 max-w-xl text-xs font-semibold text-zinc-500">Pick one outcome per NFL game. No wagering — this is about proving you know ball.</p></div><div className="flex gap-2"><ModeGuide storageKey="bk-guide-picks-v2" title="Picks" summary="Choose one football outcome per game. Your saved line is verified and locked on the server so it can be graded later." steps={["Choose a spread or an Over/Under total.","Selecting another outcome for the same game replaces the old one before kickoff.","Refresh before locking a pick because posted lines can move."]}/><button onClick={()=>void load()} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Refresh picks"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button></div></header>

    <section className="mt-3 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[#0c0f13]/95 p-3 shadow-xl"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[var(--bk-team-accent)]"><Target className="h-4 w-4"/>Your Picks</div><div className="text-[10px] font-bold text-zinc-500">{picks.length} saved · {picks.filter(pick=>pick.result==='win').length}-{picks.filter(pick=>pick.result==='loss').length}{picks.some(pick=>pick.result==='push')?`-${picks.filter(pick=>pick.result==='push').length} pushes`:''}</div></div>{picks.length?<div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">{picks.map(pick=>{const game=games.find(item=>item.id===pick.gameId);const locked=!game||isPicksGameLocked(game);return <button key={pick.id} disabled={locked||busyGame===pick.gameId} onClick={()=>game&&void choose(game,pick)} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-3 py-2 text-[11px] font-black text-white disabled:cursor-default"><Check className="h-3.5 w-3.5 text-[var(--bk-team-accent)]"/><span>{pick.label}</span>{pick.result?<span className={pick.result==='win'?'text-emerald-300':pick.result==='loss'?'text-red-300':'text-amber-200'}>{pick.result.toUpperCase()}</span>:locked?<span className="text-zinc-500">LOCKED</span>:<X className="h-3 w-3 text-zinc-500"/>}</button>})}</div>:<div className="mt-2 text-xs font-semibold text-zinc-600">Tap an outcome below to make a pick.</div>}</section>

    <div className="sticky top-[112px] z-20 mt-3 flex gap-2 border-y border-white/10 bg-black/90 py-2 backdrop-blur sm:top-[112px]"><label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#111] px-3"><Search className="h-4 w-4 text-zinc-600"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search team" className="w-full bg-transparent text-sm outline-none"/></label><div className="hidden rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-[9px] font-bold text-zinc-600 sm:block">{updated?`Updated ${updated.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:'Not loaded'}</div></div>

    {error&&<div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">{error}</div>}

    <section className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1014]">{loading&&!games.length?<div className="p-6 text-center text-sm text-zinc-600">Loading NFL lines…</div>:error&&!games.length?<div className="p-6 text-center"><div className="text-sm font-black text-zinc-300">NFL lines are temporarily unavailable.</div><div className="mt-2 text-xs font-semibold text-zinc-600">Use Refresh to try again. An outage is never shown as a valid empty board.</div></div>:!visible.length?<div className="p-6 text-center text-sm text-zinc-600">No NFL lines match that search.</div>:visible.map(game=>{
      const normalized=normalizeSpread(game.spread);const homeLine=game.homeSpread??normalized.home;const awayLine=game.awaySpread??normalized.away;const totalLine=game.overUnder;const locked=isPicksGameLocked(game);
      const homeLabel=homeLine==null?'Spread —':spreadLabel(game.home,homeLine);const awayLabel=awayLine==null?'Spread —':spreadLabel(game.away,awayLine);
      const homeSpreadId=`${game.id}-spread-home-${homeLine}`;const awaySpreadId=`${game.id}-spread-away-${awayLine}`;
      const overId=`${game.id}-total-over-${totalLine}`;const underId=`${game.id}-total-under-${totalLine}`;
      return <article key={game.id} className="border-b border-white/5 px-3 py-2.5 last:border-0">
        <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-[13px] font-black sm:text-sm">{game.away} <span className="text-zinc-600">@</span> {game.home}</div><div className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wide text-zinc-600">{game.date?new Date(game.date).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Date TBD'} · {game.status||'Scheduled'}</div></div></div>
        {locked&&<div className="mt-1 text-[9px] font-black text-amber-200">LOCKED AT KICKOFF{game.status==='Final'&&Number.isFinite(game.awayScore)&&Number.isFinite(game.homeScore)?` · FINAL ${game.awayScore}-${game.homeScore}`:''}</div>}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button disabled={locked||awayLine==null||busyGame===game.id} onClick={()=>awayLine!=null&&void choose(game,{id:awaySpreadId,gameId:game.id,label:awayLabel,market:'spread',selection:game.away,lockedLine:awayLine})} className={`min-h-11 rounded-xl border px-2 text-[10px] font-black ${selected(awaySpreadId)?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-black':'border-white/10 bg-black/25 text-zinc-200 disabled:opacity-35'}`}>{awayLabel}</button>
          <button disabled={locked||homeLine==null||busyGame===game.id} onClick={()=>homeLine!=null&&void choose(game,{id:homeSpreadId,gameId:game.id,label:homeLabel,market:'spread',selection:game.home,lockedLine:homeLine})} className={`min-h-11 rounded-xl border px-2 text-[10px] font-black ${selected(homeSpreadId)?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-black':'border-white/10 bg-black/25 text-zinc-200 disabled:opacity-35'}`}>{homeLabel}</button>
          <button disabled={locked||totalLine==null||busyGame===game.id} onClick={()=>totalLine!=null&&void choose(game,{id:overId,gameId:game.id,label:`Over ${totalLine}`,market:'total',selection:'over',lockedLine:totalLine})} className={`min-h-11 rounded-xl border px-2 text-[10px] font-black ${selected(overId)?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-black':'border-white/10 bg-black/25 text-zinc-200 disabled:opacity-35'}`}>O {totalLine??'—'}</button>
          <button disabled={locked||totalLine==null||busyGame===game.id} onClick={()=>totalLine!=null&&void choose(game,{id:underId,gameId:game.id,label:`Under ${totalLine}`,market:'total',selection:'under',lockedLine:totalLine})} className={`min-h-11 rounded-xl border px-2 text-[10px] font-black ${selected(underId)?'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-black':'border-white/10 bg-black/25 text-zinc-200 disabled:opacity-35'}`}>U {totalLine??'—'}</button>
        </div>
      </article>})}</section>
    <p className="mt-3 text-center text-[9px] font-semibold text-zinc-700">Lines are informational and can change. Ball Knower does not accept or facilitate wagers.</p>
  </div></div>;
};
