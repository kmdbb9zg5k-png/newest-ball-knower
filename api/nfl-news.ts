/** Tank01 headline/link feed. No Google RSS, article bodies or publisher images. */
const HOST='tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
const MAX_AGE=120_000;
let cached:{expires:number;payload:any}|null=null;
let pending:Promise<any>|null=null;
const plain=(value:unknown)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim():'';
const safeLink=(value:unknown)=>{
  try{const u=new URL(String(value));return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.toString():null}catch{return null}
};
export function normalizeNews(payload:any){
  const body=payload?.body??payload;
  const rows=Array.isArray(body)?body:Array.isArray(body?.news)?body.news:[];
  const seen=new Set<string>();
  const articles=rows.flatMap((row:any)=>{
    const headline=plain(row?.title??row?.headline).slice(0,240);
    const url=safeLink(row?.link??row?.url);if(!headline||!url||seen.has(url))return [];
    seen.add(url);
    const time=row?.publishedAt??row?.published??row?.pubDate??row?.date;
    const epoch=typeof time==='number'?(time>1e12?time:time*1000):Date.parse(String(time??''));
    const published=Number.isFinite(epoch)&&epoch>0?new Date(epoch).toISOString():null;
    const source=plain(row?.source?.name??row?.source)||new URL(url).hostname.replace(/^www\./,'');
    return [{id:url,headline,source,published,description:'',image:null,url}];
  }).sort((a:any,b:any)=>(Date.parse(b.published??'')||0)-(Date.parse(a.published??'')||0)).slice(0,20);
  if(!articles.length)throw new Error('No valid news links');
  return {articles,available:true,provider:'Tank01',fetchedAt:new Date().toISOString()};
}
export default async function handler(req:any,res:any){
  if(req.method && req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
  const unavailable=()=>{res.setHeader('Cache-Control','public, s-maxage=30, max-age=0');return res.status(200).json({articles:[],available:false,warning:'NFL news is temporarily unavailable.'})};
  try{
    if(cached&&cached.expires>Date.now()){res.setHeader('Cache-Control','public, s-maxage=120, max-age=0');return res.status(200).json(cached.payload)}
    const key=process.env.TANK01_API_KEY||process.env.RAPIDAPI_KEY;
    if(!key)return unavailable();
    if(!pending)pending=(async()=>{
      const url=`https://${HOST}/getNFLNews?maxItems=20`;
      const response=await fetch(url,{headers:{'x-rapidapi-key':key,'x-rapidapi-host':HOST},signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error(`News provider status ${response.status}`);
      const raw=await response.text();if(raw.length>1_000_000)throw new Error('News response too large');
      const payload=normalizeNews(JSON.parse(raw));cached={expires:Date.now()+MAX_AGE,payload};return payload;
    })().finally(()=>{pending=null});
    const payload=await pending;
    res.setHeader('Cache-Control','public, s-maxage=120, max-age=0');return res.status(200).json(payload);
  }catch{cached=null;console.warn('nfl-news-provider-unavailable');return unavailable()}
}
