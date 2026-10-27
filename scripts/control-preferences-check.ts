import assert from 'node:assert/strict';
import {cleanControls,DEFAULT_CONTROLS,CONTROL_KEY,readControls,saveControls,createPresentationGate,controlPulse} from '../combine/controlPreferences';
assert.deepEqual(cleanControls(null),DEFAULT_CONTROLS);
assert.deepEqual(cleanControls({hand:'inject',size:999,height:'sky',frames:1,vibration:'yes'}),DEFAULT_CONTROLS);
const custom=cleanControls({hand:'right',size:'large',height:'raised',frames:30,vibration:true});
assert.equal(custom.hand,'right');assert.equal(custom.frames,30);
const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
assert(saveControls(custom));assert.deepEqual(readControls(),custom);
data.set(CONTROL_KEY,'broken json');assert.deepEqual(readControls(),DEFAULT_CONTROLS);
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('full')}}});
assert.deepEqual(readControls(),DEFAULT_CONTROLS);assert.equal(saveControls(custom),false);
for(const fps of [30,60] as const){const gate=createPresentationGate();let draws=0,simulated=0;for(let frame=0;frame<=120;frame++){simulated+=1/120;if(gate(frame*1000/120,false,fps)!==null)draws++;}assert(Math.abs(simulated-121/120)<1e-10);assert(draws<=fps+1);assert(draws>=fps-1);assert.equal(gate(2000,true,fps),null);assert.equal(gate(9999,false,fps),0,'Returning from hidden state never accumulates a huge animation delta');}
const gate=createPresentationGate();gate(0,false,60);assert.equal(gate(1000,false,60),.1,'Bound animation jumps');
let pulses=0;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:(ms:number)=>{assert.equal(ms,18);pulses++;}}});controlPulse(false);assert.equal(pulses,0);controlPulse(true);assert.equal(pulses,1);
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:()=>{throw Error('unsupported')}}});assert.doesNotThrow(()=>controlPulse(true));
console.log('PASS control preferences: input normalization, persistence and storage denial, reset defaults, optional vibration, 30/60 presentation cadence with unchanged simulation ticks, hidden-tab rendering suppression.');
