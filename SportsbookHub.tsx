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
type DraftPick=Omit<Pick,'lockedAt'>;
const STORAGE_KEY='ball-knower-weekly-picks-v3';
const LEGACY_STORAGE_KEY='ball-knower-weekly-picks-v2';
const FEED_ERROR='NFL matchups are temporarily unavailable. Try again.';
const LINES_PENDING='Matchups are available. Spread and total lines have not been posted yet.';
const PICK_SAVE_ERROR='We could not confirm that submission. Refresh to check your picks before trying again.';
const PICK_LOCKED_ERROR='One of those games has already locked. Review your picks and submit the remaining games.';
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
  const [submitNotice,setSubmitNotice]=useState('');
  const [query,setQuery]=useState('');
  const [slate,setSlate]=useState('');
  const [filter,setFilter]=useState<PicksFilter>('all');
  const [updated,setUpdated]=useState<Date|null>(null);
  const [busyGame,setBusyGame]=useState('');
  const [now,setNow]=useState(Date.now);
  const [draftByGame,setDraftByGame]=useState<Record<string,DraftPick|null>>({});
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
      if(mounted.current&&run===syncRun.current&&version===revision.current){console.warn('Verified Picks sync unavailable',err);setSyncNotice('Submitted picks have not synced. Refresh to check your latest record.')}
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

  const effectivePicks=useMemo(()=>{
    const byGame=new Map(picks.map(pick=>[pick.gameId,pick]));
    for(const [gameId,draft] of Object.entries(draftByGame)){
      const existing=byGame.get(gameId);
      if(draft===null){if(existing&&!existing.result)byGame.delete(gameId);continue}
      byGame.set(gameId,{...draft,lockedAt:existing?.lockedAt||''});
    }
    return [...byGame.values()];
  },[draftByGame,picks]);
  const draftCount=Object.keys(draftByGame).length;
  const pendingCount=effectivePicks.filter(pick=>!pick.result).length;
  const wins=picks.filter(pick=>pick.result==='win').length;
  const losses=picks.filter(pick=>pick.result==='loss').length;
  const slates=useMemo(()=>[...new Map([...games].sort((a,b)=>(a.season||0)-(b.season||0)||(a.week||0)-(b.week||0)).map(game=>[slateKey(game),game])).values()],[games]);
  const visible=useMemo(()=>visiblePicksGames(games,slate,filter,query,now),[games,slate,filter,query,now]);
  const grouped=useMemo(()=>{
    const map=new Map<string,Game[]>();for(const game of visible){const key=gameDay(game);map.set(key,[...(map.get(key)||[]),game])}return [...map.entries()];
  },[visible]);
  const choose=(game:Game,pick:DraftPick)=>{
    if(loading||feedError||!hasKickoff(game)||gamePhase(game,Date.now())!=='upcoming'||isPicksGameLocked(game,Date.now())||saving.current)return;
    const current=effectivePicks.find(item=>item.gameId===game.id);
    setDraftByGame(existing=>({...existing,[game.id]:current?.id===pick.id?null:pick}));
    setError('');setSubmitNotice('');
  };
  const submitPicks=async()=>{
    const entries=Object.entries(draftByGame);
    if(!entries.length||saving.current||loading||feedError)return;
    saving.current=true;revision.current++;setBusyGame('submit');setError('');setSubmitNotice('');
    const completed:string[]=[];
    let latestVerified:VerifiedPredictionPick[]|null=null;
    try{
      for(const [gameId,draft] of entries){
        const game=games.find(item=>item.id===gameId);
        const timestamp=Date.now();
        if(!game||!hasKickoff(game)||gamePhase(game,timestamp)!=='upcoming'||isPicksGameLocked(game,timestamp))throw new Error('locked');
        const current=picksRef.current.find(item=>item.gameId===gameId);
        if(draft===null){
          if(current&&!current.result)latestVerified=await deleteVerifiedPredictionPick(gameId);
        }else if(current?.id!==draft.id){
          latestVerified=await saveVerifiedPredictionPick({id:draft.id,gameId:draft.gameId,label:draft.label,market:draft.market,selection:draft.selection,lockedLine:draft.lockedLine});
        }
        completed.push(gameId);
      }
      if(mounted.current){
        if(latestVerified)commitPicks(existing=>mergeVerifiedPicks(existing,latestVerified!));
        setDraftByGame({});setSyncNotice('');
        setSubmitNotice(`${completed.length} pick${completed.length===1?'':'s'} submitted. You can still change them before kickoff.`);
      }
    }catch(err){
      if(mounted.current){
        if(completed.length)setDraftByGame(current=>Object.fromEntries(Object.entries(current).filter(([gameId])=>!completed.includes(gameId))));
        try{const verified=await loadVerifiedPredictionPicks();if(mounted.current)commitPicks(existing=>mergeVerifiedPicks(existing,verified))}catch{}
        setError(err instanceof Error&&err.message==='locked'?PICK_LOCKED_ERROR:PICK_SAVE_ERROR);
      }
    }finally{saving.current=false;if(mounted.current)setBusyGame('')}
  };
  const selected=(id:string)=>effectivePicks.some(item=>item.id===id);

  return <BroadcastStage scene="studio" page="picks" className="bk-picks-screen min-h-[calc(100dvh-7rem)] px-3 py-4 sm:px-6 sm:py-6"><div className="mx-auto max-w-5xl">
    <div className="bk-picks-headrow">
      <BroadcastMasthead eyebrow="Make the call" title="Daily Picks" subtitle="One outcome per NFL game. No wagering. Just football knowledge." compact/>
      <div className="bk-picks-week-select-wrap"><CalendarDays size={17}/><select aria-label="NFL week" value={slate} onChange={event=>{setSlate(event.target.value);setFilter('all')}}>{slates.map(game=><option key={slateKey(game)} value={slateKey(game)}>{slateLabel(game)}</option>)}</select><ChevronDown size={15}/></div>
    </div>

    <section className="bk-picks-controls" aria-label="Matchup navigation">
      <div className="bk-picks-filters" role="group" aria-label="Game status">{(['all','upcoming','live','final'] as PicksFilter[]).map(value=><button type="button" key={value} onClick={()=>setFilter(value)} aria-pressed={filter===value}>{value==='all'?'All Games':value==='final'?'Completed':value==='live'?'Live':'Upcoming'}</button>)}</div>
      <div className="bk-picks-toolbar"><label className="bk-picks-search"><Search size={19}/><input aria-label="Search teams" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search team…" type="search"/></label>{query&&<button type="button" className="bk-picks-icon" onClick={()=>setQuery('')} aria-label="Clear team search"><X size={17}/></button>}</div>
    </section>

    <section className="bk-picks-summary" aria-label="Your picks and record">
      <div className="bk-picks-summary-heading"><strong><Target size={17}/>Your Picks</strong><span>{draftCount?`${pendingCount} selected · ${draftCount} unsent`:`${pendingCount} submitted`} · {wins}-{losses}</span></div>
      {effectivePicks.length?<div className="bk-picks-saved">{effectivePicks.map(pick=>{const game=games.find(item=>item.id===pick.gameId);const locked=Boolean(pick.result)||!game||!hasKickoff(game)||gamePhase(game,now)!=='upcoming'||isPicksGameLocked(game,now);const changed=Object.prototype.hasOwnProperty.call(draftByGame,pick.gameId);return <button type="button" key={pick.id} disabled={locked||Boolean(busyGame)||loading} onClick={()=>game&&choose(game,pick)} aria-label={`${pick.label}${locked?' · Locked':changed?' · Unsubmitted change · Remove pick':' · Submitted · Remove pick'}`}><Check size={14}/><span>{pick.label}</span>{pick.result?<b data-result={pick.result}>{pick.result.toUpperCase()}</b>:locked?<small>LOCKED</small>:changed?<small>READY</small>:<small>SUBMITTED</small>}</button>})}</div>:<p>Tap a team to make a pick. Your choices are not submitted until you press Submit Picks.</p>}
      <div className="bk-picks-submit-row"><span>{draftCount?`${draftCount} change${draftCount===1?'':'s'} ready to submit.`:pendingCount?'Your current picks are submitted. Change any pick to create a new submission.':'Choose your picks, then submit them together.'}</span><button type="button" onClick={()=>void submitPicks()} disabled={!draftCount||Boolean(busyGame)||loading||Boolean(feedError)}>{busyGame==='submit'?<><RefreshCw size={16} className="bk-picks-spin"/>Submitting…</>:draftCount?<><Check size={16}/>Submit Picks ({draftCount})</>:pendingCount?<><Check size={16}/>Picks Submitted</>:<>Submit Picks</>}</button></div>
      {submitNotice&&<p className="bk-picks-submit-note" role="status">{submitNotice}</p>}
      {syncNotice&&<p className="bk-picks-sync" role="status">{syncNotice}</p>}
    </section>

    <div className="bk-picks-refreshline"><span>{loading?'Updating matchups…':updated?`Updated ${updated.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:''}</span><button type="button" onClick={refresh} disabled={loading} className="bk-picks-refresh" aria-label="Refresh picks"><RefreshCw size={15} className={loading?'bk-picks-spin':''}/>Refresh</button><ModeGuide storageKey="bk-guide-picks-v3" title="Picks" summary="Choose one football outcome per game, review your card, then submit your picks before kickoff." steps={["Tap a team to add or change a pick.","Review the picks marked Ready in Your Picks.","Press Submit Picks to save the card. You can change and resubmit any unlocked game before kickoff."]}/></div>
    {error&&<div role="alert" className="bk-picks-alert">{error}</div>}
    {notice&&<div role="status" className="bk-picks-notice">{notice}</div>}

    <section className="bk-picks-board" aria-label="NFL matchups" aria-busy={loading}>
      {loading&&!games.length?<div className="bk-picks-empty" role="status"><RefreshCw size={18} className="bk-picks-spin"/><strong>Loading matchups…</strong><span>Getting the latest NFL schedule.</span></div>
      :feedError&&!games.length?<div className="bk-picks-empty" role="alert"><strong>{feedError}</strong><span>Your submitted picks have not been removed.</span><button type="button" onClick={refresh}>Retry matchups</button></div>
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
            <button type="button" disabled={pickDisabled||awayLine==null} aria-pressed={selected(awayId)} aria-label={awayLine==null?`${game.away} spread pending`:spreadLabel(game.away,awayLine)} onClick={()=>awayLine!=null&&choose(game,{id:awayId,gameId:game.id,label:spreadLabel(game.away,awayLine),market:'spread',selection:game.away,lockedLine:awayLine})}><b>{awayAbbr}</b>{awayLine!=null&&<small>{awayLine>0?'+':''}{awayLine}</small>}</button>
            <button type="button" disabled={pickDisabled||homeLine==null} aria-pressed={selected(homeId)} aria-label={homeLine==null?`${game.home} spread pending`:spreadLabel(game.home,homeLine)} onClick={()=>homeLine!=null&&choose(game,{id:homeId,gameId:game.id,label:spreadLabel(game.home,homeLine),market:'spread',selection:game.home,lockedLine:homeLine})}><b>{homeAbbr}</b>{homeLine!=null&&<small>{homeLine>0?'+':''}{homeLine}</small>}</button>
          </div>
          {!locked&&pendingTime&&<span className="bk-picks-pending">Picks open when kickoff time is confirmed.</span>}
        </article>;
      })}</div></div>)}
    </section>
    <p className="bk-picks-disclaimer">Lines are informational and can change. Ball Knower does not accept or facilitate wagers.</p>
  </div></BroadcastStage>;
};