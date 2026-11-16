import {dressMyAthlete} from '../athleteWardrobe';
import {refreshLocker} from '../lockerCommerceClient';
import LockerAccountSync from '../LockerAccountSync';
import {readAthletePassport,withAthleteIdentity} from '../athletePassport';
import {inMiniChallenge,exitMiniChallenge} from '../public/mini-challenge-bridge.js';
import {gameCharacterAppearance} from '../gameAthleteAppearance';
import GameAthleteSetup from '../GameAthleteSetup';
import { readGameAthlete } from '../public/play-moment-3d/game-athlete.js';
import { athleteMovement } from '../athleteBuild';
import MiniGameAthleteBuilder from '../MiniGameAthleteBuilder';
import RBExperience from './RBExperience';
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import DBExperience from './DBExperience';
import RouteExperience from './RouteExperience';
import CombineExperience from './CombineExperience';
import BroadJumpExperience from './BroadJumpExperience';
import AgilityStrengthExperience from './AgilityStrengthExperience';
import {SOLO_PLAYERS_DATABASE} from '../soloUniverse';
import {combineAthlete} from './dash.js';
import {practiceAsset, STORE_PRODUCTS, type StoreProduct} from '../storeCatalog';
import '../index.css';
import '../communityMiniGames.css';
import '../solo/soloPresentation.css';
import './combine-entry.css';

const positions=['WR','RB','CB','QB','TE','LB'];
const allPlayers=positions.flatMap(pos=>SOLO_PLAYERS_DATABASE.filter(p=>p.position===pos).slice(0,3)).map(combineAthlete);
const params = new URLSearchParams(location.search);
const drill = params.get('drill');
const competitive=inMiniChallenge();
const practiceCharacter = !competitive && drill === 'dash'
  ? STORE_PRODUCTS.find(product => product.id === params.get('character') && practiceAsset(product))
  : undefined;
const drillNames:Record<string,string>={dash:'40-Yard Dash','broad-jump':'Broad Jump',shuttle:'20-Yard Shuttle',bench:'Bench Press',routes:'Receiver Routes','one-on-one':'1-on-1 Routes',rb:'Running Back Challenge',db:'Defensive Back Challenge'};
const exit=()=>{if(!exitMiniChallenge())location.href='/?miniGames=1&combine=1';};

function playersForDrill() {
  const settings = readGameAthlete();
  const role = drill === 'db' ? 'CB' : drill === 'rb' ? 'RB'
    : ['routes', 'one-on-one'].includes(drill || '') ? 'WR' : competitive ? undefined : settings?.position;
  const base = allPlayers.find(player => player.position === role) || allPlayers[0];
  const passport = readAthletePassport();
  const character = settings && STORE_PRODUCTS.find(product => product.id === settings.character && practiceAsset(product));
  if (settings) {
    const build = { ...passport?.build, ...settings, position: role || base.position };
    const movement = athleteMovement(build as Parameters<typeof athleteMovement>[0], competitive);
    const player = dressMyAthlete(withAthleteIdentity({
      ...base, position: build.position, speed: movement.speed, acceleration: movement.acceleration,
      agility: movement.agility, careerStrength: movement.strength, contact: movement.contact,
    }, passport), 'workout');
    return [{
      ...player, heightInches: settings.heightInches, weightLbs: settings.weightLbs,
      ...(character ? { name: character.name, id: 'store:' + character.id, ...gameCharacterAppearance(character.id) } : {}),
      ...(competitive ? { id: base.id } : {}),
    }];
  }
  if (competitive) return [dressMyAthlete(withAthleteIdentity({
    ...base, speed: 85, acceleration: 85, agility: 85, careerStrength: 85, contact: 85,
  }, passport), 'workout')];
  return [dressMyAthlete(passport ? withAthleteIdentity({
    ...base, speed: passport.movement.speed, acceleration: passport.movement.acceleration,
    agility: passport.movement.agility, careerStrength: passport.movement.strength, contact: passport.movement.contact,
  }, passport) : { ...base, name: 'My Player' }, 'workout')];
}

function Drill(){
  const [players]=useState(playersForDrill);
  const Experience=drill==='broad-jump'?BroadJumpExperience:CombineExperience;
  if(drill==='rb')return <RBExperience players={players.filter(p=>p.position==='RB')} onClose={exit}/>;
  if(drill==='db')return <DBExperience players={players.filter(p=>p.position==='CB')} onClose={exit}/>;
  if(drill==='routes'||drill==='one-on-one')return <RouteExperience man={drill==='one-on-one'} players={players.filter(p=>['WR','TE','RB'].includes(p.position))} onClose={exit}/>;
  if(drill==='shuttle'||drill==='bench')return <AgilityStrengthExperience drill={drill} players={players} context="standalone" onClose={exit}/>;
  return <Experience players={players} context="standalone" onClose={exit}/>;
}

function CharacterPractice({ character }: { character: StoreProduct }) {
  const [athlete] = useState(() => ({
    ...combineAthlete({ id: 'store:' + character.id, name: character.name, position: readGameAthlete()?.position ?? 'WR', speed: 85 }),
    heightInches: readGameAthlete()?.heightInches,
    weightLbs: readGameAthlete()?.weightLbs,
    acceleration: 85,
    practiceRig: practiceAsset(character),
    fitPracticeRig: character.fitPracticeRig ? character.id : undefined,
  }));
  return <CombineExperience players={[athlete]} context="character-practice"
    onClose={() => { location.href = '/?storeCharacters=1'; }} />;
}

function CombineEntry(){
  const [started,setStarted]=useState(competitive || !!readGameAthlete()),[outfitReady,setOutfitReady]=useState(false);
  useEffect(()=>{
    let active=true;
    // Account sync must never strand a guest or an expired session on loading.
    const finish=()=>{if(active)setOutfitReady(true);};
    const timeout=window.setTimeout(finish,4000);
    void refreshLocker().catch(()=>{}).finally(()=>{window.clearTimeout(timeout);finish();});
    return()=>{active=false;window.clearTimeout(timeout);};
  },[]);
  if(!outfitReady)return <main className="combine-entry" role="status">Loading your saved outfit…</main>;
  const name=drillNames[drill||'dash']||drillNames.dash;
  return <><LockerAccountSync/>{started?<Drill/>:<main className="combine-entry" aria-label={`${name} athlete setup`}><header><button type="button" onClick={exit} aria-label="Back to Mini Games">‹</button><div><span>BALL KNOWER / MINI COMBINE</span><h1>{name}</h1></div><GameAthleteSetup onSaved={()=>setStarted(true)}/></header><MiniGameAthleteBuilder actionLabel={`Save & start ${name}`} onContinue={()=>setStarted(true)}/></main>}</>;
}

createRoot(document.getElementById('root')!).render(practiceCharacter ? <CharacterPractice character={practiceCharacter}/> : <CombineEntry/>);
