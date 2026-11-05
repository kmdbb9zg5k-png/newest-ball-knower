import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// Actual helper and alert component; only the device bridge, DOM and React
// scheduler are replaced. No browser or physical feedback is simulated as proof.
const state={};globalThis.__gmHapticsTest=state;
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))};
globalThis.document=new EventTarget();
const bundled=await build({entryPoints:['GmEventAlerts.tsx'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'gm-haptic-boundaries',setup(b){
 b.onResolve({filter:/^(react(?:\/jsx-runtime)?|lucide-react|@capacitor\/core|@ball-knower\/native-auth-session|\.\/ModalPortal|\.\/solo\/SoloPresentation|\.\/gmEventAlerts\.css)$/},args=>({path:args.path,namespace:'haptic-test'}));
 b.onLoad({filter:/.*/,namespace:'haptic-test'},({path})=>({loader:'js',contents:`const s=globalThis.__gmHapticsTest; ${
 path==='react'?`const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));export const useState=initial=>{const i=s.cursor++;if(!(i in s.hooks))s.hooks[i]=typeof initial==='function'?initial():initial;return[s.hooks[i],value=>{s.hooks[i]=typeof value==='function'?value(s.hooks[i]):value}]};export const useRef=value=>{const i=s.cursor++;return s.hooks[i]??(s.hooks[i]={current:value})};export const useMemo=(fn,deps)=>{const i=s.cursor++;if(!s.hooks[i]||!same(s.hooks[i].deps,deps))s.hooks[i]={deps,value:fn()};return s.hooks[i].value};export const useId=()=>{const i=s.cursor++;return s.hooks[i]??(s.hooks[i]='id-'+i)};export const useEffect=(fn,deps)=>{const i=s.cursor++;if(!s.hooks[i]||!same(s.hooks[i].deps,deps)){s.hooks[i]?.cleanup?.();s.hooks[i]={deps};s.effects.push(()=>{s.hooks[i].cleanup=fn()})}};export default {};`:
 path==='react/jsx-runtime'?`export const Fragment='fragment',jsx=(type,props)=>({type,props}),jsxs=jsx;`:
 path==='lucide-react'?`export const BellRing='bell',ChevronRight='chevron',X='close';`:
 path==='@capacitor/core'?`export const Capacitor={isNativePlatform:()=>{if(s.platformError)throw Error('missing runtime');return s.platform!=='web'},getPlatform:()=>s.platform};`:
 path==='@ball-knower/native-auth-session'?`export const NativeAuthSession={get notifyGmEvent(){if(s.nativeMode==='getter-throws')throw Error('bridge missing');if(s.nativeMode==='missing')return undefined;return()=>{s.calls.push('native');if(s.nativeMode==='throws')throw Error('native failure');if(s.nativeMode==='rejects')return Promise.reject({code:'UNIMPLEMENTED'});if(s.nativeMode==='pending')return s.nativePending;return Promise.resolve()}}};`:
 path==='./ModalPortal'?`export const ModalPortal='portal';`:
 path==='./solo/SoloPresentation'?`export const SoloPortrait='portrait';`:``
 }`}));
}}]});
const module={exports:{}};new Function('module','exports',bundled.outputFiles[0].text)(module,module.exports);const api=module.exports;
const settle=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));};
function reset(options={}){
 storage.clear();Object.assign(state,{calls:[],platform:'web',platformError:false,nativeMode:'success',hooks:[],cursor:0,effects:[],decisions:0,...options});
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:pattern=>{state.calls.push(['browser',pattern]);return true}}});
}
for(const platform of ['web','android']){
 reset({platform});assert.equal(api.pulseGmEvent(),undefined);await settle();
 assert.deepEqual(state.calls,[['browser',[80,60,120]]],'Browser and Android retain the existing browser vibration pattern');
}
reset({platform:'ios'});assert.equal(api.pulseGmEvent(),undefined);await settle();assert.deepEqual(state.calls,['native'],'iOS uses one native pulse without double browser feedback');
for(const nativeMode of ['missing','getter-throws','throws','rejects']){
 reset({platform:'ios',nativeMode});assert.doesNotThrow(()=>api.pulseGmEvent());await settle();
 assert.equal(state.calls.filter(call=>Array.isArray(call)).length,1,`${nativeMode}: old/missing/failed native bridges retain the optional browser fallback`);
}
reset({platform:'ios',platformError:true});assert.doesNotThrow(()=>api.pulseGmEvent());await settle();assert.equal(state.calls.length,1);
reset();Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});assert.doesNotThrow(()=>api.pulseGmEvent());
reset({platform:'ios',nativeMode:'rejects'});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{vibrate:()=>{throw Error('unsupported')}}});assert.doesNotThrow(()=>api.pulseGmEvent());await settle();
delete globalThis.navigator;state.platform='web';assert.doesNotThrow(()=>api.pulseGmEvent(),'Non-browser rendering has no navigator requirement');

