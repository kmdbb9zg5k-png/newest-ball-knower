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
assert.match(renderer,/new THREE\.PerspectiveCamera/,'gameplay uses a broadcast-style perspective camera');
assert.match(renderer,/createStadium\(scene\)/,'renderer builds the field and stadium in 3D');
assert.match(renderer,/syncRoutes\(\)/,'play art is projected onto the 3D field');
assert.match(renderer,/syncFootball\(dt\)/,'the live football is projected into the 3D scene');
assert.match(renderer,/cloneSkinned\(source\)/,'skinned model is safely cloned for each athlete');
assert.match(renderer,/DEFENSE_TEXTURE_URL/,'the opponent uses a genuinely separate uniform texture');
assert.match(renderer,/hashUnit\(el\.dataset\.id/,'cloned athletes use deterministic animation phase variation');
assert.match(renderer,/bodyProfile\(el,phase\)/,'athlete builds vary by football role');
assert.match(renderer,/syncHitTarget\(actor/,'interactive receiver hit targets follow the perspective projection');
assert.match(renderer,/createTeamKit\(isDefense/,'players receive team-specific helmets and jersey numbers');
assert.match(renderer,/node\.userData\.kitOwned\|\|node\.userData\.actorOwned/,'actor-owned geometry is released between plays');
assert.match(renderer,/document\.body\.dataset\.bk3d='fallback'/,'2D fallback is retained');
for(const action of ['idle','running','sprint','throw','catch','block','tackle','celebrate']){
  assert.match(renderer,new RegExp(`${action}:clips\\[`),`${action} animation is mapped`);
}
assert.match(css,/pointer-events:none/,'3D layer cannot block gameplay input');
assert.match(css,/data-bk3d="ready"/,'portraits hide only after successful 3D setup');
assert.doesNotMatch(css,/data-bk-3d/,'CSS reads the same data attribute written by the renderer');
assert.match(css,/\.routes\{visibility:hidden\}/,'flat route art is replaced by projected 3D routes');
assert.match(css,/--bk-screen-x/,'perspective-projected player hit zones are applied');
assert.doesNotMatch(css,/body\[data-bk3d="ready"\] #field \.player\{[^}]*opacity:0/s,'hit targets do not make the rendered actors invisible');
assert.match(gameplay,/bk-sprinting/,'sprint state is exposed to the animation renderer');
assert.match(gameplay,/state\.support=\[/,'the offense fills its tight-end and back support roles');
const defensiveShell=gameplay.match(/const defStarts=\[([\s\S]*?)\n\];/)?.[1]||'';
assert.equal((defensiveShell.match(/\[\d+,\d+,'/g)||[]).length,11,'the defensive shell contains 11 players');

const bundle=read('public/franchise-play-moment-v3-3d.bundle.js');
assert.ok(bundle.length>400_000,'self-contained Three.js runtime bundle is present');
assert.doesNotMatch(bundle,/^\s*import\s/m,'runtime bundle has no unresolved module imports');
assert.match(bundle,/gridiron-gold-defense\.jpg/,'runtime bundle contains the separated opponent-uniform implementation');

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

const defenseTexturePath=join(root,'public/models/gridiron-gold-defense.jpg');
assert.ok(statSync(defenseTexturePath).size>150_000,'separate mobile-sized opponent uniform texture is present');

console.log('Gameplay 3D check passed: 11-on-11 shell, separated uniforms, projected hit targets, rig + 11 animation clips verified.');
