import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {athleteMovement,BODY_PRESETS,limitsFor,presetAthleteBuild,sanitizeAthleteBuild} from '../athleteBuild';
import {sanitizeAthleteAppearance} from '../athleteAppearance';
import {newRoute} from '../combine/routes.js';
import {newRBRep,newRBSession} from '../combine/rb-drill.js';
import {newDBRep,newDBSession} from '../combine/db-drill.js';

const lean=presetAthleteBuild('RB',BODY_PRESETS[0]),heavy=presetAthleteBuild('RB',BODY_PRESETS[4]);
assert.ok(lean.weightLbs<heavy.weightLbs,'presets should create meaningfully different frames');
assert.ok(athleteMovement(lean).speed>athleteMovement(heavy).speed,'lighter builds should be faster in practice');
assert.ok(athleteMovement(lean).agility>athleteMovement(heavy).agility,'lighter builds should change direction faster');
assert.ok(athleteMovement(heavy).strength>athleteMovement(lean).strength,'heavier builds should be stronger');
assert.ok(athleteMovement(heavy).contact>athleteMovement(lean).contact,'heavier builds should gain contact ability');
assert.deepEqual(athleteMovement(lean,true),athleteMovement(heavy,true),'competitive challenges must normalize every body');
const fast={id:'fast',speed:94,acceleration:94,agility:94,contact:70},power={id:'power',speed:72,acceleration:75,agility:72,contact:94};
assert.ok(newRoute(fast).speed>newRoute(power).speed,'route movement uses the shared athlete speed');
assert.ok(newRBRep(fast,0,newRBSession(1)).speed>newRBRep(power,0,newRBSession(1)).speed,'runner movement uses the shared athlete speed');
assert.ok(newDBRep(fast,0,newDBSession(1)).db.speed>newDBRep(power,0,newDBSession(1)).db.speed,'coverage movement uses the shared athlete speed');

for(const position of ['QB','RB','WR','TE','EDGE','LB','CB','S'] as const){
  const limits=limitsFor(position),clean=sanitizeAthleteBuild({position,heightInches:-999,weightLbs:9999,bodyBuild:999,shoulderWidth:-1,armSize:NaN,legSize:101,bodyPresetId:'custom'});
  assert.equal(clean.heightInches,limits.height[0]);assert.equal(clean.weightLbs,limits.weight[1]);
  assert.equal(clean.bodyBuild,100);assert.equal(clean.shoulderWidth,0);assert.equal(clean.armSize,0);assert.equal(clean.legSize,100);
}
const entry=readFileSync(new URL('../combine/main.tsx',import.meta.url),'utf8');
assert.match(entry,/useState\(competitive\)/,'standalone practice waits at athlete setup while competitive challenges start immediately');
assert.match(entry,/Save & start \$\{name\}/,'the direct Combine entry requires an explicit save and start');
assert.match(entry,/function playersForDrill\(\)/,'the drill reads the saved athlete only after setup completes');
assert.match(entry,/if\(competitive\)return\[withAthleteIdentity/,'challenge entry uses one normalized athlete');
assert.match(readFileSync(new URL('../combine/meshy-runner.js',import.meta.url),'utf8'),/asset\.scale\.y\*=height/,'the actual 3D rig changes with height');
assert.deepEqual(sanitizeAthleteAppearance({skinTone:'fair',hairStyle:'braids',hairColor:'auburn',facialHair:'goatee',tattooCoverage:'both-arms',tattooStyle:'geometric'}),{skinTone:'fair',hairStyle:'braids',hairColor:'auburn',facialHair:'goatee',tattooCoverage:'both-arms',tattooStyle:'geometric'});
assert.equal(sanitizeAthleteAppearance({skinTone:'unsafe'}).skinTone,'warm brown','invalid cosmetic values fall back safely');
const livePreview=readFileSync(new URL('../AthleteLivePreview.tsx',import.meta.url),'utf8');
assert.match(livePreview,/data-arm-size=\{profile\.armSize\}/,'the preview exposes live arm sizing');
assert.match(livePreview,/standing with hands at waist/,'the preview uses the requested neutral waist pose');
assert.match(livePreview,/TattooMarks appearance=\{appearance\}/,'tattoo edits render directly on the athlete');
console.log('Athlete build checks passed');
