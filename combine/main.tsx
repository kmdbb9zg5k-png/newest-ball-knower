import {dressMyAthlete} from '../athleteWardrobe';
import {refreshLocker} from '../lockerCommerceClient';
import LockerAccountSync from '../LockerAccountSync';
import {readAthletePassport,withAthleteIdentity} from '../athletePassport';
import {inMiniChallenge,exitMiniChallenge} from '../public/mini-challenge-bridge.js';
import {withGameCharacter} from '../gameAthleteAppearance';
import {resolveGameAthlete} from '../gameAthletePreference';
import CombineLoading from './CombineLoading';
import MiniGameAthleteBuilder from '../MiniGameAthleteBuilder';
import { athleteMovement } from '../athleteBuild';
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
import '../index.css';
import '../communityMiniGames.css';
import '../solo/soloPresentation.css';
import './combine-entry.css';

const positions=['WR','RB','CB','QB','TE','LB'];
const allPlayers=positions.flatMap(pos=>SOLO_PLAYERS_DATABASE.filter(p=>p.position===pos).slice(0,3)).map(combineAthlete);
const params = new URLSearchParams(location.search);
const drill = params.get('drill');
const competitive=inMiniChallenge();
const exit=()=>{if(!exitMiniChallenge())location.href='/?miniGames=1&combine=1';};

type Selection = Awaited<ReturnType<typeof resolveGameAthlete>>;
function playersForDrill({ saved: settings, character }: Selection) {
  const passport = readAthletePassport();
  const role = drill === 'db' ? 'CB' : drill === 'rb' ? 'RB'
    : ['routes', 'one-on-one'].includes(drill || '') ? 'WR' : competitive ? undefined : settings?.position ?? passport?.build.position;
  const base = allPlayers.find(player => player.position === role) || allPlayers[0];
  if (settings) {
    const build = { ...passport?.build, ...settings, position: role || base.position };
    const movement = athleteMovement(build as Parameters<typeof athleteMovement>[0], competitive);
    const player = dressMyAthlete(withAthleteIdentity({
      ...base, position: build.position, speed: movement.speed, acceleration: movement.acceleration,
      agility: movement.agility, careerStrength: movement.strength, contact: movement.contact,
    }, passport), 'workout');
    return [withGameCharacter({
      ...player, name: passport ? player.name : 'My Player', heightInches: settings.heightInches, weightLbs: settings.weightLbs,
      ...(character && !competitive ? { id: 'store:' + character.id } : {}),
      ...(competitive ? { id: base.id } : {}),
    }, character)];
  }
  if (competitive) return [dressMyAthlete(withAthleteIdentity({
    ...base, speed: 85, acceleration: 85, agility: 85, careerStrength: 85, contact: 85,
  }, passport), 'workout')];
  return [dressMyAthlete(passport ? withAthleteIdentity({
    ...base, speed: passport.movement.speed, acceleration: passport.movement.acceleration,
    agility: passport.movement.agility, careerStrength: passport.movement.strength, contact: passport.movement.contact,
  }, passport) : { ...base, name: 'My Player' }, 'workout')];
}

function Drill({ selection }: { selection: Selection }) {
  const [players] = useState(() => playersForDrill(selection));
  const Experience=drill==='broad-jump'?BroadJumpExperience:CombineExperience;
  if(drill==='rb')return <RBExperience players={players.filter(p=>p.position==='RB')} onClose={exit}/>;
  if(drill==='db')return <DBExperience players={players.filter(p=>p.position==='CB')} onClose={exit}/>;
  if(drill==='routes'||drill==='one-on-one')return <RouteExperience man={drill==='one-on-one'} players={players.filter(p=>['WR','TE','RB'].includes(p.position))} onClose={exit}/>;
  if(drill==='shuttle'||drill==='bench')return <AgilityStrengthExperience drill={drill} players={players} context="standalone" onClose={exit}/>;
  return <Experience players={players} context="standalone" onClose={exit}/>;
}

function CombineEntry() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(!competitive && params.get('create') === '1');
  useEffect(() => {
    let active = true;
    let timer: number;
    const outfit = Promise.race([
      refreshLocker().catch(() => undefined),
      new Promise<void>(resolve => { timer = window.setTimeout(resolve, 4000); }),
    ]);
    void Promise.all([resolveGameAthlete(), outfit]).then(([resolved]) => {
      if (active) setSelection(resolved);
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : 'Could not load your Locker character.');
    }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); };
  }, [attempt]);
  if (editing) return <><LockerAccountSync/><main className="combine-entry" aria-label="Combine athlete setup">
    <header><a href="/?profile=1" aria-label="Back to Locker">‹</a><h1>Game character</h1></header>
    <MiniGameAthleteBuilder actionLabel="Save My Player" onContinue={() => setEditing(false)}/>
  </main></>;
  return <><LockerAccountSync/>{selection
    ? <Drill selection={selection}/>
    : <CombineLoading error={error} onBack={exit} onRetry={() => { setError(''); setAttempt(attempt + 1); }}/>
  }</>;
}

createRoot(document.getElementById('root')!).render(<CombineEntry/>);
