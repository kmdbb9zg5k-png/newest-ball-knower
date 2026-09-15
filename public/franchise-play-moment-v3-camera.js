/* One viewport-aware camera and one route-to-screen projection. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const field=$('field'),routes=$('routes'),shell=document.querySelector('.shell');
const stage=document.querySelector('.game-wrap'),snap=$('snapBtn'),result=$('result');
if(!field||!routes||!shell||!stage||!snap)return;
const landscape=matchMedia('(orientation: landscape)');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const coord=(el,key)=>parseFloat(el?.style[key]||'');
const setVar=(el,key,value)=>{if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value)};
const overlays=['manualHud','pressureWrap','pressureLabel','toast','result'].map($).filter(Boolean);
let players=[],raf=0,worldHeight=null,cameraY=null,last=0,wasReady=false,disposed=false;
let needsMeasure=true,needsRoutes=true;
const originals=new WeakMap();

function refreshPlayers(){players=[...field.querySelectorAll('.player')];needsMeasure=true;needsRoutes=true;queue()}
function viewport(){
 const vv=window.visualViewport;
 const height=Math.round(vv?.height||innerHeight),width=Math.round(vv?.width||innerWidth);
 setVar(document.documentElement,'--bk-view-height',height+'px');
 setVar(document.documentElement,'--bk-view-width',width+'px');
 overlays.forEach(el=>{const parent=landscape.matches?shell:field;if(el.parentElement!==parent)parent.appendChild(el)});
 worldHeight=null;cameraY=null;needsMeasure=true;needsRoutes=true;queue();
}
function phase(){
 const ended=result?.classList.contains('show')||false;
 return{ended,live:snap.classList.contains('live')&&!ended,ready:!snap.disabled&&!ended,run:$('runMode')?.classList.contains('active')||false};
}
function bounds(p){
 const rect=stage.getBoundingClientRect();
 const headers=['.scoreboard','.mode-row','.control-switch','.close'].map(s=>document.querySelector(s)?.getBoundingClientRect().bottom||0);
 const top=Math.max(rect.top+8,...headers)+8;
 const controls=document.querySelector('.controls');
 const dock=p.ready&&controls?.getClientRects().length?controls.getBoundingClientRect().top:rect.bottom-26;
 return{top:top-rect.top,bottom:Math.max(top+70,Math.min(rect.bottom-26,dock-10))-rect.top,height:rect.height};
}
function measurePlayers(){
 const f=field.getBoundingClientRect();
 return players.map(el=>{
  const y=coord(el,'top')/100,x=coord(el,'left');
  if(!Number.isFinite(y)||!Number.isFinite(x))return null;
  const r=el.getBoundingClientRect(),mask=el.querySelector('.portrait-mask')?.getBoundingClientRect();
  const tag=el.querySelector('.tag'),tr=tag?.getClientRects().length?tag.getBoundingClientRect():r;
  const anchor=f.top+y*f.height;
  return{el,x,y,up:Math.min(r.top,mask?.top??r.top)-anchor-4,down:Math.max(r.bottom,mask?.bottom??r.bottom,tr.bottom)-anchor+4};
 }).filter(Boolean);
}
function tracked(rows,p){
 if(!p.live||!p.run||!$('manualHud')?.classList.contains('show'))return rows;
 const runner=rows.find(r=>r.el.dataset.id==='runner');
 if(!runner)return rows;
 return rows.filter(r=>r===runner||(Math.abs(r.y-runner.y)<.25&&Math.abs(r.x-runner.x)<35));
}
function fit(rows,b,preferred){
 let h=preferred;
 for(const far of rows)for(const near of rows){
  const span=near.y-far.y;
  if(span>.001)h=Math.min(h,(b.bottom-b.top-near.down+far.up)/span);
 }
 return Math.max(60,h);
}
function shifts(rows,b,h){
 return{lo:Math.max(...rows.map(r=>b.top-r.y*h-r.up)),hi:Math.min(...rows.map(r=>b.bottom-r.y*h-r.down))};
}
function anchorRoutes(){
 const matrix=routes.getScreenCTM();
 if(!matrix)return;
 let inverse;try{inverse=matrix.inverse()}catch{return}
 routes.querySelectorAll('.route').forEach(path=>{
  let id=['x','slot','z'].find(name=>path.classList.contains(name));
  if(path.classList.contains('runroute'))id='runner';
  const player=players.find(el=>el.dataset.id===id);
  if(!player)return;
  if(!originals.has(path))originals.set(path,path.getAttribute('d')||'');
  const r=player.getBoundingClientRect(),point=routes.createSVGPoint();
  point.x=r.left+r.width/2;point.y=r.bottom-3;
  const local=point.matrixTransform(inverse);
  const d=originals.get(path).replace(/^M\s*[-\d.]+\s+[-\d.]+/i,'M '+local.x.toFixed(3)+' '+local.y.toFixed(3));
  if(path.getAttribute('d')!==d)path.setAttribute('d',d);
 });
}
function tick(now){
 raf=0;if(disposed||document.hidden)return;
 const p=phase();
 if(!landscape.matches){if(needsRoutes&&p.ready)anchorRoutes();needsRoutes=false;return}
 const dt=last?Math.min(.05,(now-last)/1000):.016;last=now;
 const b=bounds(p);
 // Depth belongs to the view. Never overwrite the simulation's --scale.
 players.forEach(el=>{
  const y=coord(el,'top');if(!Number.isFinite(y))return;
  setVar(el,'--bk-depth',clamp(.66+y*.0049,.72,1.15).toFixed(3));
  const z=String(20+Math.round(y));if(el.style.zIndex!==z)el.style.zIndex=z;
 });
 const rows=tracked(measurePlayers(),p);
 if(!rows.length)return;
 const wanted=fit(rows,b,b.height*1.9);
 const reset=needsMeasure||(!wasReady&&p.ready)||reduced.matches;
 if(worldHeight===null||reset)worldHeight=wanted;
 else worldHeight=Math.min(wanted,worldHeight+(wanted-worldHeight)*(1-Math.exp(-dt*8)));
 const limits=shifts(rows,b,worldHeight);
 const runner=rows.find(r=>r.el.dataset.id==='runner'),qb=rows.find(r=>r.el.dataset.id==='qb');
 let focus=(p.run&&p.live?runner:qb)||rows[0];
 const ball=$('ball'),ballY=ball?.style.display==='block'?coord(ball,'top')/100:NaN;
 const desired=p.live&&Number.isFinite(ballY)?(b.top+b.bottom)/2-ballY*worldHeight:b.bottom-20-focus.down-focus.y*worldHeight;
 const target=clamp(desired,limits.lo,limits.hi);
 if(cameraY===null||reset)cameraY=target;
 else cameraY=clamp(cameraY+(target-cameraY)*(1-Math.exp(-dt*10)),limits.lo,limits.hi);
 setVar(field,'--bk-world-height',worldHeight.toFixed(2)+'px');
 setVar(field,'--bk-camera-y',cameraY.toFixed(2)+'px');
 // Only pre-snap routes need anchoring. Do not chase moving receivers with a static play diagram.
 if(p.ready&&(needsRoutes||needsMeasure||!wasReady||Math.abs(worldHeight-wanted)>.1))anchorRoutes();
 needsMeasure=false;needsRoutes=false;wasReady=p.ready;
 if(p.live||Math.abs(worldHeight-wanted)>.1)queue();
}
function queue(){if(!raf&&!disposed&&!document.hidden)raf=requestAnimationFrame(tick)}
const playerObserver=new MutationObserver(refreshPlayers);
playerObserver.observe(field,{childList:true});
const routeObserver=new MutationObserver(()=>{needsRoutes=true;queue()});
routeObserver.observe(routes,{childList:true});
const stateObserver=new MutationObserver(()=>{needsMeasure=true;needsRoutes=true;queue()});
[snap,$('runMode'),result].filter(Boolean).forEach(el=>stateObserver.observe(el,{attributes:true,attributeFilter:['class','disabled']}));
const resize=()=>viewport();
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);
landscape.addEventListener('change',resize);
const visible=()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;last=0}else viewport()};
document.addEventListener('visibilitychange',visible);
window.addEventListener('pageshow',resize);
window.addEventListener('pagehide',event=>{cancelAnimationFrame(raf);raf=0;if(!event.persisted){disposed=true;playerObserver.disconnect();routeObserver.disconnect();stateObserver.disconnect();window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);landscape.removeEventListener('change',resize);document.removeEventListener('visibilitychange',visible);window.removeEventListener('pageshow',resize)}});
refreshPlayers();viewport();
})();
