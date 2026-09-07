import {BroadcastStage,BroadcastMasthead} from './BroadcastScene';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Check,RefreshCw,Search,Target,X} from 'lucide-react';
import {ModeGuide} from './ModeGuide';
import {gradePick,isPicksGameLocked,normalizeSavedPick,normalizeSpread,SavedPick,spreadLabel} from './picksEngine';
import {deleteVerifiedPredictionPick,gradeVerifiedPredictionPicks,loadVerifiedPredictionPicks,saveVerifiedPredictionPick,VerifiedPredictionPick} from './modeProgressionCloud';
import {BoardGame,gamePhase,hasKickoff,initialSlate,nextPicksKickoffDelay,parsePicksBoard,PicksFilter,scheduleLabel,slateKey,slateLabel,visiblePicksGames} from './picksBoard';
import {withPicksDeadline} from './picksRequest';
import './picksScreen.css';

type Game=BoardGame;
type Pick=SavedPick;
const STORAGE_KEY='ball-knower-weekly-picks-v3';
const LEGACY_STORAGE_KEY='ball-knower-weekly-picks-v2';
const FEED_ERROR='NFL matchups are temporarily unavailable. Try again.';
const LINES_PENDING='Matchups are available. Spread and total lines have not been posted yet.';
const PICK_SAVE_ERROR='We could not confirm that change. Refresh to check your saved picks before trying again.';
const mergeVerifiedPicks=(local:Pick[],verified:VerifiedPredictionPick[]):Pick[]=>{
  const verifiedGames=new Set(verified.map(pick=>pick.gameId));
  const historicalLocal=local.filter(pick=>Boolean(pick.result)&&!verifiedGames.has(pick.gameId));
  return [...verified.map(pick=>normalizeSavedPick(pick)).filter((pick):pick is Pick=>Boolean(pick)),...historicalLocal];
};

