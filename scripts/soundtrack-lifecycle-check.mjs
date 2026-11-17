import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import * as policy from '../soundtrackPolicy.ts';

const source=await readFile(process.env.BK_SOUNDTRACK_SOURCE||new URL('../SoundtrackContext.tsx',import.meta.url),'utf8');
const compiled=transformSync(source,{loader:'tsx',format:'cjs',jsx:'transform'}).code;
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const tracks=[{id:'one',title:'One',url:'/audio/one.mp3'},{id:'two',title:'Two',url:'/audio/two.mp3'},{id:'manual',title:'Manual',url:'/audio/manual.mp3',manualOnly:true}];
const OWNER_A='11111111-1111-4111-8111-111111111111',OWNER_B='22222222-2222-4222-8222-222222222222';

function harness(stored={},native=false,library=tracks,random=()=>0, iOS=false){
 const slots=[],effects=[],timers=new Map(),storage=new Map(Object.entries({ballknower_cloud_owner_v1:OWNER_A,...stored})),cloud=deferred(),recovery=deferred();
 const nativeListener=deferred();let nativeCallback,nativeRemovals=0;
 let cursor=0,dirty=true,output,unmounted=false,timerId=0,blobCount=0;
 const loads=[],saves=[],audios=[],revoked=[];
 const browser=new EventTarget(),document=new EventTarget();Object.assign(document,{hidden:false,visibilityState:'visible'});
 const hooks={
  createContext:()=>({Provider:'Provider'}),createElement:(type,props,...children)=>({type,props:{...props,children}}),
  useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,value=>{const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
  useRef(value){const i=cursor++;slots[i]??={current:value};return slots[i];},
  useCallback(callback,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n])))slots[i]={value:callback,deps};return slots[i].value;},
  useEffect(callback,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,n)=>!Object.is(d,old.deps[n]))){slots[i]={...old,deps};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=callback();});}},
 };
 class Media extends EventTarget{
  constructor(){super();this.currentTime=0;this.duration=180;this.paused=true;this.volume=1;this.muted=false;this.playCalls=0;this._src='';audios.push(this);}
  get src(){return this._src;}set src(value){this._src=new URL(value,'https://ballknower.test/').href;this.currentTime=0;this.paused=true;}
  play(){this.paused=false;this.playCalls++;this.dispatchEvent(new Event('play'));return Promise.resolve();}
  pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'));}}
  load(){}
  end(time=180){this.currentTime=time;this.paused=true;this.dispatchEvent(new Event('pause'));this.dispatchEvent(new Event('ended'));}
 }
 class TestURL extends URL{static createObjectURL(){return 'blob:recovered-'+(++blobCount)}static revokeObjectURL(url){revoked.push(url)}}
 Object.assign(browser,{location:{href:'https://ballknower.test/'},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
 const gain = { gain: { value: 1 }, connect() {} };
 if (iOS) Object.assign(browser, {
  navigator: { userAgent: 'iPhone' },
  AudioContext: class {
   state = 'suspended';
   createGain() { return gain; }
   createMediaElementSource() { return { connect() {} }; }
   async resume() { this.state = 'running'; }
   async close() { this.state = 'closed'; }
  },
 });
 const module={exports:{}};
 const context={module,exports:module.exports,console,URL:TestURL,Audio:Media,document,window:browser,localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},fetch:async url=>url==='/api/media'?{ok:true,json:async()=>({tracks:library})}:recovery.promise,Math:Object.assign(Object.create(Math),{random}),require:name=>{
  if(name==='react')return {...hooks,default:hooks,__esModule:true};
  if(name==='@capacitor/core')return{Capacitor:{isNativePlatform:()=>native}};
  if(name==='@capacitor/app')return{App:{addListener(_name,callback){nativeCallback=callback;return nativeListener.promise;}}};
  if(name==='./soundtrackPolicy')return policy;
  if(name==='./soundtrackEngine')return{globalSoundtrackEngine:{}};
  if(name==='./userStateCloud')return{loadUserState:(key,owner)=>{loads.push({key,owner});return cloud.promise;},saveUserState:async(key,value,owner)=>{saves.push({key,value,owner});}};
  throw Error('Unexpected import '+name);
 }};
 vm.runInNewContext(compiled,context);
 const render=()=>{cursor=0;dirty=false;output=module.exports.SoundtrackProvider({children:null});for(const effect of effects.splice(0))effect();};
 const flush=async()=>{for(let turn=0;turn<12;turn++){if(dirty&&!unmounted)render();await Promise.resolve();}};
 const visibility=async hidden=>{document.hidden=hidden;document.visibilityState=hidden?'hidden':'visible';document.dispatchEvent(new Event('visibilitychange'));await flush();};
 return{flush,cloud,recovery,loads,saves,audios,storage,revoked,visibility,nativeListener,gain,get nativeRemovals(){return nativeRemovals},registerNative:()=>nativeListener.resolve({remove:async()=>{nativeRemovals++}}),appState:async isActive=>{nativeCallback?.({isActive});await flush();},get value(){return output.props.value},get audio(){return audios[0]},get blobs(){return blobCount},pointer:async()=>{browser.dispatchEvent(new Event('pointerdown'));await flush();},timers:async()=>{for(const [id,fn]of [...timers]){timers.delete(id);fn();}await flush();},unmount(){unmounted=true;for(const slot of slots)slot?.cleanup?.();}};
}

