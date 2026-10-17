import * as T from 'three';
import {loadCombineRunner} from './meshy-runner.js';
import {DEFENDER,manBall} from './man-coverage.js';
export async function createDefender(scene,player=DEFENDER){
 const db=await loadCombineRunner(player);db.root.name='man-coverage-defender';scene.add(db.root);
 // Separate immutable identity, burgundy training top and a dark compression sleeve.
 db.root.traverse(o=>{if(!o.isSkinnedMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){const before=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m);m.onBeforeCompile=shader=>{before.call(m,shader);shader.vertexShader='varying vec3 bkDBWorld;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nbkDBWorld=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='varying vec3 bkDBWorld;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec3 sourceColor=texture2D(map,vMapUv).rgb;
 float neutral=(1.-smoothstep(.018,.07,max(sourceColor.r,max(sourceColor.g,sourceColor.b))-min(sourceColor.r,min(sourceColor.g,sourceColor.b))))*smoothstep(.025,.06,dot(sourceColor,vec3(.333)));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.46,.055,.08)*(.5+dot(diffuseColor.rgb,vec3(.333))),neutral*smoothstep(.86,.96,bkDBWorld.y)*(1.-smoothstep(1.48,1.58,bkDBWorld.y)));`);};m.customProgramCacheKey=()=>cache()+'-man-db-burgundy';m.needsUpdate=true;}});
 db.root.updateMatrixWorld(true);
 const bones={};db.root.traverse(o=>{if(o.isBone)bones[o.name.replace('mixamorig','').replace(':','')]=o;});
 for(const [name,child,top,bottom] of [['RightArm','RightForeArm',.071,.057],['RightForeArm','RightHand',.056,.039]]){
  const bone=bones[name],end=bones[child].position.clone(),scale=bone.getWorldScale(new T.Vector3()).x;
  const sleeve=new T.Mesh(new T.CylinderGeometry(bottom/scale,top/scale,end.length()*.98,12),new T.MeshStandardMaterial({color:'#20242b',roughness:.9}));
  sleeve.name='DB compression sleeve';sleeve.position.copy(end).multiplyScalar(.5);sleeve.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.normalize());bone.add(sleeve);sleeve.castShadow=true;
 }
 const ring=new T.Mesh(new T.RingGeometry(.39,.44,32),new T.MeshBasicMaterial({color:'#e0806c',side:T.DoubleSide,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2;ring.position.y=.028;scene.add(ring);
 return {root:db.root,setAthlete:db.setAthlete,draw(s,dt){const d=s.db,b=s.ballContact||(s.phase==='flight'?manBall(s):[s.x,1.4,s.z]);
 const hand=db.poseDefender({...d,swatting:s.mode==='db'&&s.playChoice==='swat',catchStyle:b[1]>1.65?'high':b[1]<1.1?'low':'chest',attemptAllowed:s.mode!=='db'||!!s.playChoice,phase:s.phase,clock:s.clock,arrival:s.phase==='flight'&&s.db.ballAware?s.clock+Math.min(s.arrival-s.clock,Math.hypot(b[0]-d.x,b[2]-d.z)/10):s.arrival,settle:s.settle,intercepted:s.result?.intercepted,ball:b},dt);
 db.root.rotation.y=d.heading;db.root.position.set(d.x,0,d.z);db.root.updateMatrixWorld(true);ring.position.set(d.x,.028,d.z);ring.visible=s.mode==='db'||s.phase==='idle'||s.phase==='preview';if(s.mode==='db')ring.material.color.set('#f0cf7b');
 return db.root.localToWorld(hand.clone());},dispose(){db.dispose();}};
}
