import React,{useId,useRef,useState} from 'react';
import AthleteBuildEditor from './AthleteBuildEditor';
import AthleteAppearanceEditor from './AthleteAppearanceEditor';
import AthleteLivePreview from './AthleteLivePreview';
import {ATHLETE_POSITIONS,recommendedAthleteBuild,sanitizeAthleteBuild,type AthleteBuild} from './athleteBuild';
import {DEFAULT_ATHLETE_APPEARANCE,sanitizeAthleteAppearance,type AthleteAppearance} from './athleteAppearance';
import {ATHLETE_CHANGED,ATHLETE_SAVE_KEY} from './athletePassport';
import type {Position} from './types';

const defaults={version:1,stage:'creator',name:'My Player',position:'WR' as Position,number:17,faceImage:'',presetFaceId:'malik',bodyPresetId:'balanced',renderImage:'',appearancePrompt:'',teamAbbr:'',draftRound:0,draftPick:0,combineScore:0,overall:68,xp:0,upgradePoints:0,gamesPlayed:0,speed:78,power:72,awareness:65,heightInches:72,weightLbs:195,bodyBuild:50,shoulderWidth:54,armSize:48,legSize:52,viewRotation:0,...DEFAULT_ATHLETE_APPEARANCE};
function restore(){try{const saved=JSON.parse(localStorage.getItem(ATHLETE_SAVE_KEY)||'null');return saved?.version===1?{...defaults,...saved,name:typeof saved.name==='string'&&saved.name.trim()?saved.name.slice(0,40):defaults.name,...sanitizeAthleteBuild(saved),...sanitizeAthleteAppearance(saved)}:defaults;}catch{return defaults;}}

export default function MiniGameAthleteBuilder({onContinue,actionLabel}:{onContinue?:()=>void;actionLabel?:string}={}){
  const tabs=['Build','Hair','Face','Tattoos','Player'] as const;
  const [tab,setTab]=useState<typeof tabs[number]>('Build'),[view,setView]=useState<'body'|'head'>('body');
  const panel=useRef<HTMLDivElement>(null),id=useId();
  const selectTab=(next:typeof tabs[number])=>{setTab(next);setView(next==='Hair'||next==='Face'?'head':'body');panel.current?.scrollTo(0,0);};
  const [profile,setProfile]=useState(restore),[saved,setSaved]=useState(false),[error,setError]=useState('');
  const setBuild=(build:AthleteBuild)=>{setSaved(false);setError('');setProfile(current=>({...current,...build,renderImage:''}));};
  const setAppearance=(appearance:AthleteAppearance)=>{setSaved(false);setError('');setProfile(current=>({...current,...appearance,renderImage:''}));};
  const save=()=>{try{const next={...profile,name:profile.name.trim().slice(0,40)||defaults.name};localStorage.setItem(ATHLETE_SAVE_KEY,JSON.stringify(next));window.dispatchEvent(new Event(ATHLETE_CHANGED));setProfile(next);setSaved(true);setError('');onContinue?.();}catch{setSaved(false);setError('Your athlete could not be saved on this device. Free some browser storage and try again.');}};
  const careerLocked=profile.stage!=='creator';
  return <section className="bk-mini-challenge-feed bk-athlete-studio" aria-label="Mini game athlete builder">
    <header className="bk-studio-heading"><h3>Create player</h3><span>{saved?'SAVED':'BK'}</span></header>
    <div className="bk-studio-preview"><AthleteLivePreview profile={profile} view={view} onViewChange={setView}/></div>
    <div className="bk-studio-tabs" role="tablist" aria-label="Player customization">{tabs.map((item,index)=><button key={item} type="button" role="tab" id={`${id}-${item}`} aria-controls={`${id}-panel`} aria-selected={tab===item} tabIndex={tab===item?0:-1} onClick={()=>selectTab(item)} onKeyDown={event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();selectTab(tabs[next]);document.getElementById(`${id}-${tabs[next]}`)?.focus();}}>{item}</button>)}</div>
    <div className="bk-studio-panel bk-athlete-builder-controls" ref={panel} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0}>
      {tab==='Build'&&<AthleteBuildEditor compact value={sanitizeAthleteBuild(profile)} onChange={setBuild}/>}
      {(tab==='Hair'||tab==='Face'||tab==='Tattoos')&&<AthleteAppearanceEditor value={sanitizeAthleteAppearance(profile)} onChange={setAppearance} section={tab.toLowerCase() as 'hair'|'face'|'tattoos'}/>}
      {tab==='Player'&&<><h4 className="bk-studio-panel-title">PLAYER DETAILS</h4><div className="grid grid-cols-2 gap-3"><label>Player name<input aria-label="Mini game player name" value={profile.name} maxLength={40} onChange={event=>{setSaved(false);setError('');setProfile(current=>({...current,name:event.target.value}));}}/></label><label>Jersey number<input aria-label="Mini game jersey number" type="number" min="0" max="99" value={profile.number} onChange={event=>{setSaved(false);setError('');setProfile(current=>({...current,number:Math.max(0,Math.min(99,Number(event.target.value)||0))}));}}/></label></div><div className="bk-studio-position"><span>Position {careerLocked?'· career locked':''}</span><div>{ATHLETE_POSITIONS.map(position=><button type="button" key={position} disabled={careerLocked} aria-pressed={profile.position===position} onClick={()=>setBuild(recommendedAthleteBuild(position))}>{position}</button>)}</div></div><p className="bk-studio-note">Your athlete carries into every practice drill. Position changes reset your build to its recommended frame.</p></>}
    </div>
    <footer className="bk-studio-save">{error&&<p className="bk-mini-error" role="alert">{error}</p>}<button type="button" className="bk-mini-primary" onClick={save}>{actionLabel||(saved?'Athlete saved':'Save & Play')}</button></footer>
  </section>;
}
