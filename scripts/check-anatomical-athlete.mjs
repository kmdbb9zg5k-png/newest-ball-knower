/** Validate the replacement anatomy against the previously shipped motion rig. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseGLB} from '../public/play-moment-3d/meshy-athlete.js';
const read=name=>{const b=readFileSync(new URL('../public/play-moment-3d/assets/'+name,import.meta.url));return{bytes:b.length,...parseGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))}};
const before=read('ball-knower-gridiron-sentinel-v4.glb'),after=read('ball-knower-anatomical-athlete-v6.glb');
assert.deepEqual(after.json.nodes,before.json.nodes);
assert.deepEqual(after.json.skins[0].joints,before.json.skins[0].joints);
assert.deepEqual(after.accessor(after.json.skins[0].inverseBindMatrices),before.accessor(before.json.skins[0].inverseBindMatrices));
assert.equal(after.json.animations.length,8);
for(let i=0;i<8;i++){
 const a=after.json.animations[i],b=before.json.animations[i];assert.equal(a.name,b.name);assert.deepEqual(a.channels,b.channels);
 for(let j=0;j<a.samplers.length;j++)for(const key of ['input','output'])assert.deepEqual(after.accessor(a.samplers[j][key]),before.accessor(b.samplers[j][key]));
}
const p=after.json.meshes[0].primitives[0],positions=after.accessor(p.attributes.POSITION),normals=after.accessor(p.attributes.NORMAL),weights=after.accessor(p.attributes.WEIGHTS_0),joints=after.accessor(p.attributes.JOINTS_0),regions=after.accessor(p.attributes._EQUIPMENT),indices=after.accessor(p.indices);
assert.ok(positions.every(Number.isFinite)&&normals.every(Number.isFinite));assert.ok(indices.every(i=>i<regions.length));
for(let i=0;i<regions.length;i++){assert.ok(Math.abs(weights.subarray(i*4,i*4+4).reduce((a,b)=>a+b,0)-1)<.001);assert.ok(joints.subarray(i*4,i*4+4).every(j=>j<28));}
assert.deepEqual([...new Set(regions)].sort((a,b)=>a-b),[1,2,3,4,6,7,8,9,10,11,12]);
assert.ok(indices.length/3<45000);assert.ok(after.bytes<3000000);assert.equal(after.json.extras.ballKnowerAthlete.sourceRevision,'a8bc2d54ff0ac92e78ff71431b1023eda42bf482');
const feet=[];for(let i=0;i<regions.length;i++)if(regions[i]===11)feet.push(positions[i*3+1]);assert.ok(Math.min(...feet)<.015);
console.log(JSON.stringify({status:'PASS',bytes:after.bytes,vertices:regions.length,triangles:indices.length/3,animationClipsPreserved:8,materialRegions:11}));
