import React,{useRef,useState} from 'react';
import {cleanControls,controlPulse,DEFAULT_CONTROLS,readControls,saveControls,type ControlPreferences} from './controlPreferences';
import './controlSettings.css';
export function useDrillControls(){
 const [controls,setControls]=useState(readControls),[saved,setSaved]=useState(true),ref=useRef(controls);ref.current=controls;
 const change=(patch:Partial<ControlPreferences>)=>{const next=cleanControls({...ref.current,...patch});ref.current=next;setControls(next);setSaved(saveControls(next));};
 return {controls,ref,change,saved};
}
export default function ControlSettings({controls,onChange,saved}:{controls:ControlPreferences;onChange:(patch:Partial<ControlPreferences>)=>void;saved:boolean}){
 const supported=typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
 return <details className="bk-control-settings" onKeyDown={e=>{if(e.key!=='Tab')e.stopPropagation();}}><summary>Customize controls</summary><div className="bk-control-options">
 <label>Movement stick<select aria-label="Movement stick" value={controls.hand} onChange={e=>onChange({hand:e.target.value as ControlPreferences['hand']})}><option value="left">Left side</option><option value="right">Right side</option></select></label>
 <label>Control size<select aria-label="Control size" value={controls.size} onChange={e=>onChange({size:e.target.value as ControlPreferences['size']})}><option value="standard">Standard</option><option value="large">Large</option></select></label>
 <label>Control height<select aria-label="Control height" value={controls.height} onChange={e=>onChange({height:e.target.value as ControlPreferences['height']})}><option value="low">Low</option><option value="raised">Raised</option></select></label>
 <label>Visual frame rate<select aria-label="Visual frame rate" value={controls.frames} onChange={e=>onChange({frames:Number(e.target.value) as 30|60})}><option value={60}>Up to 60 FPS</option><option value={30}>Up to 30 FPS · lower graphics workload</option></select></label>
 <label className="bk-control-toggle"><input type="checkbox" checked={controls.vibration} disabled={!supported} onChange={e=>{onChange({vibration:e.target.checked});controlPulse(e.target.checked);}}/>Action vibration{!supported?' · unavailable in this browser':''}</label>
 <button type="button" onClick={()=>onChange(DEFAULT_CONTROLS)}>Reset controls</button><p role="status">{saved?'Saved on this device for dash, receiver, running-back and DB drills and full games.':'Settings apply now, but could not be saved on this device.'} Frame-rate limits do not change athlete ratings or scoring.</p>
 </div></details>;
}
