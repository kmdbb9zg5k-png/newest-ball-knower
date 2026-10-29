import React,{useState} from 'react';
import AthleteCreatorStudio from './AthleteCreatorStudio';
import {sanitizeAthleteBuild} from './athleteBuild';
import {DEFAULT_ATHLETE_APPEARANCE,sanitizeAthleteAppearance} from './athleteAppearance';
import {ATHLETE_CHANGED,ATHLETE_SAVE_KEY} from './athletePassport';
import type {Position} from './types';

const defaults={version:1,stage:'creator',name:'My Player',position:'WR' as Position,number:17,faceImage:'',presetFaceId:'malik',bodyPresetId:'balanced',athletePortrait:'',renderImage:'',appearancePrompt:'',teamAbbr:'',draftRound:0,draftPick:0,combineScore:0,overall:68,xp:0,upgradePoints:0,gamesPlayed:0,speed:78,power:72,awareness:65,heightInches:72,weightLbs:195,bodyBuild:50,shoulderWidth:54,armSize:48,legSize:52,viewRotation:0,...DEFAULT_ATHLETE_APPEARANCE};
function restore(){try{const saved=JSON.parse(localStorage.getItem(ATHLETE_SAVE_KEY)||'null');return saved?.version===1?{...defaults,...saved,combineId:saved.combineId||crypto.randomUUID(),name:typeof saved.name==='string'&&saved.name.trim()?saved.name.slice(0,40):defaults.name,...sanitizeAthleteBuild(saved),...sanitizeAthleteAppearance(saved)}:{...defaults,combineId:crypto.randomUUID()};}catch{return {...defaults,combineId:crypto.randomUUID()};}}

export default function MiniGameAthleteBuilder({onContinue,actionLabel}:{onContinue?:()=>void;actionLabel?:string}={}){
  const [profile,setProfile]=useState(restore),[saved,setSaved]=useState(false),[error,setError]=useState('');
  const save=()=>{try{const next={...profile,name:profile.name.trim().slice(0,40)||defaults.name};localStorage.setItem(ATHLETE_SAVE_KEY,JSON.stringify(next));window.dispatchEvent(new Event(ATHLETE_CHANGED));setProfile(next);setSaved(true);setError('');onContinue?.();}catch{setSaved(false);setError('Your athlete could not be saved on this device. Free some browser storage and try again.');}};
  return <AthleteCreatorStudio profile={profile} onPortrait={athletePortrait=>setProfile(current=>current.athletePortrait===athletePortrait?current:{...current,athletePortrait})} onChange={patch=>{setSaved(false);setError('');setProfile(current=>({...current,...patch,renderImage:patch.name!==undefined||patch.number!==undefined?current.renderImage:''}));}} onSave={save} actionLabel={actionLabel||(saved?'Athlete saved':onContinue?'Save & Play':'Save athlete')} positionLocked={profile.stage!=='creator'} badge={saved?'SAVED':'BK'} error={error}/>;
}
