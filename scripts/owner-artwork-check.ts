import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { OWNER_DECISIONS } from '../ownerStoryEngine';
import { OWNER_SCENES, OWNER_STORY_SCENES, ownerSceneForDecision, ownerScenePath } from '../ownerArtwork';
assert.deepEqual(Object.keys(OWNER_STORY_SCENES).sort(), OWNER_DECISIONS.map(d => d.id).sort(), 'Every authored situation needs an explicit artwork assignment');
assert.equal(ownerSceneForDecision('legacy-test-2030'), 'suite');
let bytes = 0;
for (const scene of OWNER_SCENES) {
  const path = `public${ownerScenePath(scene)}`;
  const file = readFileSync(path);
  assert.equal(file.subarray(8, 12).toString(), 'WEBP', path);
  assert(statSync(path).size < 180_000, `${path} exceeds mobile image budget`);
  bytes += file.length;
}
assert(bytes < 2_500_000, 'Owner artwork total exceeds 2.5 MB budget');
for (const d of OWNER_DECISIONS) assert(OWNER_SCENES.includes(ownerSceneForDecision(d.id)), d.id);
console.log(`PASS ${OWNER_DECISIONS.length} story mappings, ${OWNER_SCENES.length} valid WebPs, ${bytes} bytes`);
