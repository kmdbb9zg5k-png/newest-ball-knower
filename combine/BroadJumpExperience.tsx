import React, { useEffect, useRef, useState } from 'react';
import { newJump, pressJump, stepJump, jumpMarker, formatJump, readJumps, saveJump, JUMP_ATTEMPTS, REP_SECONDS, POWER_SECONDS, LAND_GREEN_START, LAND_GREEN_END, isLandingGreen, landingProgress, inputReady, launchSeconds, landingFeedback } from './broad-jump.js';
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
  const held=useRef(new Set<string>());
  useEffect(()=>{
    const pointerUp=(e:PointerEvent)=>held.current.delete(`p${e.pointerId}`);
    const keyUp=(e:KeyboardEvent)=>held.current.delete(`k${e.key}`);
    const clear=()=>held.current.clear();
    window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerUp);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clear);
    return()=>{window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',pointerUp);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clear);};
  },[]);
  type Control='power-left'|'power-right'|'timing';
  const press=(control:Control)=>{if(!ready||stopped.current||error||run.current.phase==='finished')return;pressJump(run.current,control);setView({...run.current});};
  const reset=(next=player,clear=false)=>{run.current=newJump(next);recorded.current=false;setView({...run.current});setPlayer(next);setSaved(true);scene.current?.setAthlete(next);if(clear)setAttempts([]);};
  useEffect(()=>{
    let gone=false,raf=0,last=performance.now(),hud=0;
    import('./scene.js').then(async({createCombineScene})=>{
      if(gone||!host.current)return;
      const loaded=await createCombineScene(host.current,run.current.athlete,()=>{pause();setError('Graphics were interrupted. Reopen this drill to continue.');},'jump');
      if(gone){loaded.dispose();return;}scene.current=loaded;loaded.draw(run.current,0);setReady(true);last=performance.now();
      const frame=(now:number)=>{
        if(gone)return;raf=requestAnimationFrame(frame);const dt=Math.max(0,(now-last)/1000);last=now;
        if(stopped.current||document.hidden)return;
        // Launch countdown uses real active time; keep the one-shot landing
        // window visible even if a rendering frame stalls.
        stepJump(run.current,run.current.phase==='flight'?Math.min(dt,1/30):dt);loaded.draw(run.current,dt);
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
  const armed=inputReady(view);
  const inputHandlers=(control:Control)=>({
    onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{if(e.button!==0)return;e.preventDefault();const id=`p${e.pointerId}`;if(held.current.has(id)||(control==='timing'&&held.current.size))return;held.current.add(id);press(control);},
    onKeyDown:(e:React.KeyboardEvent<HTMLButtonElement>)=>{if([' ','Enter'].includes(e.key)){e.preventDefault();const id=`k${e.key}`;if(e.repeat||held.current.has(id)||(control==='timing'&&held.current.size))return;held.current.add(id);press(control);}},
    onClick:(e:React.MouseEvent<HTMLButtonElement>)=>{if(e.detail===0&&!held.current.size)press(control);}
  });
  const powerPhase=phase==='idle'||phase==='power';
  const feedback=landingFeedback(view);
  const label=!armed?'READY':phase==='aim'?'JUMP':view.landing===null?'LAND':feedback;
  const green=isLandingGreen(view);
  const landingTone=view.landing!==null?(view.landing===1?'perfect':'miss'):green?'green':'waiting';
  const meter=powerPhase?view.power:phase==='aim'?jumpMarker(view):view.landingAt??landingProgress(view);
  return <main ref={root} className="combine-game broad-jump" data-phase={phase} aria-label="Ball Knower broad jump" onKeyDown={e=>{
    if(e.key==='Escape'&&ready&&!error&&!terminal){e.preventDefault();if(paused){stopped.current=false;setPaused(false);}else pause();}
    if(e.key==='Tab'&&blocked){const buttons=modal.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }}>
    <div ref={host} className="combine-scene" aria-hidden="true"/>
    <div className="combine-hud" inert={blocked}>
      <header className="combine-top"><button className="combine-back" onClick={onClose} aria-label="Leave Combine">‹</button><div className="combine-brand"><b>BALL KNOWER</b><span>COMBINE</span></div><h1>BROAD JUMP</h1><span className="combine-attempt">{Math.min(JUMP_ATTEMPTS,attempts.length+1)} / {JUMP_ATTEMPTS}</span><button className="combine-pause" onClick={pause} aria-label="Pause broad jump">Ⅱ</button></header>

      <div className="jump-best">BEST <b>{best?formatJump(best):'—'}</b></div>
      <div className="jump-athlete"><b>{player.name}</b><span>{player.position}</span>{phase==='idle'&&players.length>1&&<><button aria-label="Previous athlete" onClick={()=>reset(players[(players.indexOf(player)-1+players.length)%players.length],true)}>‹</button><button aria-label="Next athlete" onClick={()=>reset(players[(players.indexOf(player)+1)%players.length],true)}>›</button></>}</div>
      <div className="jump-controls">
        <div className="jump-meter" hidden={!powerPhase&&phase!=='aim'}><div className="jump-meter-heading"><b>{phase==='idle'?'BUILD YOUR POWER':phase==='power'?'POWER':phase==='aim'?'LAUNCH TIMING':'LANDING'}</b><span>{phase==='power'?`${Math.max(0,POWER_SECONDS-view.elapsed).toFixed(1)}s`:phase==='aim'?`${launchSeconds(view).toFixed(1)}s`:''}</span></div>
        <div className="jump-track" role="meter" aria-label={phase==='power'?'Jump power':'Jump timing'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(meter*100)}>{powerPhase?<div className="jump-fill" style={{width:`${meter*100}%`}}/>:<><div className="jump-zone" style={{left:phase==='aim'?'65%':`${LAND_GREEN_START*100}%`,width:phase==='aim'?'20%':`${(LAND_GREEN_END-LAND_GREEN_START)*100}%`}}/><i style={{left:`${meter*100}%`}}/></>}</div>
        <small>{phase==='idle'?'Tap either button to start':phase==='power'?'TAP BOTH • BUILD POWER':phase==='aim'?'TAP IN GREEN':phase==='flight'?(view.landing===null?(green?'LAND NOW':'WAIT FOR GREEN'):'LANDING LOCKED'):view.stumble?'STUMBLE · DISTANCE LOST':'PERFECT LANDING'}</small></div>
        <div className={`jump-buttons ${powerPhase?'':'jump-centered'}`}>
          {powerPhase?<>
            <button ref={button} className="jump-action jump-power" aria-label="Left power" {...inputHandlers('power-left')}>POWER<span>LEFT</span></button>
            <button className="jump-action jump-power" aria-label="Right power" {...inputHandlers('power-right')}>POWER<span>RIGHT</span></button>
          </>:<div className="jump-center-control">
            <div className="jump-cue" role="status">{phase==='aim'?'TIME YOUR JUMP':feedback|| (green?'LAND NOW':'WAIT FOR GREEN')}</div>
            {phase==='aim'&&<div className="jump-local-timer" role="timer" aria-label="Launch countdown">{launchSeconds(view).toFixed(1)}s <span>{armed?'ONE SHOT':'GET READY'}</span></div>}
            <div className="jump-ring-wrap">
              {phase!=='aim'&&<svg className="jump-ring" viewBox="0 0 120 120" aria-hidden="true">
                <circle className="jump-ring-track" cx="60" cy="60" r="54"/>
                <circle className="jump-ring-zone" cx="60" cy="60" r="54" pathLength="100" strokeDasharray={`${(LAND_GREEN_END-LAND_GREEN_START)*100} ${100-(LAND_GREEN_END-LAND_GREEN_START)*100}`} strokeDashoffset={-LAND_GREEN_START*100}/>
                <circle className="jump-ring-progress" cx="60" cy="60" r="54" pathLength="100" strokeDasharray={`${meter*100} 100`}/>
                <circle className="jump-ring-marker" cx={60+54*Math.sin(meter*Math.PI*2)} cy={60-54*Math.cos(meter*Math.PI*2)} r="5"/>
              </svg>}
              <button ref={button} className="jump-action jump-timing" data-progress={Math.round(meter*100)} data-landing={phase==='flight'||phase==='landed'?landingTone:undefined} aria-label={label} disabled={!['aim','flight'].includes(phase)||!armed||(phase==='flight'&&view.landing!==null)} {...inputHandlers('timing')}>{label}</button>
            </div>
            {phase==='aim'||phase==='flight'?<small className="jump-slow-label">SLOW MOTION</small>:<small className="jump-slow-label">{view.stumble?'STUMBLE · −0.45 m':'PERFECT LANDING'}</small>}
          </div>}
        </div>
      </div>
    </div>
    {blocked&&<section className="combine-overlay" role="dialog" aria-modal="true" aria-label={error?'Combine unavailable':terminal?'Broad jump results':paused?'Broad jump paused':'Loading athlete'}><div ref={modal} className="combine-result">
      <span className="combine-eyebrow">BK / BROAD JUMP</span>
      <h2>{error?'UNAVAILABLE':!ready?'PREPARING':paused?'PAUSED':view.distance?formatJump(view.distance):'NO JUMP'}</h2>
      {error?<p role="alert">{error}</p>:!ready?<p>Loading your Combine athlete…</p>:paused?<p>Your attempt is held here.</p>:<>
        <p>{view.distance?`${view.distance.toFixed(2)} m · ${feedback} · ${view.landing===1?'Perfect landing':`Stumbled · −${view.penalty.toFixed(2)} m`}`:`${REP_SECONDS}-second launch timer expired. Failed rep — attempt used.`}</p>
        <div className="jump-attempts">{attempts.map((distance,i)=><div key={i}><span>ATTEMPT {i+1}</span><b>{distance?formatJump(distance):'NO JUMP'}</b></div>)}</div>
        <p>SESSION BEST · {formatJump(Math.max(0,...attempts))}</p><p role="status">{!saved?'Could not save on this device.':view.distance?'Best distances saved on this device.':'No distance recorded.'}</p>
      </>}
      <div className="combine-result-actions">{!error&&ready&&(paused?<button onClick={()=>{stopped.current=false;setPaused(false);}}>RESUME</button>:<button onClick={()=>reset(player,attempts.length>=JUMP_ATTEMPTS)}>{attempts.length<JUMP_ATTEMPTS?'NEXT ATTEMPT':'NEW SESSION'}</button>)}<button onClick={onClose}>BACK TO COMBINE</button></div>
    </div></section>}
  </main>;
}
