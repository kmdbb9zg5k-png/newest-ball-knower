import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assetFlag=process.argv.indexOf('--asset');
const assetPath=assetFlag>=0?path.resolve(process.argv[assetFlag+1]):path.join(root,'public/play-moment-3d/assets/ball-knower-gridiron-sentinel-v4.glb');
const bytes=fs.readFileSync(assetPath);
assert.equal(bytes.readUInt32LE(0),0x46546c67,'Athlete must be GLB');
assert.equal(bytes.readUInt32LE(4),2,'Athlete must use GLB v2');
let offset=12,json=null,bin=null;
while(offset<bytes.length){
 const length=bytes.readUInt32LE(offset),type=bytes.readUInt32LE(offset+4),chunk=bytes.subarray(offset+8,offset+8+length);
 if(type===0x4e4f534a)json=JSON.parse(chunk.toString().replace(/\0+$/,'').trim());
 if(type===0x004e4942)bin=chunk;
 offset+=8+length;
}
assert.ok(json&&bin,'Athlete GLB needs JSON and binary chunks');
const primitive=json.meshes[0].primitives[0],components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const accessor=index=>{
 const a=json.accessors[index],v=json.bufferViews[a.bufferView],count=components[a.type],elementBytes=count*sizes[a.componentType],stride=v.byteStride||elementBytes,start=(v.byteOffset||0)+(a.byteOffset||0),out=new Float32Array(a.count*count),data=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
 const read={5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a.componentType],signed=a.componentType===5120||a.componentType===5122,limit=a.componentType===5126?1:signed?(2**(sizes[a.componentType]*8-1)-1):(2**(sizes[a.componentType]*8)-1);
 for(let i=0;i<a.count;i++)for(let c=0;c<count;c++){let value=data[read](start+i*stride+c*sizes[a.componentType],true);if(a.normalized)value=Math.max(signed?-1:0,value/limit);out[i*count+c]=value}
 return{spec:a,values:out};
};

const positions=accessor(primitive.attributes.POSITION),indices=accessor(primitive.indices),joints=accessor(primitive.attributes.JOINTS_0),weights=accessor(primitive.attributes.WEIGHTS_0);
assert.ok(positions.spec.count>=25_000&&positions.spec.count<=45_000,`Mobile vertex budget exceeded: ${positions.spec.count}`);
assert.ok(indices.spec.count/3>=24_000&&indices.spec.count/3<=35_000,`Mobile triangle budget exceeded: ${indices.spec.count/3}`);
assert.equal(json.skins.length,1,'Athlete needs exactly one verified skin');
assert.equal(json.skins[0].joints.length,28,'Athlete should retain Meshy’s 28-joint humanoid rig');
assert.ok(json.skins[0].joints.length<=32,'Athlete exceeds the WebGL bone budget');
assert.deepEqual(json.animations.map(animation=>animation.name),['run','walk','juke','stiff_arm','wrap_tackle','high_point_catch','sprint','rest'],'Unexpected football animation library');
for(const attribute of['POSITION','NORMAL','TANGENT','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])assert.ok(Number.isInteger(primitive.attributes[attribute]),`Missing ${attribute}`);
let minY=Infinity,maxY=-Infinity;
for(let i=0;i<positions.spec.count;i++){
 const y=positions.values[i*3+1];minY=Math.min(minY,y);maxY=Math.max(maxY,y);
 let sum=0;for(let c=0;c<4;c++){const joint=joints.values[i*4+c],weight=weights.values[i*4+c];assert.ok(joint<json.skins[0].joints.length,`Vertex ${i} references invalid joint ${joint}`);assert.ok(Number.isFinite(weight),`Vertex ${i} has an invalid weight`);sum+=weight}
 assert.ok(Math.abs(sum-1)<.002,`Vertex ${i} weights sum to ${sum}`);
}
assert.ok(Math.abs(minY)<.01,`Feet must sit on the field, got y=${minY}`);
assert.ok(maxY>1.68&&maxY<1.72,`Unexpected bind-pose height ${maxY}`);

const jpegSize=raw=>{
 assert.equal(raw[0],0xff);assert.equal(raw[1],0xd8);let cursor=2;
 while(cursor<raw.length){if(raw[cursor]!==0xff){cursor++;continue}const marker=raw[cursor+1],length=raw.readUInt16BE(cursor+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return[raw.readUInt16BE(cursor+7),raw.readUInt16BE(cursor+5)];cursor+=2+length}
 return[0,0];
};
assert.equal(json.images.length,3,'Athlete needs base, ORM, and normal maps');
for(const [index,image] of json.images.entries()){
 const view=json.bufferViews[image.bufferView],raw=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
 assert.deepEqual(jpegSize(raw),[2048,2048],`Texture ${index} must remain 2K`);
}
assert.ok(bytes.length<8_000_000,`Athlete payload is too large: ${bytes.length}`);
assert.equal(json.extras?.ballKnowerAthlete?.mobileTriangles,indices.spec.count/3,'Missing athlete build provenance');
console.log(`Athlete v${json.extras?.ballKnowerAthlete?.version} passed: ${positions.spec.count.toLocaleString()} vertices, ${(indices.spec.count/3).toLocaleString()} triangles, ${json.animations.length} football clips, 3×2K PBR maps, ${(bytes.length/1_000_000).toFixed(2)} MB.`);
