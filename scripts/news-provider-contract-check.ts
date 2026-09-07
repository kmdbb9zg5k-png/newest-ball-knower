import assert from 'node:assert/strict';
import {createNewsHandler,normalizeNews} from '../api/nfl-news';
const makeRes=()=>({headers:{} as Record<string,string>,code:0,body:null as any,setHeader(k:string,v:string){this.headers[k]=v},status(n:number){this.code=n;return this},json(body:any){this.body=body;return this}});
const run=async(handler:ReturnType<typeof createNewsHandler>,method='GET')=>{const res=makeRes();await handler({method},res);return res};
const story={title:'Example NFL headline',link:'https://publisher.example/story',publishedAt:'2026-09-06T12:00:00Z'};
for(const body of [[story],{news:[story]},{topNews:[story]},{recentNews:[story]}])assert.equal(normalizeNews({statusCode:200,body}).articles.length,1);
assert.throws(()=>normalizeNews({statusCode:400,body:[story]}));
assert.equal(normalizeNews({body:[{...story,publishedAt:Number.MAX_VALUE}]}).articles[0].published,null);
assert.equal(normalizeNews({body:[{...story,publishedAt:'1788696000'}]}).articles[0].published,'2026-09-06T12:00:00.000Z');
assert.equal(normalizeNews({body:[story,{...story,link:'javascript:alert(1)'},{...story,link:'https://user:secret@publisher.example'}]}).articles.length,1);
let now=1000,calls=0;const diagnostics:unknown[]=[];
const handler=createNewsHandler({now:()=>now,getKey:()=>'SECRET-TEST-KEY',log:(code,data)=>diagnostics.push({code,...data}),fetchImpl:async(url,init)=>{
  calls++;assert.equal(new URL(String(url)).searchParams.get('topNews'),'true');assert.equal(init?.redirect,'error');
  assert.equal((init?.headers as Record<string,string>)['x-rapidapi-key'],'SECRET-TEST-KEY');
  if(calls===2)return new Response('SECRET BODY / arbitrary HTML',{status:429});
  return new Response(JSON.stringify({statusCode:200,body:[story]}));
}});
const [a,b]=await Promise.all([run(handler),run(handler)]);assert.equal(calls,1);assert.equal(a.body.available,true);assert.deepEqual(a.body,b.body);
await run(handler);assert.equal(calls,1);
now+=120001;const failed=await run(handler);assert.equal(failed.body.available,false);assert.deepEqual(failed.body.articles,[]);
await run(handler);assert.equal(calls,2,'Failure cooldown must avoid repeated provider charges');
now+=30001;assert.equal((await run(handler)).body.available,true);assert.equal(calls,3);
assert.deepEqual(diagnostics,[{code:'http_status',httpStatus:429}]);assert.ok(!JSON.stringify(diagnostics).includes('SECRET'));
for(const [response,expected] of [[new Response('secret broken JSON'),'invalid_json'],[new Response(JSON.stringify({statusCode:400,error:'secret body'})),'provider_status'],[new Response(JSON.stringify({body:[]})),'no_valid_links']] as const){
  const logs:unknown[]=[];const h=createNewsHandler({getKey:()=>'test',fetchImpl:async()=>response,log:(code,data)=>logs.push({code,...data})});
  const r=await run(h);assert.equal(r.body.available,false);assert.equal((logs[0] as any).code,expected);assert.ok(!JSON.stringify(logs).includes('secret'));
}
const logs:unknown[]=[];const missing=createNewsHandler({getKey:()=>undefined,fetchImpl:async()=>{throw Error('Must not fetch')},log:(code)=>logs.push(code)});
assert.equal((await run(missing)).body.available,false);assert.deepEqual(logs,['missing_key']);assert.equal((await run(missing,'POST')).code,405);
const timeout=createNewsHandler({getKey:()=>'test',fetchImpl:async()=>{throw new DOMException('Secret provider URL','TimeoutError')},log:(code,data)=>{assert.equal(code,'timeout');assert.deepEqual(data,{})}});
assert.equal((await run(timeout)).body.available,false);
console.log('News contract: explicit feed selection, safe diagnostics, cache/concurrency, cooldown/recovery, invalid dates and links passed.');
