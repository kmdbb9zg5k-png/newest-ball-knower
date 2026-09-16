import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FOOTBALL_MOTION_RECIPES, MESHY_CLIPS, PRE_SNAP_ROLE_POSES, ROLE_STANCE_PROFILES, meshyAnimationState, meshyPlaybackSeed, meshyTransitionRate, motionRecipeForState, preSnapPoseForRole } from '../public/play-moment-3d/meshy-athlete.js';

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
assert.deepEqual(Object.keys(ROLE_STANCE_PROFILES),footballRoles,'Every football role needs a skeleton-level stance profile');
assert.ok(ROLE_STANCE_PROFILES.OL.crouch>ROLE_STANCE_PROFILES.WR.crouch&&ROLE_STANCE_PROFILES.DL.lean>ROLE_STANCE_PROFILES.QB.lean,'Line stances must be lower and more aggressive than skill stances');
assert.ok(new Set(preSnap.map(({ clip, time }) => `${clip}:${time.toFixed(3)}`)).size >= 7, 'Pre-snap players must not share one synchronized pose');
assert.ok(preSnap.every(({ clip, time }) => clip >= 0 && clip < gltf.animations.length && time >= 0 && time < 1), 'Pre-snap anchors must resolve inside shipped clips');
const playbackSeeds = Array.from({ length: 22 }, (_, index) => meshyPlaybackSeed(index, index >= 11));
assert.ok(new Set(playbackSeeds.map(({ offset }) => offset.toFixed(3))).size >= 18, 'Live animation cycles need player-specific phase offsets');
assert.ok(new Set(playbackSeeds.map(({ rate }) => rate.toFixed(3))).size >= 7, 'Live animation cycles need subtle speed variation');
assert.equal(Object.keys(FOOTBALL_MOTION_RECIPES).length, 12, 'The compact GLB should expand into a twelve-recipe football motion graph');
for (const [state, recipe] of Object.entries(FOOTBALL_MOTION_RECIPES)) {
  assert.ok(recipe.base >= 0 && recipe.base < gltf.animations.length, `${state} must use a shipped base clip`);
  assert.ok(recipe.overlay === null || recipe.overlay >= 0 && recipe.overlay < gltf.animations.length, `${state} overlay must use a shipped clip`);
  assert.ok(recipe.overlayWeight >= 0 && recipe.overlayWeight <= .3, `${state} overlay must stay restrained`);
  assert.equal(motionRecipeForState(state), recipe);
}
assert.equal(meshyAnimationState({ role: 'WR', catchT: .3, catchStyle: 'aggressive' }, 'flight'), 'catch-aggressive');
assert.equal(meshyAnimationState({ role: 'RB', action: 'break-tackle' }, 'run'), 'break-tackle');
assert.equal(meshyAnimationState({ role: 'LB', action: 'miss' }, 'run'), 'miss');
assert.equal(meshyAnimationState({ role: 'QB', action: 'handoff' }, 'handoff'), 'handoff');
assert.equal(meshyAnimationState({ role: 'RB', action: 'receive-handoff' }, 'handoff'), 'receive-handoff');
assert.equal(meshyAnimationState({ role: 'QB', action: 'slide' }, 'dead'), 'slide');
assert.equal(meshyAnimationState({ role: 'OL', team: 0, engaged: true }, 'run'), 'drive-block');
assert.equal(meshyAnimationState({ role: 'OL', team: 0, engaged: true }, 'pass'), 'pass-set');
assert.equal(meshyAnimationState({ role: 'DL', team: 1, engaged: true }, 'run'), 'shed');
assert.equal(meshyAnimationState({ role: 'DL', team: 1, engaged: true }, 'pass'), 'rush-engaged');
assert.equal(meshyAnimationState({ role: 'QB', vx: 2, vz: 0 }, 'pass'), 'qb-drop');
assert.equal(meshyAnimationState({ role: 'WR', team: 0, vx: 5, vz: 0, motion: { turn: 1.4 } }, 'pass'), 'route-cut');
assert.equal(meshyAnimationState({ role: 'WR', team: 0, vx: 6, vz: 0, motion: { turn: .2 } }, 'pass'), 'route-release');
assert.equal(meshyAnimationState({ role: 'RB', team: 0, hasBall: true, vx: 8, vz: 0 }, 'run'), 'carry-sprint');
assert.equal(meshyAnimationState({ role: 'DB', team: 1, vx: 5, vz: 0 }, 'pass'), 'coverage');
assert.equal(meshyAnimationState({ role: 'DB', vx: 8, vz: 0 }, 'run'), 'sprint');
assert.equal(meshyAnimationState({ role: 'LB', action: 'big-hit' }, 'run'), 'big-hit');
assert.equal(meshyAnimationState({ role: 'LB', action: 'gang' }, 'run'), 'gang-tackle');
assert.equal(meshyAnimationState({ role: 'LB', action: 'wrap' }, 'run'), 'wrap-tackle');
assert.ok(meshyTransitionRate('run', 'big-hit') > meshyTransitionRate('run', 'route-release'), 'Contact must blend in faster than routine locomotion');

const rendererSource = readFileSync(new URL('../public/play-moment-3d/meshy-athlete.js', import.meta.url), 'utf8');
const gameSource = readFileSync(new URL('../public/play-moment-3d/game.js', import.meta.url), 'utf8');
assert.match(rendererSource, /weights\.x\*bones\[joints\.x\]/, 'The detailed model must use GPU skinning');
assert.match(rendererSource, /normalMap/, 'The detailed model must retain its normal map');
assert.match(rendererSource, /ormMap/, 'The detailed model must retain its roughness/metalness map');
assert.match(rendererSource, /using built-in players/, 'Asset or GPU failure must preserve the procedural fallback');
assert.match(rendererSource, /blendLocals\(p,locals,time,choice\.state\)/, 'Clip changes must use state-aware blending instead of snapping between poses');
assert.match(rendererSource, /mixLocals\(locals,this\.poseLocals/, 'Football recipes must layer shipped clips without another model download');
assert.match(rendererSource, /p\.reactionT>0/, 'Defenders need a visible reaction to nearby skill moves');
assert.match(rendererSource, /catch-'\+\(p\.catchStyle/, 'Catch choice must select a contextual animation state');
assert.match(rendererSource, /break-tackle/, 'Contact outcomes must select a contextual animation state');
assert.match(gameSource, /a\.action='handoff'.*b\.action='receive-handoff'/, 'The exchange must drive distinct quarterback and runner poses');
assert.match(gameSource, /d\.action=outcome\.type/, 'The tackler must receive the actual wrap, gang or big-hit state');
assert.match(gameSource, /updateSkillAction\(\)\{for\(const p of actors\)/, 'Every actor action must advance instead of freezing non-carriers on one frame');
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
  motionRecipes: Object.keys(FOOTBALL_MOTION_RECIPES).length,
  checks: 'reviewed binary asset, shared mobile topology, 27-bone GPU skinning budget, embedded PBR maps, twelve layered football recipes, role-varying cadence, distinct exchange/block/rush/route/carry/catch/contact states, state-aware transitions, skeleton football stances and procedural fallback',
}, null, 2));
