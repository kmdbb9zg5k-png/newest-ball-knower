import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {footballArenaAction,footballDriveUrl,validFootballStats,type FootballHome} from './footballArena';
import {FOOTBALL_ARENA_TEAMS} from './footballArenaTeams';

const names=['Jordan Mills','Marcus Reed','Alex Rivera','Dylan Brooks','Cameron Hayes','Andre Carter','Tyler Bennett','Chris Morgan','Devin Cole','Jesse Walker','Nico Grant','Sam Parker'];
const pick=<T,>(items:T[])=>items[crypto.getRandomValues(new Uint32Array(1))[0]%items.length];
type Rival={name:string;ownTeam:string;team:string;scores:number[];id:string;seed:number};
export default function GlobalFootballMatchmaking({me,team,onOpenAuth,onMatched}:{me:string;team:string;onOpenAuth:()=>void;onMatched:()=>void}){
 const [searching,setSearching]=useState(false),[seconds,setSeconds]=useState(30),[notice,setNotice]=useState('');
 const [rival,setRival]=useState<Rival|null>(null),[scores,setScores]=useState<number[]>([]),[playing,setPlaying]=useState(false);
 const mounted=useRef(true),locked=useRef(false),cancelled=useRef(false),pending=useRef<string|null>(null);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancelled.current=true;const id=pending.current;if(id)void footballArenaAction('cancel',{id}).catch(()=>{});};},[]);
 const cpu=()=>{setScores([]);setRival({name:pick(names),ownTeam:team,team:pick(FOOTBALL_ARENA_TEAMS.filter(t=>t.abbr!==team)).abbr,scores:[0,0,0].map(()=>pick([0,0,3,3,7,7,7,8])),id:crypto.randomUUID(),seed:crypto.getRandomValues(new Uint32Array(1))[0]%2147483647});setNotice('No player matched. Your CPU opponent is ready.');};
 async function search(){
  if(!me){onOpenAuth();return;}if(locked.current)return;
  locked.current=true;cancelled.current=false;setSearching(true);setRival(null);setNotice('Searching worldwide for an open opponent…');setSeconds(30);
  const deadline=Date.now()+30000;
  const timer=window.setInterval(()=>{if(mounted.current)setSeconds(Math.max(0,Math.ceil((deadline-Date.now())/1000)));},250);
  try{
   let home=await footballArenaAction<FootballHome>('home');
   const open=home.matches.find(m=>m.status==='open'&&m.challenger_id!==me&&Date.parse(m.expires_at)>Date.now());
   if(open&&!cancelled.current){try{await footballArenaAction('accept',{id:open.id,team});if(mounted.current){setNotice('Player matched! Your match is in Football challenges below.');onMatched();}return;}catch{/* Another player may have accepted first. */}}
   if(cancelled.current)return;
   const created=await footballArenaAction<{id:string}>('create',{team});pending.current=created.id;
   while(!cancelled.current&&Date.now()<deadline){
    home=await footballArenaAction<FootballHome>('home');
    if(home.matches.some(m=>m.id===created.id&&m.status==='active')){pending.current=null;if(mounted.current){setNotice('Player matched! Your match is in Football challenges below.');onMatched();}return;}
    await new Promise(resolve=>setTimeout(resolve,Math.min(2000,Math.max(0,deadline-Date.now()))));
   }
   // The server locks this row: a late acceptance wins over CPU fallback.
   try{await footballArenaAction('cancel',{id:created.id});pending.current=null;}
   catch{home=await footballArenaAction<FootballHome>('home');if(home.matches.some(m=>m.id===created.id&&m.status==='active')){pending.current=null;if(mounted.current){setNotice('Player matched just before the search ended. Find your match below.');onMatched();}return;}throw new Error('Could not close the online search. Check your matches before trying again.');}
   if(mounted.current){if(!cancelled.current)cpu();else setNotice('Search cancelled.');}
  }catch(e){if(mounted.current)setNotice(e instanceof Error?e.message:'Matchmaking unavailable. Please try again.');}
  finally{clearInterval(timer);locked.current=false;if(mounted.current){setSearching(false);onMatched();}}
 }
 const total=scores.reduce((a,b)=>a+b,0),opponent=rival?.scores.reduce((a,b)=>a+b,0)||0;
 return <section className="football-card" aria-label="Global matchmaking"><span className="football-eyebrow">GLOBAL QUICK MATCH</span><h3>There’s always a game.</h3><p>Find a player worldwide. After a 30-second search, play a named CPU rival. Matches use three offensive drives against CPU defense.</p>
 <div className="football-match-actions"><button disabled={searching} onClick={()=>void search()}>{searching?`Finding opponent · ${seconds}s`:'Find global opponent'}</button>{searching&&<button className="secondary" onClick={()=>{cancelled.current=true;setNotice('Closing your search…');}}>Cancel search</button>}</div>
 <p className="football-note" role="status">{notice}</p>
 {rival&&<div><span className="football-eyebrow">CPU OPPONENT · UNRANKED</span><h3>{rival.name}</h3><p>{FOOTBALL_ARENA_TEAMS.find(t=>t.abbr===rival.team)?.name}</p><p>{scores.length===3?`${total===opponent?'TIE GAME':total>opponent?'YOU WIN':'OPPONENT WINS'} · ${total} – ${opponent}`:`Your score: ${total} · ${scores.length}/3 drives complete`}</p><p className="football-note">Simulated rival. Results do not affect global player standings.</p>{scores.length<3&&<button onClick={()=>setPlaying(true)}>Play CPU drive {scores.length+1} of 3</button>}</div>}
 {playing&&rival&&createPortal(<CpuDrive key={`${rival.id}:${scores.length}`} rival={rival} team={rival.ownTeam} drive={scores.length+1} onDone={points=>{setScores(s=>[...s,points]);setPlaying(false);}}/>,document.body)}
 </section>;
}
function CpuDrive({rival,team,drive,onDone}:{rival:Rival;team:string;drive:number;onDone:(points:number)=>void}){
 const frame=useRef<HTMLIFrameElement>(null),dialog=useRef<HTMLDialogElement>(null),done=useRef(false);
 const [token]=useState(()=>crypto.randomUUID()),[leaving,setLeaving]=useState(false);
 const finish=(points:number)=>{if(!done.current){done.current=true;onDone(points);}};
 useEffect(()=>{const prior=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;dialog.current?.showModal();document.body.style.overflow='hidden';const listener=(event:MessageEvent)=>{const d=event.data;if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||d?.matchId!==rival.id||d?.token!==token||d?.drive!==drive)return;if(d.type==='bk-arena-result'&&validFootballStats(d.stats))finish(d.stats.points);if(d.type==='bk-arena-exit')setLeaving(true);};window.addEventListener('message',listener);return()=>{window.removeEventListener('message',listener);document.body.style.overflow=overflow;prior?.focus();};},[]);
 return <dialog ref={dialog} className="football-drive-dialog" aria-label="CPU football drive" onCancel={e=>{e.preventDefault();setLeaving(true);}}><header><div><strong>{rival.name} · CPU OPPONENT</strong><small>Unranked · Drive {drive}/3</small></div><button onClick={()=>setLeaving(true)}>Close drive</button></header>{leaving&&<section className="football-drive-message"><h2>Leave this drive?</h2><p>Leaving records zero points.</p><button onClick={()=>finish(0)}>Record 0 and leave</button><button onClick={()=>setLeaving(false)}>Keep playing</button></section>}<iframe className={leaving?'football-frame-hidden':''} ref={frame} title="CPU offensive drive" src={footballDriveUrl(rival.id,{token,drive,seed:rival.seed+drive,team,opponent:rival.team,deadline:new Date(Date.now()+720000).toISOString()})} allow="fullscreen"/></dialog>;
}
