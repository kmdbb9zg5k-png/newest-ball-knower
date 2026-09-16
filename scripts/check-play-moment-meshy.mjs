import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MESHY_CLIPS, PRE_SNAP_ROLE_POSES, meshyPlaybackSeed, preSnapPoseForRole } from '../public/play-moment-3d/meshy-athlete.js';

const asset = new URL('../public/play-moment-3d/assets/meshy-gridiron-gold.glb', import.meta.url);
const bytes = readFileSync(asset);
assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Detailed player must be a binary glTF');
assert.equal(bytes.readUInt32LE(4), 2, 'Detailed player must use glTF 2.0');
assert.ok(bytes.byteLength < 11_000_000, 'Shared player asset must stay inside the mobile transfer budget');

const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ''));
const primitive = gltf.meshes[0].primitives[0];
const positions = gltf.accessors[primitive.attributes.POSITION];
const indices = gltf.accessors[primitive.indices];
const skin = gltf.skins[gltf.nodes.find((node) => Number.isInteger(node.skin)).skin];

assert.equal(indices.count / 3, 14_187, 'Expected the reviewed Meshy football topology');
assert.equal(positions.count, 9_821, 'Expected the reviewed split-vertex count');
assert.equal(skin.joints.length, 27, 'The mobile skinning path is budgeted for the reviewed 27-bone rig');
assert.ok(skin.joints.length <= 32, 'The rig must fit the WebGL2 uniform bone budget');
assert.equal(gltf.images.length, 3, 'Base color, normal and material maps should all remain embedded');
assert.ok(gltf.images.every((image) => image.mimeType === 'image/jpeg' && Number.isInteger(image.bufferView)));
assert.equal(gltf.animations.length, 11, 'The player should ship with core football motion plus run/walk/rest');

for (const [state, index] of Object.entries(MESHY_CLIPS)) {
  assert.ok(index >= 0 && index < gltf.animations.length, `${state} clip must resolve inside the shipped GLB`);
}
for (const index of [MESHY_CLIPS.sprint, MESHY_CLIPS.tackle, MESHY_CLIPS.block, MESHY_CLIPS.idle, MESHY_CLIPS.throw, MESHY_CLIPS.catch, MESHY_CLIPS.celebrate]) {
  const animation = gltf.animations[index];
  assert.equal(animation.channels.length, 54, 'Each custom football clip must animate translation and rotation on 27 bones');
}

const footballRoles = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB'];
const preSnap = footballRoles.map((role, index) => preSnapPoseForRole(role, index));
assert.equal(Object.keys(PRE_SNAP_ROLE_POSES).length, footballRoles.length, 'Every football role needs a deliberate pre-snap pose');
assert.ok(new Set(preSnap.map(({ clip, time }) => `${clip}:${time.toFixed(3)}`)).size >= 7, 'Pre-snap players must not share one synchronized pose');
assert.ok(preSnap.every(({ clip, time }) => clip >= 0 && clip < gltf.animations.length && time >= 0 && time < 1), 'Pre-snap anchors must resolve inside shipped clips');
const playbackSeeds = Array.from({ length: 22 }, (_, index) => meshyPlaybackSeed(index, index >= 11));
assert.ok(new Set(playbackSeeds.map(({ offset }) => offset.toFixed(3))).size >= 18, 'Live animation cycles need player-specific phase offsets');
assert.ok(new Set(playbackSeeds.map(({ rate }) => rate.toFixed(3))).size >= 7, 'Live animation cycles need subtle speed variation');

const rendererSource = readFileSync(new URL('../public/play-moment-3d/meshy-athlete.js', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../public/play-moment-3d/game.js', import.meta.url), 'utf8');
assert.match(rendererSource, /weights\.x\*bones\[joints\.x\]/, 'The detailed model must use GPU skinning');
assert.match(rendererSource, /normalMap/, 'The detailed model must retain its normal map');
assert.match(rendererSource, /ormMap/, 'The detailed model must retain its roughness/metalness map');
assert.match(rendererSource, /using built-in players/, 'Asset or GPU failure must preserve the procedural fallback');
assert.match(gameSource, /if\(!meshy\.ready\)for\(const p of actors\)drawAthlete/, 'The existing players must stay visible until the detailed asset is ready');
assert.match(gameSource, /meshy\.draw\(actors,phase,now\/1000\)/, 'The shared skinned player must be wired into the live scene with presentation time');

console.log(JSON.stringify({
  status: 'PASS',
  bytes: bytes.byteLength,
  triangles: indices.count / 3,
  vertices: positions.count,
  bones: skin.joints.length,
  textures: gltf.images.length,
  animations: gltf.animations.length,
  footballStates: Object.keys(MESHY_CLIPS),
  preSnapPoses: Object.keys(PRE_SNAP_ROLE_POSES).length,
  checks: 'reviewed binary asset, shared mobile topology, 27-bone GPU skinning budget, embedded PBR maps, position-specific planted pre-snap poses, staggered live motion, live integration and procedural fallback',
}, null, 2));
