import assert from 'node:assert/strict';
import fs from 'node:fs';

export function verifyHealth(response, payload){
  assert.equal(response.status,200,'Production health endpoint must return 200');
  assert.match(response.headers.get('content-type')||'',/application\/json/i,'A 200 HTML page is not a Ball Knower backend');
  assert.equal(payload?.ok,true,'Production health reports an unhealthy service');
  assert.equal(payload?.service,'ball-knower','Native origin must be the Ball Knower football backend');
  assert.equal(payload?.integrations?.database,true,'Production database must be configured');
  assert.equal(payload?.integrations?.nflData,true,'Production football provider must be configured');
}
export async function preflight(origin='https://ballknowerofficial.com'){
  assert.equal(new URL(origin).origin,'https://ballknowerofficial.com','Unexpected release backend');
  const response=await fetch(`${origin}/api/health`,{signal:AbortSignal.timeout(12000)});
  const raw=await response.text();let payload;try{payload=JSON.parse(raw)}catch{throw new Error('Backend returned non-JSON content; do not build with this origin')}
  verifyHealth(response,payload);
  for(const route of ['/privacy.html','/support.html','/terms.html','/player-photo-credits.html','/data-credits.html']){
    const r=await fetch(`${origin}${route}`,{signal:AbortSignal.timeout(12000)});
    assert.equal(r.status,200,`Missing public review page: ${route}`);
    assert.match(await r.text(),/Ball Knower/i,`Unexpected public review page: ${route}`);
  }
  return {checkedAt:new Date().toISOString(),origin,service:payload.service};
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  if(process.argv.includes('--self-test')){
    const good={status:200,headers:new Headers({'content-type':'application/json'})};
    const data={ok:true,service:'ball-knower',integrations:{database:true,nflData:true}};
    verifyHealth(good,data);
    assert.throws(()=>verifyHealth({...good,headers:new Headers({'content-type':'text/html'})},data));
    assert.throws(()=>verifyHealth(good,{...data,service:'baseball'}));
    console.log('Backend identity guard rejects HTML-200 and wrong-app responses.');
  }else{
    const result=await preflight();fs.mkdirSync('artifacts/release',{recursive:true});
    fs.writeFileSync('artifacts/release/backend-preflight.json',JSON.stringify(result,null,2));
    console.log('Football backend and public review pages verified.');
  }
}
