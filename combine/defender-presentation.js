import * as T from 'three';
import {loadCombineRunner} from './meshy-runner.js';
import {DEFENDER,manBall} from './man-coverage.js';
export async function createDefender(scene){
 const db=await loadCombineRunner(DEFENDER);db.root.name='man-coverage-defender';scene.add(db.root);
 // Separate immutable identity, burgundy training top and a dark compression sleeve.
 db.root.traverse(o=>{if(!o.isSkinnedMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){const before=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m);m.onBeforeCompile=shader=>{before.call(m,shader);shader.vertexShader=''+shader.vertexShader;shader.fragmentShader=''+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float neutral=1.-smoothstep(.04,.15,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.46,.055,.08)*(.5+dot(diffuseColor.rgb,vec3(.333))),neutral*smoothstep(.12,.35,dot(diffuseColor.rgb,vec3(.333))));`);};m.customProgramCacheKey=()=>cache()+'-man-db-burgundy';m.needsUpdate=true;}});
 db.root.updateMatrixWorld(true);
 const bones={};db.root.traverse(o=>{if(o.isBone)bones[o.name.replace('mixamorig','').replace(':','')]=o;});
 for(const [name,child,top,bottom] of [['RightArm','RightForeArm',.071,.057],['RightForeArm','RightHand',.056,.039]]){
  const bone=bones[name],end=bones[child].position.clone(),scale=bone.getWorldScale(new T.Vector3()).x;
  const sleeve=new T.Mesh(new T.CylinderGeometry(bottom/scale,top/scale,end.length()*.98,12),new T.MeshStandardMaterial({color:'#20242b',roughness:.9}));
  sleeve.name='DB compression sleeve';sleeve.position.copy(end).multiplyScalar(.5);sleeve.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.normalize());bone.add(sleeve);sleeve.castShadow=true;
 }
 const ring=new T.Mesh(new T.RingGeometry(.39,.44,32),new T.MeshBasicMaterial({color:'#e0806c',side:T.DoubleSide,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2;ring.position.y=.028;scene.add(ring);
 return {root:db.root,draw(s,dt){const d=s.db,b=s.phase==='flight'?manBall(s):[s.x,1.4,s.z];
 const hand=db.poseDefender({...d,phase:s.phase,clock:s.clock,arrival:s.arrival,settle:s.settle,intercepted:s.result?.intercepted,ball:b},dt);
 db.root.rotation.y=d.heading;db.root.position.set(d.x,0,d.z);db.root.updateMatrixWorld(true);ring.position.set(d.x,.028,d.z);ring.visible=s.phase==='idle'||s.phase==='preview';
 return db.root.localToWorld(hand.clone());},dispose(){db.dispose();}};
}
