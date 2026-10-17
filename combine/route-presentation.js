import * as T from 'three';
import {loadCombineRunner} from './meshy-runner.js';
import {CATCH_RADIUS} from './routes.js';
export async function createRoutePresentation(scene,runner,camera,host,player){
 const qb=await loadCombineRunner({id:'combine-quarterback-114',name:'Marcus • Passing Coach',position:'QB',heightInches:75,weightLbs:220});scene.add(qb.root);
 qb.root.traverse(o=>{if(!o.isSkinnedMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){const before=m.onBeforeCompile,cache=m.customProgramCacheKey.bind(m);m.onBeforeCompile=shader=>{before.call(m,shader);shader.vertexShader='varying vec3 bkQBPosition;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nbkQBPosition=(modelMatrix*vec4(transformed,1.)).xyz;');shader.fragmentShader='varying vec3 bkQBPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float grey=1.-smoothstep(.04,.15,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)));
 float shirt=grey*smoothstep(.88,.98,bkQBPosition.y)*(1.-smoothstep(1.48,1.57,bkQBPosition.y));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10,.32,.62)*(.45+dot(diffuseColor.rgb,vec3(.333))),shirt);`);};m.customProgramCacheKey=()=>cache()+'-route-coach-blue';m.needsUpdate=true;}});
 const ball=new T.Mesh(new T.SphereGeometry(.115,20,12),new T.MeshStandardMaterial({color:'#804320',roughness:.8}));ball.scale.set(.72,.72,1.65);scene.add(ball);ball.castShadow=true;
 const lace=new T.Mesh(new T.BoxGeometry(.025,.012,.14),new T.MeshBasicMaterial({color:'#fff4df'}));lace.position.y=.115;ball.add(lace);
 const halo=new T.Mesh(new T.RingGeometry(.17,.21,24),new T.MeshBasicMaterial({color:'#fff3c7',side:T.DoubleSide,depthTest:false,transparent:true,opacity:.8}));ball.add(halo);halo.renderOrder=4;
 const marker=new T.Mesh(new T.RingGeometry(.65,.70,40),new T.MeshBasicMaterial({color:'#eac979',side:T.DoubleSide,transparent:true,opacity:.6}));marker.rotation.x=-Math.PI/2;marker.position.y=.025;scene.add(marker);
 const routeGroup=new T.Group();scene.add(routeGroup);let routeIndex=-1,origin=new T.Vector3(3,1.6,-3);
 const qbPosition=new T.Vector3(3,0,-3),qbYaw=Math.atan2(-3,12);let cam=new T.Vector3(),look=new T.Vector3(),initialized=false;
 function draw(s,dt){
  if(s.index!==routeIndex){routeIndex=s.index;initialized=false;for(const o of [...routeGroup.children]){o.geometry.dispose();o.material.dispose();routeGroup.remove(o);}for(let i=1;i<s.route.points.length;i++){const a=s.route.points[i-1],b=s.route.points[i],dx=b[0]-a[0],dz=b[1]-a[1];const line=new T.Mesh(new T.BoxGeometry(.10,.015,Math.hypot(dx,dz)),new T.MeshBasicMaterial({color:'#efce7e',transparent:true}));line.position.set((a[0]+b[0])/2,.03,(a[1]+b[1])/2);line.rotation.y=Math.atan2(dx,dz);routeGroup.add(line);}const end=s.route.points.at(-1);marker.position.set(end[0],.025,end[1]);}
  const preview=s.phase==='idle'||s.phase==='preview';routeGroup.visible=s.phase==='preview'||s.phase==='running'&&s.clock<.35;for(const line of routeGroup.children)line.material.opacity=s.phase==='preview'?1:Math.max(0,1-s.clock/.35);marker.material.color.set(s.phase==='flight'?'#b8f397':'#eac979');marker.visible=s.phase==='preview'||s.phase==='flight';
  const hand=runner.poseReceiver(s,dt);
  runner.root.rotation.y=s.heading;runner.root.position.set(s.x,0,s.z);runner.root.updateMatrixWorld(true);
  const qbHand=qb.poseQuarterback(s.clock-s.throwAt);qb.root.position.copy(qbPosition);qb.root.rotation.y=qbYaw;qb.root.updateMatrixWorld(true);
  const qbGrip=qb.root.localToWorld(qbHand.clone());
  if(s.phase==='running'||preview||s.result?.reason==='ROUTE TIMEOUT'){ball.position.copy(qbGrip);origin.copy(qbGrip);}
  else if(s.result?.caught){ball.position.copy(runner.root.localToWorld(hand.clone()));}
  else{const end=s.route.points.at(-1),p=T.MathUtils.clamp((s.clock-s.throwAt)/s.flight,0,1);
   const height=s.catchStyle==='high'?1.9:s.catchStyle==='low'?.85:1.45;
   const target=new T.Vector3(end[0],height,end[1]);
   // A reachable, queued catch meets the hands without steering the runner.
   if(s.catchAt!==null&&Math.hypot(s.x-end[0],s.z-end[1])<=CATCH_RADIUS)target.lerp(runner.root.localToWorld(hand.clone()),T.MathUtils.smoothstep(p,.55,1));
   ball.position.lerpVectors(origin,target,p);ball.position.y+=Math.sin(Math.PI*p)*(s.flight>1.3?3.5:2.2);if(s.result)ball.position.y=Math.max(.14,height-s.settle*2.8);}
  ball.rotation.y+=dt*8;halo.visible=s.phase==='flight';halo.quaternion.copy(camera.quaternion);ball.visible=true;
  const portrait=camera.aspect<1;
  const framingX=portrait&&s.phase==='preview'&&Math.abs(s.route.points.at(-1)[0])>5?s.route.points.at(-1)[0]/2:0;
  const nextCam=new T.Vector3(s.x+framingX,portrait?7.5:6,s.z-(portrait?11:10));
  const nextLook=new T.Vector3(s.x+framingX,1,s.z+4);
  if(!initialized){cam.copy(nextCam);look.copy(nextLook);initialized=true;}else{const a=1-Math.exp(-dt*5);cam.lerp(nextCam,a);look.lerp(nextLook,a);}
  camera.position.copy(cam);camera.lookAt(look);
 }
 return {draw,dispose(){qb.dispose();}};
}
