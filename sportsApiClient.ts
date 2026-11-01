/** Optional read-only news migration. Never changes fantasy/player identities. */
export type NewsItem={id:string;headline:string;source:string;published:string|null;url:string;license?:string;licenseUrl?:string;attribution?:string};
export type NewsFeed={articles:NewsItem[];provider:string;fetchedAt:string|null;stale:boolean;fallback:boolean};
const text=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):'';
const date=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const link=(value:unknown)=>{try{const url=new URL(String(value));return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:''}catch{return''}};

export function parseNewsFeed(data:any,versioned:boolean,now=Date.now()):NewsFeed{
  if(data?.available!==true||(versioned&&data?.kind!=='news'))throw new Error('news_unavailable');
  const rows=versioned?data.items:data.articles;
  if(!Array.isArray(rows))throw new Error('news_unavailable');
  const seen=new Set<string>();
  const articles:NewsItem[]=rows.slice(0,100).flatMap((row:any)=>{
    const url=link(row?.url),headline=text(row?.headline,240);
    if(!url||!headline||seen.has(url))return[];
    seen.add(url);
    return[{id:url,headline,url,source:text(row?.source,120)||new URL(url).hostname,published:date(row?.published),license:text(row?.license,120)||undefined,licenseUrl:link(row?.licenseUrl)||undefined,attribution:text(row?.attribution,500)||undefined}];
  });
  if(!articles.length)throw new Error('news_unavailable');
  // Retrieval time is not publication time or proof that the publisher is current.
  const fetchedAt=date(versioned?(data.fetchedAt??data.updatedAt):data.fetchedAt);
  const fetchedMs=fetchedAt?Date.parse(fetchedAt):NaN;
  if(versioned&&(!Number.isFinite(fetchedMs)||fetchedMs>now+60_000||now-fetchedMs>15*60_000||data.stale===true))throw new Error('news_stale');
  return{articles,provider:versioned?'Ball Knower Sports API':'Tank01',fetchedAt,
    stale:data.stale===true||(Number.isFinite(fetchedMs)&&now-fetchedMs>15*60_000),fallback:false};
}

async function requestNews(path:string,versioned:boolean,request:typeof fetch,signal?:AbortSignal):Promise<NewsFeed>{
  const controller=new AbortController();
  const abort=()=>controller.abort();
  if(signal?.aborted)throw new Error('news_cancelled');
  signal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,10_000);
  try{
    const response=await request(path,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('news_unavailable');
    return parseNewsFeed(await response.json(),versioned);
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort)}
}

export async function loadNewsFeed(options:{useSportsApi?:boolean;fetchImpl?:typeof fetch;signal?:AbortSignal}={}):Promise<NewsFeed>{
  const request=options.fetchImpl??fetch;
  if(options.useSportsApi){
    try{return await requestNews('/api/bk/v1/news',true,request,options.signal)}catch{
      if(options.signal?.aborted)throw new Error('news_cancelled');
    }
  }
  const result=await requestNews('/api/nfl-news',false,request,options.signal);
  return{...result,fallback:options.useSportsApi===true};
}
