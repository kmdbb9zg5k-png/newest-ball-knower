export type ControlPreferences={version:1;hand:'left'|'right';size:'standard'|'large';height:'low'|'raised';vibration:boolean;frames:30|60};
import {CONTROL_KEY,DEFAULT_CONTROLS as defaults,cleanControls as clean,readControls as read,saveControls as save,controlPulse} from '../public/player-controls.js';
export {CONTROL_KEY,controlPulse};
export const DEFAULT_CONTROLS=defaults as ControlPreferences;
export const cleanControls=(raw:unknown)=>clean(raw) as ControlPreferences;
export const readControls=()=>read() as ControlPreferences;
export const saveControls=(value:ControlPreferences)=>save(value);
/** Simulation continues at the display cadence; only expensive drawing/HUD updates are limited. */
export function createPresentationGate(){let previous:number|null=null;return (now:number,hidden:boolean,fps:30|60)=>{
 if(hidden){previous=null;return null;}
 if(previous===null){previous=now;return 0;}
 const elapsed=now-previous;if(elapsed<1000/fps-1)return null;
 previous=now;return Math.min(.1,Math.max(0,elapsed/1000));
};}
