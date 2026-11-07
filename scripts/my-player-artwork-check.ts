import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MY_PLAYER_SCENES,MY_PLAYER_JOURNEY_SCENES,MY_PLAYER_CONVERSATION_SCENES,myPlayerScenePath,myPlayerDraftScene,myPlayerPreparationScene} from '../myPlayerArtwork';
import {JOURNEY_ORDER} from '../myPlayerJourney';
import {CAREER_CAST} from '../myPlayerCareer';
assert.deepEqual(Object.keys(MY_PLAYER_JOURNEY_SCENES).sort(),[...JOURNEY_ORDER].sort());
assert.deepEqual(Object.keys(MY_PLAYER_CONVERSATION_SCENES).sort(),Object.keys(CAREER_CAST).sort());
assert.equal(myPlayerDraftScene(false,'drafted'),'agent');
assert.equal(myPlayerDraftScene(true,'undrafted'),'agent');
assert.equal(myPlayerDraftScene(true,'drafted'),'draft');
assert.equal(myPlayerPreparationScene('recovery','training'),'recovery');
assert.equal(myPlayerPreparationScene('film','training'),'film');
let bytes=0;
for(const scene of MY_PLAYER_SCENES){const file=readFileSync(`public${myPlayerScenePath(scene)}`);assert.equal(file.subarray(8,12).toString(),'WEBP');assert(file.length<180000);bytes+=file.length;}
assert(bytes<2000000);
console.log(`PASS ${MY_PLAYER_SCENES.length} scene assets, complete journey/cast coverage, draft-outcome gating, ${bytes} bytes`);
