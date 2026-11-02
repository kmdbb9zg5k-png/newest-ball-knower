import {loadCombineAsset,invalidateCombineAsset} from './asset-loading.js';
import * as T from 'three';
import {createWatchingAthlete} from './background-athlete.js';
const SKINS=['#ae764e','#ceaa88','#684330','#986340'];
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export async function createCombineBackground(scene,source,{fieldPeople=true,standOffset=0}={}){
 const url='/play-moment-3d/assets/combine-scout-poses-v1.json.gz';
 let poses;
 try {
  const bytes=new Uint8Array(await loadCombineAsset(url));
  const text=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
  poses=JSON.parse(text);
 } catch(error) {invalidateCombineAsset(url);throw error;}
 const loader=new T.BufferGeometryLoader(),group=new T.Group();group.name='combine-background-people';scene.add(group);
 let sourceMaterial;source.traverse(o=>{if(o.isSkinnedMesh&&!sourceMaterial)sourceMaterial=Array.isArray(o.material)?o.material[0]:o.material;});
 const regionShader=shader=>{shader.vertexShader='varying vec3 bkRegion;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbkRegion=color;');shader.fragmentShader='varying vec3 bkRegion;\n'+shader.fragmentShader.replace('#include <color_fragment>','');};
 function scoutMaterial(index){const m=new T.MeshStandardMaterial({map:sourceMaterial.map,roughness:.91,vertexColors:true});
  m.onBeforeCompile=shader=>{regionShader(shader);const tint=new T.Color(SKINS[index]),reference=new T.Color('#b17b4b');shader.uniforms.bkTint={value:v(tint.r/reference.r,tint.g/reference.g,tint.b/reference.b)};shader.uniforms.bkShirt={value:new T.Color(['#2f414c','#565e69','#514c41','#263a34'][index])};shader.uniforms.bkPants={value:new T.Color(index%2?'#5c584b':'#252c32')};shader.fragmentShader='uniform vec3 bkTint;uniform vec3 bkShirt;uniform vec3 bkPants;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float sleeve=smoothstep(.20,.65,bkRegion.r);
   float shirt=max(smoothstep(.35,.70,bkRegion.g),sleeve);
   float pants=smoothstep(.25,.65,bkRegion.b);
   float fabric=.9+.1*dot(diffuseColor.rgb,vec3(.333));
   diffuseColor.rgb*=bkTint;
   diffuseColor.rgb=mix(diffuseColor.rgb,bkShirt*fabric,shirt);
   diffuseColor.rgb=mix(diffuseColor.rgb,bkPants*fabric,pants);`);};m.customProgramCacheKey=()=> 'combine-scout-clothing-v2';return m;
 }
 const scouts=[];
 const clusters=[[0,1,7],[2,6,7],[4,5,12],[3,10,11]];
 for(const side of [-1,1])for(let row=0;row<4;row++)for(const col of clusters[row])scouts.push({x:side*(11+standOffset+row*.9),y:row*.62+.83,z:col*.86-3,angle:side<0?Math.PI/2:-Math.PI/2,variant:scouts.length%3,seated:true});
 if(fieldPeople)for(let i=0;i<3;i++)scouts.push({x:6.6+i*.65,y:0,z:2.2+i*1.2,angle:-Math.PI/2+(i-1)*.16,variant:3,seated:false});
 const batches=poses.map((pose,index)=>{const people=scouts.filter(s=>s.variant===index);return {people,meshes:pose.geometries.map(json=>{const geometry=loader.parse(json),batch=new T.InstancedMesh(geometry,scoutMaterial(index),people.length);batch.name=`scout-detailed-${index}`;batch.frustumCulled=false;batch.receiveShadow=true;group.add(batch);return batch;})};});
 const material=new T.MeshStandardMaterial({color:'#5f4c33',roughness:.9}),paperMaterial=new T.MeshStandardMaterial({color:'#d8dbcf',roughness:1}),penMaterial=new T.MeshStandardMaterial({color:'#16232e'});
 const boards=new T.InstancedMesh(new T.BoxGeometry(.29,.016,.23),material,scouts.length),paper=new T.InstancedMesh(new T.BoxGeometry(.25,.005,.20),paperMaterial,scouts.length),pens=new T.InstancedMesh(new T.CylinderGeometry(.005,.005,.09,6),penMaterial,scouts.length);boards.name='scout-clipboards';pens.name='scout-pens';group.add(boards,paper,pens);for(const m of[boards,paper,pens])m.frustumCulled=false;
 const dummy=new T.Object3D(),local=new T.Object3D(),matrix=new T.Matrix4();
 function personMatrix(s,index,time){dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(Math.sin(time*.3+index)*.006,s.angle+(index%3-1)*.04,0);dummy.scale.set(.9+(index%5)*.055,.95+(index%4)*.035,.94+(index%3)*.055);dummy.updateMatrix();}
 function prop(mesh,i,p,size,angle){local.position.set(...p);local.rotation.set(angle,0,0);local.scale.set(...size);local.updateMatrix();matrix.multiplyMatrices(dummy.matrix,local.matrix);mesh.setMatrixAt(i,matrix);}
 function updateScouts(time){for(const {people,meshes}of batches){people.forEach((s,i)=>{personMatrix(s,scouts.indexOf(s),time);for(const m of meshes)m.setMatrixAt(i,dummy.matrix);});for(const m of meshes)m.instanceMatrix.needsUpdate=true;}
  scouts.forEach((s,i)=>{personMatrix(s,i,time);const hip=s.seated?.11:.98,note=Math.sin(time*2+i)*.01;prop(boards,i,[0,hip+.13,.35],[1,1,1],-.08);prop(paper,i,[0,hip+.142,.35],[1,1,1],-.08);prop(pens,i,[.08+note,hip+.205,.37+note],[1,1,1],-.3);});for(const m of[boards,paper,pens])m.instanceMatrix.needsUpdate=true;
 }
 const waiting=Array.from({length:fieldPeople?3:0},(_,i)=>{const person=createWatchingAthlete(source,i);group.add(person.root);return person;});
 let time=0,last=-1,previousPhase='idle',reactionStart=-Infinity;
 function update(dt,state={},target=v()){
  dt=Number.isFinite(dt)?T.MathUtils.clamp(dt,0,.1):0;time+=dt;
  if(state.phase==='idle'||state.phase==='power'||state.phase==='running')reactionStart=-Infinity;
  // Landed is the jump's completion; finished is the sprint's completion.
  // A timed-out jump has zero distance and must not trigger applause.
  if((state.phase==='landed'&&previousPhase!=='landed')||(state.phase==='finished'&&previousPhase!=='finished'&&previousPhase!=='landed'&&state.distance>0))reactionStart=time;
  previousPhase=state.phase;
  if(time-last<1/30)return;const step=last<0?dt:time-last;last=time;
  updateScouts(time);waiting.forEach(person=>person.update(time,step,target,time-reactionStart));
 }
 updateScouts(0);group.userData={scouts:scouts.length,waitingAthletes:waiting.length,detailedScouts:true,cleanArms:true,reactiveAthletes:true};
 return {update,counts:group.userData,dispose(){for(const person of waiting)person.dispose();}};
}
