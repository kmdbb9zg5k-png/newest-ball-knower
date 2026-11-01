import {BroadcastStage,BroadcastMasthead} from './BroadcastScene';
import React,{useEffect,useRef,useState}from'react';
import{ExternalLink,Newspaper,RefreshCw}from'lucide-react';
import{loadNewsFeed,type NewsFeed,type NewsItem}from'./sportsApiClient';

const safeExternalUrl=(value?:string)=>{
  if(!value)return'';
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.toString():''}catch{return''}
};
const publishedLabel=(value?:string)=>{
  if(!value)return'Publication time not supplied';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleString():'Publication time not supplied';
};

export const NewsHub:React.FC=()=>{
  const[items,setItems]=useState<NewsItem[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[feed,setFeed]=useState<NewsFeed|null>(null);
  const activeRequest=useRef<AbortController|null>(null);

  const load=async()=>{
    activeRequest.current?.abort();
    const controller=new AbortController();activeRequest.current=controller;
    setLoading(true);setError('');setItems([]);setFeed(null);
    try{
      const data=await loadNewsFeed({useSportsApi:import.meta.env.VITE_BK_NEWS_API_ENABLED==='true',signal:controller.signal});
      if(controller.signal.aborted)return;
      setItems(data.articles);setFeed(data);
    }catch{
      if(controller.signal.aborted)return;
      // Do not surface native/WebKit/provider exception strings or leave an old
      // cached board visible as if it were current after a failed refresh.
      setItems([]);
      setError('NFL news is temporarily unavailable. Use Refresh to try again.');
    }finally{if(!controller.signal.aborted)setLoading(false)}
  };

  useEffect(()=>{void load();return()=>activeRequest.current?.abort()},[]);

  return <BroadcastStage scene="studio" page="news" className="min-h-[calc(100dvh-7rem)] px-4 pb-8 pt-0 sm:px-8"><div className="mx-auto max-w-6xl">
    <BroadcastMasthead eyebrow="Around the league" title="NFL News" subtitle="Read each headline at its publisher." compact actions={<button type="button" onClick={()=>void load()} aria-label="Refresh" disabled={loading} className="bk-news-refresh disabled:opacity-50"><RefreshCw size={15} className={loading?'animate-spin':''}/><span>Refresh</span></button>}/>

    {feed&&<p role="status" className="mb-4 break-words text-xs leading-relaxed text-zinc-400">Headlines supplied by {feed.provider}. {feed.fetchedAt?<>Feed retrieved <time dateTime={feed.fetchedAt}>{new Date(feed.fetchedAt).toLocaleString()}</time>.</>:'Feed retrieval time unavailable.'} {feed.stale?'This feed may be out of date. ':''}{feed.fallback?'Backup feed in use. ':''}Publication times appear below.</p>}

    {error&&<div role="status" className="mb-5 border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">{error}</div>}
    {loading&&items.length===0?<div className="grid gap-4 md:grid-cols-2">{[0,1,2,3].map(i=><div key={i} className="h-48 animate-pulse rounded-xl border border-white/5 bg-white/[.03]"/>)}</div>:items.length===0?<div className="rounded-xl border border-white/10 bg-[#111] p-10 text-center text-zinc-400">No current headlines are available right now.</div>:<div className="bk-news-list">{items.map(item=>{const storyUrl=safeExternalUrl(item.url);return <article key={item.id} className="bk-news-story">
      <span className="bk-story-mark" aria-hidden="true"><Newspaper size={21}/></span>
      <div><h3>{storyUrl?<a href={storyUrl} target="_blank" rel="noreferrer noopener">{item.headline}</a>:item.headline}</h3>
      <p><span>{item.source||'NFL News'}</span> · <time dateTime={item.published||undefined}>{publishedLabel(item.published)}</time></p>
      {(item.license||item.attribution)&&<p className="break-words">{item.license&&(safeExternalUrl(item.licenseUrl)?<a href={safeExternalUrl(item.licenseUrl)} target="_blank" rel="noreferrer noopener">{item.license}</a>:<span>{item.license}</span>)}{item.license&&item.attribution?' · ':''}{item.attribution&&(safeExternalUrl(item.attribution)?<a href={safeExternalUrl(item.attribution)} target="_blank" rel="noreferrer noopener">Source attribution</a>:<span>{item.attribution}</span>)}</p>}
</div>
      {storyUrl&&<a href={storyUrl} target="_blank" rel="noreferrer noopener" aria-label={`Read story: ${item.headline}`}><ExternalLink size={14}/></a>}
    </article>})}</div>}

  </div></BroadcastStage>;
};
