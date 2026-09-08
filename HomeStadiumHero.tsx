import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight} from 'lucide-react';

const readReduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Decorative Home-only scene. No video, timers, player data or sound. */
export function HomeStadiumHero({onMyLeagues}:{onMyLeagues:()=>void}){
  const [reduced,setReduced]=useState(readReduced);
  const [visible,setVisible]=useState(()=>!document.hidden);
  const [onScreen,setOnScreen]=useState(true);
  const scene=useRef<HTMLElement>(null);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync=()=>setReduced(media.matches);
    const visibility=()=>setVisible(!document.hidden);
    media.addEventListener('change',sync);document.addEventListener('visibilitychange',visibility);
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>setOnScreen(entry.isIntersecting));
    if(scene.current)observer?.observe(scene.current);
    return()=>{media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',visibility);observer?.disconnect()};
  },[]);
  const moving=!reduced&&visible&&onScreen;
  return <section ref={scene} className="bk-home-stadium" aria-labelledby="home-stadium-title" data-motion={moving?'on':'off'}>
    <div className="bk-home-stadium-art" aria-hidden="true">
      <img src="/home/command-stadium.webp" alt="" width="400" height="242" fetchPriority="high" decoding="async"/>
      <div className="bk-home-team-tint"/>
      <div className="bk-home-light bk-home-light-one"/>
      <div className="bk-home-light bk-home-light-two"/>
      <div className="bk-home-floodlights">
        <i className="bk-home-floodlight"/><i className="bk-home-floodlight"/><i className="bk-home-floodlight"/>
        <i className="bk-home-floodlight"/><i className="bk-home-floodlight"/><i className="bk-home-floodlight"/>
      </div>
      <div className="bk-home-haze"/>
      <div className="bk-home-stadium-shade"/>
    </div>
    <div className="bk-home-hero-copy">
      <h2 id="home-stadium-title">The Ball Knowledge Command Center</h2>
      <p className="bk-home-hero-tagline">Intel. Insights. NFL mastery.</p>
      <button type="button" className="bk-home-gold-button" onClick={onMyLeagues}>My Leagues <ArrowRight size={16}/></button>
    </div>
  </section>;
}
