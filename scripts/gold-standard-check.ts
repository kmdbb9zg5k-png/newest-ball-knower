import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {STORE_PRODUCTS} from '../storeCatalog';
import {CLOTHING,cleanOutfit} from '../playerWardrobe';
const gold=STORE_PRODUCTS.find(p=>p.id==='gold-standard')!,tunnel=STORE_PRODUCTS.find(p=>p.id==='tunnel-fit')!;
assert.ok(gold&&tunnel&&gold!==tunnel);
for(const product of [gold,tunnel]){
 assert.equal(product.priceCents,299);
 assert.ok(product.tryOn&&'outfit' in product.tryOn);
 const outfit=product.tryOn.outfit;
 for(const [slot,id] of Object.entries(outfit)){
  assert.ok(CLOTHING.some(c=>c.id===id&&c.slot===slot&&c.premium&&c.retailPreview));
  assert.notEqual(cleanOutfit(outfit)[slot],id,'Preview must not grant ownership');
 }
 const b=readFileSync(`public/store/${product.id==='gold-standard'?'gold-standard':'tunnel-fit'}-athlete-v1.glb`);
 assert.equal(b.toString('utf8',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
 const j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
 const triangles=j.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+j.accessors[p.indices].count/3,0);
 assert.ok(triangles>=50000);
 if(product===gold){assert.equal(triangles,500000);assert.ok(j.materials.some(m=>m.name==='Original athlete skin'));assert.ok(j.materials.some(m=>m.name==='Gold Standard clothing'));}
 assert.ok(j.images.length>=3);
 console.log(product.id,{triangles,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});
}
console.log('PASS: separate catalog items, protected premium ownership, complete detailed GLBs and original skin material.');
