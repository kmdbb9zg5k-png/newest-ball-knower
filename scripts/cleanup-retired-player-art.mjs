// Explicit one-time operator command; never runs during normal builds.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile(new URL('../docs/qa/2026-10-26-retired-player-art.json',import.meta.url),'utf8'));
const base='https://gpnboygoosrmeydwjpvk.supabase.co';
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const execute=process.argv.includes('--execute');
assert(key,'Existing server credential required');
assert.equal(manifest.bucket,'ball-knower-simulated-player-art');
assert.equal(manifest.files.length,936);
assert.equal(manifest.files.reduce((n,f)=>n+f.bytes,0),66500976);
const targets=new Set(manifest.files.map(f=>f.name));
assert.equal(targets.size,936);
for(const name of targets) assert(/^v4\/uniforms\/solo-[^/]+\/[^/]+\/home\/[^/]+\/[^/]+\/(avatar.webp|card.webp|full-body.webp|portrait.webp|row.webp|source-full-body.jpg|source-portrait.jpg|source-sheet.jpg)$/.test(name),'Unexpected cleanup path');
async function request(path,options={}) {
 const r=await fetch(base+path,{...options,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(30000)});
 assert(r.ok,`Storage/catalog request failed: ${r.status}`);
 return r.json();
}
async function catalog() {
 const rows=[];
 for(let offset=0;;offset+=500){
  const page=await request(`/rest/v1/ball_knower_simulated_player_art?select=*&order=player_id&offset=${offset}&limit=500`);
  rows.push(...page);if(page.length<500)break;
 }
 assert(rows.length>=1706,'Incomplete catalog');
 const refs=new Set(rows.flatMap(r=>Object.entries(r).filter(([k,v])=>k.endsWith('_path')&&typeof v==='string').map(([,v])=>v)));
 for(const path of targets) assert(!refs.has(path),'A retired path is now referenced; abort');
 for(const {root} of manifest.sets){
  const prefix=root.slice(0,root.lastIndexOf('/')+1);
  assert([...refs].some(p=>p.startsWith(prefix)&&p.endsWith('/avatar.webp')&&!targets.has(p)),'Missing current replacement');
 }
 return rows.length;
}
const catalogCount=await catalog();
const existing=[];
for(const {root} of manifest.sets){
 const entries=await request(`/storage/v1/object/list/${manifest.bucket}`,{method:'POST',body:JSON.stringify({prefix:root,limit:100,offset:0})});
 for(const entry of entries){
  const path=root+'/'+entry.name;
  assert(targets.has(path),'Unexpected content in retired folder');
  const expected=manifest.files.find(f=>f.name===path);
  assert.equal(Number(entry.metadata?.size),expected.bytes,'Object changed since audit');
  existing.push(path);
 }
}
// The operator verifies the separately saved backup and deployed cache fix first.
if(execute){
 assert.equal(process.env.BK_RETIREMENT_BACKUP_VERIFIED,'936:66500976','Verified backup acknowledgment required');
 await catalog();
 for(let i=0;i<existing.length;i+=100){
  await request(`/storage/v1/object/${manifest.bucket}`,{method:'DELETE',body:JSON.stringify({prefixes:existing.slice(i,i+100)})});
  console.log(JSON.stringify({removedThrough:Math.min(i+100,existing.length)}));
 }
}
if(execute){
 await catalog();
 for(const {root} of manifest.sets){
  const remaining=await request(`/storage/v1/object/list/${manifest.bucket}`,{method:'POST',body:JSON.stringify({prefix:root,limit:100})});
  assert.equal(remaining.length,0,'Deletion verification failed');
 }
}
const result={execute,catalogCount,selected:existing.length,bytes:existing.reduce((n,p)=>n+manifest.files.find(f=>f.name===p).bytes,0),bucket:manifest.bucket};
await mkdir('audit-dist',{recursive:true});
await writeFile('audit-dist/cleanup-result.json',JSON.stringify(result));
console.log(JSON.stringify(result));
