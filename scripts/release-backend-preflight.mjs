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
export function verifyNews(response,payload,now=Date.now()){
  assert.equal(response.status,200,'News request failed');
  assert.match(response.headers.get('content-type')||'',/application\/json/i,'News must return JSON');
  assert.equal(payload?.available,true,'Live News is unavailable; do not ship an empty-feed build');
  assert.equal(payload?.provider,'Tank01','Unexpected News provider');
  assert.ok(Array.isArray(payload?.articles)&&payload.articles.length>0&&payload.articles.length<=20,'Live News must contain actual headline links');
  const retrieved=Date.parse(payload.fetchedAt);
  assert.ok(Number.isFinite(retrieved)&&retrieved<=now+60_000&&now-retrieved<=300_000,'News retrieval timestamp is invalid or stale');
  const ids=new Set();
  for(const item of payload.articles){
    assert.ok(typeof item.headline==='string'&&item.headline.trim()&&typeof item.source==='string'&&item.source.trim(),'Headline/source missing');
    const link=new URL(item.url);
    assert.ok(['https:','http:'].includes(link.protocol)&&!link.username&&!link.password,'Unsafe story link');
    assert.equal(item.id,item.url);assert.ok(!ids.has(item.id),'Duplicate story');ids.add(item.id);
    assert.equal(item.image,null,'Publisher images must not be republished');
    assert.equal(item.description,'','Article bodies/summaries must not be republished');
    assert.ok(item.published===null||Number.isFinite(Date.parse(item.published)),'Invalid publication date');
  }
  return {articleCount:payload.articles.length,provider:payload.provider,fetchedAt:payload.fetchedAt};
}
export async function preflight(origin='https://ballknowerofficial.com'){
  assert.equal(new URL(origin).origin,'https://ballknowerofficial.com','Unexpected release backend');
  const request=async route=>fetch(`${origin}${route}`,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
  const response=await request('/api/health');
  const raw=await response.text();let payload;try{payload=JSON.parse(raw)}catch{throw new Error('Backend returned non-JSON content; do not build with this origin')}
  verifyHealth(response,payload);
  const newsResponse=await request('/api/nfl-news');
  const news=verifyNews(newsResponse,await newsResponse.json());
  for(const route of ['/privacy.html','/support.html','/terms.html','/player-photo-credits.html','/data-credits.html']){
    const r=await request(route);
    assert.equal(r.status,200,`Missing public review page: ${route}`);
    assert.match(await r.text(),/Ball Knower/i,`Unexpected public review page: ${route}`);
  }
  return {checkedAt:new Date().toISOString(),origin,service:payload.service,news};
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  if(process.argv.includes('--self-test')){
    const good={status:200,headers:new Headers({'content-type':'application/json'})};
    const data={ok:true,service:'ball-knower',integrations:{database:true,nflData:true}};
    verifyHealth(good,data);
    assert.throws(()=>verifyHealth({...good,headers:new Headers({'content-type':'text/html'})},data));
    assert.throws(()=>verifyHealth(good,{...data,service:'baseball'}));
    const news={available:true,provider:'Tank01',fetchedAt:new Date().toISOString(),articles:[{id:'https://publisher.example/story',url:'https://publisher.example/story',headline:'Test story',source:'Test publisher',published:null,image:null,description:''}]};
    verifyNews(good,news);
    for(const invalid of [{...news,available:false},{...news,articles:[]},{...news,fetchedAt:'2000-01-01T00:00:00Z'},{...news,articles:[{...news.articles[0],url:'javascript:alert(1)'}]},{...news,articles:[{...news.articles[0],description:'Unapproved article body'}]}])assert.throws(()=>verifyNews(good,invalid));
    assert.throws(()=>verifyNews({...good,headers:new Headers({'content-type':'text/html'})},news));
    console.log('Backend guards reject HTML-200, wrong service, empty/unavailable/stale News and unsafe content.');
  }else{
    const result=await preflight();fs.mkdirSync('artifacts/release',{recursive:true});
    fs.writeFileSync('artifacts/release/backend-preflight.json',JSON.stringify(result,null,2));
    console.log('Football backend, live headline feed and public review pages verified.');
  }
}
