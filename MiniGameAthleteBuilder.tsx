import {GAME_GEAR_CHANGED} from './playerGameGear';
import {readAthletePassport} from './athletePassport';
import React,{useState,useEffect} from 'react';
import AthleteCreatorStudio from './AthleteCreatorStudio';
import EquippedCharacterPreview from './EquippedCharacterPreview';
import {useGameAthlete} from './useGameAthlete';
import {sanitizeAthleteBuild} from './athleteBuild';
import {DEFAULT_ATHLETE_APPEARANCE,sanitizeAthleteAppearance} from './athleteAppearance';
import {ATHLETE_CHANGED,ATHLETE_SAVE_KEY} from './athletePassport';
import type {Position} from './types';

const defaults={version:1,stage:'creator',name:'My Player',position:'WR' as Position,number:17,faceImage:'',presetFaceId:'malik',bodyPresetId:'balanced',athletePortrait:'',renderImage:'',appearancePrompt:'',teamAbbr:'',draftRound:0,draftPick:0,combineScore:0,overall:68,xp:0,upgradePoints:0,gamesPlayed:0,speed:78,power:72,awareness:65,heightInches:72,weightLbs:195,bodyBuild:50,shoulderWidth:54,armSize:48,legSize:52,viewRotation:0,...DEFAULT_ATHLETE_APPEARANCE};
function restore(){try{const saved=JSON.parse(localStorage.getItem(ATHLETE_SAVE_KEY)||'null');return saved?.version===1?{...defaults,...saved,combineId:saved.combineId||crypto.randomUUID(),name:typeof saved.name==='string'&&saved.name.trim()?saved.name.slice(0,40):defaults.name,...sanitizeAthleteBuild(saved),...sanitizeAthleteAppearance(saved)}:{...defaults,combineId:crypto.randomUUID()};}catch{return {...defaults,combineId:crypto.randomUUID()};}}

type Props = { onContinue?: () => void; actionLabel?: string };

export default function MiniGameAthleteBuilder(props: Props) {
  const { character, loading, saved } = useGameAthlete(true);
  const [editingCreatedAthlete, setEditingCreatedAthlete] = useState(false);
  if (loading) return <p className="bk-mini-equipped" role="status">Loading your equipped character…</p>;
  if (saved?.character && !character) return <section className="bk-mini-equipped" aria-label="Equipped character">
    <p role="alert">Could not load your equipped character. Check your selection in the Locker.</p>
    <a className="bk-mini-primary" href="/?profile=1">Open Locker</a>
  </section>;
  if (character && !editingCreatedAthlete) return <section className="bk-mini-equipped" aria-label="Equipped character">
    <EquippedCharacterPreview key={character.id} character={character}/>
    <div className="bk-mini-equipped-actions">
      {props.onContinue
        ? <button className="bk-mini-primary" type="button" onClick={props.onContinue}>Start drill</button>
        : <a className="bk-mini-primary" href="/?profile=1">Open Locker</a>}
      <button className="bk-mini-equipped-edit" type="button" onClick={() => setEditingCreatedAthlete(true)}>Edit created athlete</button>
    </div>
  </section>;
  return <CreatedAthleteEditor {...props}/>;
}

function CreatedAthleteEditor({onContinue,actionLabel}: Props) {
  const [profile,setProfile]=useState(restore),[saved,setSaved]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const syncGear=()=>{const athlete=readAthletePassport();setProfile(current=>athlete&&athlete.id===(current.combineId||`legacy:${current.name}:${current.position}`)?{...current,gameGear:athlete.gameGear}:current);};window.addEventListener(GAME_GEAR_CHANGED,syncGear);return()=>window.removeEventListener(GAME_GEAR_CHANGED,syncGear);},[]);
  const save=()=>{try{const next={...profile,name:profile.name.trim().slice(0,40)||defaults.name};localStorage.setItem(ATHLETE_SAVE_KEY,JSON.stringify(next));window.dispatchEvent(new Event(ATHLETE_CHANGED));setProfile(next);setSaved(true);setError('');onContinue?.();}catch{setSaved(false);setError('Your athlete could not be saved on this device. Free some browser storage and try again.');}};
  return <AthleteCreatorStudio profile={profile} onPortrait={athletePortrait=>setProfile(current=>current.athletePortrait===athletePortrait?current:{...current,athletePortrait})} onChange={patch=>{setSaved(false);setError('');setProfile(current=>({...current,...patch,renderImage:patch.name!==undefined||patch.number!==undefined?current.renderImage:''}));}} onSave={save} actionLabel={actionLabel||(saved?'Athlete saved':onContinue?'Save & Play':'Save athlete')} positionLocked={profile.stage!=='creator'} badge={saved?'SAVED':'BK'} error={error}/>;
}
