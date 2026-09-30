import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {MINI_SELECTOR_ART} from '../miniSelectorArt';
import {MINI_TEAMS} from '../public/play-moment-3d/mini-teams.js';
import {SOLO_PLAYERS_DATABASE,SOLO_PLAYER_BY_ID} from '../soloUniverse';
assert.equal(Object.keys(MINI_SELECTOR_ART).length,32);
const seen=new Set<string>();
for(const team of MINI_TEAMS){
 const specialists=SOLO_PLAYERS_DATABASE.filter(p=>p.team===team.abbr && ['K','P'].includes(p.position));
 assert.equal(specialists.length,2);
 const art=MINI_SELECTOR_ART[team.abbr];assert(art);assert.equal(art.specialTeams,Math.round(specialists.reduce((sum,p)=>sum+(p.overall??0),0)/2));assert.equal(art.players.length,3);
 const best=SOLO_PLAYERS_DATABASE.filter(p=>p.team===team.abbr).map(p=>p.overall??0).sort((a,b)=>b-a).slice(0,3);
 assert.deepEqual(art.players.map(p=>p.rating),best,team.name+' must show the top three full-roster ratings');
 for(const p of art.players){const source=SOLO_PLAYER_BY_ID.get(p.id);assert(source);assert.equal(source.team,team.abbr);assert.equal(p.name,source.name);assert.equal(p.position,source.position);assert.equal(p.rating,source.overall);assert(!seen.has(p.id));seen.add(p.id);assert(existsSync('public'+p.portrait),p.portrait);}
assert(existsSync('public'+art.logo));
}
console.log('PASS 32 teams, 96 fixed portraits, true full-roster top-three names/positions/ratings and all local assets.');
