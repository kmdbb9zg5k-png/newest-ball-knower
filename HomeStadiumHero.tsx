import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,Pause,Play} from 'lucide-react';

const MOTION_KEY='bk-home-atmosphere-motion-v1';
const readMotion=()=>{try{return localStorage.getItem(MOTION_KEY)!=='off'}catch{return true}};
const readReduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Decorative Home-only scene. No video, timers, player data or sound. */
export function HomeStadiumHero({onMyLeagues}:{onMyLeagues:()=>void}){
  const [enabled,setEnabled]=useState(readMotion);
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
  const moving=enabled&&!reduced&&visible&&onScreen;
  const toggle=()=>setEnabled(value=>{try{localStorage.setItem(MOTION_KEY,value?'off':'on')}catch{}return!value});
  return <section ref={scene} className="bk-home-stadium" aria-labelledby="home-stadium-title" data-motion={moving?'on':'off'}>
    <div className="bk-home-stadium-art" aria-hidden="true">
      <img src="/atmosphere/home-stadium.webp" alt="" width="249" height="158" fetchPriority="high" decoding="async"/>
      <div className="bk-home-team-tint"/>
      <div className="bk-home-light bk-home-light-one"/>
      <div className="bk-home-light bk-home-light-two"/>
      <div className="bk-home-haze"/>
      <div className="bk-home-stadium-shade"/>
    </div>
    <button type="button" className="bk-home-motion" onClick={toggle} disabled={reduced} aria-pressed={enabled&&!reduced} aria-label={reduced?'Background motion off: Reduce Motion is enabled':enabled?'Pause background motion':'Enable background motion'} title={reduced?'Respects your device’s Reduce Motion setting':'Background effects only; soundtrack unchanged'}>
      {enabled&&!reduced?<Pause size={12}/>:<Play size={12}/>}<span>{reduced?'Reduced motion':`Motion ${enabled?'on':'off'}`}</span>
    </button>
    <div className="bk-home-hero-copy">
      <p className="bk-home-hero-eyebrow">Your game. Your legacy.</p>
      <h2 id="home-stadium-title">IT’S MORE<br/><span>THAN FANTASY.</span></h2>
      <p className="bk-home-hero-tagline">IT’S BALL KNOWLEDGE.</p>
      <button type="button" className="bk-home-gold-button" onClick={onMyLeagues}>My Leagues <ArrowRight size={16}/></button>
    </div>
  </section>;
}
