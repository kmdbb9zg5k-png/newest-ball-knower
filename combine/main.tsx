import {readAthletePassport,withAthleteIdentity} from '../athletePassport';
import {inMiniChallenge,exitMiniChallenge} from '../public/mini-challenge-bridge.js';
import MiniGameAthleteBuilder from '../MiniGameAthleteBuilder';
import RBExperience from './RBExperience';
import React,{useState} from 'react';
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
const drill=new URLSearchParams(location.search).get('drill');
const competitive=inMiniChallenge();
const drillNames:Record<string,string>={dash:'40-Yard Dash','broad-jump':'Broad Jump',shuttle:'20-Yard Shuttle',bench:'Bench Press',routes:'Receiver Routes','one-on-one':'1-on-1 Routes',rb:'Running Back Challenge',db:'Defensive Back Challenge'};
const exit=()=>{if(!exitMiniChallenge())location.href='/?miniGames=1&combine=1';};

function playersForDrill(){
  const pool=drill==='db'?allPlayers.filter(p=>p.position==='CB'):drill==='rb'?allPlayers.filter(p=>p.position==='RB'):['routes','one-on-one'].includes(drill||'')?allPlayers.filter(p=>p.position==='WR'):allPlayers;
  const passport=readAthletePassport(),base=pool[0]||allPlayers[0];
  if(competitive)return[withAthleteIdentity({...base,speed:85,acceleration:85,agility:85,careerStrength:85,contact:85},passport)];
  return[passport?withAthleteIdentity({...base,speed:passport.movement.speed,acceleration:passport.movement.acceleration,agility:passport.movement.agility,careerStrength:passport.movement.strength,contact:passport.movement.contact},passport):{...base,name:'My Player'}];
}

function Drill(){
  const players=playersForDrill(),Experience=drill==='broad-jump'?BroadJumpExperience:CombineExperience;
  if(drill==='rb')return <RBExperience players={players.filter(p=>p.position==='RB')} onClose={exit}/>;
  if(drill==='db')return <DBExperience players={players.filter(p=>p.position==='CB')} onClose={exit}/>;
  if(drill==='routes'||drill==='one-on-one')return <RouteExperience man={drill==='one-on-one'} players={players.filter(p=>['WR','TE','RB'].includes(p.position))} onClose={exit}/>;
  if(drill==='shuttle'||drill==='bench')return <AgilityStrengthExperience drill={drill} players={players} context="standalone" onClose={exit}/>;
  return <Experience players={players} context="standalone" onClose={exit}/>;
}

function CombineEntry(){
  const [started,setStarted]=useState(competitive);
  if(started)return <Drill/>;
  const name=drillNames[drill||'dash']||drillNames.dash;
  return <main className="combine-entry" aria-label={`${name} athlete setup`}><header><button type="button" onClick={exit} aria-label="Back to Mini Games">‹</button><div><span>BALL KNOWER / MINI COMBINE</span><h1>Create your athlete before the {name}</h1><p>Set your body and movement style now. The drill will not load until you save and start.</p></div></header><MiniGameAthleteBuilder actionLabel={`Save & start ${name}`} onContinue={()=>setStarted(true)}/></main>;
}

createRoot(document.getElementById('root')!).render(<CombineEntry/>);
