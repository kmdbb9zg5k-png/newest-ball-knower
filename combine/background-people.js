import * as T from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Sparse evaluation groups, not a cheering game-day crowd. Shared instanced
// geometry keeps the seated spectators inexpensive on mobile.
export function createCombineBackground(scene, source) {
  const group=new T.Group();group.name='combine-background-people';scene.add(group);
  const scouts=[];
  for(const side of [-1,1])for(let row=0;row<4;row++)for(let col=0;col<9;col++){
    if((col+row)%3===0)continue;
    scouts.push({x:side*(11+row*.9),y:row*.62+.83,z:(col*2+row%2)*.86-1.28,angle:side<0?Math.PI/2:-Math.PI/2,seed:scouts.length,seated:true});
  }
  for(let i=0;i<3;i++)scouts.push({x:6.5+i*.6,y:0,z:2.5+i*1.1,angle:-Math.PI/2,seed:scouts.length,seated:false});
  const material=new T.MeshStandardMaterial({roughness:.9});
  const sphere=new T.SphereGeometry(1,10,7),cube=new T.BoxGeometry(1,1,1),limb=new T.CylinderGeometry(1,1,1,7);
  const parts={neck:[limb,1],head:[sphere,1],hair:[sphere,1],body:[cube,1],legs:[limb,4],arms:[limb,4],hands:[sphere,2],shoes:[cube,2],board:[cube,1],paper:[cube,1],pen:[limb,1]};
  const batches={};for(const [name,[geometry,count]]of Object.entries(parts)){const batch=new T.InstancedMesh(geometry,material,scouts.length*count);batch.name=`scout-${name}`;batch.frustumCulled=false;batch.receiveShadow=true;group.add(batch);batches[name]=batch;}
  const dummy=new T.Object3D(),local=new T.Object3D(),matrix=new T.Matrix4(),color=new T.Color(),up=new T.Vector3(0,1,0);
  const palettes={skin:['#b98461','#684431','#ceaa88','#8e5f45'],shirt:['#263544','#56616b','#162a26','#6d6156'],pants:['#242b33','#424b50','#746958']};
  function set(name,index,p,size,tint,rotation=0){local.position.set(...p);local.scale.set(...size);local.rotation.set(rotation,0,0);local.updateMatrix();matrix.multiplyMatrices(dummy.matrix,local.matrix);batches[name].setMatrixAt(index,matrix);batches[name].setColorAt(index,color.set(tint));}
  function segment(name,index,a,b,r,tint){const start=new T.Vector3(...a),end=new T.Vector3(...b);local.position.copy(start).add(end).multiplyScalar(.5);local.scale.set(r,start.distanceTo(end),r);local.quaternion.setFromUnitVectors(up,end.sub(start).normalize());local.updateMatrix();matrix.multiplyMatrices(dummy.matrix,local.matrix);batches[name].setMatrixAt(index,matrix);batches[name].setColorAt(index,color.set(tint));}
  function updateScouts(time){scouts.forEach((s,i)=>{
    dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(0,s.angle,0);dummy.scale.setScalar(1);dummy.updateMatrix();
    const seated=s.seated,hip=seated?.08:.89,shoulder=hip+.48,skin=palettes.skin[i%4],shirt=palettes.shirt[i%4],pants=palettes.pants[i%3];
    const note=Math.sin(time*2.2+i)*.014,glance=Math.sin(time*.35+i)*.025;
    set('body',i,[0,hip+.24,.015],[.40,.48,.23],shirt,.08);
    set('neck',i,[0,shoulder+.055,.035],[.045,.11,.045],skin);
    set('head',i,[glance,shoulder+.20,.04],[.095,.13,.10],skin,.13);
    set('hair',i,[glance,shoulder+.29,.025],[.097,.045,.097],i%5===0?'#92918a':'#29221d',.13);
    for(let side=0;side<2;side++){
      const x=side===0?-.12:.12,knee=[x,seated?-.03:.48,seated?.43:.06],foot=[x,seated?-.38:.08,seated?.45:.10];
      segment('legs',i*4+side*2,[x,hip,0],knee,.075,pants);segment('legs',i*4+side*2+1,knee,foot,.055,pants);
      set('shoes',i*2+side,[x,foot[1]-.035,foot[2]+.055],[.12,.08,.24],'#182027');
      const elbow=[side===0?-.24:.24,hip+.12,.20],hand=[side===0?-.12:.09+note,hip+.16,.39+ (side===1?note:0)];
      segment('arms',i*4+side*2,[side===0?-.22:.22,shoulder-.04,0],elbow,.052,shirt);segment('arms',i*4+side*2+1,elbow,hand,.035,skin);
      set('hands',i*2+side,hand,[.036,.027,.055],skin);
    }
    set('board',i,[0,hip+.10,.38],[.32,.025,.25],'#725b3e',-.13);set('paper',i,[0,hip+.118,.38],[.275,.008,.205],'#d7dccd',-.13);
    segment('pen',i,[.09+note,hip+.17,.39+note],[.08+note,hip+.24,.42+note],.006,'#192b37');
  });for(const batch of Object.values(batches)){batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;}}
  // Clone the actual Combine rig and uniform, with no extra network downloads.
  // Independent materials keep the waiting group stable when the user switches athlete.
  const waiting=[];
  for(let i=0;i<3;i++){
    const root=clone(source);root.name=`waiting-athlete-${i+1}`;root.position.set(4.3+i*.4,0,2.3+i*1.05);root.rotation.y=-1.3+i*.12;root.scale.setScalar(.97+i*.025);
    const materials=new Map(),bones=[];
    root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.frustumCulled=false;const copy=m=>{if(!materials.has(m)){const material=m.clone();material.onBeforeCompile=shader=>{m.onBeforeCompile(shader);if(shader.uniforms.bkSkinTint){const tint=new T.Color(['#986340','#ceaa88','#684330'][i]),reference=new T.Color('#b17b4b');shader.uniforms.bkSkinTint={value:new T.Vector3(tint.r/reference.r,tint.g/reference.g,tint.b/reference.b)};}};material.customProgramCacheKey=m.customProgramCacheKey;materials.set(m,material);};return materials.get(m);};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);}if(o.isBone&&/Head$|Spine2$|LeftArm$|RightArm$/.test(o.name))bones.push({bone:o,q:o.quaternion.clone()});});
    group.add(root);waiting.push({root,bones});
  }
  let time=0,last=-1;
  function update(dt){time+=Math.min(.1,Math.max(0,dt));if(time-last<.1)return;last=time;updateScouts(time);waiting.forEach(({bones},i)=>{for(const {bone,q}of bones){bone.quaternion.copy(q);if(/Head$/.test(bone.name))bone.rotateY(Math.sin(time*.4+i*2)*.12);else if(/Spine2$/.test(bone.name))bone.rotateZ(Math.sin(time*.65+i)*.012);else bone.rotateX(Math.sin(time*.7+i*2)*.045);}});}
  updateScouts(0);
  group.userData={scouts:scouts.length,waitingAthletes:waiting.length};
  return {update,counts:group.userData,dispose(){for(const {root}of waiting)root.traverse(o=>o.skeleton?.dispose());}};
}
