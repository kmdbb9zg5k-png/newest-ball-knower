// Convert embedded PNG textures to high-quality WebP; keep every mesh/UV/index byte.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
for(const path of process.argv.slice(2)) {
 const source=fs.readFileSync(path),jsonSize=source.readUInt32LE(12),doc=JSON.parse(source.subarray(20,20+jsonSize));
 const bin=source.subarray(28+jsonSize);let offset=0;const chunks=[];
 const imageViews=new Map(doc.images.map(i=>[i.bufferView,i]));
 for(let i=0;i<doc.bufferViews.length;i++){
  const view=doc.bufferViews[i];let bytes=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  if(imageViews.has(i)){bytes=await sharp(bytes).webp({quality:95}).toBuffer();imageViews.get(i).mimeType='image/webp';}
  else assert.deepEqual(bytes,bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));
  view.byteOffset=offset;view.byteLength=bytes.length;chunks.push(bytes);offset+=bytes.length;
  const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}
 }
 // EXT_texture_webp declares the WebP source for all original textures.
 doc.extensionsUsed=[...new Set([...(doc.extensionsUsed||[]),'EXT_texture_webp'])];
 doc.extensionsRequired=[...new Set([...(doc.extensionsRequired||[]),'EXT_texture_webp'])];
 for(const t of doc.textures){t.extensions={...t.extensions,EXT_texture_webp:{source:t.source}};delete t.source;}
 doc.buffers[0].byteLength=offset;
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+offset,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const bh=Buffer.alloc(8);bh.writeUInt32LE(offset);bh.writeUInt32LE(0x004e4942,4);
 fs.writeFileSync(path,Buffer.concat([header,json,bh,...chunks]));console.log(path,source.length,'->',fs.statSync(path).size);
}
