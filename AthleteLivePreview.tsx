import React,{useEffect,useRef,useState} from 'react';
import {careerAthleteIdentity} from './athletePassport';
import type {AthleteBuild} from './athleteBuild';
import {sanitizeAthleteAppearance,type AthleteAppearance} from './athleteAppearance';

type Profile=AthleteBuild&AthleteAppearance&{name:string;number:number;combineId?:string;athletePortrait?:string};
type Scene=Awaited<ReturnType<typeof import('./combine/creator-scene').createCreatorScene>>;
const asPlayer=(profile:Profile)=>({...profile,id:'my-player-user',cosmeticIdentityId:`my-player-${careerAthleteIdentity(profile).id}`,jerseyNumber:profile.number,athleteAppearance:sanitizeAthleteAppearance(profile)});

export default function AthleteLivePreview({profile,view='body',onViewChange,onPortrait}:{profile:Profile;view?:'body'|'head';onViewChange?:(view:'body'|'head')=>void;onPortrait?:(portrait:string)=>void}){
  const host=useRef<HTMLDivElement>(null),scene=useRef<Scene|null>(null),latest=useRef(profile),latestView=useRef(view),angle=useRef(9),drag=useRef<{id:number;x:number;start:number}|null>(null);
  const capturedKey=useRef('');
  const portraitCallback=useRef(onPortrait);portraitCallback.current=onPortrait;
  const appearanceKey=JSON.stringify([profile.name,profile.number,profile.combineId,profile.position,profile.heightInches,profile.weightLbs,profile.bodyBuild,profile.shoulderWidth,profile.armSize,profile.legSize,sanitizeAthleteAppearance(profile)]);
  latestView.current=view;
  latest.current=profile;
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0),[rotation,setRotation]=useState(9);
  useEffect(()=>{
    let cancelled=false,owned:Scene|null=null;
    const container=host.current!;
    setState('loading');
    import('./combine/creator-scene').then(module=>{if(cancelled)return null;return module.createCreatorScene(container,asPlayer(latest.current));}).then(created=>{
      if(!created)return;
      if(cancelled){created.dispose();return;}
      owned=created;scene.current=created;created.update(asPlayer(latest.current));created.setView(latestView.current);created.rotate(angle.current*Math.PI/180);setState('ready');
    }).catch(()=>{if(!cancelled)setState('error');});
    return()=>{cancelled=true;owned?.dispose();if(scene.current===owned)scene.current=null;};
  },[attempt]);
  useEffect(()=>{scene.current?.update(asPlayer(profile));},[profile]);
  useEffect(()=>{scene.current?.setView(view);},[view]);
  useEffect(()=>{if(state!=='ready'||!portraitCallback.current||(capturedKey.current===appearanceKey&&profile.athletePortrait))return;const timer=setTimeout(()=>{try{const portrait=scene.current?.capturePortrait();if(portrait){capturedKey.current=appearanceKey;portraitCallback.current?.(portrait);}}catch{/* Preview and controls remain usable if image export is unavailable. */}},180);return()=>clearTimeout(timer);},[state,appearanceKey,Boolean(profile.athletePortrait)]);
  const rotate=(value:number)=>{const normalized=((value+180)%360+360)%360-180;angle.current=normalized;setRotation(normalized);scene.current?.rotate(normalized*Math.PI/180);};
  return <figure className="bk-athlete-live-preview bk-athlete-3d-preview" aria-label={`${profile.name||'Created athlete'} ${view==='head'?'close-up':'full-body'} live preview`} data-athlete-live-preview="true" data-render-state={state} data-view={view} data-arm-size={profile.armSize} data-skin-tone={profile.skinTone} data-hair-style={profile.hairStyle} data-tattoo-coverage={profile.tattooCoverage}>
    <figcaption>YOUR ATHLETE <span>3D PREVIEW</span></figcaption>
    <div className="bk-athlete-3d-stage" ref={host} onPointerDown={event=>{if(state!=='ready'||(event.pointerType==='mouse'&&event.button!==0))return;drag.current={id:event.pointerId,x:event.clientX,start:angle.current};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const active=drag.current;if(active?.id===event.pointerId)rotate(active.start+(event.clientX-active.x)*.65);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}/>
    {onViewChange&&<div className="bk-athlete-view-toggle" aria-label="Preview framing"><button type="button" aria-pressed={view==='body'} onClick={()=>onViewChange('body')}>Full body</button><button type="button" aria-pressed={view==='head'} onClick={()=>onViewChange('head')}>Close-up</button></div>}
    {state==='loading'?<div className="bk-athlete-preview-message" role="status">Preparing your athlete…</div>:null}
    {state==='error'?<div className="bk-athlete-preview-message" role="status"><strong>The 3D preview couldn’t load.</strong><p>Your customization controls still work.</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry preview</button></div>:null}
    <div className="bk-athlete-preview-footer"><strong>{Math.floor(profile.heightInches/12)}′{profile.heightInches%12}″ <span>· {profile.weightLbs} LB</span></strong><label><span>Drag to rotate · Rotate athlete</span><input aria-label="Rotate athlete" type="range" min={-180} max={180} value={rotation} disabled={state!=='ready'} onChange={event=>{rotate(Number(event.target.value));}}/></label></div>
  </figure>;
}