export const SportsbookHub:React.FC=()=>{
  const [games,setGames]=useState<Game[]>([]);
  const [loading,setLoading]=useState(true);
  const [feedError,setFeedError]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [syncNotice,setSyncNotice]=useState('');
  const [query,setQuery]=useState('');
  const [slate,setSlate]=useState('');
  const [filter,setFilter]=useState<PicksFilter>('all');
  const [updated,setUpdated]=useState<Date|null>(null);
  const [busyGame,setBusyGame]=useState('');
  const [now,setNow]=useState(Date.now);
  const [picks,setPicks]=useState<Pick[]>(()=>{
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY)||'[]');
      return Array.isArray(parsed)?parsed.map(normalizeSavedPick).filter((pick):pick is Pick=>Boolean(pick)):[];
    }catch{return []}
  });
  const picksRef=useRef(picks);
  const mounted=useRef(false);
  const feedController=useRef<AbortController|null>(null);
  const revision=useRef(0);
  const syncRun=useRef(0);
  const syncing=useRef(false);
  const saving=useRef(false);
  const commitPicks=useCallback((update:(current:Pick[])=>Pick[])=>{
    const next=update(picksRef.current);
    picksRef.current=next;
    setPicks(next);
  },[]);

  // Public matchups must never wait for authentication, grading or reward claims.
  const load=useCallback(async()=>{
    feedController.current?.abort();
    const controller=new AbortController();feedController.current=controller;
    setLoading(true);setFeedError('');setNotice('');
    try{
      const ungradedIds=[...new Set(picksRef.current.filter(pick=>!pick.result).map(pick=>pick.gameId))];
      const params=ungradedIds.length?`?gameIds=${encodeURIComponent(ungradedIds.join(','))}`:'';
      const data=await withPicksDeadline(async signal=>{
        const response=await fetch(`/api/nfl-sportsbook${params}`,{cache:'no-store',signal});
        if(!response.ok)throw new Error('feed');
        return response.json();
      },20_000,controller.signal);
      if(data?.available===false)throw new Error('feed');
      const next=parsePicksBoard(data);
      if(!mounted.current||controller.signal.aborted)return;
      setGames(next);setUpdated(new Date());setNow(Date.now());
      setSlate(current=>next.some(game=>slateKey(game)===current)?current:initialSlate(next));
      if(next.length&&data?.linesAvailable===false)setNotice(LINES_PENDING);
    }catch(err){
      if(!mounted.current||controller.signal.aborted)return;
      console.warn('Picks feed unavailable',err);
      // Never leave stale lines selectable after an unsuccessful refresh.
      setGames([]);setUpdated(null);setNotice('');setFeedError(FEED_ERROR);
    }finally{
      if(mounted.current&&feedController.current===controller)setLoading(false);
    }
  },[]);

  const syncPicks=useCallback(async()=>{
    if(syncing.current||saving.current)return;
    syncing.current=true;const run=++syncRun.current;const version=revision.current;
    try{
      let verified:VerifiedPredictionPick[];
      try{verified=await gradeVerifiedPredictionPicks()}
      catch{verified=await loadVerifiedPredictionPicks()}
      // A late initial sync must not overwrite a newer save/delete response.
      if(mounted.current&&run===syncRun.current&&version===revision.current){
        commitPicks(current=>mergeVerifiedPicks(current,verified));setSyncNotice('');
      }
    }catch(err){
      if(mounted.current&&run===syncRun.current&&version===revision.current){
        console.warn('Verified Picks sync unavailable',err);
        setSyncNotice('Saved picks have not synced. Refresh to check your latest record.');
      }
    }finally{if(run===syncRun.current)syncing.current=false}
  },[commitPicks]);
  const refresh=()=>{void load();void syncPicks()};
  useEffect(()=>{
    mounted.current=true;void load();void syncPicks();
    return()=>{mounted.current=false;revision.current++;syncRun.current++;syncing.current=false;feedController.current?.abort()};
  },[load,syncPicks]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(picks))}catch{}},[picks]);
  useEffect(()=>{
    if(!games.length)return;
    commitPicks(current=>current.map(pick=>{const game=games.find(item=>item.id===pick.gameId);return game?gradePick(pick,game):pick}));
    let timer:ReturnType<typeof setTimeout>|undefined;
    const tick=()=>{
      clearTimeout(timer);const current=Date.now();setNow(current);
      const delay=nextPicksKickoffDelay(games,current);
      if(delay!==null&&!document.hidden)timer=setTimeout(tick,delay);
    };
    tick();
    document.addEventListener('visibilitychange',tick);
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',tick)};
  },[games,commitPicks]);

  const slates=useMemo(()=>[...new Map([...games].sort((a,b)=>(a.season||0)-(b.season||0)||(a.week||0)-(b.week||0)).map(game=>[slateKey(game),game])).values()],[games]);
  const visible=useMemo(()=>visiblePicksGames(games,slate,filter,query,now),[games,slate,filter,query,now]);
  const slateGames=useMemo(()=>games.filter(game=>slateKey(game)===slate),[games,slate]);
  const dates=[...new Set(slateGames.map(game=>game.scheduleDate||game.date?.slice(0,10)).filter(Boolean))].sort();
  const dayLabel=(day:string)=>new Date(`${day}T12:00:00Z`).toLocaleDateString([],{month:'short',day:'numeric',timeZone:'UTC'});
  const dateRange=dates.length?`${dayLabel(dates[0]!)}${dates.length>1?` – ${dayLabel(dates.at(-1)!)}`:''}`:'NFL schedule';
  const choose=async(game:Game,pick:Omit<Pick,'lockedAt'>)=>{
    if(loading||feedError||!hasKickoff(game)||gamePhase(game)!=='upcoming'||isPicksGameLocked(game)||saving.current)return;
    saving.current=true;revision.current++;setBusyGame(game.id);setError('');
    try{
      const current=picksRef.current.find(item=>item.gameId===game.id);
      const verified=current?.id===pick.id
        ?await deleteVerifiedPredictionPick(game.id)
        :await saveVerifiedPredictionPick({id:pick.id,gameId:pick.gameId,label:pick.label,market:pick.market,selection:pick.selection,lockedLine:pick.lockedLine});
      if(mounted.current){commitPicks(existing=>mergeVerifiedPicks(existing,verified));setSyncNotice('')}
    }catch(err){if(mounted.current){console.warn('Picks save unavailable',err);setError(PICK_SAVE_ERROR)}}
    finally{saving.current=false;if(mounted.current)setBusyGame('')}
  };
  const selected=(id:string)=>picks.some(item=>item.id===id);

  return <BroadcastStage scene="studio" page="picks" className="bk-picks-screen min-h-[calc(100dvh-7rem)] px-3 py-4 sm:px-6 sm:py-6"><div className="mx-auto max-w-5xl">
    <BroadcastMasthead eyebrow="Make the call" title="Daily Picks" subtitle="One pick per game. Football knowledge. No wagering." compact showMotionControl={false} actions={<>
      <ModeGuide storageKey="bk-guide-picks-v2" title="Picks" summary="Choose one football outcome per game. Your saved line is verified and locked on the server so it can be graded later." steps={["Choose either team's spread, or an Over/Under total.","Change or remove your selection before the confirmed kickoff.","Games without confirmed kickoff times or posted lines remain visible, but cannot be picked yet."]}/>
      <button type="button" onClick={refresh} disabled={loading} className="bk-picks-icon" aria-label="Refresh picks"><RefreshCw size={17} className={loading?'bk-picks-spin':''}/></button>
    </>}/>

    <section className="bk-picks-summary" aria-label="Your picks and record">
      <div className="bk-picks-summary-heading"><strong><Target size={16}/>Your Picks</strong><span>{picks.length} saved · {picks.filter(pick=>pick.result==='win').length}W–{picks.filter(pick=>pick.result==='loss').length}L{picks.some(pick=>pick.result==='push')?` · ${picks.filter(pick=>pick.result==='push').length} pushes`:''}</span></div>
      {picks.length?<div className="bk-picks-saved">{picks.map(pick=>{
        const game=games.find(item=>item.id===pick.gameId);
        const locked=Boolean(pick.result)||!game||!hasKickoff(game)||gamePhase(game,now)!=='upcoming'||isPicksGameLocked(game,now);
        return <button type="button" key={pick.id} disabled={locked||Boolean(busyGame)||loading} onClick={()=>game&&void choose(game,pick)} aria-label={`${pick.label}${locked?' · Locked':' · Remove pick'}`}>
          <Check size={14}/><span>{pick.label}</span>{pick.result?<b data-result={pick.result}>{pick.result.toUpperCase()}</b>:locked?<small>LOCKED</small>:<X size={13}/>}
        </button>;
      })}</div>:<p>Choose an outcome below to save your first pick.</p>}
      {syncNotice&&<p className="bk-picks-sync" role="status">{syncNotice}</p>}
    </section>

    <section className="bk-picks-controls" aria-label="Matchup navigation">
      <div className="bk-picks-slate-meta"><strong>{dateRange}</strong><span>{loading?'Updating…':updated?`Updated ${updated.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:'Not updated'}</span></div>
      {slates.length>0&&<div className="bk-picks-weeks" role="group" aria-label="NFL week">{slates.map(game=><button type="button" key={slateKey(game)} aria-pressed={slate===slateKey(game)} onClick={()=>{setSlate(slateKey(game));setFilter('all')}}>{slateLabel(game)}</button>)}</div>}
      <div className="bk-picks-filters" role="group" aria-label="Game status">{(['all','upcoming','live','final'] as PicksFilter[]).map(value=><button type="button" key={value} onClick={()=>setFilter(value)} aria-pressed={filter===value}>{value==='all'?'All games':value==='final'?'Completed':value==='live'?'Live':'Upcoming'}</button>)}</div>
      <div className="bk-picks-toolbar"><label className="bk-picks-search"><Search size={17}/><input aria-label="Search teams" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search team" type="search"/></label>{query&&<button type="button" className="bk-picks-icon" onClick={()=>setQuery('')} aria-label="Clear team search"><X size={17}/></button>}</div>
    </section>

    {error&&<div role="alert" className="bk-picks-alert">{error}</div>}
    {notice&&<div role="status" className="bk-picks-notice">{notice}</div>}
    <section className="bk-picks-board" aria-label="NFL matchups" aria-busy={loading}>
      {loading&&!games.length?<div className="bk-picks-empty" role="status"><RefreshCw size={18} className="bk-picks-spin"/><strong>Loading matchups…</strong><span>Getting the latest NFL schedule.</span></div>
      :feedError&&!games.length?<div className="bk-picks-empty" role="alert"><strong>{feedError}</strong><span>Your saved picks have not been removed.</span><button type="button" onClick={refresh}>Retry matchups</button></div>
      :!games.length?<div className="bk-picks-empty"><strong>No NFL matchups scheduled right now.</strong><span>Check back when the next slate is available.</span><button type="button" onClick={refresh}>Refresh schedule</button></div>
      :!visible.length?<div className="bk-picks-empty"><strong>{query.trim()?'No teams match your search.':`No ${filter==='final'?'completed':filter==='all'?'matching':filter} games in this week.`}</strong><button type="button" onClick={()=>{setQuery('');setFilter('all')}}>Show all games this week</button></div>
      :visible.map(game=>{
        const normalized=normalizeSpread(game.spread);const homeLine=game.homeSpread??normalized.home;const awayLine=game.awaySpread??normalized.away;const totalLine=game.overUnder;
        const phase=gamePhase(game,now);const locked=phase!=='upcoming'||isPicksGameLocked(game,now);const pendingTime=!hasKickoff(game);
        const homeLabel=homeLine==null?'Spread pending':spreadLabel(game.home,homeLine);const awayLabel=awayLine==null?'Spread pending':spreadLabel(game.away,awayLine);
        const choices=[
          {id:`${game.id}-spread-away-${awayLine}`,label:awayLabel,market:'spread' as const,selection:game.away,line:awayLine},
          {id:`${game.id}-spread-home-${homeLine}`,label:homeLabel,market:'spread' as const,selection:game.home,line:homeLine},
          {id:`${game.id}-total-over-${totalLine}`,label:`Over ${totalLine??'—'}`,market:'total' as const,selection:'over',line:totalLine},
          {id:`${game.id}-total-under-${totalLine}`,label:`Under ${totalLine??'—'}`,market:'total' as const,selection:'under',line:totalLine},
        ];
        return <article key={game.id} className="bk-picks-game" data-game-id={game.id}>
          <div className="bk-picks-game-heading"><h2>{game.away} <span>@</span> {game.home}</h2><span className="bk-picks-phase" data-phase={phase}>{phase==='final'?'Final':phase==='live'?'Live':'Upcoming'}</span></div>
          <p className="bk-picks-kickoff">{scheduleLabel(game)}</p>
          {locked&&<p className="bk-picks-lock">LOCKED AT KICKOFF{phase==='final'&&Number.isFinite(game.awayScore)&&Number.isFinite(game.homeScore)?` · FINAL ${game.awayScore}–${game.homeScore}`:''}</p>}
          {!locked&&pendingTime&&<p className="bk-picks-lock">Picks open when kickoff time is confirmed.</p>}
          <div className="bk-picks-choices">{choices.map(choice=><button type="button" key={choice.id} disabled={locked||pendingTime||choice.line==null||Boolean(busyGame)||loading} aria-pressed={selected(choice.id)} onClick={()=>choice.line!=null&&void choose(game,{id:choice.id,gameId:game.id,label:choice.label,market:choice.market,selection:choice.selection,lockedLine:choice.line})}>{choice.label}</button>)}</div>
          {busyGame===game.id&&<p role="status" className="bk-picks-kickoff">Saving your pick…</p>}
        </article>;
      })}
    </section>
    <p className="bk-picks-disclaimer">Lines are informational and can change. Ball Knower does not accept or facilitate wagers.</p>
  </div></BroadcastStage>;
};
