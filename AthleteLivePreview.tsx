import React,{useEffect,useRef,useState} from 'react';
import type {AthleteBuild} from './athleteBuild';
import {sanitizeAthleteAppearance,type AthleteAppearance} from './athleteAppearance';

type Profile=AthleteBuild&AthleteAppearance&{name:string;number:number};
type Scene=Awaited<ReturnType<typeof import('./combine/creator-scene').createCreatorScene>>;
const asPlayer=(profile:Profile)=>({...profile,id:'my-player-creator',jerseyNumber:profile.number,athleteAppearance:sanitizeAthleteAppearance(profile)});

export default function AthleteLivePreview({profile}:{profile:Profile}){
  const host=useRef<HTMLDivElement>(null),scene=useRef<Scene|null>(null),latest=useRef(profile);
  latest.current=profile;
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0),[rotation,setRotation]=useState(9);
  useEffect(()=>{
    let cancelled=false,owned:Scene|null=null;
    const container=host.current!;
    setState('loading');
    import('./combine/creator-scene').then(module=>{if(cancelled)return null;return module.createCreatorScene(container,asPlayer(latest.current));}).then(created=>{
      if(!created)return;
      if(cancelled){created.dispose();return;}
      owned=created;scene.current=created;created.update(asPlayer(latest.current));setState('ready');
    }).catch(()=>{if(!cancelled)setState('error');});
    return()=>{cancelled=true;owned?.dispose();if(scene.current===owned)scene.current=null;};
  },[attempt]);
  useEffect(()=>{scene.current?.update(asPlayer(profile));},[profile]);
  return <figure className="bk-athlete-live-preview bk-athlete-3d-preview" aria-label={`${profile.name||'Created athlete'} full-body live preview`} data-athlete-live-preview="true" data-render-state={state} data-arm-size={profile.armSize} data-skin-tone={profile.skinTone} data-hair-style={profile.hairStyle} data-tattoo-coverage={profile.tattooCoverage}>
    <figcaption>YOUR ATHLETE <span>3D PREVIEW</span></figcaption>
    <div className="bk-athlete-3d-stage" ref={host}/>
    {state==='loading'?<div className="bk-athlete-preview-message" role="status">Preparing your athlete…</div>:null}
    {state==='error'?<div className="bk-athlete-preview-message" role="status"><strong>The 3D preview couldn’t load.</strong><p>Your customization controls still work.</p><button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry preview</button></div>:null}
    <div className="bk-athlete-preview-footer"><strong>{Math.floor(profile.heightInches/12)}′{profile.heightInches%12}″ <span>· {profile.weightLbs} LB</span></strong><label>Rotate athlete<input aria-label="Rotate athlete" type="range" min={-180} max={180} value={rotation} disabled={state!=='ready'} onChange={event=>{const value=Number(event.target.value);setRotation(value);scene.current?.rotate(value*Math.PI/180);}}/></label></div>
  </figure>;
}
