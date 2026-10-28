import {reportMiniChallenge} from '../public/mini-challenge-bridge.js';
import React,{useEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {newSkill,startSkill,stepSkill,cutSkill,cutProgress,readSkills,saveSkill,BENCH_SECONDS,benchCue,SHUTTLE_RULESET} from './agility-strength.js';
import HoldPauseButton from './HoldPauseButton';
import './combine.css';
import './skills.css';
type Athlete={id:string;name:string;position:string;speed:number;acceleration:number;seed:number};
export default function AgilityStrengthExperience({players,context,onClose,drill,onResult}:{players:Athlete[];context:string;onClose:()=>void;drill:'shuttle'|'bench';onResult?:(stats:Record<string,number>)=>void}){
 const [player,setPlayer]=useState(players[0]),[view,setView]=useState(()=>newSkill(players[0],drill));
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[paused,setPaused]=useState(false),[pauseReason,setPauseReason]=useState('manual'),[attempts,setAttempts]=useState<number[]>([]),[saved,setSaved]=useState(true),[rows,setRows]=useState(readSkills);
 const run=useRef(newSkill(players[0],drill)),host=useRef<HTMLDivElement>(null),scene=useRef<any>(null),stopped=useRef(false),recorded=useRef(false),modal=useRef<HTMLDivElement>(null),start=useRef<HTMLButtonElement>(null),held=useRef(new Set<string>());
 const shuttle=drill==='shuttle',title=shuttle?'20-YARD SHUTTLE':'BENCH PRESS',terminal=view.phase==='finished',blocked=!ready||!!error||paused||terminal;
 const marks=rows.filter(r=>r.drill===drill&&r.context===context&&r.playerId===player.id&&(!shuttle||r.ruleset===SHUTTLE_RULESET)).map(r=>r.score),best=marks.length?(shuttle?Math.min(...marks):Math.max(...marks)):null;
 const format=(n:number)=>shuttle?`${n.toFixed(2)}s`:`${n} reps`;
 const release=()=>{held.current.clear();run.current.pressing=false;};
 const pause=(reason='manual')=>{stopped.current=true;release();setPauseReason(reason);setPaused(true);};
 const reset=(next=player,clear=false)=>{release();run.current=newSkill(next,drill);recorded.current=false;setView({...run.current});setPlayer(next);scene.current?.setAthlete(next);if(clear)setAttempts([]);setSaved(true);};
 useEffect(()=>{
  let gone=false,raf=0,last=0,hud=0;
  import('./scene.js').then(async({createCombineScene})=>{
   if(gone||!host.current)return;const loaded=await createCombineScene(host.current,run.current.athlete,()=>{pause();setError('Graphics were interrupted. Reopen the drill to continue.');},drill);
   if(gone){loaded.dispose();return;}scene.current=loaded;loaded.draw(run.current,0);setReady(true);last=performance.now();
   const frame=(now:number)=>{if(gone)return;raf=requestAnimationFrame(frame);const dt=(now-last)/1000;last=now;if(stopped.current||document.hidden)return;
    if(dt>5&&['running','cut','countdown'].includes(run.current.phase)){pause('interruption');return;}
    // Consume all active time; the fixed plant phase makes cuts readable.
    stepSkill(run.current,dt);loaded.draw(run.current,Math.min(dt,.1));
    if(run.current.phase==='finished'&&!recorded.current){recorded.current=true;const resultStats=drill==='shuttle'?{time:Number(run.current.score.toFixed(3)),penalty:Number(run.current.penalty.toFixed(3))}:{reps:run.current.score};reportMiniChallenge(resultStats);onResult?.(resultStats);setAttempts(a=>[...a,run.current.score]);setSaved(saveSkill(run.current,context));setRows(readSkills());}
    // Commit the timing cue before the next input task; no stale green window.
    if(now-hud>30){flushSync(()=>setView({...run.current}));hud=now;}
   };raf=requestAnimationFrame(frame);
  }).catch(()=>{if(!gone)setError('Could not load the athlete. Reopen this drill to try again.');});
  const hide=()=>{if(document.hidden&&['countdown','running','cut'].includes(run.current.phase))pause('background');};
  // Browser chrome/keyboard focus changes release a held press; only hiding the app pauses.
  const blur=()=>release();
  const up=(e:PointerEvent)=>{held.current.delete(`p${e.pointerId}`);run.current.pressing=held.current.size>0;};
  const keyup=(e:KeyboardEvent)=>{held.current.delete(`k${e.key}`);run.current.pressing=held.current.size>0;};
  document.addEventListener('visibilitychange',hide);window.addEventListener('blur',blur);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('keyup',keyup);
  return()=>{gone=true;cancelAnimationFrame(raf);scene.current?.dispose();scene.current=null;document.removeEventListener('visibilitychange',hide);window.removeEventListener('blur',blur);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('keyup',keyup);};
 },[]);
 useEffect(()=>{if(blocked)modal.current?.querySelector('button')?.focus();else if(view.phase==='idle')start.current?.focus();},[blocked,view.phase]);
 const press=(id:string)=>{if(stopped.current||!ready||error||run.current.phase!=='running')return;held.current.add(id);run.current.pressing=true;};
 const cut=(side:string)=>{if(!blocked)cutSkill(run.current,side);};
 const progress=cutProgress(view),green=progress>=.45&&progress<=.90&&!view.locked&&view.turn<2;
 const cue=view.phase==='idle'?'READY TO COMPETE':view.phase==='countdown'?String(Math.ceil(view.countdown)):shuttle?(view.feedbackUntil>view.clock?view.feedback:view.turn>=2?'SPRINT THROUGH':view.locked?'CUT LOCKED':green?'CUT NOW':`GET READY · ${view.turn===0?'LEFT':'RIGHT'}`):benchCue(view);
 return <main className="combine-game skill-game" data-drill={drill} data-phase={view.phase} data-pause-reason={paused?pauseReason:undefined} onKeyDown={e=>{
  if(e.key==='Escape'&&ready&&!terminal&&!error){if(paused){stopped.current=false;setPaused(false);}else pause();}
  if(e.key==='Tab'&&blocked){const b=modal.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(b?.length){const first=b[0],last=b[b.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 }} aria-label={`Ball Knower ${title.toLowerCase()}`}>
 <div className="combine-scene" ref={host} aria-hidden="true"/>
 <div className="skill-hud" inert={blocked}>
  <header className="skill-top"><button onClick={onClose} aria-label="Leave Combine">‹</button><b>BK <span>COMBINE</span></b><HoldPauseButton onPause={()=>pause()}/></header>
  <section className="skill-score"><div><small>{shuttle?'AGILITY / CHANGE OF DIRECTION':'STRENGTH / ENDURANCE'}</small><h1>{title}</h1></div><div className="skill-stats"><span>ATTEMPT <b>{Math.min(2,attempts.length+1)} / 2</b></span><span>PERSONAL BEST <b>{best===null?'—':format(best)}</b></span></div></section>
  <div className="skill-live"><b>{shuttle?view.clock.toFixed(2):view.reps}<small>{shuttle?' SEC':' REPS'}</small></b>{!shuttle&&<strong className="skill-clock">{Math.max(0,BENCH_SECONDS-view.clock).toFixed(1)}<small> SEC LEFT</small></strong>}<span>{shuttle?`TURN COST +${view.penalty.toFixed(2)}s`:'225 LB'}</span></div>
  <section className="skill-bottom">
   <div className="skill-panel">
    <b className="skill-cue" data-green={green} data-warning={!shuttle&&(view.forcedLower||view.topHold>=.55||view.needsRelease)} role="status">{cue}</b>
    {view.phase==='idle'?<p>{shuttle?'Sprint automatically. Tap LEFT at the first line, then RIGHT at the second. Aim for the center of green: more precise cuts save time. Updated scoring starts fresh shuttle bests.':'Hold PRESS to lift. Release to lower fully and recover. Complete as many reps as you can in 30 seconds. Hold too long and your grip fails: the bar returns to your chest. Release to reset.'}</p>:shuttle?<><div className="skill-track" role="meter" aria-label="Cut timing" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><span className="skill-zone"/><i style={{left:`${progress*100}%`}}/></div><p>{view.turn>=2?'Finish strong':`CUT ${view.turn+1} / 2 · ${view.locked?'INPUT LOCKED':'TAP IN GREEN'}`} · Missed cut +0.45s</p></>:<><div className="skill-stages"><span data-on={!view.lowering&&!view.forcedLower&&!view.needsRelease&&view.pressing}>PRESS</span><span data-on={view.lowering||view.forcedLower}>LOWER</span><span data-on={!view.pressing&&view.lift===0}>RECOVER</span></div><div className="skill-lift" role="meter" aria-label="Bar extension" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.lift*100)}><i style={{width:`${view.lift*100}%`}}/></div><div className="skill-meter-label"><span>STRENGTH</span><span>{Math.round(view.energy*100)}%</span></div><div className="skill-track" role="meter" aria-label="Strength remaining" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.energy*100)}><div className="skill-fill" style={{width:`${view.energy*100}%`}}/></div><p>{view.forcedLower?'Grip lost. Let the bar return to your chest.':view.needsRelease?'Let go of PRESS before trying again.':view.lowering?'Release PRESS: lower fully before the next rep.':view.energy<.15?'Release or tap RECOVER to refill.':'Chest to full extension. Partial lifts do not count.'}</p></>}
   </div>
   <div className="skill-controls">{view.phase==='idle'?<button ref={start} className="skill-start" onClick={()=>{startSkill(run.current);setView({...run.current});}}>START {shuttle?'SHUTTLE':'SET'} →</button>:shuttle?<><button disabled={!['running','cut'].includes(view.phase)||view.turn>=2||view.locked} data-active={view.turn===0} onClick={()=>cut('left')}>← CUT LEFT</button><button disabled={!['running','cut'].includes(view.phase)||view.turn>=2||view.locked} data-active={view.turn===1} onClick={()=>cut('right')}>CUT RIGHT →</button></>:<><button aria-label="Hold to press" disabled={view.phase!=='running'} data-active={view.pressing} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);press(`p${e.pointerId}`);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onBlur={release} onKeyDown={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)press(`k${e.key}`);}}} onKeyUp={release} onClick={e=>{if(e.detail===0&&!held.current.size&&run.current.phase==='running'){run.current.pressing=!run.current.pressing;}}}>PRESS ↑<small>HOLD TO LIFT</small></button><button disabled={view.phase!=='running'} onPointerDown={release} onClick={release}>RECOVER ↓<small>RELEASE TO LOWER</small></button></>}</div>
   <div className="skill-athlete"><div><b>{player.name}</b><span>{player.position}</span></div>{players.length>1&&<><button disabled={view.phase!=='idle'} aria-label="Previous athlete" onClick={()=>reset(players[(players.indexOf(player)-1+players.length)%players.length],true)}>‹</button><button disabled={view.phase!=='idle'} aria-label="Next athlete" onClick={()=>reset(players[(players.indexOf(player)+1)%players.length],true)}>›</button></>}</div>
  </section>
 </div>
 {blocked&&<section className="combine-overlay" role="dialog" aria-modal="true" aria-label={error?'Drill unavailable':paused?'Drill paused':terminal?'Drill results':'Loading athlete'}><div className="skill-dialog" ref={modal}><small>BK / {title}</small><h2>{error?'UNAVAILABLE':!ready?'PREPARING':paused?'PAUSED':format(view.score)}</h2>{error?<p role="alert">{error}</p>:!ready?<p>Loading your Combine athlete…</p>:paused?<p>{pauseReason==='background'?'The app moved into the background. Your attempt is held.':pauseReason==='interruption'?'A long interruption stopped play. Your attempt is held.':'Your attempt is held. Resume when you’re ready.'}</p>:<><p>{shuttle?`Run ${view.clock.toFixed(2)}s + penalties ${view.penalty.toFixed(2)}s`:'Set complete. Full extensions counted.'}</p>{shuttle&&<p>{view.cuts.map((c,i)=>`Cut ${i+1}: ${c}`).join(' · ')}</p>}<div className="skill-attempts">{attempts.map((n,i)=><span key={i}>ATTEMPT {i+1}<b>{format(n)}</b></span>)}</div><p>{saved?'Results saved on this device.':'Could not save on this device. Your result is shown above.'}</p></>}
 <div className="skill-dialog-actions">{ready&&!error&&(paused?<button onClick={()=>{release();stopped.current=false;setPaused(false);}}>RESUME</button>:<button onClick={()=>reset(player,attempts.length>=2)}>{attempts.length<2?'NEXT ATTEMPT':'NEW SESSION'}</button>)}<button onClick={onClose}>BACK TO COMBINE</button></div></div></section>}
 </main>;
}
