import {BroadcastStage,BroadcastMasthead,BroadcastMotionControl} from './BroadcastScene';
import React,{useEffect,useState}from'react';
import{ExternalLink,Newspaper,RefreshCw}from'lucide-react';

type NewsItem={
  id:string;
  headline:string;
  source?:string;
  description?:string;
  published?:string;
  image?:string;
  url?:string;
};

const safeExternalUrl=(value?:string)=>{
  if(!value)return'';
  try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.toString():''}catch{return''}
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

  const load=async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch('/api/nfl-news',{cache:'no-store'});
      if(!response.ok)throw new Error('unavailable');
      const data=await response.json();
      if(data?.available===false)throw new Error('unavailable');
      const next=Array.isArray(data?.articles)?data.articles:[];
      if(!next.length)throw new Error('unavailable');
      setItems(next);
    }catch{
      // Do not surface native/WebKit/provider exception strings or leave an old
      // cached board visible as if it were current after a failed refresh.
      setItems([]);
      setError('NFL news is temporarily unavailable. Use Refresh to try again.');
    }finally{setLoading(false)}
  };

  useEffect(()=>{void load()},[]);

  return <BroadcastStage scene="studio" page="news" className="min-h-[calc(100dvh-7rem)] px-4 pb-8 pt-0 sm:px-8"><div className="mx-auto max-w-6xl">
    <BroadcastMasthead eyebrow="Around the league" title="NFL News" subtitle="Headlines supplied by Tank01. Read each story at its publisher." compact actions={<button type="button" onClick={()=>void load()} aria-label="Refresh" className="bk-news-refresh"><RefreshCw size={15} className={loading?'animate-spin':''}/><span>Refresh</span></button>}/>


    {error&&<div role="status" className="mb-5 border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">{error}</div>}
    {loading&&items.length===0?<div className="grid gap-4 md:grid-cols-2">{[0,1,2,3].map(i=><div key={i} className="h-48 animate-pulse rounded-xl border border-white/5 bg-white/[.03]"/>)}</div>:items.length===0?<div className="rounded-xl border border-white/10 bg-[#111] p-10 text-center text-zinc-400">No current headlines are available right now.</div>:<div className="bk-news-list">{items.map(item=>{const storyUrl=safeExternalUrl(item.url);return <article key={item.id} className="bk-news-story">
      <span className="bk-story-mark" aria-hidden="true"><Newspaper size={21}/></span>
      <div><h3>{storyUrl?<a href={storyUrl} target="_blank" rel="noreferrer noopener">{item.headline}</a>:item.headline}</h3>
      <p><span>{item.source||'NFL News'}</span> · <time dateTime={item.published||undefined}>{publishedLabel(item.published)}</time></p>
</div>
      {storyUrl&&<a href={storyUrl} target="_blank" rel="noreferrer noopener" aria-label={`Read story: ${item.headline}`}><ExternalLink size={14}/></a>}
    </article>})}</div>}

  </div></BroadcastStage>;
};
