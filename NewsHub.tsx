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
  if(!value)return'Recent NFL update';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleString():'Recent NFL update';
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

  return <div className="min-h-[calc(100vh-7rem)] px-4 py-8 sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="mb-7 flex items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.28em] text-[#D4AF37]"><Newspaper className="h-4 w-4"/>NFL News<span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]"/></div><h2 className="font-display text-4xl font-black uppercase sm:text-6xl">Around the <span className="text-[#D4AF37]">League</span></h2><p className="mt-2 max-w-2xl text-sm text-zinc-400">Current league-wide NFL headlines, newest first.</p></div><button onClick={()=>void load()} className="flex shrink-0 items-center gap-2 border border-white/10 bg-[#151515] px-3 py-2 text-xs font-black uppercase tracking-wider text-zinc-300 hover:border-[#D4AF37]/50"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</button></div>

    {error&&<div role="status" className="mb-5 border border-amber-400/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">{error}</div>}
    {loading&&items.length===0?<div className="grid gap-4 md:grid-cols-2">{[0,1,2,3].map(i=><div key={i} className="h-48 animate-pulse rounded-xl border border-white/5 bg-white/[.03]"/>)}</div>:items.length===0?<div className="rounded-xl border border-white/10 bg-[#111] p-10 text-center text-zinc-400">No current headlines are available right now.</div>:<div className="grid gap-4 md:grid-cols-2">{items.map(item=>{const storyUrl=safeExternalUrl(item.url);return <article key={item.id} className="group overflow-hidden rounded-xl border border-white/10 bg-[#111]/90 shadow-xl transition hover:border-[#D4AF37]/40">{item.image&&safeExternalUrl(item.image)&&<img src={safeExternalUrl(item.image)} loading="lazy" decoding="async" alt="" className="h-44 w-full object-cover opacity-85 transition group-hover:opacity-100"/>}<div className="p-5"><div className="mb-2 flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-black uppercase tracking-[.16em] text-zinc-500"><span>{item.source||'NFL News'}</span><span aria-hidden="true">·</span><time dateTime={item.published||undefined}>{publishedLabel(item.published)}</time></div><h3 className="text-xl font-black leading-tight text-white">{item.headline}</h3>{item.description&&<p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-400">{item.description}</p>}{storyUrl&&<a href={storyUrl} target="_blank" rel="noreferrer noopener" className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#D4AF37]">Read Story <ExternalLink className="h-3.5 w-3.5"/></a>}</div></article>})}</div>}
  </div></div>;
};
