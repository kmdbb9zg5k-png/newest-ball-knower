/** Tank01 headline/link feed. No Google RSS, article bodies or publisher images. */
const HOST='tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
const MAX_AGE=120_000;
const FAILURE_COOLDOWN=30_000;
type NewsFailureCode='missing_key'|'http_status'|'provider_status'|'invalid_json'|'response_too_large'|'no_valid_links'|'timeout'|'network_error';
type Diagnostic={httpStatus?:number;providerStatus?:number;bodyKind?:string;candidateCount?:number};
class NewsFailure extends Error{
  constructor(readonly code:NewsFailureCode,readonly diagnostic:Diagnostic={}){super(code)}
}
const plain=(value:unknown)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
const safeLink=(value:unknown)=>{
  try{const u=new URL(String(value));return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.toString():null}catch{return null}
};
const numericStatus=(value:unknown)=>{
  const number=typeof value==='number'?value:typeof value==='string'&&/^\d{3}$/.test(value)?Number(value):NaN;
  return Number.isInteger(number)&&number>=100&&number<=599?number:null;
};
const publishedDate=(value:unknown)=>{
  // Missing/invalid dates remain missing; retrieval time is not publication time.
  const numeric=typeof value==='number'?value:typeof value==='string'&&/^\d{10,13}$/.test(value)?Number(value):NaN;
  const epoch=Number.isFinite(numeric)?(numeric>=1e12?numeric:numeric*1000):Date.parse(String(value??''));
  const date=new Date(epoch);return epoch>0&&Number.isFinite(date.getTime())?date.toISOString():null;
};
export function normalizeNews(payload:any){
  const providerStatus=numericStatus(payload?.statusCode);
  if(providerStatus!==null&&providerStatus!==200)throw new NewsFailure('provider_status',{providerStatus});
  const body=payload?.body??payload;
  const rows=Array.isArray(body)?body:Array.isArray(body?.news)?body.news:Array.isArray(body?.topNews)?body.topNews:Array.isArray(body?.recentNews)?body.recentNews:[];
  const seen=new Set<string>();
  const articles=rows.flatMap((row:any)=>{
    const headline=plain(row?.title??row?.headline).slice(0,240);
    const url=safeLink(row?.link??row?.url);if(!headline||!url||seen.has(url))return [];
    seen.add(url);
    const published=publishedDate(row?.publishedAt??row?.published??row?.pubDate??row?.date);
    const source=plain(row?.source?.name??row?.source).slice(0,120)||new URL(url).hostname.replace(/^www\./,'');
    return [{id:url,headline,source,published,description:'',image:null,url}];
  }).sort((a:any,b:any)=>(Date.parse(b.published??'')||0)-(Date.parse(a.published??'')||0)).slice(0,20);
  if(!articles.length)throw new NewsFailure('no_valid_links',{bodyKind:Array.isArray(body)?'array':body===null?'null':typeof body,candidateCount:rows.length});
  return {articles,available:true,provider:'Tank01',fetchedAt:new Date().toISOString()};
}
export function createNewsHandler(deps:{fetchImpl?:typeof fetch;now?:()=>number;getKey?:()=>string|undefined;log?:(code:NewsFailureCode,diagnostic:Diagnostic)=>void}={}){
  let cached:{expires:number;payload:ReturnType<typeof normalizeNews>}|null=null;
  let pending:Promise<ReturnType<typeof normalizeNews>>|null=null;
  let retryAfter=0;
  const now=deps.now??(()=>Date.now());
  const request=deps.fetchImpl??((...args:Parameters<typeof fetch>)=>fetch(...args));
  const getKey=deps.getKey??(()=>process.env.TANK01_API_KEY||process.env.RAPIDAPI_KEY);
  // Never log raw errors, response bodies, headers, keys, request URLs or user data.
  const log=deps.log??((code:NewsFailureCode,diagnostic:Diagnostic)=>console.warn('nfl-news-provider-unavailable',JSON.stringify({code,...diagnostic})));
  return async function handler(req:any,res:any){
    if(req.method&&req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
    const unavailable=()=>{res.setHeader('Cache-Control','public, s-maxage=30, max-age=0');return res.status(200).json({articles:[],available:false,warning:'NFL news is temporarily unavailable.'})};
    try{
      if(cached&&cached.expires>now()){res.setHeader('Cache-Control','public, s-maxage=120, max-age=0');return res.status(200).json(cached.payload)}
      if(retryAfter>now())return unavailable();
      const key=getKey();if(!key)throw new NewsFailure('missing_key');
      if(!pending)pending=(async()=>{
        // Explicitly select the league-wide top-news feed rather than relying on provider defaults.
        const url=`https://${HOST}/getNFLNews?topNews=true&maxItems=20`;
        const response=await request(url,{headers:{'x-rapidapi-key':key,'x-rapidapi-host':HOST},signal:AbortSignal.timeout(8000),redirect:'error'});
        if(!response.ok)throw new NewsFailure('http_status',{httpStatus:response.status});
        const raw=await response.text();if(raw.length>1_000_000)throw new NewsFailure('response_too_large');
        let data:unknown;try{data=JSON.parse(raw)}catch{throw new NewsFailure('invalid_json')}
        const payload=normalizeNews(data);cached={expires:now()+MAX_AGE,payload};retryAfter=0;return payload;
      })().finally(()=>{pending=null});
      const payload=await pending;
      res.setHeader('Cache-Control','public, s-maxage=120, max-age=0');return res.status(200).json(payload);
    }catch(error){
      cached=null;retryAfter=now()+FAILURE_COOLDOWN;
      if(error instanceof NewsFailure)log(error.code,error.diagnostic);
      else log(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'timeout':'network_error',{});
      return unavailable();
    }
  };
}
export default createNewsHandler();
