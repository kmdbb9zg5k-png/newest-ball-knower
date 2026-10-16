import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {backgroundMasks} from './background-rig.js';
import {createPlayerAppearance} from './player-appearance.js';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const profiles=[
 {id:'combine-observer-0',name:'Marcus',position:'WR',spot:[4.1,0,1.15],scale:[.94,1.02,.94]},
 {id:'combine-observer-3',name:'Owen',position:'TE',spot:[5.25,0,2.7],scale:[1.12,1.08,1.07]},
 {id:'combine-observer-10',name:'Andre',position:'RB',spot:[4.35,0,4.5],scale:[1.03,.95,1.04]},
];

export function createWatchingAthlete(source,index){
 const profile=profiles[index],root=clone(source),bones={},materials=new Map();
 root.name=`waiting-athlete-${index+1}`;root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);
 // Each observer owns its materials and hair. Never inherit a live player's
 // shader closures or dispose geometry still used by the selected athlete.
 const inheritedHair=root.getObjectByName('CombineHair');inheritedHair?.removeFromParent();
 root.traverse(o=>{
  if(o.isBone)bones[o.name.replace('mixamorig','').replace(':','')]=o;
  if(o.isSkinnedMesh)o.geometry=backgroundMasks(o);
  if(o.isMesh){o.castShadow=false;o.frustumCulled=false;const copy=m=>{if(!materials.has(m)){const next=m.clone();next.onBeforeCompile=()=>{};next.customProgramCacheKey=()=> 'observer-base';materials.set(m,next);}return materials.get(m);};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);}
 });
 const appearance=createPlayerAppearance(root,bones);appearance.apply(profile);
 const reference=new T.Color('#b17b4b');
 for(const material of materials.values()){
  const skinShader=material.onBeforeCompile;material.vertexColors=true;
  material.onBeforeCompile=shader=>{
   skinShader(shader);
   shader.vertexShader='varying float observerArm;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nobserverArm=color.r;');
   shader.fragmentShader='varying float observerArm;\n'+shader.fragmentShader.replace('#include <color_fragment>','').replace('#include <map_fragment>',`#include <map_fragment>
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${reference.r},${reference.g},${reference.b}),smoothstep(.03,.12,observerArm));`);
  };
  material.customProgramCacheKey=()=> 'observer-clean-skin-v3';material.needsUpdate=true;
 }
 // Subtle skull proportions and distinct builds complement independent hair,
 // facial hair and skin; all retain the same Combine uniform.
 bones.Head.scale.multiply(v([.96,1.06,1.02][index],[1.04,.98,.95][index],[1,.98,1.04][index]));
 root.position.fromArray(profile.spot);root.scale.fromArray(profile.scale);
 const base=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.quaternion.clone()]));
 const position=b=>b.getWorldPosition(v()),rotation=b=>b.getWorldQuaternion(new T.Quaternion());
 function aim(a,b,target){const q=new T.Quaternion().setFromUnitVectors(position(b).sub(position(a)).normalize(),target.clone().sub(position(a)).normalize()).multiply(rotation(a));a.quaternion.copy(rotation(a.parent).invert().multiply(q));root.updateMatrixWorld(true);}
 function arm(side,target,pole){
  const a=bones[side+'Arm'],b=bones[side+'ForeArm'],c=bones[side+'Hand'];
  const origin=position(a),l1=position(b).distanceTo(origin),l2=position(c).distanceTo(position(b)),delta=target.clone().sub(origin),d=T.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.001,l1+l2-.001),axis=delta.normalize(),bend=pole.clone().sub(origin);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),joint=origin.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  aim(a,b,joint);aim(b,c,origin.clone().addScaledVector(axis,d));
  const tip=bones[side+'HandMiddle4'];if(tip)aim(c,tip,position(c).add(root.localToWorld(v(0,.16,.025)).sub(root.position)));
 }
 let applause=0;
 function update(time,dt,target,reactionAge){
  const desired=Math.atan2(target.x-root.position.x,target.z-root.position.z);
  const turn=Math.atan2(Math.sin(desired-root.rotation.y),Math.cos(desired-root.rotation.y));
  root.rotation.y+=turn*(1-Math.exp(-dt*5));
  for(const [n,b]of Object.entries(bones))b.quaternion.copy(base[n]);
  bones.Spine2.rotateZ(Math.sin(time*.65+index*2)*.012);
  bones.Head.rotateY(Math.sin(time*.4+index)*.025);
  const delay=.25+index*.18,clapping=reactionAge>delay&&reactionAge<delay+3.5;
  applause=T.MathUtils.damp(applause,clapping?1:0,9,dt);
  root.userData.clapping=applause>.1;
  root.updateMatrixWorld(true);
  for(const [side,sign]of [['Left',1],['Right',-1]]){
   // Hands on hips, loosely clasped hands, and one hand on the hip.
   const idle=index===0?v(sign*.32,1.04,.17):index===1?v(sign*.07,.96,.32):v(sign*.32,side==='Left'?1.04:.80,side==='Left'?.17:.16);
   const gap=.045+.12*(.5+.5*Math.cos((Number.isFinite(reactionAge)?Math.max(0,reactionAge-delay):0)*(5.8+index*.35)*Math.PI));
   const clap=v(sign*gap,1.26,.34);
   const hand=idle.lerp(clap,applause),pole=v(sign*.46,.97,.13);
   arm(side,root.localToWorld(hand),root.localToWorld(pole));
  }
 }
 update(0,1,v(0,0,0),-1);
 return {root,update,dispose(){appearance.dispose();root.traverse(o=>o.skeleton?.dispose());}};
}
