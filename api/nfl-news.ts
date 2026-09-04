const decodeEntities=(value:string)=>value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
  .replace(/&nbsp;/g,' ')
  .replace(/&amp;/g,'&')
  .replace(/&quot;/g,'"')
  .replace(/&#39;|&apos;/g,"'")
  .replace(/&lt;/g,'<')
  .replace(/&gt;/g,'>');

const tag=(xml:string,name:string)=>{
  const match=xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'));
  return match?decodeEntities(match[1].trim()):'';
};
const plainText=(value:string)=>decodeEntities(value.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
const usefulSummary=(raw:string,headline:string,source:string)=>{
  let text=plainText(raw);
  if(text.toLowerCase().startsWith(headline.toLowerCase()))text=text.slice(headline.length).trim();
  text=text.replace(new RegExp(`^[-–—·\\s]*${source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[-–—·\\s]*$`,'i'),'').trim();
  return text.length>=24?text.slice(0,280):'';
};

const sendUnavailable=(res:any)=>{
  res.setHeader('Cache-Control','public, s-maxage=30, max-age=0');
  res.status(200).json({articles:[],available:false,warning:'NFL news is temporarily unavailable.'});
};

export default async function handler(_req:any,res:any){
  try{
    const signal=AbortSignal.timeout(8000);
    const upstream=await fetch(
      'https://news.google.com/rss/search?q=NFL%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen',
      {headers:{'User-Agent':'Mozilla/5.0 (compatible; BallKnower/1.0; +https://ballknower.com)'},signal},
    );
    if(!upstream.ok){console.warn('nfl-news-upstream-unavailable',upstream.status);return sendUnavailable(res)}

    const xml=await upstream.text();
    const items=xml.match(/<item>[\s\S]*?<\/item>/gi)||[];
    const articles=items.map((item:string,i:number)=>{
      const rawTitle=tag(item,'title');
      const source=tag(item,'source')||rawTitle.match(/\s+-\s+([^-]+)$/)?.[1]?.trim()||'NFL News';
      const headline=rawTitle.replace(/\s+-\s+[^-]+$/,'').trim()||'NFL Update';
      const published=tag(item,'pubDate')||'';
      return{
        id:tag(item,'guid')||`${published}-${i}`,
        headline,
        source,
        description:usefulSummary(tag(item,'description'),headline,source),
        published:published||null,
        image:null,
        url:tag(item,'link')||null,
      };
    }).filter((article:any)=>article.headline&&article.url)
      .sort((a:any,b:any)=>{
        const aTime=Date.parse(a.published||'');const bTime=Date.parse(b.published||'');
        return(Number.isFinite(bTime)?bTime:0)-(Number.isFinite(aTime)?aTime:0);
      }).slice(0,20);

    if(!articles.length){console.warn('nfl-news-feed-degraded','no-current-articles');return sendUnavailable(res)}

    res.setHeader('Cache-Control','public, s-maxage=120, max-age=0');
    res.status(200).json({articles,available:true,fetchedAt:new Date().toISOString()});
  }catch(error:any){
    const timeout=error?.name==='TimeoutError'||error?.name==='AbortError';
    console.warn('nfl-news-feed-degraded',timeout?'timeout':String(error?.message||error));
    return sendUnavailable(res);
  }
}
