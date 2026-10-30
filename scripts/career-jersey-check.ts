import assert from 'node:assert/strict';
import {careerJersey} from '../careerJersey';
import {SOLO_TEAM_THEMES} from '../soloUniverse';
import {cleanOutfit,outfitLook,DEFAULT_OUTFIT} from '../playerWardrobe';
let profile:any={version:1,stage:'season',teamAbbr:'JCY',name:'Elijah Delgadillo',number:21};
Object.assign(globalThis,{localStorage:{getItem:()=>JSON.stringify(profile)}});
const outfit={...DEFAULT_OUTFIT,top:'top-career-jersey'};
assert.deepEqual(cleanOutfit(outfit),outfit);
assert.equal(outfitLook(outfit).top.jersey?.number,21);
assert.equal(outfitLook(outfit).top.jersey?.playerName,'DELGADILLO');
for(const team of SOLO_TEAM_THEMES){profile.teamAbbr=team.abbr;assert.equal(outfitLook(outfit).top.color,team.primary);assert.equal(outfitLook(outfit).top.jersey?.team,team.abbr);}
profile.number=0;assert.equal(outfitLook(outfit).top.jersey?.number,0);
profile.stage='combine';assert.equal(outfitLook(outfit).top.jersey?.team,'BK');
profile.stage='season';profile.teamAbbr='INVALID';assert.equal(careerJersey().team,'BK');
assert.equal(careerJersey(null).team,'BK');assert.equal(careerJersey({version:1,stage:'season',teamAbbr:'JCY',number:999}).number,0);
console.log('PASS career jersey: all 32 teams, automatic transfer, number zero, surname, free equip, prospect/invalid fallback.');
