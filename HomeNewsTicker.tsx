import React,{useEffect,useRef,useState} from 'react';
import {ChevronRight,ChevronDown,Pause,Play} from 'lucide-react';

const INTERVAL=120_000;
const ROTATION=10_000;
const HIDDEN_KEY='bk-home-headlines-hidden-v1';
type Story={id:string;headline:string;url:string};
let cache:{at:number;stories:Story[]}|null=null;
const readHidden=()=>{try{return localStorage.getItem(HIDDEN_KEY)==='yes'}catch{return false}};
export function validTickerStories(payload:any):Story[]{
  if(payload?.available!==true||!Array.isArray(payload.articles))return[];
  const seen=new Set<string>();
  return payload.articles.flatMap((row:any)=>{
    if(typeof row?.headline!=='string'||!row.headline.trim()||typeof row?.url!=='string')return[];
    try{
      const url=new URL(row.url);
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password||seen.has(url.href))return[];
      seen.add(url.href);return[{id:url.href,url:url.href,headline:row.headline.trim().slice(0,240)}];
    }catch{return[]}
  }).slice(0,20);
}
export function HomeNewsTicker({onOpenNews}:{onOpenNews:()=>void}){
  const [hidden,setHidden]=useState(readHidden);
  const [stories,setStories]=useState<Story[]>(()=>cache&&Date.now()-cache.at<INTERVAL?cache.stories:[]);
  const [selected,setSelected]=useState('');
  const [loading,setLoading]=useState(true);
  const [paused,setPaused]=useState(false);
  const [hovered,setHovered]=useState(false);
  const [visible,setVisible]=useState(()=>!document.hidden);
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const touch=useRef<{x:number;y:number}|null>(null);
  const dragged=useRef(false);
  const index=Math.max(0,stories.findIndex(story=>story.id===selected));
  const story=stories[index];
  const rotating=!paused&&!hovered&&!reduced&&visible&&!hidden&&stories.length>1;
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduced(media.matches);
    media.addEventListener('change',sync);
    return()=>media.removeEventListener('change',sync);
  },[]);
  useEffect(()=>{
    let alive=true;let timer:ReturnType<typeof setTimeout>|undefined;
    let controller:AbortController|undefined;let requestId=0;
    const load=async()=>{
      if(document.hidden||hidden||!alive)return;
      const id=++requestId;
      if(cache&&Date.now()-cache.at<INTERVAL){setStories(cache.stories);setLoading(false);timer=setTimeout(load,Math.max(500,INTERVAL-(Date.now()-cache.at)));return}
      controller=new AbortController();const own=controller;
      const timeout=setTimeout(()=>own.abort(),10_000);
      try{
        const response=await fetch('/api/nfl-news',{cache:'no-store',signal:own.signal});
        if(!response.ok)throw Error('Unavailable');
        const next=validTickerStories(await response.json());
        if(!next.length)throw Error('No stories');
        if(!alive||id!==requestId||document.hidden)return;
        cache={at:Date.now(),stories:next};setStories(next);
        setSelected(previous=>next.some(item=>item.id===previous)?previous:next[0].id);
      }catch{
        if(alive&&id===requestId&&!document.hidden){cache=null;setStories([])}
      }finally{
        clearTimeout(timeout);
        if(alive&&id===requestId&&!document.hidden){setLoading(false);timer=setTimeout(load,INTERVAL)}
      }
    };
    const visibility=()=>{
      setVisible(!document.hidden);clearTimeout(timer);
      // Invalidate old completions before resuming; no hidden-tab polling.
      requestId++;controller?.abort();
      if(!document.hidden)void load();
    };
    document.addEventListener('visibilitychange',visibility);
    void load();
    return()=>{alive=false;requestId++;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',visibility)};
  },[hidden]);
  useEffect(()=>{
    if(!rotating)return;
    const timer=setInterval(()=>setSelected(previous=>{
      const at=Math.max(0,stories.findIndex(item=>item.id===previous));
      return stories[(at+1)%stories.length].id;
    }),ROTATION);
    return()=>clearInterval(timer);
  },[rotating,stories]);
  const step=(delta:number)=>{setPaused(true);if(stories.length)setSelected(stories[(index+delta+stories.length)%stories.length].id)};
  const toggleHidden=()=>setHidden(value=>{try{localStorage.setItem(HIDDEN_KEY,value?'no':'yes')}catch{}return!value});
  return <div className="bk-home-news-strip" role="region" aria-label="NFL headlines" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={event=>{if(!(event.target as HTMLElement).closest('[data-rotation-control]'))setPaused(true)}}>
    <button type="button" className="bk-home-news-label" onClick={onOpenNews} aria-label="Open NFL News">NFL NEWS <ChevronRight size={10}/></button>
    {hidden?<span className="bk-home-news-empty">Headlines hidden</span>:<div className="bk-home-news-story" aria-live="off" data-rotating={rotating?'true':'false'}
      onTouchStart={event=>{touch.current={x:event.touches[0].clientX,y:event.touches[0].clientY};dragged.current=false}}
      onTouchEnd={event=>{if(!touch.current)return;const dx=event.changedTouches[0].clientX-touch.current.x;const dy=event.changedTouches[0].clientY-touch.current.y;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)){dragged.current=true;step(dx<0?1:-1)}touch.current=null}}>
      {story?<a key={story.id} href={story.url} target="_blank" rel="noopener noreferrer" title={story.headline} onClick={event=>{if(dragged.current){event.preventDefault();dragged.current=false}}}>{story.headline}</a>:<button type="button" onClick={onOpenNews}>{loading?'Loading headlines…':'News unavailable · Open feed'}</button>}
    </div>}
    {!hidden&&stories.length>1&&<><button type="button" data-rotation-control className="bk-home-news-control" onClick={()=>setPaused(value=>!value)} disabled={reduced} aria-label={reduced?'Automatic headlines off: Reduce Motion':paused?'Resume headline rotation':'Pause headline rotation'}>{paused||reduced?<Play size={12}/>:<Pause size={12}/>}</button><button type="button" className="bk-home-news-control bk-home-news-next" onClick={()=>step(1)} aria-label="Next headline"><ChevronRight size={14}/></button></>}
    <button type="button" className="bk-home-news-control" aria-expanded={!hidden} onClick={toggleHidden} aria-label={hidden?'Show headlines':'Hide headlines'}><ChevronDown size={13} style={{transform:hidden?'rotate(-90deg)':undefined}}/></button>
  </div>;
}
