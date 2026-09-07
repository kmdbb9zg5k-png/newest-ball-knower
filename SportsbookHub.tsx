import {BroadcastStage,BroadcastMasthead} from './BroadcastScene';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,Check,ChevronDown,RefreshCw,Search,Target,X} from 'lucide-react';
import {ModeGuide} from './ModeGuide';
import {gradePick,isPicksGameLocked,normalizeSavedPick,normalizeSpread,SavedPick,spreadLabel} from './picksEngine';
import {deleteVerifiedPredictionPick,gradeVerifiedPredictionPicks,loadVerifiedPredictionPicks,saveVerifiedPredictionPick,VerifiedPredictionPick} from './modeProgressionCloud';
import {BoardGame,gamePhase,hasKickoff,initialSlate,nextPicksKickoffDelay,parsePicksBoard,PicksFilter,slateKey,slateLabel,visiblePicksGames} from './picksBoard';
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
const logoAbbr=(abbr?:string)=>({JAX:'jax',WAS:'wsh'}[String(abbr||'').toUpperCase()]||String(abbr||'').toLowerCase());
const logoUrl=(abbr?:string)=>abbr?`https://a.espncdn.com/i/teamlogos/nfl/500/${logoAbbr(abbr)}.png`:'';
const displayAbbr=(abbr?:string,name?:string)=>abbr||String(name||'').split(/\s+/).map(part=>part[0]).join('').slice(0,3).toUpperCase();
const gameDay=(game:Game)=>game.scheduleDate||game.date?.slice(0,10)||'TBD';
const dayHeading=(day:string)=>day==='TBD'?'DATE TBD':new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).toUpperCase();
const kickoffParts=(game:Game)=>{
  if(!hasKickoff(game))return {time:'Time TBD',meta:'Kickoff pending'};
  const date=new Date(game.date!);
  return {time:date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),meta:gamePhase(game)==='final'?'Final':gamePhase(game)==='live'?'Live':'NFL'};
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
    const next=update(picksRef.current);picksRef.current=next;setPicks(next);
  },[]);

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
      console.warn('Picks feed unavailable',err);setGames([]);setUpdated(null);setNotice('');setFeedError(FEED_ERROR);
    }finally{if(mounted.current&&feedController.current===controller)setLoading(false)}
  },[]);

  const syncPicks=useCallback(async()=>{
    if(syncing.current||saving.current)return;
    syncing.current=true;const run=++syncRun.current;const version=revision.current;
    try{
      let verified:VerifiedPredictionPick[];
      try{verified=await gradeVerifiedPredictionPicks()}catch{verified=await loadVerifiedPredictionPicks()}
      if(mounted.current&&run===syncRun.current&&version===revision.current){commitPicks(current=>mergeVerifiedPicks(current,verified));setSyncNotice('')}
    }catch(err){
      if(mounted.current&&run===syncRun.current&&version===revision.current){console.warn('Verified Picks sync unavailable',err);setSyncNotice('Saved picks have not synced. Refresh to check your latest record.')}
    }finally{if(run===syncRun.current)syncing.current=false}
  },[commitPicks]);
  const refresh=()=>{void load();void syncPicks()};
  useEffect(()=>{mounted.current=true;void load();void syncPicks();return()=>{mounted.current=false;revision.current++;syncRun.current++;syncing.current=false;feedController.current?.abort()}},[load,syncPicks]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(picks))}catch{}},[picks]);
  useEffect(()=>{
    if(!games.length)return;
    commitPicks(current=>current.map(pick=>{const game=games.find(item=>item.id===pick.gameId);return game?gradePick(pick,game):pick}));
    let timer:ReturnType<typeof setTimeout>|undefined;
    const tick=()=>{clearTimeout(timer);const current=Date.now();setNow(current);const delay=nextPicksKickoffDelay(games,current);if(delay!==null&&!document.hidden)timer=setTimeout(tick,delay)};
    tick();document.addEventListener('visibilitychange',tick);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',tick)};
  },[games,commitPicks]);

  const slates=useMemo(()=>[...new Map([...games].sort((a,b)=>(a.season||0)-(b.season||0)||(a.week||0)-(b.week||0)).map(game=>[slateKey(game),game])).values()],[games]);
  const visible=useMemo(()=>visiblePicksGames(games,slate,filter,query,now),[games,slate,filter,query,now]);
  const grouped=useMemo(()=>{
    const map=new Map<string,Game[]>();for(const game of visible){const key=gameDay(game);map.set(key,[...(map.get(key)||[]),game])}return [...map.entries()];
  },[visible]);
  const choose=async(game:Game,pick:Omit<Pick,'lockedAt'>)=>{
    if(loading||feedError||!hasKickoff(game)||gamePhase(game)!=='upcoming'||isPicksGameLocked(game)||saving.current)return;
    saving.current=true;revision.current++;setBusyGame(game.id);setError('');
    try{
      const current=picksRef.current.find(item=>item.gameId===game.id);
      const verified=current?.id===pick.id?await deleteVerifiedPredictionPick(game.id):await saveVerifiedPredictionPick({id:pick.id,gameId:pick.gameId,label:pick.label,market:pick.market,selection:pick.selection,lockedLine:pick.lockedLine});
      if(mounted.current){commitPicks(existing=>mergeVerifiedPicks(existing,verified));setSyncNotice('')}
    }catch(err){if(mounted.current){console.warn('Picks save unavailable',err);setError(PICK_SAVE_ERROR)}}finally{saving.current=false;if(mounted.current)setBusyGame('')}
  };
  const selected=(id:string)=>picks.some(item=>item.id===id);

  return <BroadcastStage scene="studio" page="picks" className="bk-picks-screen min-h-[calc(100dvh-7rem)] px-3 py-4 sm:px-6 sm:py-6"><div className="mx-auto max-w-5xl">
    <div className="bk-picks-headrow">
      <BroadcastMasthead eyebrow="Make the call" title="Daily Picks" subtitle="One outcome per NFL game. No wagering. Just football knowledge." compact showMotionControl={false}/>
      <div className="bk-picks-week-select-wrap"><CalendarDays size={17}/><select aria-label="NFL week" value={slate} onChange={event=>{setSlate(event.target.value);setFilter('all')}}>{slates.map(game=><option key={slateKey(game)} value={slateKey(game)}>{slateLabel(game)}</option>)}</select><ChevronDown size={15}/></div>
    </div>

    <section className="bk-picks-controls" aria-label="Matchup navigation">
      <div className="bk-picks-filters" role="group" aria-label="Game status">{(['all','upcoming','live','final'] as PicksFilter[]).map(value=><button type="button" key={value} onClick={()=>setFilter(value)} aria-pressed={filter===value}>{value==='all'?'All Games':value==='final'?'Completed':value==='live'?'Live':'Upcoming'}</button>)}</div>
      <div className="bk-picks-toolbar"><label className="bk-picks-search"><Search size={19}/><input aria-label="Search teams" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search team…" type="search"/></label>{query&&<button type="button" className="bk-picks-icon" onClick={()=>setQuery('')} aria-label="Clear team search"><X size={17}/></button>}</div>
    </section>

    <section className="bk-picks-summary" aria-label="Your picks and record">
      <div className="bk-picks-summary-heading"><strong><Target size={17}/>Your Picks</strong><span>{picks.length} saved · {picks.filter(pick=>pick.result==='win').length}-{picks.filter(pick=>pick.result==='loss').length}</span></div>
      {picks.length?<div className="bk-picks-saved">{picks.map(pick=>{const game=games.find(item=>item.id===pick.gameId);const locked=Boolean(pick.result)||!game||!hasKickoff(game)||gamePhase(game,now)!=='upcoming'||isPicksGameLocked(game,now);return <button type="button" key={pick.id} disabled={locked||Boolean(busyGame)||loading} onClick={()=>game&&void choose(game,pick)} aria-label={`${pick.label}${locked?' · Locked':' · Remove pick'}`}><Check size={14}/><span>{pick.label}</span>{pick.result?<b data-result={pick.result}>{pick.result.toUpperCase()}</b>:locked?<small>LOCKED</small>:<X size={13}/>}</button>})}</div>:<p>Tap a team to make a pick. You can change your pick anytime before kickoff.</p>}
      {syncNotice&&<p className="bk-picks-sync" role="status">{syncNotice}</p>}
    </section>

    <div className="bk-picks-refreshline"><span>{loading?'Updating matchups…':updated?`Updated ${updated.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:''}</span><button type="button" onClick={refresh} disabled={loading} className="bk-picks-refresh" aria-label="Refresh picks"><RefreshCw size={15} className={loading?'bk-picks-spin':''}/>Refresh</button><ModeGuide storageKey="bk-guide-picks-v2" title="Picks" summary="Choose one football outcome per game. Your saved line is verified and locked on the server so it can be graded later." steps={["Tap a team pick before kickoff.","Tap the same saved pick again to remove it before kickoff.","Games without a confirmed kickoff time or spread stay visible but cannot be picked yet."]}/></div>
    {error&&<div role="alert" className="bk-picks-alert">{error}</div>}
    {notice&&<div role="status" className="bk-picks-notice">{notice}</div>}

    <section className="bk-picks-board" aria-label="NFL matchups" aria-busy={loading}>
      {loading&&!games.length?<div className="bk-picks-empty" role="status"><RefreshCw size={18} className="bk-picks-spin"/><strong>Loading matchups…</strong><span>Getting the latest NFL schedule.</span></div>
      :feedError&&!games.length?<div className="bk-picks-empty" role="alert"><strong>{feedError}</strong><span>Your saved picks have not been removed.</span><button type="button" onClick={refresh}>Retry matchups</button></div>
      :!games.length?<div className="bk-picks-empty"><strong>No NFL matchups scheduled right now.</strong><span>Check back when the next slate is available.</span><button type="button" onClick={refresh}>Refresh schedule</button></div>
      :!visible.length?<div className="bk-picks-empty"><strong>{query.trim()?'No teams match your search.':`No ${filter==='final'?'completed':filter==='all'?'matching':filter} games in this week.`}</strong><button type="button" onClick={()=>{setQuery('');setFilter('all')}}>Show all games this week</button></div>
      :grouped.map(([day,dayGames])=><div className="bk-picks-day" key={day}><h2 className="bk-picks-day-title">{dayHeading(day)}</h2><div className="bk-picks-day-list">{dayGames.map(game=>{
        const normalized=normalizeSpread(game.spread);const homeLine=game.homeSpread??normalized.home;const awayLine=game.awaySpread??normalized.away;const phase=gamePhase(game,now);const locked=phase!=='upcoming'||isPicksGameLocked(game,now);const pendingTime=!hasKickoff(game);const kickoff=kickoffParts(game);
        const awayAbbr=displayAbbr(game.awayAbbr,game.away);const homeAbbr=displayAbbr(game.homeAbbr,game.home);
        const awayId=`${game.id}-spread-away-${awayLine}`;const homeId=`${game.id}-spread-home-${homeLine}`;
        const pickDisabled=locked||pendingTime||Boolean(busyGame)||loading;
        return <article key={game.id} className="bk-picks-game" data-game-id={game.id}>
          <div className="bk-picks-teams">
            <div className="bk-picks-team"><img src={logoUrl(game.awayAbbr)} alt="" onError={event=>{event.currentTarget.style.visibility='hidden'}}/><span>{game.away}</span></div>
            <div className="bk-picks-team"><img src={logoUrl(game.homeAbbr)} alt="" onError={event=>{event.currentTarget.style.visibility='hidden'}}/><span>{game.home}</span></div>
          </div>
          <div className="bk-picks-time"><strong>{kickoff.time}</strong><span>{phase==='final'&&Number.isFinite(game.awayScore)&&Number.isFinite(game.homeScore)?`${game.awayScore}-${game.homeScore}`:kickoff.meta}</span></div>
          <div className="bk-picks-team-buttons">
            <button type="button" disabled={pickDisabled||awayLine==null} aria-pressed={selected(awayId)} aria-label={awayLine==null?`${game.away} spread pending`:spreadLabel(game.away,awayLine)} onClick={()=>awayLine!=null&&void choose(game,{id:awayId,gameId:game.id,label:spreadLabel(game.away,awayLine),market:'spread',selection:game.away,lockedLine:awayLine})}><b>{awayAbbr}</b>{awayLine!=null&&<small>{awayLine>0?'+':''}{awayLine}</small>}</button>
            <button type="button" disabled={pickDisabled||homeLine==null} aria-pressed={selected(homeId)} aria-label={homeLine==null?`${game.home} spread pending`:spreadLabel(game.home,homeLine)} onClick={()=>homeLine!=null&&void choose(game,{id:homeId,gameId:game.id,label:spreadLabel(game.home,homeLine),market:'spread',selection:game.home,lockedLine:homeLine})}><b>{homeAbbr}</b>{homeLine!=null&&<small>{homeLine>0?'+':''}{homeLine}</small>}</button>
          </div>
          {busyGame===game.id&&<span className="bk-picks-saving" role="status">Saving…</span>}
          {!locked&&pendingTime&&<span className="bk-picks-pending">Picks open when kickoff time is confirmed.</span>}
        </article>;
      })}</div></div>)}
    </section>
    <p className="bk-picks-disclaimer">Lines are informational and can change. Ball Knower does not accept or facilitate wagers.</p>
  </div></BroadcastStage>;
};
