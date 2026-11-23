import assert from 'node:assert/strict';
import{loadNewsFeed,parseNewsFeed}from'../sportsApiClient';
const article={headline:'Synthetic NFL contract test headline',url:'https://publisher.example/story',published:null,source:'Test publisher'};
const legacy={available:true,provider:'Currents',attribution:'https://currentsapi.services/',articles:[article],fetchedAt:new Date().toISOString()};
const versioned={available:true,provider:'Currents',source:'Currents',attribution:'https://currentsapi.services/',kind:'news',items:[article],updatedAt:new Date().toISOString()};
const calls:string[]=[];
let v1:any=versioned,status=200;
const request=(async(url:any)=>{calls.push(String(url));return new Response(JSON.stringify(String(url).includes('/bk/')?v1:legacy),{status:String(url).includes('/bk/')?status:200})})as typeof fetch;
assert.equal((await loadNewsFeed({fetchImpl:request})).provider,'Currents');
assert.deepEqual(calls.splice(0),['/api/nfl-news'],'default must use the compatible legacy news route');
assert.equal((await loadNewsFeed({useSportsApi:true,fetchImpl:request})).provider,'Currents');
assert.deepEqual(calls.splice(0),['/api/bk/v1/news']);
for(const payload of [{available:false}, {...versioned,kind:'players'}, {...versioned,items:[]}, {...versioned,updatedAt:'invalid'}, {...versioned,updatedAt:new Date(Date.now()-16*60_000).toISOString()}, {...versioned,stale:true}, {...versioned,items:[{...article,url:'javascript:alert(1)'}]}]){
  v1=payload;
  assert.equal((await loadNewsFeed({useSportsApi:true,fetchImpl:request})).fallback,true);
  assert.deepEqual(calls.splice(0),['/api/bk/v1/news','/api/nfl-news']);
}
status=503;v1=versioned;
assert.equal((await loadNewsFeed({useSportsApi:true,fetchImpl:request})).fallback,true);
assert.deepEqual(calls.splice(0),['/api/bk/v1/news','/api/nfl-news']);
await assert.rejects(()=>loadNewsFeed({useSportsApi:true,fetchImpl:(async()=>new Response(JSON.stringify({available:false}),{status:503}))as typeof fetch}));
const cancelled=new AbortController();cancelled.abort();
await assert.rejects(()=>loadNewsFeed({useSportsApi:true,fetchImpl:request,signal:cancelled.signal}));
assert.deepEqual(calls,[],'cancelled load must not launch fallback requests');
const parsed=parseNewsFeed({...legacy,articles:[article,article,{...article,url:'https://user:pass@publisher.example/'}]},false);
assert.equal(parsed.articles.length,1);assert.equal(parsed.articles[0].published,null,'missing publication time must not become retrieval time');

const now=Date.parse('2026-11-22T18:00:00Z');
const fetchedAtOffset=(offset:number)=>new Date(now+offset).toISOString();
assert.equal(parseNewsFeed({...versioned,updatedAt:fetchedAtOffset(-15*60_000)},true,now).stale,false,
  'the versioned feed accepts a response exactly 15 minutes old');
assert.throws(()=>parseNewsFeed({...versioned,updatedAt:fetchedAtOffset(-15*60_000-1)},true,now),/news_stale/,
  'the versioned feed rejects a response one millisecond past the cutoff');
assert.equal(parseNewsFeed({...legacy,fetchedAt:fetchedAtOffset(60_000)},false,now).stale,false,
  'the legacy feed allows exactly 60 seconds of clock skew');
for(const fetchedAt of [undefined,'invalid',fetchedAtOffset(60_001)]){
  const feed=parseNewsFeed({...legacy,fetchedAt},false,now);
  assert.equal(feed.stale,true,'the legacy feed flags missing, invalid, and excessively future timestamps');
  assert.equal(feed.articles[0]?.headline,article.headline,'legacy articles remain available with a freshness warning');
}

for(const provider of [undefined,'Unverified provider','<script>alert(1)</script>']){
  assert.equal(parseNewsFeed({...legacy,provider},false).provider,'News provider','Missing or unverified source must not acquire Currents branding');
  assert.equal(parseNewsFeed({...versioned,provider},true).provider,'News provider');
}
const attributed=parseNewsFeed({...versioned,items:[{...article,license:'CC BY 4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',attribution:'https://publisher.example/credits'}]},true);
assert.equal(attributed.articles[0].licenseUrl,'https://creativecommons.org/licenses/by/4.0/');assert.equal(attributed.articles[0].license,'CC BY 4.0');assert.equal(attributed.articles[0].attribution,'https://publisher.example/credits');
console.log('News client migration, fallback, freshness, identity, and cancellation contracts passed.');
