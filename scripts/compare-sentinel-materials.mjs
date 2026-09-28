// Export a controlled material comparison for render-football-athlete.py.
// The same reconstructed source A-pose, geometry, camera and lighting are used
// in every column. This is not a screenshot of Meshy's proprietary viewer.
import fs from 'node:fs';
import path from 'node:path';
import {parseGLB,ATHLETE_SHADERS} from '../public/play-moment-3d/meshy-athlete.js';
import {refineAthleteSurface} from '../public/play-moment-3d/athlete-surface.js';
const out=path.resolve(process.argv[2]||'/tmp/sentinel-materials');fs.mkdirSync(out,{recursive:true});
const raw=fs.readFileSync(new URL('../public/play-moment-3d/assets/ball-knower-gridiron-sentinel-v4.glb',import.meta.url));
const parsed=parseGLB(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),{json,accessor}=parsed,p=json.meshes[0].primitives[0];
const surface=refineAthleteSurface(accessor(p.attributes.POSITION),accessor(p.attributes.NORMAL),accessor(p.attributes.TANGENT),accessor(p.indices),{regularizeHelmet:false}),attrs={};
for(const [name,index] of Object.entries(p.attributes)){
 const data=({POSITION:surface.positions,NORMAL:surface.normals,TANGENT:surface.tangents})[name]||accessor(index);
 fs.writeFileSync(path.join(out,name+'.bin'),Buffer.from(data.buffer,data.byteOffset,data.byteLength));attrs[name]={type:json.accessors[index].componentType,count:json.accessors[index].count};
}
const indices=accessor(p.indices);fs.writeFileSync(path.join(out,'indices.bin'),Buffer.from(indices.buffer,indices.byteOffset,indices.byteLength));
const material=json.materials[p.material];
[material.pbrMetallicRoughness.baseColorTexture.index,material.normalTexture.index,material.pbrMetallicRoughness.metallicRoughnessTexture.index].forEach((t,i)=>{const im=json.images[json.textures[t].source],v=json.bufferViews[im.bufferView];fs.writeFileSync(path.join(out,`tex${i}.jpg`),Buffer.from(parsed.bin,v.byteOffset||0,v.byteLength));});
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],skin=json.skins[0],ib=accessor(skin.inverseBindMatrices),names=skin.joints.map(i=>json.nodes[i].name),bones=names.map(identity);
// Recover world joint origin from inverse rigid bind matrix.
const origin=j=>{const m=ib.subarray(j*16,j*16+16);return[0,1,2].map(k=>-(m[k*4]*m[12]+m[k*4+1]*m[13]+m[k*4+2]*m[14]));};
for(const [side,sign] of [['Left',-1],['Right',1]]){
 const [x,y]=origin(names.indexOf('mixamorig:'+side+'Arm')),a=sign*43*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 const transform=[c,s,0,0,-s,c,0,0,0,0,1,0,x-c*x+s*y,y-s*x-c*y,0,1];
 for(const suffix of ['Arm','ForeArm','Hand','HandMiddle4'])bones[names.indexOf('mixamorig:'+side+suffix)]=transform;
}
const poses=[];
for(const [view,eye,target] of [['Close-up',[.65,1.48,1.65],[0,1.32,0]],['Full player',[1.8,1.5,3.7],[0,.86,0]],['Gameplay size',[2.2,2.7,11],[0,.86,0]]]){
 for(const [label,mode] of [['Source maps',2],['Previous shader',0],['Revised shader',1]])poses.push({label:`${view} | ${label}`,eye,target,sourceMaterials:mode,p:{team:process.argv.includes('--away')?1:0,number:24},model:identity(),bones:bones.flat()});
}
fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify({...ATHLETE_SHADERS,attrs,indexType:json.accessors[p.indices].componentType,indexCount:indices.length,columns:3,size:[520,520],labelSize:18,saveRows:true,poses}));
console.log(out);
