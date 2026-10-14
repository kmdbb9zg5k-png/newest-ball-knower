import * as T from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export function backgroundRig(source,seated,variant=0){
 const root=clone(source),bones={};root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.setScalar(1);root.traverse(o=>{if(o.isBone)bones[o.name.replace('mixamorig','').replace(':','')]=o;});root.updateMatrixWorld(true);
 const position=b=>b.getWorldPosition(v()),rotation=b=>b.getWorldQuaternion(new T.Quaternion());
 function aim(a,b,target){const before=position(b).sub(position(a)).normalize(),after=target.clone().sub(position(a)).normalize(),q=new T.Quaternion().setFromUnitVectors(before,after).multiply(rotation(a));a.quaternion.copy(rotation(a.parent).invert().multiply(q));root.updateMatrixWorld(true);}
 function solve(names,target,pole){const [a,b,c]=names.map(n=>bones[n]),origin=position(a),l1=position(b).distanceTo(origin),l2=position(c).distanceTo(position(b)),delta=target.clone().sub(origin),d=T.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.001,l1+l2-.001),axis=delta.normalize(),bend=pole.clone().sub(origin);bend.addScaledVector(axis,-bend.dot(axis)).normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),joint=origin.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));aim(a,b,joint);aim(b,c,origin.clone().addScaledVector(axis,d));}
 const originalHip=position(bones.Hips),hip=seated?.11:originalHip.y;
 bones.Hips.position.y+=(hip-originalHip.y)/bones.Hips.parent.getWorldScale(v()).y;
 bones.Spine.rotateX(seated?.10+variant*.025:.015);bones.Head.rotateX(variant%2?.06:.20);bones.Head.rotateY((variant-1)*.07);root.updateMatrixWorld(true);
 for(const [side,sign]of [['Left',-1],['Right',1]]){
  const foot=bones[side+'Foot'],footRotation=rotation(foot);
  if(seated)solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*(.13+variant*.012),-.36,.40+(sign===1?variant*.015:0)),v(sign*.2,.08,.9));
  foot.quaternion.copy(rotation(foot.parent).invert().multiply(footRotation));root.updateMatrixWorld(true);
  solve([side+'Arm',side+'ForeArm',side+'Hand'],v(sign===-1?-.13:.08,hip+.17,.34+(sign===1?.025:0)),v(sign*.45,hip-.08,.16));
 }
 root.updateMatrixWorld(true);root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});return {root,bones};
}
// Store region masks as colors so simplification preserves them. The masks are
// consumed by the background shader, never used as display vertex colors.
export function backgroundMasks(mesh){const g=mesh.geometry.clone(),weights=g.attributes.skinWeight,indices=g.attributes.skinIndex,colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<g.attributes.position.count;i++){let arms=0,legs=0,torso=0;for(let j=0;j<4;j++){const n=mesh.skeleton.bones[indices.getComponent(i,j)]?.name||'',w=weights.getComponent(i,j);if(/Arm|ForeArm/.test(n))arms+=w;if(/UpLeg|Leg$/.test(n))legs+=w;if(/Hips|Spine|Shoulder/.test(n))torso+=w;}colors[i*3]=arms;colors[i*3+1]=torso;colors[i*3+2]=legs;}g.setAttribute('color',new T.BufferAttribute(colors,3));return g;}
