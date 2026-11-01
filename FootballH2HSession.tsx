import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {footballArenaAction,footballDriveUrl,validFootballStats,type FootballAttempt,type FootballMatch,type FootballHome,type FootballStats} from './footballArena';
import {FOOTBALL_ARENA_TEAMS} from './footballArenaTeams';
import {FootballH2HTeamSelect} from './FootballH2HTeamSelect';
import './footballH2HSession.css';
import {pickFootballOpponentHandle} from './footballOpponentHandles';

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
export default function FootballH2HSession({me,initialTeam='JCY',initialMatch,onClose}:{me:string;initialTeam?:string;initialMatch?:FootballMatch;onClose:()=>void}){
 const [phase,setPhase]=useState<Phase>(initialMatch?'loading':'team');
 const [team,setTeam]=useState(initialMatch?(initialMatch.challenger_id===me?initialMatch.challenger_team:initialMatch.opponent_team||initialTeam):initialTeam);
 const [elapsed,setElapsed]=useState(0),[rival,setRival]=useState<Rival|null>(null),[match,setMatch]=useState<FootballMatch|null>(initialMatch||null);
 const [ours,setOurs]=useState<DetailStats[]>([]),[theirs,setTheirs]=useState<DetailStats[]>([]);
 const [attempt,setAttempt]=useState<FootballAttempt|null>(null),[error,setError]=useState(''),[leaving,setLeaving]=useState(false),[busy,setBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),frame=useRef<HTMLIFrameElement>(null),mounted=useRef(true),generation=useRef(0),pendingSearch=useRef<string|null>(null);
 const currentMatch=useRef<FootballMatch|null>(initialMatch||null),currentAttempt=useRef<FootballAttempt|null>(null),currentRival=useRef<Rival|null>(null),currentTeam=useRef(team);
 const accepted=useRef(false),saving=useRef(false),pendingResult=useRef<DetailStats|null>(null),launches=useRef(new Map<string,string>()),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
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
   if(!mounted.current||run!==generation.current){if(!r.simulated)void footballArenaAction('forfeit',{id:r.id,drive:next.drive,token:next.token}).catch(()=>{});return;}currentAttempt.current=next;setAttempt(next);transition(()=>setPhase('game'));
  }catch(e){if(mounted.current&&run===generation.current)setError(e instanceof Error?e.message:'Could not start the next drive.');}finally{starting.current=false;if(mounted.current)setBusy(false);}
 }
 function introduce(m:FootballMatch|null,r:Rival){
  currentRival.current=r;setRival(r);if(m){const ownTeam=m.challenger_id===me?m.challenger_team:m.opponent_team!;currentTeam.current=ownTeam;setTeam(ownTeam);updateMatch(m);}else{setOurs([]);setTheirs([]);}
  setPhase('intro');setError('');later(()=>{const complete=m?matchRows(m,me).length:0;if(complete>=3)setPhase('results');else void beginDrive(m,r,complete+1);},1800);
 }
 useEffect(()=>{if(initialMatch){const other=initialMatch.challenger_id===me?initialMatch.opponent_id:initialMatch.challenger_id;if(!other){setError('This match is waiting for an opponent.');return;}introduce(initialMatch,{id:initialMatch.id,team:initialMatch.challenger_id===me?initialMatch.opponent_team!:initialMatch.challenger_team,name:initialMatch.challenger_id===me?initialMatch.opponent_name:initialMatch.challenger_name,simulated:false,seed:0});}},[]);
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
   const options=FOOTBALL_ARENA_TEAMS.filter(t=>t.abbr!==currentTeam.current),opponent=options[random(options.length)];
   introduce(null,{id:crypto.randomUUID(),team:opponent.abbr,name:pickFootballOpponentHandle(),simulated:true,seed:random(2147483647)});
  }catch(e){if(active())setError(e instanceof Error?e.message:'Matchmaking is unavailable. Please retry.');}
  finally{clearInterval(timer);}
 }
 async function cancelSearch(){
  if(busy)return;setBusy(true);generation.current++;
  try{
   const id=pendingSearch.current||(searchCreation.current?await searchCreation.current.then(found=>found.id,()=>null):null);
   if(!mounted.current)return;
   if(id){try{await footballArenaAction('cancel',{id});pendingSearch.current=null;}catch{const m=await readMatch(id);if(!mounted.current)return;if(m.status==='active'||m.status==='completed'){pendingSearch.current=null;introduce(m,{id:m.id,team:m.challenger_id===me?m.opponent_team!:m.challenger_team,name:m.challenger_id===me?m.opponent_name:m.challenger_name,simulated:false,seed:0});return;}if(['cancelled','expired','declined'].includes(m.status))pendingSearch.current=null;else throw Error('Could not close this search. Try again.');}}
   if(!mounted.current)return;searchCreation.current=null;setPhase('team');setError('');
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Could not close search.');}finally{if(mounted.current)setBusy(false);}
 }
 async function finishDrive(stats:DetailStats,expired=false){
  if(saving.current)return;const a=currentAttempt.current,r=currentRival.current;if(!a||!r)return;
  saving.current=true;pendingResult.current=stats;setBusy(true);setError('');setPhase('intermission');
  try{
   let m=currentMatch.current;
   if(r.simulated){setOurs(rows=>[...rows,stats]);setTheirs(rows=>[...rows,simulateDrive(r.team)]);}
   else{if(!m)throw Error('Match unavailable.');await footballArenaAction(expired?'forfeit':'submit',{id:m.id,drive:a.drive,token:a.token,...(expired?{}:{stats})});m=await readMatch(m.id);if(!mounted.current)return;updateMatch(m);}
   pendingResult.current=null;currentAttempt.current=null;setAttempt(null);
   if(!mounted.current)return;
   later(()=>{if(a.drive<3)void beginDrive(m,r,a.drive+1);else setPhase('results');},1300);
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
 async function leaveGame(){
  if(busy||saving.current||starting.current)return;setBusy(true);setError('');const a=currentAttempt.current,r=currentRival.current;
  try{if(a&&r&&!r.simulated)await footballArenaAction('forfeit',{id:r.id,drive:a.drive,token:a.token});generation.current++;deferred.current=null;timers.current.forEach(clearTimeout);if(mounted.current)onClose();}
  catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Could not record the interrupted drive. Retry.');setBusy(false);}}
 }
 function close(){if(phase==='search'){void cancelSearch();return;}if(['game','intermission','loading','intro'].includes(phase)){requestExit();return;}onClose();}
 const closed=!!match&&['expired','cancelled','declined'].includes(match.status);
 const pending=phase==='results'&&!rival?.simulated&&match?.status!=='completed'&&!closed;
 const ourScore=scoreSum(ours),theirScore=scoreSum(theirs);
 const outcome=closed?'Match closed':pending?'Waiting for your opponent':ourScore>theirScore?'You win!':ourScore<theirScore?'You lose':'Tie game';
 const retry=()=>{if(pendingResult.current)void finishDrive(pendingResult.current,!!currentAttempt.current&&Date.now()>=Date.parse(currentAttempt.current.deadline));else if(currentRival.current)void beginDrive(currentMatch.current,currentRival.current,ours.length+1);};
 return createPortal(<dialog ref={dialog} className="football-session" aria-label="Football match" onCancel={e=>{e.preventDefault();close();}}>
  <header className="football-session-header"><div><span className="football-eyebrow">BALL KNOWER · HEAD-TO-HEAD</span><strong>{phase==='team'?'Build your matchup':phase==='search'?'Matchmaking':phase==='results'?'Match results':`Drive ${attempt?.drive||Math.min(3,ours.length+1)} of 3`}</strong></div><button type="button" className="secondary" disabled={busy} onClick={close}>{phase==='team'?'Back':phase==='results'?'Back to main screen':'Exit'}</button></header>
  {phase==='team'&&<FootballH2HTeamSelect selectedTeam={team} onSelect={setTeam} onContinue={()=>void search()} onBack={onClose}/>}
  {phase==='search'&&<section className="football-session-stage" aria-label="Matchmaking"><span className="football-eyebrow">{teamInfo(team).name}</span><h1>Finding your matchup</h1><div className="football-search-clock" role="timer" aria-label="Matchmaking seconds">{elapsed}<small>/ 30 seconds</small></div><p>Your next matchup is on the way. Get ready to take the field.</p>{error&&<p role="alert">{error}</p>}<button type="button" className="secondary" disabled={busy} onClick={()=>void cancelSearch()}>{busy?'Closing search…':'Cancel search'}</button></section>}
  {phase==='intro'&&rival&&<section className="football-session-stage" role="status"><span className="football-eyebrow">OPPONENT FOUND</span><h1>{teamInfo(team).name}<em>VS</em>{teamInfo(rival.team).name}</h1><p>{rival.name}</p><p>Three drives. Each begins with a kickoff.</p></section>}
  {phase==='loading'&&<section className="football-session-stage"><h1>Preparing kickoff</h1>{error?<><p role="alert">{error}</p><button type="button" onClick={retry}>Retry next drive</button></>:<p role="status">Loading your next drive…</p>}</section>}
  {(phase==='game'||phase==='intermission')&&attempt&&rival&&<><div className="football-session-score"><span>You <b>{ourScore}</b></span><small>{rival.name} · {theirs.length}/3 opponent drives</small><span><b>{theirScore}</b> {teamInfo(rival.team).abbr}</span></div><iframe ref={frame} key={`${rival.id}:${attempt.drive}`} title={`Football H2H offensive drive ${attempt.drive}`} src={footballDriveUrl(rival.id,attempt)} allow="fullscreen" className={phase==='intermission'||leaving?'football-session-frame hidden-frame':'football-session-frame'}/></>}
  {phase==='intermission'&&<section className="football-session-stage" aria-live="polite"><h1>{busy?'Saving drive…':error?'Save interrupted':'Drive complete'}</h1>{error?<><p role="alert">{error}</p><button type="button" disabled={busy} onClick={retry}>Retry saving result</button></>:<p>{(attempt?.drive||ours.length)<3?'The next kickoff starts automatically.':'Preparing your scoreboard…'}</p>}</section>}
  {phase==='results'&&rival&&<section className="football-session-results"><span className="football-eyebrow">{closed?'MATCH CLOSED':pending?'YOUR DRIVES ARE COMPLETE':'FINAL SCORE'}</span><h1>{outcome}</h1><div className="football-final-score"><div><strong>You</strong><span>{teamInfo(team).name}</span><b>{ourScore}</b></div><em>—</em><div><strong>{rival.name}</strong><span>{teamInfo(rival.team).name}</span><b>{theirScore}</b></div></div>{closed&&<p role="status">This match expired or closed before both players finished. Completed drive totals are shown below.</p>}{pending&&<p role="status">Your score is saved. Your opponent has finished {theirs.length} of 3 drives. This screen updates automatically; you can also return later from Match history.</p>}{error&&<p role="alert">{error}</p>}<OffensiveComparison ours={ours} theirs={theirs}/><p className="football-session-fine">{rival.simulated?'Quick match · does not affect standings.':'Device-reported results · final after both players finish.'}</p><button type="button" onClick={onClose}>Back to main screen</button></section>}
  {leaving&&<section className="football-session-exit" role="alertdialog" aria-modal="true" aria-label="Leave match?"><h2>Leave this match?</h2><p>{phase==='game'?'The current drive will be recorded as zero.':'Completed drives stay recorded. You can return to online matches from the lobby.'}</p>{error&&<p role="alert">{error}</p>}<button type="button" disabled={busy} onClick={()=>void leaveGame()}>Leave match</button><button type="button" className="secondary" disabled={busy} onClick={resume}>Keep playing</button></section>}
 </dialog>,document.body);
}
function OffensiveComparison({ours,theirs}:{ours:DetailStats[];theirs:DetailStats[]}){
 const total=(rows:DetailStats[],key:keyof DetailStats)=>rows.length&&rows.every(r=>typeof r[key]==='number')?rows.reduce((s,r)=>s+(r[key] as number),0):null;
 const show=(n:number|null)=>n===null?'—':String(n);
 const passing=(rows:DetailStats[])=>{const c=total(rows,'completions'),a=total(rows,'passAttempts');return c===null||a===null?'—':`${c}/${a}`;};
 const fields:[string,keyof DetailStats][]=[['Total yards','yards'],['Passing yards','passingYards'],['Rushing yards','rushingYards'],['Offensive plays','plays'],['Touchdowns','touchdowns'],['Turnovers','turnovers']];
 return <div className="football-offense-comparison"><h2>Offensive comparison</h2><table aria-label="Offensive stats"><thead><tr><th scope="col">You</th><th scope="col">Offense</th><th scope="col">Opponent</th></tr></thead><tbody><tr><td>{ours.length}/3</td><th scope="row">Drives completed</th><td>{theirs.length}/3</td></tr>{fields.map(([label,key])=><tr key={key}><td>{show(total(ours,key))}</td><th scope="row">{label}</th><td>{show(total(theirs,key))}</td></tr>)}<tr><td>{passing(ours)}</td><th scope="row">Completions / attempts</th><td>{passing(theirs)}</td></tr></tbody></table><p>— means the statistic is not available. Totals include completed drives.</p></div>;
}
