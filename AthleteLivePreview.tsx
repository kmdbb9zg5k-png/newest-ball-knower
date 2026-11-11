import {usePlayerOutfit} from './usePlayerOutfit';
import {type Outfit} from './playerWardrobe';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Footprints,PersonStanding,RotateCcw,ScanFace,Shirt} from 'lucide-react';
import {careerAthleteIdentity} from './athletePassport';
import type {AthleteBuild} from './athleteBuild';
import {sanitizeAthleteAppearance,type AthleteAppearance} from './athleteAppearance';
import type {CreatorView} from './combine/creator-scene';

type Profile=AthleteBuild&AthleteAppearance&{name:string;number:number;combineId?:string;athletePortrait?:string;wardrobe?:Outfit;showroomSample?:boolean};
type Scene=Awaited<ReturnType<typeof import('./combine/creator-scene').createCreatorScene>>;
type ShowroomAthleteToggle={label:string;onClick:()=>void};
const asPlayer=(profile:Profile)=>({...profile,id:'my-player-user',cosmeticIdentityId:`my-player-${careerAthleteIdentity(profile).id}`,jerseyNumber:profile.number,athleteAppearance:sanitizeAthleteAppearance(profile),wardrobe:profile.wardrobe});
const SHOWROOM_ANGLE=18;
const showroomViews=[
  {id:'body',label:'Full outfit',Icon:PersonStanding},
  {id:'head',label:'Face',Icon:ScanFace},
  {id:'hoodie',label:'Top',Icon:Shirt},
  {id:'sweats',label:'Pants',Icon:SweatsIcon},
  {id:'trainers',label:'Trainers',Icon:Footprints},
] as const;

function SweatsIcon({size=20}:{size?:number}){
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l2 18h-5l-3-12-3 12H4L6 3Z"/><path d="M6 6h12"/></svg>;
}

