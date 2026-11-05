import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {footballArenaAction,footballDriveUrl,validFootballStats,type FootballAttempt,type FootballMatch,type FootballHome,type FootballStats} from './footballArena';
import {FOOTBALL_ARENA_TEAMS} from './footballArenaTeams';
import {FootballH2HTeamSelect} from './FootballH2HTeamSelect';
import './footballH2HSession.css';
import {readFootballResult,saveFootballResult,clearFootballResult} from './footballResultRecovery';

type Phase='team'|'search'|'intro'|'loading'|'game'|'intermission'|'results';
type DetailStats=FootballStats;
type Rival={id:string;team:string;name:string;simulated:boolean;seed:number};
const teamInfo=(id:string)=>FOOTBALL_ARENA_TEAMS.find(t=>t.abbr===id)||FOOTBALL_ARENA_TEAMS[11];
const random=(max:number)=>crypto.getRandomValues(new Uint32Array(1))[0]%max;
const scoreSum=(rows:DetailStats[])=>rows.reduce((sum,row)=>sum+row.points,0);
// Simulation produces its own scorecard; never attributed to another player.
function simulateDrive(team:string):DetailStats{
 const rating=teamInfo(team).overall,roll=random(100);
 const points=roll<Math.max(24,rating-45)?7:roll<65?3:0;
 const yards=points===7?75:points===3?45+random(15):random(50);
 const plays=5+random(8),passAttempts=2+random(Math.max(1,plays-2));
 const completions=Math.min(passAttempts,1+random(passAttempts));
 const passingYards=Math.round(yards*(.4+random(40)/100));
 return {points,yards,plays,passingYards,rushingYards:yards-passingYards,passAttempts,completions,touchdowns:points===7?1:0,turnovers:points===0&&random(3)===0?1:0};
}
function matchRows(match:FootballMatch,user:string):DetailStats[]{
 return match.drives.filter(d=>d.user_id===user&&d.finished_at).sort((a,b)=>a.ordinal-b.ordinal).map(d=>({points:d.points??0,yards:d.yards??0,plays:d.plays??0,...Object.fromEntries(['passingYards','rushingYards','passAttempts','completions','touchdowns','turnovers','returnTouchdowns'].flatMap(key=>typeof d[key as keyof typeof d]==='number'?[[key,d[key as keyof typeof d]]]:[]))}));
}
export default function FootballH2HSession({me,initialTeam='JCY',initialMatch,friendIds=[],onClose}:{me:string;initialTeam?:string;initialMatch?:FootballMatch;friendIds?:string[];onClose:()=>void}){
 const [phase,setPhase]=useState<Phase>(initialMatch?'loading':'team');
 const [team,setTeam]=useState(initialMatch?(initialMatch.challenger_id===me?initialMatch.challenger_team:initialMatch.opponent_team||initialTeam):initialTeam);
 const [elapsed,setElapsed]=useState(0),[rival,setRival]=useState<Rival|null>(null),[match,setMatch]=useState<FootballMatch|null>(initialMatch||null);
 const [ours,setOurs]=useState<DetailStats[]>([]),[theirs,setTheirs]=useState<DetailStats[]>([]);
 const [attempt,setAttempt]=useState<FootballAttempt|null>(null),[error,setError]=useState(''),[leaving,setLeaving]=useState(false),[busy,setBusy]=useState(false),[rematchSent,setRematchSent]=useState(false),[frameActive,setFrameActive]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),frame=useRef<HTMLIFrameElement>(null),mounted=useRef(true),generation=useRef(0),pendingSearch=useRef<string|null>(null);
 const currentMatch=useRef<FootballMatch|null>(initialMatch||null),currentAttempt=useRef<FootballAttempt|null>(null),currentRival=useRef<Rival|null>(null),currentTeam=useRef(team);
 const accepted=useRef(false),saving=useRef(false),pendingResult=useRef<DetailStats|null>(null),launches=useRef(new Map<string,string>()),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const pendingExpired=useRef(false),resultRetained=useRef(false),rematchLock=useRef(false);
 const searchCreation=useRef<Promise<{id:string;status:string}>|null>(null);
 const leavingRef=useRef(false),deferred=useRef<(()=>void)|null>(null),starting=useRef(false);
 currentTeam.current=team;
 function requestExit(){leavingRef.current=true;setLeaving(true);}
 function resume(){leavingRef.current=false;setLeaving(false);const next=deferred.current;deferred.current=null;if(next)next();}
 function transition(fn:()=>void){if(leavingRef.current)deferred.current=fn;else fn();}
 const later=(fn:()=>void,delay:number)=>{const run=generation.current;const id=setTimeout(()=>{if(mounted.current&&run===generation.current)transition(fn);},delay);timers.current.push(id);};
 const updateMatch=(m:FootballMatch)=>{currentMatch.current=m;setMatch(m);setOurs(matchRows(m,me));setTheirs(matchRows(m,m.challenger_id===me?m.opponent_id||'':m.challenger_id));};
 useEffect(()=>{
  mounted.current=true;const prior=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  dialog.current?.showModal();document.body.style.overflow='hidden';
  return()=>{mounted.current=false;generation.current++;timers.current.forEach(clearTimeout);document.body.style.overflow=overflow;prior?.focus();const id=pendingSearch.current;if(id)void footballArenaAction('cancel',{id}).catch(()=>{});};
 },[]);
 async function readMatch(id:string){const home=await footballArenaAction<FootballHome>('home');const m=home.matches.find(m=>m.id===id);if(!m)throw Error('Could not load this match. Retry to reconnect.');return m;}
 async function beginDrive(m:FootballMatch|null,r:Rival,ordinal:number){
  if(!mounted.current||starting.current)return;if(leavingRef.current){deferred.current=()=>void beginDrive(m,r,ordinal);return;}const run=generation.current;starting.current=true;setBusy(true);setPhase('loading');setError('');accepted.current=false;pendingResult.current=null;currentAttempt.current=null;setAttempt(null);
  try{
   let next:FootballAttempt;
   if(r.simulated)next={token:crypto.randomUUID(),drive:ordinal,seed:r.seed+ordinal,team:currentTeam.current,opponent:r.team,deadline:new Date(Date.now()+720000).toISOString()};
   else{
    if(!m)throw Error('Match unavailable.');
    if(['expired','cancelled','declined'].includes(m.status)||Date.parse(m.expires_at)<=Date.now())throw Error('This match has expired or closed. Return to the lobby to start another match.');
    const unfinished=m.drives.find(d=>d.user_id===me&&!d.finished_at);
    if(unfinished)throw Error('An earlier drive was interrupted. Return to your matches to record it before continuing.');
    const key=`${m.id}:${ordinal}`;if(!launches.current.has(key))launches.current.set(key,crypto.randomUUID());
    next=await footballArenaAction<FootballAttempt>('begin',{id:m.id,drive:ordinal,launch:launches.current.get(key)});
   }
   if(!mounted.current||run!==generation.current){if(!r.simulated)void footballArenaAction('forfeit',{id:r.id,drive:next.drive,token:next.token}).catch(()=>{});return;}currentAttempt.current=next;setAttempt(next);setFrameActive(true);transition(()=>setPhase('game'));
  }catch(e){if(mounted.current&&run===generation.current)setError(e instanceof Error?e.message:'Could not start the next drive.');}finally{starting.current=false;if(mounted.current)setBusy(false);}
 }
 function introduce(m:FootballMatch|null,r:Rival){
  currentRival.current=r;setRival(r);if(m){const ownTeam=m.challenger_id===me?m.challenger_team:m.opponent_team!;currentTeam.current=ownTeam;setTeam(ownTeam);updateMatch(m);
   const cached=readFootballResult(me,m.id);
   if(cached&&!m.drives.some(d=>d.user_id===me&&d.ordinal===cached.attempt.drive&&d.finished_at)){
    currentAttempt.current=cached.attempt;setAttempt(cached.attempt);setFrameActive(false);accepted.current=true;void finishDrive(cached.stats,cached.expired);return;
   }
   clearFootballResult(me,m.id);
  }else{setOurs([]);setTheirs([]);}
  setPhase('intro');setError('');later(()=>{const complete=m?matchRows(m,me).length:0;if(complete>=3||(m&&['completed','expired','cancelled','declined'].includes(m.status)))setPhase('results');else void beginDrive(m,r,complete+1);},1800);
 }
 useEffect(()=>{if(initialMatch){const other=initialMatch.challenger_id===me?initialMatch.opponent_id:initialMatch.challenger_id;if(!other){setError('This match is waiting for an opponent.');return;}introduce(initialMatch,{id:initialMatch.id,team:initialMatch.challenger_id===me?initialMatch.opponent_team!:initialMatch.challenger_team,name:initialMatch.challenger_id===me?initialMatch.opponent_name:initialMatch.challenger_name,simulated:false,seed:0});}},[]);
 function practice(sameOpponent=false){
  generation.current++;timers.current.forEach(clearTimeout);timers.current=[];currentAttempt.current=null;setAttempt(null);pendingResult.current=null;currentMatch.current=null;setMatch(null);setRematchSent(false);leavingRef.current=false;setLeaving(false);deferred.current=null;
  const options=FOOTBALL_ARENA_TEAMS.filter(t=>t.abbr!==currentTeam.current),opponent=sameOpponent&&currentRival.current?teamInfo(currentRival.current.team):options[random(options.length)];
  introduce(null,{id:crypto.randomUUID(),team:opponent.abbr,name:'CPU opponent',simulated:true,seed:random(2147483647)});
 }
 function nextMatch(){generation.current++;timers.current.forEach(clearTimeout);timers.current=[];currentAttempt.current=null;setAttempt(null);currentRival.current=null;setRival(null);currentMatch.current=null;setMatch(null);setOurs([]);setTheirs([]);setError('');setRematchSent(false);setPhase('team');}
 async function search(){
  const run=++generation.current;searchCreation.current=null;setPhase('search');setElapsed(0);setError('');setRival(null);setOurs([]);setTheirs([]);currentMatch.current=null;setMatch(null);
  const start=Date.now(),active=()=>mounted.current&&run===generation.current;
  const timer=window.setInterval(()=>{if(active())setElapsed(Math.min(30,Math.floor((Date.now()-start)/1000)));},200);
  let id:string|null=null;
  try{
   if(me){
    const creation=footballArenaAction<{id:string;status:string}>('quick_match',{team:currentTeam.current});searchCreation.current=creation;
    const found=await creation;id=found.id;pendingSearch.current=id;
    if(!active()){if(!mounted.current)await footballArenaAction('cancel',{id}).catch(()=>{});return;}
    while(active()&&Date.now()-start<30000){
     const m=await readMatch(id);
     if(!active())return;
     if(m.status==='active'||m.status==='completed'){pendingSearch.current=null;introduce(m,{id:m.id,team:m.challenger_id===me?m.opponent_team!:m.challenger_team,name:m.challenger_id===me?m.opponent_name:m.challenger_name,simulated:false,seed:0});return;}
     if(!['open','pending'].includes(m.status))throw Error('This search was closed. Please try again.');
     await new Promise(resolve=>setTimeout(resolve,Math.min(1500,Math.max(0,30000-(Date.now()-start)))));
    }
   }else while(active()&&Date.now()-start<30000)await new Promise(resolve=>setTimeout(resolve,250));
   if(!active())return;
   if(id){
    try{await footballArenaAction('cancel',{id});pendingSearch.current=null;}
    catch{
     const m=await readMatch(id);
     if(!active())return;
     if(m.status==='active'||m.status==='completed'){pendingSearch.current=null;introduce(m,{id:m.id,team:m.challenger_id===me?m.opponent_team!:m.challenger_team,name:m.challenger_id===me?m.opponent_name:m.challenger_name,simulated:false,seed:0});return;}
     throw Error('Could not confirm your search closed. Retry before starting another match.');
    }
   }
   if(!active())return;
   searchCreation.current=null;practice();
  }catch(e){if(active())setError(e instanceof Error?e.message:'Matchmaking is unavailable. Please retry.');}
  finally{clearInterval(timer);}
 }
 async function cancelSearch(next:'team'|'search'|'practice'='team'){
  if(busy)return;setBusy(true);generation.current++;
  try{
   const id=pendingSearch.current||(searchCreation.current?await searchCreation.current.then(found=>found.id,()=>null):null);
   if(!mounted.current)return;
   if(id){try{await footballArenaAction('cancel',{id});pendingSearch.current=null;}catch{const m=await readMatch(id);if(!mounted.current)return;if(m.status==='active'||m.status==='completed'){pendingSearch.current=null;introduce(m,{id:m.id,team:m.challenger_id===me?m.opponent_team!:m.challenger_team,name:m.challenger_id===me?m.opponent_name:m.challenger_name,simulated:false,seed:0});return;}if(['cancelled','expired','declined'].includes(m.status))pendingSearch.current=null;else throw Error('Could not close this search. Try again.');}}
   if(!mounted.current)return;searchCreation.current=null;setError('');if(next==='practice')practice();else if(next==='search')void search();else setPhase('team');
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Could not close search.');}finally{if(mounted.current)setBusy(false);}
 }
 async function finishDrive(stats:DetailStats,expired=false){
  if(saving.current)return;const a=currentAttempt.current,r=currentRival.current;if(!a||!r)return;
  saving.current=true;pendingResult.current=stats;pendingExpired.current=expired;setBusy(true);setError('');setPhase('intermission');
  if(!r.simulated&&currentMatch.current)resultRetained.current=saveFootballResult(me,r.id,{attempt:a,stats,expired,expiresAt:new Date(Math.max(Date.now(),Date.parse(currentMatch.current.expires_at))+86400000).toISOString()});
  try{
   let m=currentMatch.current;
   if(r.simulated){setOurs(rows=>[...rows,stats]);setTheirs(rows=>[...rows,simulateDrive(r.team)]);}
   else{if(!m)throw Error('Match unavailable.');await footballArenaAction(expired?'forfeit':'submit',{id:m.id,drive:a.drive,token:a.token,...(expired?{}:{stats})});m=await readMatch(m.id);if(!mounted.current)return;updateMatch(m);}
   if(!r.simulated)clearFootballResult(me,r.id);pendingResult.current=null;currentAttempt.current=null;setAttempt(null);
   if(!mounted.current)return;
   later(()=>{if(m&&['completed','expired','cancelled','declined'].includes(m.status))setPhase('results');else if(a.drive<3)void beginDrive(m,r,a.drive+1);else setPhase('results');},1300);
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Could not save your drive. Retry to continue.');}
  finally{saving.current=false;if(mounted.current)setBusy(false);}
 }
 const finishCurrent=useRef(finishDrive);finishCurrent.current=finishDrive;
 useEffect(()=>{
  const listener=(event:MessageEvent)=>{const a=currentAttempt.current,r=currentRival.current,d=event.data;if(!a||!r||event.origin!==location.origin||event.source!==frame.current?.contentWindow||d?.matchId!==r.id||d?.token!==a.token||d?.drive!==a.drive)return;
   if(d.type==='bk-arena-result'&&!accepted.current&&validFootballStats(d.stats)){accepted.current=true;void finishCurrent.current(d.stats);}
   if(d.type==='bk-arena-exit'&&!accepted.current)requestExit();
  };window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);
 },[]);
 // Resolve an abandoned or expired iframe drive, even when it never sends a result.
 useEffect(()=>{
  if(!attempt)return;const tick=()=>{if(Date.now()>=Date.parse(attempt.deadline)&&!accepted.current&&!saving.current){accepted.current=true;void finishDrive({points:0,yards:0,plays:0},true);}};
  tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);
 },[attempt?.token]);
 // Online opponents play at their own pace. Never declare a result from partial drives.
 useEffect(()=>{
  if(phase!=='results'||!match||['completed','expired','cancelled','declined'].includes(match.status)||rival?.simulated)return;
  let stopped=false,inFlight=false;const refresh=async()=>{if(inFlight)return;inFlight=true;try{const next=await readMatch(match.id);if(!stopped&&mounted.current){updateMatch(next);setError('');}}catch(e){if(!stopped)setError(e instanceof Error?e.message:'Could not refresh opponent results.');}finally{inFlight=false;}};
  void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>{stopped=true;clearInterval(timer);};
 },[phase,match?.id,match?.status,rival?.simulated]);
 async function refreshResults(){
  const m=currentMatch.current;if(!m||busy)return;setBusy(true);setError('');
  try{const next=await readMatch(m.id);if(mounted.current)updateMatch(next);}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Could not refresh opponent results.');}finally{if(mounted.current)setBusy(false);}
 }
 async function leaveGame(){
  if(busy||saving.current||starting.current)return;setBusy(true);setError('');const a=currentAttempt.current,r=currentRival.current;
  try{if(a&&r&&!r.simulated&&!pendingResult.current)await footballArenaAction('forfeit',{id:r.id,drive:a.drive,token:a.token});generation.current++;deferred.current=null;timers.current.forEach(clearTimeout);if(mounted.current)onClose();}
  catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Could not record the interrupted drive. Retry.');setBusy(false);}}
 }
 function close(){if(phase==='search'){void cancelSearch();return;}if(['game','intermission','loading','intro'].includes(phase)){requestExit();return;}onClose();}
 const closed=!!match&&['expired','cancelled','declined'].includes(match.status);
 const pending=phase==='results'&&!rival?.simulated&&match?.status!=='completed'&&!closed;
 const ourScore=scoreSum(ours),theirScore=scoreSum(theirs);
 const outcome=closed?'Match closed':pending?'Waiting for your opponent':ourScore>theirScore?'You win!':ourScore<theirScore?'You lose':'Tie game';
 const retry=()=>{if(pendingResult.current)void finishDrive(pendingResult.current,pendingExpired.current);else if(currentRival.current)void beginDrive(currentMatch.current,currentRival.current,ours.length+1);};
 const otherId=match?(match.challenger_id===me?match.opponent_id:match.challenger_id):null;
 async function rematch(){if(!otherId||rematchLock.current)return;rematchLock.current=true;setBusy(true);setError('');try{await footballArenaAction('create',{team:currentTeam.current,opponent:otherId});if(mounted.current)setRematchSent(true);}catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Could not send the rematch challenge.');}finally{rematchLock.current=false;if(mounted.current)setBusy(false);}}
 return createPortal(<dialog ref={dialog} className="football-session" data-phase={phase} aria-label="Football match" onCancel={e=>{e.preventDefault();close();}}>
  <header className="football-session-header"><div><span className="football-eyebrow">BALL KNOWER · HEAD-TO-HEAD</span><strong>{phase==='team'?'Build your matchup':phase==='search'?'Matchmaking':phase==='results'?'Match results':`Drive ${attempt?.drive||Math.min(3,ours.length+1)} of 3`}</strong></div><button type="button" className="secondary" disabled={busy} onClick={close}>{phase==='team'?'Back':phase==='results'?'Back to main screen':'Exit'}</button></header>
  {phase==='team'&&<FootballH2HTeamSelect selectedTeam={team} onSelect={setTeam} onContinue={()=>void search()} onBack={onClose} continueLabel={me?'Find online player':'Start quick practice'} description={me?'Search for a real player. Automated practice starts after 30 seconds if nobody joins.':'A 30-second countdown, then CPU practice. Online records require an account.'}/>}
  {phase==='search'&&<section className="football-session-stage" aria-label="Matchmaking"><span className="football-eyebrow">{me?'ONLINE PLAYER SEARCH':'AUTOMATED PRACTICE COUNTDOWN'} · {teamInfo(team).name}</span><h1>{error?'Search interrupted':me?'Finding an online player':'Preparing automated practice'}</h1><div className="football-search-clock" role="timer" aria-label="Matchmaking seconds">{elapsed}<small>/ 30 seconds</small></div><p>{me?'Looking for a real player. If nobody joins within 30 seconds, a clearly labelled CPU practice match starts automatically. Online players complete their drives at their own pace.':'Guest quick matches use a CPU opponent. Automated practice starts after this 30-second countdown. Sign in from the Arena to find real players and keep online records.'}</p>{error&&<><p role="alert">{error}</p><div className="football-session-actions"><button type="button" disabled={busy} onClick={()=>void cancelSearch('search')}>Retry online search</button><button type="button" className="secondary" disabled={busy} onClick={()=>void cancelSearch('practice')}>Play automated practice</button></div></>}<button type="button" className="secondary" disabled={busy} onClick={()=>void cancelSearch()}>{busy?'Closing search…':'Cancel search'}</button></section>}
  {phase==='intro'&&rival&&<section className="football-session-stage" role="status"><span className="football-eyebrow">{rival.simulated?'AUTOMATED PRACTICE':'ONLINE PLAYER MATCHED'}</span><h1>{teamInfo(team).name}<em>VS</em>{teamInfo(rival.team).name}</h1><p>{rival.name}{rival.simulated?' · computer-controlled scorecard':''}</p><p>Three drives. Each begins with a kickoff.</p></section>}
  {phase==='loading'&&<section className="football-session-stage"><h1>Preparing kickoff</h1>{error?<><p role="alert">{error}</p><button type="button" disabled={busy||!rival} onClick={retry}>Retry next drive</button></>:<p role="status">Loading your next drive…</p>}</section>}
  {(phase==='game'||phase==='intermission')&&attempt&&rival&&<><div className="football-session-score"><span>You <b>{ourScore}</b></span><small>{rival.simulated?'CPU · automated practice':rival.name} · {theirs.length}/3 opponent drives</small><span><b>{theirScore}</b> {teamInfo(rival.team).abbr}</span></div>{frameActive&&<iframe ref={frame} key={`${rival.id}:${attempt.drive}`} title={`Football H2H offensive drive ${attempt.drive}`} src={footballDriveUrl(rival.id,attempt)} allow="fullscreen" className={phase==='intermission'||leaving?'football-session-frame hidden-frame':'football-session-frame'}/>}</>}
  {phase==='intermission'&&<section className="football-session-stage" aria-live="polite"><h1>{busy?'Saving drive…':error?'Save interrupted':'Drive complete'}</h1>{error?<><p role="alert">{error}</p><button type="button" disabled={busy} onClick={retry}>Retry saving result</button></>:<p>{(attempt?.drive||ours.length)<3?'The next kickoff starts automatically.':'Preparing your scoreboard…'}</p>}</section>}
  {phase==='results'&&rival&&<section className="football-session-results"><span className="football-eyebrow">{closed?'MATCH CLOSED':pending?'YOUR DRIVES ARE COMPLETE':'FINAL SCORE'}</span><h1>{outcome}</h1><div className="football-final-score"><div><strong>You</strong><span>{teamInfo(team).name}</span><b>{ourScore}</b></div><em>—</em><div><strong>{rival.name}</strong><span>{teamInfo(rival.team).name}</span><b>{theirScore}</b></div></div>{closed&&<p role="status">This match expired or closed before both players finished. Completed drive totals are shown below.</p>}{pending&&<p role="status">Your score is saved. Your opponent has finished {theirs.length} of 3 drives. This screen updates automatically. You can return later from Football H2H in the Arena.</p>}{error&&<p role="alert">{error}{pending&&<button type="button" className="secondary" disabled={busy} onClick={()=>void refreshResults()}>Retry opponent score</button>}</p>}<OffensiveComparison ours={ours} theirs={theirs}/><p className="football-session-fine">{rival.simulated?'Automated practice · CPU scores are simulated · does not affect online standings.':'Online player · device-reported results · final after both players finish.'}</p><div className="football-session-actions">{rival.simulated?<button type="button" onClick={()=>practice(true)}>Play automated rematch</button>:!pending&&!closed&&otherId&&friendIds.includes(otherId)&&<button type="button" disabled={busy||rematchSent} onClick={()=>void rematch()}>{rematchSent?'Rematch challenge sent':'Challenge to rematch'}</button>}<button type="button" className="secondary" disabled={busy} onClick={nextMatch}>{rival.simulated?'Choose another matchup':'Find another opponent'}</button><button type="button" className="secondary" disabled={busy} onClick={onClose}>Back to main screen</button></div>{rematchSent&&<p role="status">Your completed match is saved. The new rematch challenge is in your Football H2H matches.</p>}</section>}
  {leaving&&<section className="football-session-exit" role="alertdialog" aria-modal="true" aria-label="Leave match?"><h2>Leave this match?</h2><p>{rival?.simulated?'Automated practice is kept only while this match is open. Leaving ends this practice match.':pendingResult.current?resultRetained.current?'Your finished drive is waiting to save on this device. Return to this match in Football H2H to retry.':'Your result has not saved and browser storage is unavailable. Leaving now discards it. Keep this screen open and retry to preserve this drive.':phase==='game'?'The current drive will be recorded as zero. Completed drives stay saved.':'Completed drives stay recorded. You can return to online matches from the lobby.'}</p>{error&&<p role="alert">{error}</p>}<button type="button" disabled={busy} onClick={()=>void leaveGame()}>{pendingResult.current&&!rival?.simulated&&!resultRetained.current?'Leave without saving':'Leave match'}</button><button type="button" className="secondary" disabled={busy} onClick={resume}>Keep playing</button></section>}
 </dialog>,document.body);
}
function OffensiveComparison({ours,theirs}:{ours:DetailStats[];theirs:DetailStats[]}){
 const total=(rows:DetailStats[],key:keyof DetailStats)=>rows.length&&rows.every(r=>typeof r[key]==='number')?rows.reduce((s,r)=>s+(r[key] as number),0):null;
 const show=(n:number|null)=>n===null?'—':String(n);
 const passing=(rows:DetailStats[])=>{const c=total(rows,'completions'),a=total(rows,'passAttempts');return c===null||a===null?'—':`${c}/${a}`;};
 const fields:[string,keyof DetailStats][]=[['Total yards','yards'],['Passing yards','passingYards'],['Rushing yards','rushingYards'],['Offensive plays','plays'],['Touchdowns','touchdowns'],['Turnovers','turnovers']];
 return <div className="football-offense-comparison"><h2>Offensive comparison</h2><table aria-label="Offensive stats"><thead><tr><th scope="col">You</th><th scope="col">Offense</th><th scope="col">Opponent</th></tr></thead><tbody><tr><td>{ours.length}/3</td><th scope="row">Drives completed</th><td>{theirs.length}/3</td></tr>{fields.map(([label,key])=><tr key={key}><td>{show(total(ours,key))}</td><th scope="row">{label}</th><td>{show(total(theirs,key))}</td></tr>)}<tr><td>{passing(ours)}</td><th scope="row">Completions / attempts</th><td>{passing(theirs)}</td></tr></tbody></table><p>— means the statistic is not available. Totals include completed drives.</p></div>;
}
