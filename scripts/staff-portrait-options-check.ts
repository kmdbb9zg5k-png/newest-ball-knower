import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SIMULATED_ART_BATCH_COST_MICRO_USD } from '../solo/artBudget';
import {
  AGENT_PORTRAITS,
  OWNER_PORTRAITS,
  STAFF_ART_PROFILES,
  staffPortraitPlayer,
  staffPortraitProfile,
} from '../solo/staffPortraits';

assert.equal(OWNER_PORTRAITS.length,4);
assert.equal(AGENT_PORTRAITS.length,4);
assert.equal(STAFF_ART_PROFILES.length,8);
assert.equal(new Set(STAFF_ART_PROFILES.map(profile=>profile.id)).size,8);
assert.equal(new Set(OWNER_PORTRAITS.map(profile=>profile.nationality)).size,4);
assert.equal(new Set(AGENT_PORTRAITS.map(profile=>profile.nationality)).size,4);
assert(STAFF_ART_PROFILES.every(profile=>profile.id.startsWith(`solo-staff-${profile.role}-`)));
assert(STAFF_ART_PROFILES.every(profile=>profile.visualDirection.length>50));
assert.equal(staffPortraitProfile('missing','owner').id,OWNER_PORTRAITS[0].id);
assert.equal(staffPortraitProfile('missing','agent').id,AGENT_PORTRAITS[0].id);

for(const profile of STAFF_ART_PROFILES){
  const player=staffPortraitPlayer(profile);
  assert.equal(player.id,profile.id);
  assert.equal(player.team,'BK');
  assert.equal(player.age,profile.age);
}

const owner=readFileSync('OwnerBusinessMode.tsx','utf8');
const agent=readFileSync('PlayerAgentMode.tsx','utf8');
const api=readFileSync('api/simulated-player-art.ts','utf8');
const controller=readFileSync('api/simulated-player-art-preview-control.source.ts','utf8');
assert.match(owner,/portraitId/);
assert.match(owner,/OWNER_PORTRAITS\.map/);
assert.match(agent,/portraitId/);
assert.match(agent,/AGENT_PORTRAITS\.map/);
assert.doesNotMatch(agent,/profile\.nationality/);
assert(AGENT_PORTRAITS.some(profile=>profile.id==='solo-staff-agent-ethan-cole'));
assert.match(api,/professional sports-business photography sheet/);
assert.match(api,/no football uniform, jersey, helmet, sports equipment, national flag, costume or cultural stereotype/);
assert.match(controller,/action\s*===\s*['"]submit-staff['"]/);
assert.match(controller,/STAFF_ART_PROFILES\.map/);
assert.match(controller,/const knownPlayers/);
assert.equal(STAFF_ART_PROFILES.length*SIMULATED_ART_BATCH_COST_MICRO_USD.economy,136_000);

console.log(JSON.stringify({
  ownerPortraits:OWNER_PORTRAITS.length,
  agentPortraits:AGENT_PORTRAITS.length,
  uniqueNationalities:8,
  estimatedGenerationUsd:STAFF_ART_PROFILES.length*SIMULATED_ART_BATCH_COST_MICRO_USD.economy/1_000_000,
},null,2));
