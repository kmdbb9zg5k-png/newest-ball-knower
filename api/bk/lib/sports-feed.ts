/**
 * Ball Knower Sports API v1.
 * Source URLs are fixed server-side configuration, NEVER client-supplied URLs.
 * Configure only feeds you are licensed/permitted to redistribute.
 */
export type FeedKind='news'|'games'|'players'|'injuries';
type Result={items:unknown[];updatedAt:string;source:string};
const cache=new Map<FeedKind,{until:number;result:Result}>();
const inFlight=new Map<FeedKind,Promise<Result>>();
const ttl:Record<FeedKind,number>={news:300_000,games:60_000,players:3_600_000,injuries:300_000};
const env:Record<FeedKind,string>={news:'BK_NEWS_JSON_URL',games:'BK_GAMES_JSON_URL',players:'BK_PLAYERS_JSON_URL',injuries:'BK_INJURIES_JSON_URL'};
const clean=(v:unknown,n=300)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').trim().slice(0,n):'';
const safeUrl=(v:unknown)=>{try{const u=new URL(String(v));return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return''}};
function normalize(kind:FeedKind,raw:any):unknown[]{
  const rows=Array.isArray(raw)?raw:Array.isArray(raw?.items)?raw.items:Array.isArray(raw?.data)?raw.data:Array.isArray(raw?.articles)?raw.articles:Array.isArray(raw?.games)?raw.games:Array.isArray(raw?.players)?raw.players:Array.isArray(raw?.injuries)?raw.injuries:[];
  return rows.slice(0,100).flatMap((r:any)=>{
    if(!r||typeof r!=='object')return[];
    if(kind==='news'){
      const title=clean(r.headline??r.title,240),url=safeUrl(r.url??r.link);
      if(!title||!url)return[];
      return [{id:clean(r.id)||url,headline:title,url,source:clean(r.source?.name??r.source,120)||new URL(url).hostname,published:clean(r.publishedAt??r.published??r.pubDate,80)||null}];
    }
    if(kind==='games'){
      const id=clean(r.id??r.gameId??r.game_id,100),home=clean(r.home??r.homeTeam,80),away=clean(r.away??r.awayTeam,80);
      if(!id||!home||!away)return[];
      return [{id,home,away,startTime:clean(r.startTime??r.date,80)||null,status:clean(r.status,80)||'unknown',homeScore:Number.isFinite(Number(r.homeScore))&&r.homeScore!=null?Number(r.homeScore):null,awayScore:Number.isFinite(Number(r.awayScore))&&r.awayScore!=null?Number(r.awayScore):null}];
    }
    if(kind==='players'){
      const id=clean(r.id??r.playerId,100),name=clean(r.name??r.fullName,120);
      return id&&name?[{id,name,team:clean(r.team,80)||null,position:clean(r.position,20)||null}]:[];
    }
    const id=clean(r.id??r.playerId,100),status=clean(r.status,100);
    return id&&status?[{id,player:clean(r.player??r.name,120)||null,status,detail:clean(r.detail??r.injury,180)||null,updatedAt:clean(r.updatedAt,80)||null}]:[];
  });
}
export async function fetchFeed(kind:FeedKind):Promise<Result>{
  const cached=cache.get(kind);
  if(cached&&cached.until>Date.now())return cached.result;
  const pending=inFlight.get(kind);if(pending)return pending;
  const task=(async()=>{
    const value=process.env[env[kind]];
    if(!value)throw new Error('not_configured');
    const url=safeUrl(value);
    if(!url)throw new Error('invalid_feed_config');
    const response=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'},redirect:'error'});
    if(!response.ok)throw new Error('upstream_unavailable');
    const raw=await response.text();
    if(raw.length>1_000_000)throw new Error('response_too_large');
    const items=normalize(kind,JSON.parse(raw));
    if(!items.length)throw new Error('no_valid_items');
    const result={items,updatedAt:new Date().toISOString(),source:new URL(url).hostname};
    cache.set(kind,{result,until:Date.now()+ttl[kind]});return result;
  })();
  inFlight.set(kind,task);
  try{return await task}finally{inFlight.delete(kind)}
}
export function handlerFor(kind:FeedKind){
  return async(req:any,res:any)=>{
    res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60');
    if(req.method&&req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
    try{const result=await fetchFeed(kind);return res.status(200).json({available:true,kind,...result});}
    catch(error){console.warn('bk-feed-unavailable',kind,error instanceof Error?error.message:'unknown');return res.status(503).json({available:false,kind,items:[],error:'feed_unavailable'});}
  };
}
