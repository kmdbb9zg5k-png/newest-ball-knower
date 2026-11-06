import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createPlayerAppearance,combineAppearance} from '../combine/player-appearance.js';

// Inspect the shipped native mesh, bones and generated strands without a GPU.
// Only image decoding is omitted; no geometry or animation data is substituted.
const bytes=await readFile(new URL('../public/play-moment-3d/assets/combine-native-athlete-v1.glb',import.meta.url));
const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength));
const binary=bytes.subarray(28+jsonLength);
json.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');
delete json.images;delete json.textures;
json.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];
for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0;
globalThis.ProgressEvent??=class{constructor(type,values){Object.assign(this,{type},values)}};
const load=async()=>{
 const {scene:body}=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
 const bones={};body.traverse(object=>{if(object.isBone)bones[object.name.replace('mixamorig','').replace(':','')]=object;});
 const appearance=createPlayerAppearance(body,bones),hair=body.getObjectByName('CombineHair');
 return {body,hair,appearance};
};
const custom={skinTone:'rich brown',hairStyle:'short curls',hairColor:'black',facialHair:'clean shaven',tattooCoverage:'none',tattooArms:'right',tattooStyle:'blackwork'};
const player=id=>({id,name:'Identity check',position:'WR',athleteAppearance:{...custom}});
const a=player('my-player-stable-hair-a'),b=player('my-player-stable-hair-b');
assert.notEqual(combineAppearance(a).identitySeed,combineAppearance(b).identitySeed);
const fingerprint=hair=>{
 const hash=createHash('sha256');
 hair.traverse(object=>{if(object.geometry){for(const attribute of Object.values(object.geometry.attributes))hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));if(object.instanceMatrix)hash.update(Buffer.from(object.instanceMatrix.array.buffer));}});
 return hash.digest('hex');
};
const live=await load(),fresh=await load();
live.appearance.apply(a);const original=fingerprint(live.hair);
live.appearance.apply(b);fresh.appearance.apply(b);
assert.equal(fingerprint(live.hair),fingerprint(fresh.hair),'An athlete must have the same strands after selection as on a fresh load');
assert.notEqual(fingerprint(live.hair),original,'Different immutable identities must receive their own seeded strands');
live.appearance.apply(a);assert.equal(fingerprint(live.hair),original,'A → B → A must restore the original hair exactly');
const originalParts=[...live.hair.children];
let disposed=0;for(const part of originalParts)part.geometry.addEventListener('dispose',()=>disposed++);
const begin=performance.now();
for(let edit=0;edit<40;edit++)live.appearance.apply({...a,team:'OTHER',name:'Renamed',speed:50,athleteAppearance:{...custom,skinTone:edit%2?'fair':'rich brown',tattooCoverage:edit%2?'full-sleeve':'none',tattooArms:edit%2?'both':'right'}});
const editMs=performance.now()-begin;
const discardedHairGeometries=disposed;
assert.equal(disposed,0,'Skin and tattoo edits must not discard unchanged hair geometry');
assert.deepEqual(live.hair.children,originalParts,'Unchanged hair parts must survive appearance edits');
const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>'};
let material;live.body.traverse(object=>{if(object.isSkinnedMesh)material=object.material;});material.onBeforeCompile(shader);
assert.equal(shader.uniforms.bkTattooCoverage.value,5,'Tattoo uniforms still update while strands are reused');
assert.equal(shader.uniforms.bkTattooArms.value,2);
const seedAlias={...a,id:'temporary-roster-id',cosmeticIdentityId:a.id};
live.appearance.apply(seedAlias);assert.equal(fingerprint(live.hair),original,'Roster aliases preserve the cosmetic identity seed');
live.appearance.dispose();fresh.appearance.dispose();
console.log(JSON.stringify({status:'PASS',asset:'combine-native-athlete-v1.glb',checks:['fresh-load identity','A → B → A','cosmetic identity aliases','skin/tattoo uniform updates','no strand allocations during 40 skin/tattoo edits'],editMs,discardedHairGeometries}));
