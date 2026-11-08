import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GM_SCENES, GM_MEETING_SCENES, gmSceneUrl } from '../gmSceneArtwork';
const hashes = new Set<string>();
let bytes = 0;
for (const scene of GM_SCENES) {
  const data = readFileSync(`public${gmSceneUrl(scene)}`);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  assert(data.length < 180_000, `${scene} exceeds mobile image budget`);
  hashes.add(createHash('sha256').update(data).digest('hex'));
  bytes += data.length;
}
assert.equal(hashes.size, GM_SCENES.length, 'Every GM situation has distinct image content');
assert.equal(new Set(Object.values(GM_MEETING_SCENES)).size, 7, 'Each meeting kind has its own scene');
console.log(`PASS ${hashes.size} unique WebP scenes, seven distinct meetings, ${bytes} bytes total`);
