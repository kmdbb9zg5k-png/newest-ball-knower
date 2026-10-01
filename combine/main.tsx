import React from 'react';
import { createRoot } from 'react-dom/client';
import CombineExperience from './CombineExperience';
import { SOLO_PLAYERS_DATABASE } from '../soloUniverse';
import { combineAthlete } from './dash.js';
const positions = ['WR', 'RB', 'CB', 'QB', 'TE', 'LB'];
const players = positions.flatMap(pos => SOLO_PLAYERS_DATABASE.filter(p => p.position === pos).slice(0, 3)).map(combineAthlete);
createRoot(document.getElementById('root')!).render(<CombineExperience players={players} context="standalone" onClose={() => { location.href = '/?miniGames=1'; }} />);
