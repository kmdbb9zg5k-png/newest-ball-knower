import assert from 'node:assert/strict';
import {handlerFor,fetchFeed} from '../api/bk/lib/sports-feed';

const old=process.env.BK_NEWS_JSON_URL;
const originalFetch=globalThis.fetch;
try{
  delete process.env.BK_NEWS_JSON_URL;
  await assert.rejects(fetchFeed('news'),/not_configured/);
  const status={statusCode:0,body:null as any,headers:{} as Record<string,string>,setHeader(k:string,v:string){this.headers[k]=v},status(n:number){this.statusCode=n;return this},json(b:any){this.body=b;return this}};
  await handlerFor('news')({method:'GET'},status);
  assert.equal(status.statusCode,503);assert.equal(status.body.available,false);
  process.env.BK_NEWS_JSON_URL='https://licensed.example/feed.json';
  globalThis.fetch=async()=>new Response(JSON.stringify({articles:[{title:'Example headline',link:'https://publisher.example/story',source:'Publisher'}]}),{status:200});
  const result=await fetchFeed('news');
  assert.equal(result.items.length,1);
  assert.equal((result.items[0] as any).headline,'Example headline');
  assert.equal((result.items[0] as any).url,'https://publisher.example/story');
  console.log('Ball Knower Sports API contract checks passed');
}finally{
  globalThis.fetch=originalFetch;
  if(old===undefined)delete process.env.BK_NEWS_JSON_URL;else process.env.BK_NEWS_JSON_URL=old;
}
