import React,{useEffect,useRef,useState} from 'react';
export default function HoldPauseButton({onPause}:{onPause:()=>void}){
 const [progress,setProgress]=useState(0),timer=useRef(0),started=useRef(0);
 const cancel=()=>{window.clearInterval(timer.current);timer.current=0;setProgress(0);};
 useEffect(()=>()=>window.clearInterval(timer.current),[]);
 return <button className="skill-pause-hold" aria-label="Hold to pause" title="Hold for half a second to pause" style={{'--pause-progress':`${progress*360}deg`} as React.CSSProperties}
 onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();cancel();started.current=performance.now();timer.current=window.setInterval(()=>{const p=Math.min(1,(performance.now()-started.current)/500);setProgress(p);if(p===1){cancel();onPause();}},16);}}
 onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel} onBlur={cancel}
 onClick={e=>{if(e.detail===0)onPause();}}>Ⅱ<small>HOLD</small></button>;
}
