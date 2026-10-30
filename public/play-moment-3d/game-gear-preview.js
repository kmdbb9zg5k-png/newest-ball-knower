import {Renderer} from './renderer.js?v=football-foundation-44';
import {createMeshyAthletes} from './reference-athlete.js?v=game-gear-1';
import {prepareJerseys} from './athlete.js';
import {miniTeam} from './mini-teams.js';
import {sanitizeGameGear} from './game-gear.js';
const status=document.querySelector('#status'),canvas=document.querySelector('canvas');
try{
 const renderer=new Renderer(canvas);renderer.setQuality('balanced');
 const model=createMeshyAthletes(renderer);
 const player={index:5,team:0,role:'QB',x:0,z:0,heading:0,vx:0,vz:0,distance:0,hasBall:false,number:1,lastName:'MY PLAYER',gameGear:sanitizeGameGear(null)};
 let angle=.35,dirty=true,loaded=false;
 function update(data){
  const team=miniTeam(data.team);
  Object.assign(player,{gameGear:sanitizeGameGear(data.gear),kitPrimary:team.primary,kitJersey:team.primary,kitTrim:team.secondary,kitInk:'#fff5dc',number:Math.max(0,Math.min(99,Math.floor(Number.isFinite(Number(data.number))?Number(data.number):1))),lastName:String(data.name||'MY PLAYER').trim().split(/\s+/).at(-1).slice(0,24)});
  angle=Number.isFinite(data.rotation)?data.rotation*Math.PI/180:.35;
  prepareJerseys(renderer,[player]);dirty=true;
 }
 update({});
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='bk-game-gear-preview')update(event.data);});
 new ResizeObserver(()=>{renderer.resize();dirty=true;}).observe(canvas);
 canvas.addEventListener('webglcontextlost',()=>{status.textContent='Preview paused. Reopen Game Gear to reload it.';});
 function frame(){
  if(model.error){status.textContent='The 3D preview could not load. Your gear choices are still available.';return;}
  if(model.ready&&!loaded){loaded=true;dirty=true;status.textContent='';}
  if(loaded&&dirty&&!renderer.lost){dirty=false;renderer.begin();renderer.camera([Math.sin(angle)*2.65,1.45,Math.cos(angle)*2.65],[0,.95,0]);model.queueShadows([player],'pre',0);renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT|renderer.gl.DEPTH_BUFFER_BIT);model.draw([player],'pre',0);}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 parent.postMessage({type:'bk-game-gear-ready'},location.origin);
}catch{status.textContent='3D preview is unavailable on this device. You can still equip game gear.';}
