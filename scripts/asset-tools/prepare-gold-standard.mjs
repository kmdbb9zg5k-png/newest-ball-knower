// npm install in this directory, then node prepare-gold-standard.mjs original.glb retextured.glb output.glb
// Preserve the original geometry/UVs and exposed skin; import only the clothing material.
import assert from 'node:assert/strict';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {copyToDocument,meshopt,prune,textureCompress} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import sharp from 'sharp';
const [original,retextured,output]=process.argv.slice(2);
assert.ok(original&&retextured&&output,'Pass original, retextured, and output GLB paths');
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(original),gold=await io.read(retextured);
const mesh=doc.getRoot().listMeshes()[0],p=mesh.listPrimitives()[0],q=gold.getRoot().listMeshes()[0].listPrimitives()[0];
assert.deepEqual(p.getIndices().getArray(),q.getIndices().getArray(),'Retexturing must preserve topology');
assert.deepEqual(p.getAttribute('TEXCOORD_0').getArray(),q.getAttribute('TEXCOORD_0').getArray(),'Retexturing must preserve UVs');
const material=copyToDocument(doc,gold,[q.getMaterial()]).get(q.getMaterial());
material.setName('Gold Standard clothing').setMetallicFactor(0).setRoughnessFactor(.9);
const originalMaterial=p.getMaterial();
// Reuse original surface relief and roughness, matching this exact mesh.
material.setNormalTexture(originalMaterial.getNormalTexture()).setMetallicRoughnessTexture(originalMaterial.getMetallicRoughnessTexture());
originalMaterial.setName('Original athlete skin').setMetallicFactor(.12).setRoughnessFactor(.9);
const pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),indices=p.getIndices().getArray();
const {data,info}=await sharp(originalMaterial.getBaseColorTexture().getImage()).removeAlpha().raw().toBuffer({resolveWithObject:true});
const skin=[],clothes=[];
for(let i=0;i<indices.length;i+=3){
 const tri=[indices[i],indices[i+1],indices[i+2]],v=tri.map(n=>pos.getElement(n,[]));
 const head=v.every(a=>a[2]<-1.005);
 const hand=v.every(a=>Math.abs(a[0])>.19&&a[2]>-.66)&&tri.some(n=>{
  const t=uv.getElement(n,[]),x=Math.min(info.width-1,Math.max(0,Math.floor(t[0]*info.width))),y=Math.min(info.height-1,Math.max(0,Math.floor(t[1]*info.height))),k=(y*info.width+x)*info.channels;
  return data[k]>data[k+1]*1.12&&data[k+1]>data[k+2]*1.08;
 });
 (head||hand?skin:clothes).push(...tri);
}
const buffer=doc.getRoot().listBuffers()[0];
const skinPrimitive=p.clone().setMaterial(originalMaterial).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(skin)).setBuffer(buffer));
p.setMaterial(material).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(clothes)).setBuffer(buffer));mesh.addPrimitive(skinPrimitive);
assert.equal(skin.length+clothes.length,1500000,'Keep all 500,000 triangles');
await doc.transform(prune(),textureCompress({encoder:sharp,targetFormat:'webp',quality:95}),meshopt({encoder:MeshoptEncoder,level:'high'}));
await io.write(output,doc);
console.log(JSON.stringify({triangles:indices.length/3,skinTriangles:skin.length/3,clothingTriangles:clothes.length/3,uvsPreserved:true,originalGeometry:true,output}));
