import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const read=(path:string)=>readFileSync(join(root,path),'utf8');
const html=read('public/franchise-play-moment-v3.html');
const renderer=read('public/franchise-play-moment-v3-3d.js');
const css=read('public/franchise-play-moment-v3-3d.css');
const gameplay=read('public/franchise-play-moment-v3.js');

assert.match(html,/franchise-play-moment-v3-3d\.css/,'3D stylesheet is loaded');
assert.doesNotMatch(html,/type="importmap"/,'brittle runtime import map was removed');
assert.match(html,/defer src="\/franchise-play-moment-v3-3d\.bundle\.js"/,'self-contained 3D bundle is loaded');
assert.match(renderer,/new THREE\.WebGLRenderer/,'renderer creates a WebGL surface');
assert.equal((renderer.match(/new THREE\.WebGLRenderer/g)||[]).length,1,'gameplay uses one shared WebGL renderer');
assert.match(renderer,/cloneSkinned\(source\)/,'skinned model is safely cloned for each athlete');
assert.match(renderer,/document\.body\.dataset\.bk3d='fallback'/,'2D fallback is retained');
for(const action of ['idle','running','sprint','throw','catch','block','tackle','celebrate']){
  assert.match(renderer,new RegExp(`${action}:clips\\[`),`${action} animation is mapped`);
}
assert.match(css,/pointer-events:none/,'3D layer cannot block gameplay input');
assert.match(css,/data-bk3d="ready"/,'portraits hide only after successful 3D setup');
assert.doesNotMatch(css,/data-bk-3d/,'CSS reads the same data attribute written by the renderer');
assert.match(gameplay,/bk-sprinting/,'sprint state is exposed to the animation renderer');

const bundle=read('public/franchise-play-moment-v3-3d.bundle.js');
assert.ok(bundle.length>400_000,'self-contained Three.js runtime bundle is present');
assert.doesNotMatch(bundle,/^\s*import\s/m,'runtime bundle has no unresolved module imports');

const modelPath=join(root,'public/models/gridiron-gold-player.glb');
const model=readFileSync(modelPath);
assert.ok(statSync(modelPath).size>9_000_000,'complete textured GLB is present');
assert.equal(model.toString('ascii',0,4),'glTF','asset is a binary glTF');
const jsonLength=model.readUInt32LE(12);
const jsonType=model.readUInt32LE(16);
assert.equal(jsonType,0x4e4f534a,'first GLB chunk is JSON');
const gltf=JSON.parse(model.toString('utf8',20,20+jsonLength).replace(/\0+$/,''));
assert.ok((gltf.skins?.length||0)>=1,'model contains a rig');
assert.ok((gltf.skins?.[0]?.joints?.length||0)>=27,'model has a complete biped skeleton');
assert.ok((gltf.animations?.length||0)>=11,'model contains the full animation set');
assert.ok((gltf.images?.length||0)>=3,'model contains embedded textures');

console.log('Gameplay 3D check passed: one renderer, fallback intact, rig + 11 animation clips verified.');