{
 const h=harness({bk_soundtrack_muted:'true'});await h.flush();assert.equal(h.audios.length,1);assert(h.audio.paused,'Intro owns audio until it exits');
 h.value.setIntroActive(false);await h.flush();assert(!h.audio.paused);assert.equal(h.audio.muted,true,'Saved mute remains applied');
 const first=h.value.currentTrack.id;h.audio.end();await h.flush();assert.notEqual(h.value.currentTrack.id,first);assert(!h.audio.paused,'Natural ended/pause order must automatically start the next uploaded track');assert(!h.value.currentTrack.manualOnly);
 await h.visibility(true);assert(h.audio.paused);await h.pointer();assert(h.audio.paused,'Background gestures cannot start music');await h.visibility(false);assert(!h.audio.paused);
 h.value.pause();await h.flush();await h.visibility(true);await h.visibility(false);await h.pointer();assert(h.audio.paused,'An explicit pause survives background/foreground and gestures');
 h.value.setIntroActive(true);h.value.play();await h.flush();assert(h.audio.paused,'Play stays blocked while intro/team setup owns audio');h.value.setIntroActive(false);await h.flush();assert(!h.audio.paused);h.unmount();
}
{
 const h=harness();await h.flush();h.value.setIntroActive(false);await h.flush();h.audio.end(8);await h.flush();h.value.selectTrack(1);await h.flush();const selected=h.audio.src;
 h.recovery.resolve({ok:true,blob:async()=>({})});await h.flush();assert.equal(h.audio.src,selected,'A delayed recovery must not replace a newly selected track');h.unmount();
}
{
 const h=harness();await h.flush();h.value.setIntroActive(false);await h.flush();h.audio.end(8);await h.flush();h.recovery.resolve({ok:true,blob:async()=>({})});await h.flush();h.audio.dispatchEvent(new Event('loadedmetadata'));await h.flush();
 assert(h.audio.src.startsWith('blob:'),'Recovered audio must not immediately be replaced by the original broken URL');assert(!h.audio.paused);h.audio.end(9);await h.flush();assert.equal(h.value.currentTrack.id,'two','Repeated early ending must advance after one recovery');h.unmount();assert.equal(h.revoked.length,1);
}
{
 const h=harness({bk_soundtrack_volume:'not-a-number',bk_soundtrack_muted:'"false"'});await h.flush();assert.equal(h.value.volume,.22);assert.equal(h.value.isMuted,false);await h.timers();assert.equal(h.saves.length,0,'Initial defaults cannot overwrite cloud settings before restore settles');
 h.value.toggleMute();h.value.setVolume(.4);await h.flush();h.cloud.resolve({muted:false,volume:.9});await h.flush();assert.equal(h.value.isMuted,true,'A delayed cloud restore must preserve a newer local mute change');assert.equal(h.value.volume,.4);await h.timers();assert.equal(h.saves.at(-1).value.volume,.4);h.unmount();
}
{
 const h=harness();await h.flush();h.value.setIntroActive(false);await h.flush();h.audio.end(8);await h.flush();h.unmount();h.recovery.resolve({ok:true,blob:async()=>({})});await h.flush();assert.equal(h.blobs,0,'A completed fetch after unmount must not allocate an orphaned audio blob');
}
{
 const h=harness({},true);await h.flush();h.value.setIntroActive(false);await h.flush();await h.appState(false);assert(h.audio.paused);await h.visibility(true);await h.visibility(false);assert(h.audio.paused,'A visibility event cannot override native background state');await h.appState(true);assert(!h.audio.paused);await h.visibility(true);await h.appState(true);assert(h.audio.paused,'Native activation cannot override a hidden document');h.unmount();h.registerNative();await h.flush();assert.equal(h.nativeRemovals,1,'An asynchronously registered native listener must be removed after unmount');
}
{
 const h=harness({ballknower_cloud_owner_v1:null});await h.flush();assert.equal(h.loads.length,0,'Offline soundtrack controls must not start a cloud identity');h.value.toggleMute();await h.flush();await h.timers();assert.equal(h.saves.length,0,'Offline preference edits remain local without an owner');h.unmount();
}
{
 const h=harness();await h.flush();assert.equal(h.loads[0].owner,OWNER_A,'Hydration uses the originating expected owner');h.cloud.resolve(null);await h.flush();await h.timers();assert.equal(h.saves.length,0,'Untouched hydration never uploads defaults');h.value.setVolume(.65);await h.flush();h.storage.set('ballknower_cloud_owner_v1',OWNER_B);await h.timers();assert.equal(h.saves.at(-1).owner,OWNER_A,'A delayed save retains its originating expected owner');h.unmount();
}
console.log('PASS real soundtrack provider with fake media: intro ownership, single audio, mute/volume restore, ended auto-advance, foreground intent, bounded/race-safe recovery, unmount cleanup and cloud-restore ordering');
{
 const full=[...tracks.filter(x=>!x.manualOnly),{id:'three',title:'Three',url:'/audio/three.mp3'},{id:'four',title:'Four',url:'/audio/four.mp3'},tracks.find(x=>x.manualOnly)];
 const h=harness({},false,full);await h.flush();h.value.setIntroActive(false);await h.flush();
 const heard=[h.value.currentTrack.id];
 for(let i=0;i<3;i++){h.audio.end(180);await h.flush();heard.push(h.value.currentTrack.id);}
 assert.equal(new Set(heard).size,4,'Each automatic song must play exactly once per shuffle cycle before repeating');
 assert(!heard.includes('manual'),'Manually excluded tracks stay out of the automatic playlist');
 const previous=heard.at(-1);
 h.audio.end(180);await h.flush();
 assert.notEqual(h.value.currentTrack.id,previous,'A new shuffle cycle must not start with the same track that just ended');
 h.unmount();
}
{
 const library=tracks.filter(x=>!x.manualOnly);
 const h=harness({bk_soundtrack_last_track_id:'one'},false,library,()=>0);
 await h.flush();
 assert.equal(h.value.currentTrack.id,'two','Reopening the app must avoid the previously played song when possible');
 h.unmount();
}

console.log('PASS owner/offline preferences: no cloud bootstrap, no untouched default writes, scoped hydration and originating-owner debounce');

{
 const h = harness({bk_soundtrack_muted:'true'}, false, tracks, () => 0, true);
 await h.flush();
 h.value.setIntroActive(false);
 await h.flush();
 assert.equal(h.audio.crossOrigin, 'anonymous');
 assert.equal(h.gain.gain.value, 0, 'The iOS audio graph starts muted');
 const playCalls = h.audio.playCalls;
 h.audio.currentTime = 37;
 h.value.setVolume(.55, true);
 await h.flush();
 assert.equal(h.value.isMuted, false);
 assert.equal(h.gain.gain.value, .55, 'The slider changes audible gain on iOS');
 assert.equal(h.audio.volume, 1, 'The HTML volume must not attenuate the signal twice');
 assert.equal(h.audio.playCalls, playCalls, 'Changing volume must not restart playback');
 assert.equal(h.audio.currentTime, 37);
 h.value.setVolume(0, true);
 await h.flush();
 assert.equal(h.gain.gain.value, 0);
 h.unmount();
}
console.log('PASS iOS gain, slider unmute, silence at zero, and playback continuity');
