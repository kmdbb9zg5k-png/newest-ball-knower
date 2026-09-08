import React,{createContext,useEffect,useRef,useState} from 'react';
import {useBroadcastFocus,useBroadcastFocused} from './broadcastFocus';

export type BroadcastScene='tunnel'|'studio'|'office'|'suite'|'field'|'locker'|'legacy';
const KEY='bk-home-atmosphere-motion-v1';
const EVENT='bk-atmosphere-motion-change';
const preference=()=>{try{return localStorage.getItem(KEY)!=='off'}catch{return true}};
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const MotionContext=createContext({enabled:false,reduced:false,quiet:false,toggle:()=>{}});

/** Presentation only. Children keep their existing state, actions and data providers. */
export function BroadcastStage({scene,page,quiet=false,className='',children}:{scene:BroadcastScene;page?:string;quiet?:boolean;className?:string;children:React.ReactNode}){
  const [enabled,setEnabled]=useState(preference);
  const [reduce,setReduce]=useState(reduced);
  const [visible,setVisible]=useState(()=>!document.hidden);
  const [onScreen,setOnScreen]=useState(true);
  const ref=useRef<HTMLDivElement>(null);
  useBroadcastFocus(quiet);
  const focused=useBroadcastFocused();
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>{setEnabled(preference());setReduce(media.matches)};
    const visibility=()=>setVisible(!document.hidden);
    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(([entry])=>setOnScreen(entry.isIntersecting)):null;
    if(ref.current)observer?.observe(ref.current);
    media.addEventListener('change',sync);document.addEventListener('visibilitychange',visibility);
    window.addEventListener('storage',sync);window.addEventListener(EVENT,sync);
    return()=>{observer?.disconnect();media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('storage',sync);window.removeEventListener(EVENT,sync)};
  },[]);
  const toggle=()=>{
    const next=!enabled;setEnabled(next);
    try{localStorage.setItem(KEY,next?'on':'off')}catch{}
    window.dispatchEvent(new Event(EVENT));
  };
  const moving=enabled&&!reduce&&!quiet&&!focused&&visible&&onScreen;
  return <MotionContext.Provider value={{enabled,reduced:reduce,quiet:quiet||focused,toggle}}>
    <div className={`bk-screen ${className}`} data-scene={scene} data-page={page} data-motion={moving?'on':'off'} data-quiet={quiet?'true':'false'}>
      <div ref={ref} className="bk-scene-backdrop" aria-hidden="true">
        <div className="bk-scene-art"/>
        <div className="bk-scene-architecture"><i/><i/><i/></div>
        <div className="bk-scene-beam bk-scene-beam-left"/><div className="bk-scene-beam bk-scene-beam-right"/>
        <div className="bk-scene-haze"/><div className="bk-scene-shade"/>
      </div>
      <div className="bk-screen-content">{children}</div>
    </div>
  </MotionContext.Provider>;
}

// Kept as a no-op export so any older callers cannot render the removed control.
export function BroadcastMotionControl(){return null;}

export function BroadcastMasthead({eyebrow,title,subtitle,actions,compact=false}:{eyebrow:string;title:string;subtitle?:string;actions?:React.ReactNode;compact?:boolean;showMotionControl?:boolean}){
  return <header className={`bk-scene-masthead${compact?' bk-scene-masthead-compact':''}`}>
    <div className="bk-scene-toolbar"><span className="bk-scene-eyebrow">{eyebrow}</span><div className="bk-scene-actions">{actions}</div></div>
    <div className="bk-scene-title"><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>
    <div className="bk-scene-rule" aria-hidden="true"/>
  </header>;
}
