import {createDrillFootball} from './football.js';
import * as T from 'three';
import {loadCombineRunner} from './meshy-runner.js';
import {LINEBACKER,GOAL,WIDTH} from './rb-drill.js';
import {stepRouteCamera} from './route-camera.js';
export async function createRBPresentation(scene,runner,camera){
 const lb=await loadCombineRunner(LINEBACKER);scene.add(lb.root);const qb=await loadCombineRunner({id:'combine-rb-coach-18',name:'Marcus Reed',position:'QB',heightInches:75,weightLbs:220});scene.add(lb.root,qb.root);lb.root.name='rb-linebacker';qb.root.name='rb-handoff-qb';
 // Distinct opponent top; identity, build and hair are supplied by persistent player IDs.
 for(const [actor,tint]of [[lb,'vec3(.43,.055,.07)'],[qb,'vec3(.08,.23,.43)']])actor.root.traverse(o=>{if(!o.isSkinnedMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){const prev=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m);m.onBeforeCompile=shader=>{prev.call(m,shader);shader.vertexShader='varying vec3 rbPos;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nrbPos=(modelMatrix*vec4(position,1.)).xyz;');shader.fragmentShader='varying vec3 rbPos;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float neutral=1.-smoothstep(.03,.10,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b))-min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b)));
 diffuseColor.rgb=mix(diffuseColor.rgb,${tint},neutral*smoothstep(.85,.98,rbPos.y)*(1.-smoothstep(1.47,1.58,rbPos.y)));`);};m.customProgramCacheKey=()=>key()+'-rb-shirt-'+tint;m.needsUpdate=true;}});
 const ball=createDrillFootball('rb-football');scene.add(ball);
 const ring=new T.Mesh(new T.RingGeometry(.39,.44,32),new T.MeshBasicMaterial({color:'#f0cf7b',side:T.DoubleSide,transparent:true,opacity:.85}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;scene.add(ring);
 for(const x of [-WIDTH,WIDTH]){const line=new T.Mesh(new T.BoxGeometry(.10,.025,GOAL+3),new T.MeshBasicMaterial({color:'#e9ddc2'}));line.position.set(x,.025,GOAL/2);scene.add(line);}
 const goal=new T.Mesh(new T.BoxGeometry(WIDTH*2,.025,.16),new T.MeshBasicMaterial({color:'#f3cf7d'}));goal.position.set(0,.03,GOAL);scene.add(goal);
 const endzone=new T.Mesh(new T.PlaneGeometry(WIDTH*2,3),new T.MeshBasicMaterial({color:'#c8a654',transparent:true,opacity:.20}));endzone.rotation.x=-Math.PI/2;endzone.position.set(0,.015,GOAL+1.5);scene.add(endzone);
 let anchor={x:0,z:0},index=-1,lookAhead=.7;
 function draw(s,dt){
  if(s.index!==index||s.phase==='idle'){index=s.index;anchor={x:0,z:0};lookAhead=.7;}
  const hand=runner.poseRB(s,dt),age=s.clock-s.moveAt,spin=s.move==='spin'?T.MathUtils.smoothstep(age,0,.65)*Math.PI*2*s.moveSide:0;
  runner.root.rotation.y=s.heading+spin;runner.root.position.set(s.x,0,s.z);runner.root.updateMatrixWorld(true);
  lb.poseRB(s,dt,true);lb.root.rotation.y=s.db.heading;lb.root.position.set(s.db.x,0,s.db.z);
  if(s.result?.reason==='TACKLED'){const t=T.MathUtils.smoothstep(s.settle,0,.6);const dx=s.db.x-s.x,dz=s.db.z-s.z,n=Math.max(.01,Math.hypot(dx,dz));lb.root.position.set(s.x+dx/n*T.MathUtils.lerp(n,.78,t)+.18*t,0,s.z+dz/n*T.MathUtils.lerp(n,.78,t));lb.root.rotation.y=Math.atan2(-dx,-dz);}
  lb.root.updateMatrixWorld(true);
  const qhand=qb.poseHandoff(s.phase==='running'||s.phase==='settle'||s.phase==='result');qb.root.position.set(1,0,.05);qb.root.rotation.y=-Math.PI/2;qb.root.updateMatrixWorld(true);
  const start=qb.root.localToWorld(qhand.clone()),end=runner.root.localToWorld(hand.clone());
  const transfer=s.phase==='idle'||s.phase==='preview'?0:s.phase==='handoff'?T.MathUtils.smoothstep(s.handoff,.15,.55):1;
  ball.position.lerpVectors(start,end,transfer);ball.rotation.set(.15,T.MathUtils.lerp(-Math.PI/2,s.heading+spin,transfer),.3);ball.userData.owner=transfer<1?'quarterback':'runner';
  qb.root.visible=s.z<9;ring.position.set(s.x,.025,s.z);
  stepRouteCamera(anchor,s,dt);const portrait=camera.aspect<1;camera.position.set(anchor.x,portrait?7.0:6,anchor.z-(portrait?10.5:10));lookAhead+=((['idle','preview','handoff'].includes(s.phase)?.7:2)-lookAhead)*(1-Math.exp(-Math.min(.1,Math.max(0,dt))*5));camera.lookAt(anchor.x,1,anchor.z+lookAhead);
 }
 return {draw,dispose(){lb.dispose();qb.dispose();}};
}
