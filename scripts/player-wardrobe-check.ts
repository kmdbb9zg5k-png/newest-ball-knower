import assert from 'node:assert/strict';
import {CLOTHING,DEFAULT_OUTFIT,cleanOutfit,outfitLook} from '../playerWardrobe';
assert.equal(new Set(CLOTHING.map(item=>item.id)).size,CLOTHING.length);
assert.deepEqual(cleanOutfit(null),DEFAULT_OUTFIT);
assert.deepEqual(cleanOutfit({top:'top-gold',shorts:'shoes-white',wrist:'wrist-gold',owned:['top-gold']}),DEFAULT_OUTFIT);
assert.equal(cleanOutfit({top:'top-forest'}).top,'top-forest');
assert.equal(outfitLook({...DEFAULT_OUTFIT,top:'top-electric'}).top.pattern,true);
assert.equal(outfitLook({...DEFAULT_OUTFIT,top:'bad'}).top.id,DEFAULT_OUTFIT.top);
assert.equal(CLOTHING.filter(item=>!item.premium).length,66);
for(const item of CLOTHING.filter(item=>!item.premium)){assert.equal(cleanOutfit({[item.slot]:item.id})[item.slot],item.id,`${item.name} must equip without purchase`);assert.match(item.color,/^#[0-9a-f]{6}$/i);}
console.log('PASS: free gear validation, invalid/cross-slot values, no local premium entitlement, preview catalog.');
