import React,{useId,useRef,useState} from 'react';
import JerseyNumberInput from './JerseyNumberInput';
import AthleteBuildEditor from './AthleteBuildEditor';
import AthleteAppearanceEditor from './AthleteAppearanceEditor';
import AthleteLivePreview from './AthleteLivePreview';
import {ATHLETE_POSITIONS,sanitizeAthleteBuild,type AthleteBuild} from './athleteBuild';
import {sanitizeAthleteAppearance,type AthleteAppearance} from './athleteAppearance';
import './communityMiniGames.css';

export type CreatorAthlete=AthleteBuild&AthleteAppearance&{name:string;number:number};
type Props={profile:CreatorAthlete;onChange:(patch:Partial<CreatorAthlete>)=>void;onSave:()=>void;actionLabel:string;positionLocked?:boolean;ariaLabel?:string;nameLabel?:string;jerseyLabel?:string;badge?:string;error?:string;message?:string;note?:string;faceExtras?:React.ReactNode};

export default function AthleteCreatorStudio({profile,onChange,onSave,actionLabel,positionLocked=false,ariaLabel='Mini game athlete builder',nameLabel='Mini game player name',jerseyLabel='Mini game jersey number',badge='BK',error='',message='',note='Your athlete carries into every practice drill. Changing position keeps your custom build and appearance.',faceExtras}:Props){
  const tabs=['Player','Build','Hair','Face','Tattoos'] as const;
  const [tab,setTab]=useState<typeof tabs[number]>('Player'),[view,setView]=useState<'body'|'head'>('body');
  const panel=useRef<HTMLDivElement>(null),id=useId();
  const selectTab=(next:typeof tabs[number])=>{setTab(next);setView(next==='Hair'||next==='Face'?'head':'body');panel.current?.scrollTo(0,0);};
  return <section className="bk-mini-challenge-feed bk-athlete-studio" aria-label={ariaLabel}>
    <header className="bk-studio-heading"><h3>Create player</h3><span>{badge}</span></header>
    <div className="bk-studio-preview"><AthleteLivePreview profile={profile} view={view} onViewChange={setView}/></div>
    <div className="bk-studio-tabs" role="tablist" aria-label="Player customization">{tabs.map((item,index)=><button key={item} type="button" role="tab" id={`${id}-${item}`} aria-controls={`${id}-panel`} aria-selected={tab===item} tabIndex={tab===item?0:-1} onClick={()=>selectTab(item)} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();selectTab(tabs[next]);document.getElementById(`${id}-${tabs[next]}`)?.focus();}}>{item}</button>)}</div>
    <div className="bk-studio-panel bk-athlete-builder-controls" ref={panel} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>
      {tab==='Build'&&<AthleteBuildEditor compact value={sanitizeAthleteBuild(profile)} onChange={build=>onChange(build)}/>}
      {(tab==='Hair'||tab==='Face'||tab==='Tattoos')&&<AthleteAppearanceEditor value={sanitizeAthleteAppearance(profile)} onChange={appearance=>onChange(appearance)} section={tab.toLowerCase() as 'hair'|'face'|'tattoos'}/>}
      {tab==='Face'&&faceExtras}
      {tab==='Player'&&<><h4 className="bk-studio-panel-title">PLAYER DETAILS</h4><div className="grid grid-cols-2 gap-3"><label>Player name<input aria-label={nameLabel} value={profile.name} maxLength={40} onChange={event=>onChange({name:event.target.value})}/></label><label>Jersey number<JerseyNumberInput ariaLabel={jerseyLabel} value={profile.number} onChange={number=>onChange({number})}/></label></div><div className="bk-studio-position"><span>Position {positionLocked?'· career locked':''}</span><div>{ATHLETE_POSITIONS.map(position=><button type="button" key={position} disabled={positionLocked} aria-pressed={profile.position===position} onClick={()=>onChange({position})}>{position}</button>)}</div></div><p className="bk-studio-note">{note}</p></>}
    </div>
    <footer className="bk-studio-save">{message&&<p className="bk-studio-note" role="status">{message}</p>}{error&&<p className="bk-mini-error" role="alert">{error}</p>}<button type="button" className="bk-mini-primary" onClick={onSave}>{actionLabel}</button></footer>
  </section>;
}
