import * as T from 'three';
import {SimplifyModifier} from 'three/addons/modifiers/SimplifyModifier.js';
import {loadCombineRunner} from '/combine/meshy-runner.js';
import {backgroundRig,backgroundMasks} from '/combine/background-rig.js';
const runner=await loadCombineRunner({id:'scout-source',name:'Scout',position:'WR'});runner.poseJump({phase:'idle',elapsed:0,flight:1.2,height:0,visualDistance:0});
window.baked=[];
for(let variant=0;variant<4;variant++){
 const {root}=backgroundRig(runner.root,variant<3,variant%3),meshes=[];root.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});const geometries=[];
 for(const mesh of meshes){const g=backgroundMasks(mesh),positions=g.attributes.position,p=new T.Vector3();for(let i=0;i<positions.count;i++){p.fromBufferAttribute(positions,i);mesh.applyBoneTransform(i,p);p.applyMatrix4(mesh.matrixWorld);positions.setXYZ(i,p.x,p.y,p.z);}g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');g.computeVertexNormals();const simplified=new SimplifyModifier().modify(g,Math.max(0,positions.count-9000));simplified.computeVertexNormals();geometries.push(simplified.toJSON());}
 window.baked.push({seated:variant<3,geometries});window.progress=variant+1;
}
window.done=true;
