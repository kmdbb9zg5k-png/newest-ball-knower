import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'fflate';
import {BufferGeometryLoader} from 'three';
import {decodeScoutPoses, loadScoutPoses, SCOUT_POSES_URL} from '../combine/scout-poses.js';
import {invalidateCombineAsset} from '../combine/asset-loading.js';

const compressed = await readFile('public/play-moment-3d/assets/combine-scout-poses-v1.json.gz');
const buffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const nativeDecoder = globalThis.DecompressionStream;
globalThis.DecompressionStream = undefined;
const poses = decodeScoutPoses(buffer(compressed));
assert.equal(poses.length, 4);
assert.deepEqual(decodeScoutPoses(buffer(gunzipSync(compressed))), poses);
for (const pose of poses) for (const json of pose.geometries) {
  const geometry = new BufferGeometryLoader().parse(json);
  assert(geometry.getAttribute('position').count > 0);
  geometry.dispose();
}
assert.throws(() => decodeScoutPoses(buffer(compressed.subarray(0, 60))));
for (const text of ['<html>offline</html>', '{}', '[]', '[{},{},{},{}]']) {
  assert.throws(() => decodeScoutPoses(buffer(Buffer.from(text))));
}
globalThis.DecompressionStream = nativeDecoder;

let calls = [];
globalThis.fetch = async (_url, options) => {
  calls.push(options.cache);
  return {ok:true, arrayBuffer:async () => buffer(calls.length === 1 ? Buffer.from('bad cache') : compressed)};
};
assert.equal((await loadScoutPoses()).length, 4);
assert.deepEqual(calls, ['force-cache', 'reload']);
await loadScoutPoses();
assert.equal(calls.length, 2, 'Successful bytes remain cached across drills');

invalidateCombineAsset(SCOUT_POSES_URL);
calls = [];
globalThis.fetch = async (_url, options) => { calls.push(options.cache); return {ok:false}; };
await assert.rejects(loadScoutPoses(), /Could not download/);
assert.equal(calls.length, 2, 'Persistent errors have bounded retries');

const signals = [];
globalThis.fetch = async (_url, options) => {signals.push(options.signal); return new Promise(() => {});};
await assert.rejects(loadScoutPoses(10), /timed out/);
assert.equal(signals.length, 2);
assert(signals.every(signal => signal.aborted));
globalThis.fetch = async () => ({ok:true, arrayBuffer:async () => buffer(compressed)});
assert.equal((await loadScoutPoses()).length, 4, 'A later visit recovers after timeout');
console.log('PASS real scout geometry, absent native decoder, gzip/plain JSON, corrupt/truncated responses, bounded retry, timeout abort and later recovery');
