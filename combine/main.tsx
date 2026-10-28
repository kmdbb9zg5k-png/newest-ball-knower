import {readAthletePassport,withAthleteIdentity} from '../athletePassport';
import {inMiniChallenge,exitMiniChallenge} from '../public/mini-challenge-bridge.js';
import RBExperience from './RBExperience';
import React from 'react';
import { createRoot } from 'react-dom/client';
import DBExperience from './DBExperience';
import RouteExperience from './RouteExperience';
import CombineExperience from './CombineExperience';
import BroadJumpExperience from './BroadJumpExperience';
import AgilityStrengthExperience from './AgilityStrengthExperience';
import { SOLO_PLAYERS_DATABASE } from '../soloUniverse';
import { combineAthlete } from './dash.js';
const positions = ['WR', 'RB', 'CB', 'QB', 'TE', 'LB'];
const allPlayers = positions.flatMap(pos => SOLO_PLAYERS_DATABASE.filter(p => p.position === pos).slice(0, 3)).map(combineAthlete);
const drill = new URLSearchParams(location.search).get('drill');
const pool = drill==='db'?allPlayers.filter(p=>p.position==='CB'):drill==='rb'?allPlayers.filter(p=>p.position==='RB'):['routes','one-on-one'].includes(drill||'')?allPlayers.filter(p=>p.position==='WR'):allPlayers;
const passport=readAthletePassport(),base=pool[0]||allPlayers[0];
const shared=passport?withAthleteIdentity({...base,speed:passport.movement.speed,acceleration:passport.movement.acceleration,agility:passport.movement.agility,careerStrength:passport.movement.strength,contact:passport.movement.contact},passport):{...base,name:'My Player'};
// Every standalone drill loads one persistent build. Competitive challenges keep
// its appearance but normalize physical ratings so a body choice is never an edge.
const players = inMiniChallenge() ? [withAthleteIdentity({...base,speed:85,acceleration:85,agility:85,careerStrength:85,contact:85},passport)] : [shared];
const Drill = drill === 'broad-jump' ? BroadJumpExperience : CombineExperience;
createRoot(document.getElementById('root')!).render(drill === 'rb' ? <RBExperience players={players.filter(p=>p.position==='RB')} onClose={() => { if(!exitMiniChallenge())location.href = '/?miniGames=1&combine=1'; }} /> : drill === 'db' ? <DBExperience players={players.filter(p=>p.position==='CB')} onClose={() => { if(!exitMiniChallenge())location.href = '/?miniGames=1&combine=1'; }} /> : drill === 'routes' || drill === 'one-on-one' ? <RouteExperience man={drill === 'one-on-one'} players={players.filter(p=>['WR','TE','RB'].includes(p.position))} onClose={() => { if(!exitMiniChallenge())location.href = '/?miniGames=1&combine=1'; }} /> : drill === 'shuttle' || drill === 'bench' ? <AgilityStrengthExperience drill={drill} players={players} context="standalone" onClose={() => { if(!exitMiniChallenge())location.href = '/?miniGames=1&combine=1'; }} /> : <Drill players={players} context="standalone" onClose={() => { if(!exitMiniChallenge())location.href = '/?miniGames=1&combine=1'; }} />);
