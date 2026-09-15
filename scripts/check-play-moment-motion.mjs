import assert from 'node:assert/strict';
import {advanceMotion,samplePose,footTarget,twoBone,bodyTypes} from '../public/play-moment-3d/motion.js';
function actor(role='WR'){return {x:0,z:0,heading:0,index:7,role,engaged:false,fallen:false,throwT:0,catchT:0}}
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
for(const role of Object.keys(bodyTypes)){
 const p=actor(role);advanceMotion(p,0,'pre');const pre=samplePose(p);near(pre.ready,1);
 for(let i=0;i<120;i++){p.z+=6/60;advanceMotion(p,1/60,'run')}
 const q=samplePose(p);assert.ok(q.drive>.95);assert.ok(q.ready<1e-6);assert.ok(p.motion.speed>5.9);
 const rootBefore=[p.x,p.z,p.heading];samplePose(p);footTarget(q,1);footTarget(q,-1);assert.deepEqual([p.x,p.z,p.heading],rootBefore);
 for(let i=0;i<90;i++)advanceMotion(p,1/60,'dead');const stopped=samplePose(p);assert.ok(stopped.drive<1e-4);
 const gait=p.motion.gait;for(let i=0;i<90;i++)advanceMotion(p,1/60,'dead');near(gait,p.motion.gait);
 for(const phase of ['pre','pass','flight','run','dead']){
  advanceMotion(p,1/60,phase);const q=samplePose(p);for(let i=0;i<180;i++){
   q.gait=i*.04;for(const side of[-1,1]){const foot=footTarget(q,side),hip=[side*.14,q.pelvis,0],leg=twoBone(hip,foot,.5,.5);
    assert.ok(foot[1]>=.085-1e-8);for(const value of leg.joint.concat(leg.end))assert.ok(Number.isFinite(value));
    near(Math.hypot(...hip.map((x,i)=>x-leg.joint[i])),.5);near(Math.hypot(...leg.end.map((x,i)=>x-leg.joint[i])),.5);
   }
  }
 }
}
const line=actor('OL');advanceMotion(line,0,'pre');const receiver=actor('WR');advanceMotion(receiver,0,'pre');assert.ok(samplePose(line).pelvis<samplePose(receiver).pelvis);assert.ok(samplePose(line).build.width>samplePose(receiver).build.width);
const blocking=actor('OL');blocking.engaged=true;for(let i=0;i<30;i++)advanceMotion(blocking,1/60,'pass');assert.ok(samplePose(blocking).block>.99);
const q=actor('QB');advanceMotion(q,0,'pass');q.throwT=.001;for(let i=0;i<8;i++)advanceMotion(q,1/60,'flight');assert.ok(samplePose(q).throwWeight>.3);for(let i=0;i<40;i++)advanceMotion(q,1/60,'flight');near(samplePose(q).throwWeight,0);
q.fallen=true;const original=[q.x,q.z];advanceMotion(q,1/60,'dead');assert.ok(q.motion.fall>0&&q.motion.fall<.3);for(let i=0;i<60;i++)advanceMotion(q,1/60,'dead');assert.ok(q.motion.fall>.99);assert.deepEqual([q.x,q.z],original);
// Dampening is independent of the render frame rate when sampling a uniform run.
const a=actor(),b=actor();advanceMotion(a,0,'run');advanceMotion(b,0,'run');
for(let i=0;i<60;i++){a.z+=.1;advanceMotion(a,1/60,'run')}
for(let i=0;i<30;i++){b.z+=.2;advanceMotion(b,1/30,'run')}
near(a.motion.speed,b.motion.speed);near(a.motion.gait,b.motion.gait);
console.log('PASS: eight body types, pose blending, gait stop, coordinate isolation, foot targets, two-bone segment lengths, block/throw/fall and frame-rate invariance.');
