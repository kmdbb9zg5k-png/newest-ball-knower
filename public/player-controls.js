export const CONTROL_KEY='bk-drill-controls-v1';
export const DEFAULT_CONTROLS={version:1,hand:'left',size:'standard',height:'low',vibration:false,frames:60};
export function cleanControls(raw){const r=raw&&typeof raw==='object'?raw:{};return {version:1,hand:r.hand==='right'?'right':'left',size:r.size==='large'?'large':'standard',height:r.height==='raised'?'raised':'low',vibration:r.vibration===true,frames:r.frames===30?30:60};}
export function readControls(){try{return cleanControls(JSON.parse(localStorage.getItem(CONTROL_KEY)||'null'));}catch{return {...DEFAULT_CONTROLS};}}
export function saveControls(value){try{localStorage.setItem(CONTROL_KEY,JSON.stringify(cleanControls(value)));return true;}catch{return false;}}
export function controlPulse(enabled,pattern=18){if(enabled&&typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'){try{navigator.vibrate(pattern);}catch{/* Optional feedback must never interrupt play. */}}}
