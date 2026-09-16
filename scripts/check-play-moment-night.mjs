import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTorsoGeometry,createLimbGeometry} from '../public/play-moment-3d/geometry.js';
import {Renderer,GRAPHICS_TIERS,mul,identity,pose,point} from '../public/play-moment-3d/renderer.js';
import {bodyTypes,advanceMotion,samplePose,footTarget,twoBone} from '../public/play-moment-3d/motion.js';
for(const g of [createTorsoGeometry(),createLimbGeometry()]){
 assert.equal(g.v.length%8,0);assert.equal(g.ix.length%3,0);
 assert.ok(g.v.every(Number.isFinite));assert.ok(g.ix.every(i=>i>=0&&i<g.v.length/8));
 for(let i=0;i<g.v.length;i+=8)assert.ok(Math.abs(Math.hypot(...g.v.slice(i+3,i+6))-1)<1e-5);
}
for(const role of Object.keys(bodyTypes)){
 const p={role,index:5,x:0,z:0,heading:0};advanceMotion(p,0,'pre');
 for(let i=0;i<120;i++){p.z+=.1;advanceMotion(p,1/60,'run');const q=samplePose(p);
  for(const side of[-1,1]){const hip=[side*.141,q.pelvis,0],target=footTarget(q,side),leg=twoBone(hip,target,.5,.5);
   assert.ok(leg.joint.concat(leg.end).every(Number.isFinite));
   assert.ok(Math.abs(Math.hypot(...hip.map((v,k)=>v-leg.joint[k]))-.5)<1e-6);
  }
 }
 const before=[p.x,p.z,p.heading];samplePose(p);assert.deepEqual(before,[p.x,p.z,p.heading]);
}
const qualityState={quality:'balanced'};
for(const invalid of ['toString','__proto__','unknown',null]){Renderer.prototype.setQuality.call(qualityState,invalid);assert.equal(qualityState.quality,'balanced');}
assert.equal(GRAPHICS_TIERS.eco.shadow,0);assert.equal(GRAPHICS_TIERS.high.shadow,2048);
assert.ok(Object.values(GRAPHICS_TIERS).every(t=>t.dpr<=2&&t.shadow<=2048));
const rendererSource=readFileSync(new URL('../public/play-moment-3d/renderer.js',import.meta.url),'utf8');
assert.match(rendererSource,/this\.setQuality\('high'\)/,'The preview must always launch in High graphics');
assert.doesNotMatch(rendererSource,/installQualityControls/,'Graphics quality must not be player-selectable');
assert.deepEqual([...mul(identity(),pose(1,2,3))],[...pose(1,2,3)]);
assert.deepEqual(point(pose(1,2,3),[0,0,0]),[1,2,3]);
for(const f of ['renderer','athlete','geometry','stadium','game']){
 const s=readFileSync(new URL('../public/play-moment-3d/'+f+'.js',import.meta.url),'utf8');
 assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(s));
 assert.ok(!/\b(?:localStorage|sessionStorage)\b/.test(s));
}
console.log('PASS: finite normalized geometry, index bounds, eight-role pose/limb invariants, bounded quality settings, matrix API, no network or storage calls.');