export default function AthleteLivePreview({profile:inputProfile,view='body',onViewChange,onPortrait,previewOutfit,showroom=false,showroomAthleteToggle,fallbackImage,hideFaceDetail=false,profileShowcase=false}:{profile:Profile;previewOutfit?:Outfit;view?:'body'|'head';onViewChange?:(view:'body'|'head')=>void;onPortrait?:(portrait:string)=>void;showroom?:boolean;showroomAthleteToggle?:ShowroomAthleteToggle;fallbackImage?:string;hideFaceDetail?:boolean;profileShowcase?:boolean}){
  const equipped=usePlayerOutfit();
  const profile=useMemo(()=>({...inputProfile,wardrobe:previewOutfit||equipped}),[inputProfile,previewOutfit,equipped]);
  const [showroomView,setShowroomView]=useState<(typeof showroomViews)[number]>(showroomViews[0]);
  const activeView=showroom?showroomView.id:view;
  const host=useRef<HTMLDivElement>(null),scene=useRef<Scene|null>(null),latest=useRef(profile),latestView=useRef<CreatorView>(activeView),angle=useRef(showroom?SHOWROOM_ANGLE:9),drag=useRef<{id:number;x:number;start:number}|null>(null);
  const capturedKey=useRef('');
  const portraitCallback=useRef(onPortrait);portraitCallback.current=onPortrait;
  const appearanceKey=JSON.stringify([profile.name,profile.number,profile.combineId,profile.position,profile.heightInches,profile.weightLbs,profile.bodyBuild,profile.shoulderWidth,profile.armSize,profile.legSize,sanitizeAthleteAppearance(profile),profile.wardrobe]);
  latestView.current=activeView;
  latest.current=profile;
  const useShowroomSample=showroom&&Boolean(profile.showroomSample);
  const goldShowroomSample=useShowroomSample&&profile.wardrobe?.top==='top-gold-standard';
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0),[rotation,setRotation]=useState(9);
  useEffect(()=>{
    let cancelled=false,owned:Scene|null=null;
    const container=host.current!;
    const onContextLost=(event:Event)=>{
      event.preventDefault();
      if(!cancelled)setState('error');
    };
    container.addEventListener('webglcontextlost',onContextLost,true);
    setState('loading');
    import('./combine/creator-scene').then(module=>{if(cancelled)return null;return module.createCreatorScene(container,asPlayer({...latest.current,showroomSample:useShowroomSample}),showroom,profileShowcase);}).then(created=>{
      if(!created)return;
      if(cancelled){created.dispose();return;}
      owned=created;scene.current=created;created.update(asPlayer(latest.current));created.setView(latestView.current);created.rotate(angle.current*Math.PI/180);setState('ready');
    }).catch(()=>{if(!cancelled)setState('error');});
    return()=>{cancelled=true;container.removeEventListener('webglcontextlost',onContextLost,true);owned?.dispose();if(scene.current===owned)scene.current=null;};
  },[attempt,showroom,useShowroomSample,goldShowroomSample,profileShowcase]);
  useEffect(()=>{try{scene.current?.update(asPlayer(profile));}catch{setState('error');}},[profile]);
  useEffect(()=>{try{scene.current?.setView(activeView);}catch{setState('error');}},[activeView]);
  useEffect(()=>{if(state!=='ready'||!portraitCallback.current||(capturedKey.current===appearanceKey&&profile.athletePortrait))return;const timer=setTimeout(()=>{try{const portrait=scene.current?.capturePortrait();if(portrait){capturedKey.current=appearanceKey;portraitCallback.current?.(portrait);}}catch{/* Preview and controls remain usable if image export is unavailable. */}},180);return()=>clearTimeout(timer);},[state,appearanceKey,Boolean(profile.athletePortrait)]);
  const rotate=(value:number)=>{const normalized=((value+180)%360+360)%360-180;angle.current=normalized;if(!showroom)setRotation(normalized);try{scene.current?.rotate(normalized*Math.PI/180);}catch{setState('error');}};
  const dimensions=<>{Math.floor(profile.heightInches/12)}′{profile.heightInches%12}″ <span>· {profile.weightLbs} lb</span></>;
  function resetShowroom(){
    setShowroomView(showroomViews[0]);
    rotate(SHOWROOM_ANGLE);
  }
  return <figure className={`bk-athlete-live-preview bk-athlete-3d-preview${showroom?' bk-athlete-showroom':''}${profileShowcase?' bk-athlete-profile-showcase':''}`} aria-label={`${profile.name||'Created athlete'} ${showroom?showroomView.label.toLowerCase():view==='head'?'close-up':'full-body'} live preview`} data-athlete-live-preview="true" data-render-state={state} data-view={activeView} data-arm-size={profile.armSize} data-skin-tone={profile.skinTone} data-hair-style={profile.hairStyle} data-tattoo-coverage={profile.tattooCoverage}>
    {showroom ? <figcaption className="bk-showroom-identity">
      <strong>{profile.name || 'Sample athlete'}</strong><span>{dimensions}</span>
      {showroomAthleteToggle&&<button className="bk-showroom-athlete-toggle" type="button" onClick={showroomAthleteToggle.onClick}>{showroomAthleteToggle.label}</button>}
    </figcaption> : <figcaption>YOUR ATHLETE <span>3D PREVIEW</span></figcaption>}
    <div className="bk-athlete-3d-stage" ref={host} onPointerDown={event=>{if(state!=='ready'||(event.pointerType==='mouse'&&event.button!==0))return;drag.current={id:event.pointerId,x:event.clientX,start:angle.current};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{const active=drag.current;if(active?.id===event.pointerId)rotate(active.start+(event.clientX-active.x)*.65);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}/>
    {onViewChange&&!profileShowcase&&<div className="bk-athlete-view-toggle" aria-label="Preview framing"><button type="button" aria-pressed={view==='body'} onClick={()=>onViewChange('body')}>Full body</button><button type="button" aria-pressed={view==='head'} onClick={()=>onViewChange('head')}>Close-up</button></div>}
    {showroom&&<>
      <button className="bk-showroom-reset" type="button" aria-label="Reset view" disabled={state!=='ready'} onClick={resetShowroom}><RotateCcw size={20} aria-hidden="true"/></button>
      <div className="bk-showroom-orbit" role="group" aria-label="Rotate athlete">
        <button type="button" aria-label="Rotate left" disabled={state!=='ready'} onClick={()=>rotate(angle.current-30)}><ChevronLeft size={20} aria-hidden="true"/></button>
        <span>Drag to rotate · 360°</span>
        <button type="button" aria-label="Rotate right" disabled={state!=='ready'} onClick={()=>rotate(angle.current+30)}><ChevronRight size={20} aria-hidden="true"/></button>
      </div>
      <div className="bk-showroom-views" role="group" aria-label="Outfit detail views">
        {showroomViews.filter(option=>!(hideFaceDetail && option.id==='head')).map(option=><button key={option.id} type="button" aria-pressed={activeView===option.id} onClick={()=>setShowroomView(option)}><option.Icon size={21} aria-hidden="true"/><span>{option.label}</span></button>)}
      </div>
    </>}
    {state==='loading'?<div className="bk-athlete-preview-message" role="status">Preparing your athlete…</div>:null}
    {state==='error'?<div className="bk-athlete-preview-message" role="status">
      {fallbackImage && <img className="bk-showroom-error-fallback" src={fallbackImage} alt={profileShowcase ? "Athlete portrait while 3D graphics are unavailable" : "Full-body outfit photo while 3D graphics are unavailable"}/>}
      <strong>The 3D viewer could not start on this device.</strong>
      <p>Try again, or open Ball Knower in Safari instead of an in-app browser.</p>
      <button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry 3D preview</button>
    </div>:null}
    {profileShowcase&&onViewChange&&<button className="bk-profile-athlete-frame" type="button" disabled={state!=='ready'} onClick={()=>onViewChange(view==='body'?'head':'body')}>{view==='body'?'Close-up':'Full body'}</button>}
    {profileShowcase&&<div className="bk-profile-athlete-controls">
      <button type="button" aria-label="Rotate athlete left" disabled={state!=='ready'} onClick={()=>rotate(angle.current-30)}><ChevronLeft aria-hidden="true"/></button>
      <button className="bk-profile-walkout" type="button" disabled={state!=='ready'} onClick={()=>{if(view!=='body'){onViewChange?.('body');scene.current?.setView('body');}rotate(0);scene.current?.walkout();}}><Footprints aria-hidden="true"/> Walkout</button>
      <button type="button" aria-label="Rotate athlete right" disabled={state!=='ready'} onClick={()=>rotate(angle.current+30)}><ChevronRight aria-hidden="true"/></button>
    </div>}
    {!showroom&&!profileShowcase&&<div className="bk-athlete-preview-footer"><strong>{dimensions}</strong><label><span>Drag to rotate · Rotate athlete</span><input aria-label="Rotate athlete" type="range" min={-180} max={180} value={rotation} disabled={state!=='ready'} onChange={event=>{rotate(Number(event.target.value));}}/></label></div>}
  </figure>;
}
