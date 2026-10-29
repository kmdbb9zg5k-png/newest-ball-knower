import assert from 'node:assert/strict';
import {sanitizeAthleteAppearance} from '../athleteAppearance';
import {athletePassport,withAthleteIdentity} from '../athletePassport';
const legacy=sanitizeAthleteAppearance({tattooCoverage:'both-arms',tattooStyle:'blackwork'});
assert.equal(legacy.tattooCoverage,'full-sleeve');assert.equal(legacy.tattooArms,'both');
assert.equal(sanitizeAthleteAppearance({tattooCoverage:'forearm'}).tattooArms,'right','Old single-arm saves keep their original arm');
assert.equal(sanitizeAthleteAppearance({tattooArms:'invalid'}).tattooArms,'right');
for(const tattooArms of ['left','right','both'] as const){
 const raw={version:1,stage:'combine',name:'Tattoo Athlete',position:'WR',number:21,tattooArms,tattooCoverage:'forearm',tattooStyle:'traditional'};
 const restored=athletePassport(JSON.parse(JSON.stringify(raw)))!;
 assert.equal(restored.appearance.tattooArms,tattooArms);assert.equal(restored.appearance.tattooCoverage,'forearm');
 const player=withAthleteIdentity({id:'fixed-competitive',name:'Default',speed:85},restored);
 assert.equal(player.athleteAppearance?.tattooArms,tattooArms);assert.equal(player.speed,85);assert.equal(player.id,'fixed-competitive');
 assert.equal(sanitizeAthleteAppearance({...raw,tattooCoverage:'none'}).tattooArms,tattooArms,'Removing ink keeps the chosen placement');
}
console.log('PASS tattoo placement migration, save/restore and shared career/competitive identity.');
