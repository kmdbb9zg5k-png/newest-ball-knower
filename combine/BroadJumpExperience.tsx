import React, { useEffect, useRef, useState } from 'react';
import { newJump, pressJump, stepJump, jumpMarker, formatJump, readJumps, saveJump } from './broad-jump.js';
import './combine.css';
type Athlete = {id:string;name:string;position:string;speed:number;acceleration:number;seed:number};
export default function BroadJumpExperience({players,context,onClose}:{players:Athlete[];context:string;onClose:()=>void}) {
  const [player,setPlayer]=useState(players[0]),[view,setView]=useState(()=>newJump(players[0]));
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[paused,setPaused]=useState(false);
  const [attempts,setAttempts]=useState<number[]>([]),[rows,setRows]=useState(readJumps),[saved,setSaved]=useState(true);
  const host=useRef<HTMLDivElement>(null),root=useRef<HTMLElement>(null),button=useRef<HTMLButtonElement>(null),modal=useRef<HTMLDivElement>(null);
  const run=useRef(newJump(players[0])),scene=useRef<any>(null),stopped=useRef(false),recorded=useRef(false);
  const phase=view.phase,terminal=phase==='finished',blocked=paused||terminal||!ready||!!error;
  const best=Math.max(0,...rows.filter(r=>r.context===context&&r.playerId===player.id).map(r=>r.distance));
  const pause=()=>{stopped.current=true;setPaused(true);};
  const press=()=>{if(!ready||stopped.current||error||run.current.phase==='finished')return;pressJump(run.current);setView({...run.current});};
  const reset=(next=player,clear=false)=>{run.current=newJump(next);recorded.current=false;setView({...run.current});setPlayer(next);setSaved(true);scene.current?.setAthlete(next);if(clear)setAttempts([]);};
  useEffect(()=>{
    let gone=false,raf=0,last=performance.now(),hud=0;
    import('./scene.js').then(async({createCombineScene})=>{
      if(gone||!host.current)return;
      const loaded=await createCombineScene(host.current,run.current.athlete,()=>{pause();setError('Graphics were interrupted. Reopen this drill to continue.');},'jump');
      if(gone){loaded.dispose();return;}scene.current=loaded;loaded.draw(run.current,0);setReady(true);last=performance.now();
      const frame=(now:number)=>{
        if(gone)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;
        if(stopped.current||document.hidden)return;
        stepJump(run.current,dt);loaded.draw(run.current,dt);
        if(run.current.phase==='finished'&&!recorded.current){recorded.current=true;setAttempts(a=>[...a,run.current.distance]);if(run.current.distance>0){setSaved(saveJump(run.current,context));setRows(readJumps());}}
        if(now-hud>32){setView({...run.current});hud=now;}
      };raf=requestAnimationFrame(frame);
    }).catch(()=>{if(!gone)setError('Could not load the Combine athlete. Reopen this drill to try again.');});
    const hide=()=>{if(document.hidden&& !['idle','finished'].includes(run.current.phase))pause();};
    const blur=()=>{if(!['idle','finished'].includes(run.current.phase))pause();};
    document.addEventListener('visibilitychange',hide);window.addEventListener('blur',blur);
    return()=>{gone=true;cancelAnimationFrame(raf);scene.current?.dispose();scene.current=null;document.removeEventListener('visibilitychange',hide);window.removeEventListener('blur',blur);};
  },[]);
  useEffect(()=>{if(blocked)modal.current?.querySelector('button')?.focus();else button.current?.focus();},[blocked]);
  const label=phase==='idle'?'START':phase==='power'?'POWER':phase==='aim'?'JUMP':phase==='flight'?(view.landing===null?'STICK':'LOCKED'):'LANDED';
  const meter=phase==='power'?view.power:phase==='aim'?jumpMarker(view):Math.min(1,view.elapsed/view.flight);
  return <main ref={root} className="combine-game broad-jump" data-phase={phase} aria-label="Ball Knower broad jump" onKeyDown={e=>{
    if(e.key==='Escape'&&ready&&!error&&!terminal){e.preventDefault();if(paused){stopped.current=false;setPaused(false);}else pause();}
    if(e.key==='Tab'&&blocked){const buttons=modal.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }}>
    <div ref={host} className="combine-scene" aria-hidden="true"/>
    <div className="combine-hud" inert={blocked}>
      <header className="combine-top"><button className="combine-back" onClick={onClose} aria-label="Leave Combine">‹</button><div className="combine-brand"><b>BALL KNOWER</b><span>COMBINE</span></div><h1>BROAD JUMP</h1><span className="combine-attempt">{Math.min(3,attempts.length+1)} / 3</span><button className="combine-pause" onClick={pause} aria-label="Pause broad jump">Ⅱ</button></header>
      <div className="jump-best">BEST <b>{best?formatJump(best):'—'}</b></div>
      <div className="jump-athlete"><b>{player.name}</b><span>{player.position}</span>{phase==='idle'&&players.length>1&&<><button aria-label="Previous athlete" onClick={()=>reset(players[(players.indexOf(player)-1+players.length)%players.length],true)}>‹</button><button aria-label="Next athlete" onClick={()=>reset(players[(players.indexOf(player)+1)%players.length],true)}>›</button></>}</div>
      <div className="jump-controls">
        <div className="jump-meter"><div className="jump-meter-heading"><b>{phase==='idle'?'BUILD YOUR POWER':phase==='power'?'POWER':phase==='aim'?'LAUNCH TIMING':'LANDING'}</b><span>{phase==='power'?`${Math.max(0,3-view.elapsed).toFixed(1)}s`:phase==='aim'?`${Math.max(0,3-view.elapsed).toFixed(1)}s`:''}</span></div>
        <div className="jump-track" role="meter" aria-label={phase==='power'?'Jump power':'Jump timing'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(meter*100)}>{phase==='power'?<div className="jump-fill" style={{width:`${meter*100}%`}}/>:<><div className="jump-zone" style={{left:phase==='aim'?'65%':'78%',width:'20%'}}/><i style={{left:`${meter*100}%`}}/></>}</div>
        <small>{phase==='idle'?'Tap fast • Time your jump • Stick the landing':phase==='power'?'TAP FAST':phase==='aim'?'TAP IN GREEN':phase==='flight'?(view.landing===null?'STICK IN GREEN':'LANDING LOCKED'):'MEASURING…'}</small></div>
        <button ref={button} className="jump-action" aria-label={label} disabled={phase==='landed'||(phase==='flight'&&view.landing!==null)}
          onPointerDown={e=>{if(e.button!==0||!e.isPrimary)return;e.preventDefault();press();}}
          onKeyDown={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)press();}}}
          onClick={e=>{if(e.detail===0)press();}}>{label}</button>
      </div>
    </div>
    {blocked&&<section className="combine-overlay" role="dialog" aria-modal="true" aria-label={error?'Combine unavailable':terminal?'Broad jump results':paused?'Broad jump paused':'Loading athlete'}><div ref={modal} className="combine-result">
      <span className="combine-eyebrow">BK / BROAD JUMP</span>
      <h2>{error?'UNAVAILABLE':!ready?'PREPARING':paused?'PAUSED':view.distance?formatJump(view.distance):'NO JUMP'}</h2>
      {error?<p role="alert">{error}</p>:!ready?<p>Loading your Combine athlete…</p>:paused?<p>Your attempt is held here.</p>:<>
        <p>{view.distance?`${view.distance.toFixed(2)} m · ${view.landing!>=.8?'Stuck the landing':view.landing!>0?'Landing cost distance':'Missed the landing'}`:'Launch window missed. Attempt used.'}</p>
        <div className="jump-attempts">{attempts.map((distance,i)=><div key={i}><span>ATTEMPT {i+1}</span><b>{distance?formatJump(distance):'NO JUMP'}</b></div>)}</div>
        <p>SESSION BEST · {formatJump(Math.max(0,...attempts))}</p><p role="status">{!saved?'Could not save on this device.':view.distance?'Best distances saved on this device.':'No distance recorded.'}</p>
      </>}
      <div className="combine-result-actions">{!error&&ready&&(paused?<button onClick={()=>{stopped.current=false;setPaused(false);}}>RESUME</button>:<button onClick={()=>reset(player,attempts.length>=3)}>{attempts.length<3?'NEXT ATTEMPT':'NEW SESSION'}</button>)}<button onClick={onClose}>BACK TO COMBINE</button></div>
    </div></section>}
  </main>;
}