// An unresponsive native bridge cannot hold open, close or decision handlers.
reset({platform:'ios',nativeMode:'pending',nativePending:new Promise(()=>{})});
const event={id:'meeting',eyebrow:'PLAYER MEETING',title:'A player wants a larger role',detail:'Choose a response.',choices:[{id:'save',label:'Save decision',detail:'Keep the game plan.',onSelect:()=>state.decisions++}]};
const render=()=>{state.cursor=0;return api.GmEventAlerts({events:[event],scopeKey:'native-test'})};
const effects=(strict=false)=>{for(const run of state.effects.splice(0)){run();if(strict)run()}};
function find(node,predicate){
 if(Array.isArray(node)){for(const child of node){const result=find(child,predicate);if(result)return result}return null;}
 if(!node||typeof node!=='object')return null;
 return predicate(node)?node:find(node.props?.children,predicate);
}
const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):String(node??'');
render();effects(true);assert.deepEqual(state.calls,['native'],'StrictMode effect replay requests a single native pulse');
let tree=render();effects();assert(find(tree,node=>node.props?.role==='dialog'));
const choice=find(tree,node=>node.type==='button'&&text(node).startsWith('Save decision'));
assert.equal(choice.props.onClick(),undefined);assert.equal(state.decisions,1,'Saving a decision never waits for haptic completion');
tree=render();effects();assert.equal(find(tree,node=>node.props?.role==='dialog'),null);
find(tree,node=>node.props?.['aria-label']==='Review '+event.title).props.onClick();tree=render();effects();
assert(find(tree,node=>node.props?.role==='dialog'));assert.deepEqual(state.calls,['native'],'Manual review never repeats feedback');
find(tree,node=>node.props?.['aria-label']==='Close GM alert').props.onClick();tree=render();effects();assert.equal(find(tree,node=>node.props?.role==='dialog'),null);

const swift=readFileSync('packages/native-auth-session/ios/Sources/NativeAuthSessionPlugin/NativeAuthSessionPlugin.swift','utf8');
for(const method of ['authenticate','authorizeAppleForDeletion','notifyGmEvent'])assert(swift.includes(`CAPPluginMethod(name: "${method}", returnType: CAPPluginReturnPromise)`),`${method} stays registered`);
const nativeBody=swift.slice(swift.indexOf('@objc func notifyGmEvent('),swift.indexOf('@objc func authenticate('));
assert.match(nativeBody,/DispatchQueue\.main\.async/);assert.match(nativeBody,/UIApplication\.shared\.applicationState == \.active/);assert.match(nativeBody,/notificationOccurred\(\.warning\)/);assert.match(nativeBody,/call\.resolve\(\)/);
assert.doesNotMatch(nativeBody,/self\.(?:session|deletionCall|deletionController)/,'Haptics cannot modify authentication state');
assert.match(readFileSync('packages/native-auth-session/index.d.ts','utf8'),/notifyGmEvent\(\): Promise<void>/);
assert.match(readFileSync('packages/native-auth-session/index.js','utf8'),/registerPlugin\('NativeAuthSession'\)/);
console.log('PASS actual GM haptics/alerts: iOS bridge, browser/Android fallback, old and failed native methods, unsupported browsers, StrictMode dedup and nonblocking decisions/review/close; native registration/main-thread/active-app contract checked. UIKit build and physical feedback remain device gates.');
