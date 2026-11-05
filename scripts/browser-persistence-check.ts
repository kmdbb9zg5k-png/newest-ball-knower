import assert from 'node:assert/strict';
import {persistBrowserValue} from '../browserPersistence';

const values = new Map<string,string>();
const storage = {setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
assert.equal(persistBrowserValue('league','league-42',()=>storage),true);
assert.equal(values.get('league'),'league-42');
assert.equal(persistBrowserValue('league',null,()=>storage),true);
assert.equal(values.has('league'),false);
for (const name of ['SecurityError','QuotaExceededError']) {
  const blocked = ()=>{throw new DOMException('Storage unavailable',name);};
  assert.equal(persistBrowserValue('user','profile',blocked),false,'A throwing storage getter must not crash the session');
  assert.equal(persistBrowserValue('user','profile',()=>({setItem:blocked,removeItem:blocked})),false);
  assert.equal(persistBrowserValue('user',null,()=>({setItem:blocked,removeItem:blocked})),false,'Sign-out must continue even when removal is blocked');
}
console.log('PASS: browser persistence handles normal write/removal, blocked access and quota errors without interrupting callers.');
