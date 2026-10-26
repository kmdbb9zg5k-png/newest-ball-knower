import {mkdir,writeFile} from "node:fs/promises";
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const base="https://gpnboygoosrmeydwjpvk.supabase.co";
const reports=[];
if(key){
 for(const [name,path,options] of [
 ["catalog","/rest/v1/ball_knower_simulated_player_art?select=player_id&limit=1",{}],
 ["storage","/storage/v1/object/list/ball-knower-simulated-player-art",{method:"POST",body:JSON.stringify({prefix:"v4/uniforms/solo-abq-01",limit:1})}],
 // An empty exact-object list never selects a file or empties a bucket.
 ["delete-access-no-files","/storage/v1/object/ball-knower-simulated-player-art",{method:"DELETE",body:JSON.stringify({prefixes:[]})}]
 ]){
  const r=await fetch(base+path,{...options,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},signal:AbortSignal.timeout(20000)});
  const body=await r.text();reports.push({name,status:r.status,restricted:body.includes("exceed_storage_size_quota"),ok:r.ok});
 }
}else reports.push({error:"Server storage credential unavailable"});
await mkdir("audit-dist",{recursive:true});
await writeFile("audit-dist/storage-access.json",JSON.stringify({readOnly:true,reports}));
console.log(JSON.stringify({readOnly:true,reports}));
