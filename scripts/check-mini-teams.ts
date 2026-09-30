import assert from 'node:assert/strict';
import {SOLO_PLAYER_BY_ID,SOLO_TEAM_THEMES} from '../soloUniverse';
import {MINI_TEAMS,miniMatchup,rosterRatings} from '../public/play-moment-3d/mini-teams.js';
import {jerseyIdentityKey,jerseySurname} from '../public/play-moment-3d/jersey-identity.js';
assert.equal(MINI_TEAMS.length,32);
assert.deepEqual(MINI_TEAMS.map(t=>t.abbr),SOLO_TEAM_THEMES.map(t=>t.abbr));
for(const team of MINI_TEAMS){
 const seen=new Set();
 for(const p of [...team.lineup,team.fullback]){
  const actual=SOLO_PLAYER_BY_ID.get(p.id)!;assert(actual);assert.equal(actual.team,team.abbr);assert.equal(actual.lastName,p.lastName);assert.equal(actual.jerseyNumber,p.number);assert.equal(actual.overall,p.overall);assert(!seen.has(p.id));seen.add(p.id);
 }
 const average=(players:any[])=>Math.round(players.reduce((n,p)=>n+p.overall,0)/players.length);
 assert.equal(team.overall,average(team.lineup));assert.equal(team.offense,average(team.lineup.slice(0,11)));assert.equal(team.defense,average(team.lineup.slice(11)));
}
const same=miniMatchup('JCY','JCY');assert.notEqual(same.home.abbr,same.away.abbr);
assert.equal(miniMatchup('bad','bad').home.abbr,'JCY');
const qb1=MINI_TEAMS[0].lineup[5],qb2=MINI_TEAMS[1].lineup[5];
const base={speed:78,acceleration:82,agility:80,throw:91};
assert.equal(rosterRatings(base,qb1).throw,qb1.attributes.passing);
assert.notDeepEqual(rosterRatings(base,qb1),rosterRatings(base,qb2));
assert.notEqual(jerseyIdentityKey({team:0,number:11,lastName:'Mercer'}),jerseyIdentityKey({team:0,number:11,lastName:'Nash'}));
assert.equal(jerseySurname({lastName:'Rodriguez'}),'RODRIGUEZ');
console.log('PASS: 32 exact Solo teams, 736 matching identities, no duplicate lineup players, derived OVR/OFF/DEF, matchup guards, gameplay attributes, identity-aware jersey keys.');
