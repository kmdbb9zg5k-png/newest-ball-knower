import * as T from 'three';
import {loadCombineRunner} from './meshy-runner.js';
import {createDefender} from './defender-presentation.js';
import {manBall} from './man-coverage.js';
import {newRouteCamera,stepRouteCamera} from './route-camera.js';
export async function createRoutePresentation(scene,runner,camera,host,player,man=false){
 const qb=await loadCombineRunner({id:'combine-quarterback-114',name:'Marcus • Passing Coach',position:'QB',heightInches:75,weightLbs:220});scene.add(qb.root);
 qb.root.traverse(o=>{if(!o.isSkinnedMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){const before=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m);m.onBeforeCompile=shader=>{before.call(m,shader);shader.vertexShader='varying vec3 bkQBPosition;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nbkQBPosition=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='varying vec3 bkQBPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float grey=1.-smoothstep(.04,.15,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)));
 float shirt=grey*smoothstep(.88,.98,bkQBPosition.y)*(1.-smoothstep(1.48,1.57,bkQBPosition.y));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10,.32,.62)*(.45+dot(diffuseColor.rgb,vec3(.333))),shirt);`);};m.customProgramCacheKey=()=>cache()+'-route-coach-blue';m.needsUpdate=true;}});
 const defender=man?await createDefender(scene):null;
 const ball=new T.Mesh(new T.SphereGeometry(.115,20,12),new T.MeshStandardMaterial({color:'#804320',roughness:.8}));ball.name='receiver-drill-football';ball.scale.set(.72,.72,1.65);scene.add(ball);ball.castShadow=true;
 const lace=new T.Mesh(new T.BoxGeometry(.025,.012,.14),new T.MeshBasicMaterial({color:'#fff4df'}));lace.position.y=.115;ball.add(lace);
 const halo=new T.Mesh(new T.RingGeometry(.17,.21,24),new T.MeshBasicMaterial({color:'#fff3c7',side:T.DoubleSide,depthTest:false,transparent:true,opacity:.8}));ball.add(halo);halo.renderOrder=4;
 const marker=new T.Mesh(new T.RingGeometry(.65,.70,40),new T.MeshBasicMaterial({color:'#eac979',side:T.DoubleSide,transparent:true,opacity:.6}));marker.rotation.x=-Math.PI/2;marker.position.y=.025;scene.add(marker);
 const routeGroup=new T.Group();scene.add(routeGroup);let routeIndex=-1,origin=new T.Vector3(3,1.6,-3),flightEnd=new T.Vector3(),flightStamp=null;
 const flightOrientation=new T.Quaternion(),heldOrientation=new T.Quaternion(),axis=new T.Vector3(0,0,1);
 const qbPosition=new T.Vector3(3,0,-3),qbYaw=Math.atan2(-3,12);let cameraAnchor=null;
 function draw(s,dt){
  if(s.index!==routeIndex){routeIndex=s.index;cameraAnchor=newRouteCamera(s.route,camera.aspect<1);for(const o of [...routeGroup.children]){o.geometry.dispose();o.material.dispose();routeGroup.remove(o);}for(let i=1;i<s.route.points.length;i++){const a=s.route.points[i-1],b=s.route.points[i],dx=b[0]-a[0],dz=b[1]-a[1];const line=new T.Mesh(new T.BoxGeometry(.10,.015,Math.hypot(dx,dz)),new T.MeshBasicMaterial({color:'#efce7e',transparent:true}));line.position.set((a[0]+b[0])/2,.03,(a[1]+b[1])/2);line.rotation.y=Math.atan2(dx,dz);routeGroup.add(line);}const end=s.route.points.at(-1);marker.position.set(end[0],.025,end[1]);}
  const preview=s.phase==='idle'||s.phase==='preview';routeGroup.visible=s.phase==='preview'||s.phase==='running'&&s.clock<.35;for(const line of routeGroup.children)line.material.opacity=s.phase==='preview'?1:Math.max(0,1-s.clock/.35);if(s.phase==='flight'&&s.ballTarget)marker.position.set(s.ballTarget[0],.025,s.ballTarget[1]);marker.material.color.set(s.phase==='flight'?'#b8f397':'#eac979');marker.visible=s.phase==='preview'||s.phase==='flight';
  const defenderHand=defender?.draw(s,dt);
  const hand=runner.poseReceiver(s,dt);
  runner.root.rotation.y=s.heading;runner.root.position.set(s.x,0,s.z);runner.root.updateMatrixWorld(true);
  const held=s.phase==='running'||preview||s.result?.reason==='ROUTE TIMEOUT';
  if(held)flightStamp=null;
  const throwTime=s.clock-s.throwAt;
  const qbHand=qb.poseQuarterback(held?(s.windupAt===null||s.windupAt===undefined?-.5:s.clock-s.windupAt-.22):throwTime);qb.root.position.copy(qbPosition);qb.root.rotation.y=qbYaw;qb.root.updateMatrixWorld(true);
  const qbGrip=qb.root.localToWorld(qbHand.clone());
  if(held&&man){const release=qb.poseQuarterback(0);qb.root.position.copy(qbPosition);qb.root.rotation.y=qbYaw;qb.root.updateMatrixWorld(true);s.ballOrigin=qb.root.localToWorld(release).toArray();qb.poseQuarterback(s.windupAt===null?-.5:s.clock-s.windupAt-.22);qb.root.position.copy(qbPosition);qb.root.rotation.y=qbYaw;qb.root.updateMatrixWorld(true);}
  if(held){
   ball.position.copy(qbGrip);ball.quaternion.setFromEuler(new T.Euler(.15,qbYaw,.3));ball.userData.owner='quarterback';
  }else{
   if(flightStamp!==s.throwAt){
    flightStamp=s.throwAt;
    const release=qb.poseQuarterback(0);qb.root.position.copy(qbPosition);qb.root.rotation.y=qbYaw;qb.root.updateMatrixWorld(true);origin.copy(qb.root.localToWorld(release));
    qb.poseQuarterback(throwTime);qb.root.position.copy(qbPosition);qb.root.rotation.y=qbYaw;qb.root.updateMatrixWorld(true);
    const end=s.ballTarget||s.route.points.at(-1),height=s.catchStyle==='high'?1.9:s.catchStyle==='low'?.85:1.45;
    flightEnd.set(end[0],height,end[1]);
    flightOrientation.setFromUnitVectors(axis,flightEnd.clone().sub(origin).normalize());
   }
   const p=T.MathUtils.clamp((s.clock-s.throwAt)/s.flight,0,1);
   const spin=new T.Quaternion().setFromAxisAngle(axis,p*s.flight*14);
   ball.quaternion.copy(flightOrientation).multiply(spin);
   if(man&&s.result?.intercepted){
    const contact=T.MathUtils.smoothstep(s.settle,0,.2);ball.position.fromArray(s.ballContact).lerp(defenderHand,contact);ball.quaternion.slerp(new T.Quaternion().setFromEuler(new T.Euler(.25,s.db.heading,.25)),contact);ball.userData.owner='defender';
   }else if(s.result?.caught){
    const contact=T.MathUtils.smoothstep(s.settle,0,.25);
    ball.position.lerpVectors(flightEnd,runner.root.localToWorld(hand.clone()),contact);
    heldOrientation.setFromEuler(new T.Euler(.25,s.heading,.25));ball.quaternion.slerp(heldOrientation,contact);ball.userData.owner='receiver';
   }else{
    ball.position.lerpVectors(origin,flightEnd,p);ball.position.y+=Math.sin(Math.PI*p)*(s.flight>1.3?3.5:2.2);
    if(man)ball.position.fromArray(manBall(s));
    if(s.result){if(man&&s.ballContact){ball.position.x+=s.settle*.7;ball.position.z+=s.settle*.4;}ball.position.y=Math.max(.14,(s.ballContact?.[1]??flightEnd.y)-s.settle*2.8);}
    ball.userData.owner=s.result?'ground':'flight';
   }
  }
  halo.visible=s.phase==='flight';halo.quaternion.copy(camera.quaternion);ball.visible=true;
  const portrait=camera.aspect<1;
  stepRouteCamera(cameraAnchor,s,dt);
  camera.position.set(cameraAnchor.x,portrait?7.5:6,cameraAnchor.z-(portrait?11:10));
  camera.lookAt(cameraAnchor.x,1,cameraAnchor.z+4);
 }
 return {draw,dispose(){defender?.dispose();qb.dispose();}};
}
