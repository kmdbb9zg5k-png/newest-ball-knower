import {Renderer,mul,pose} from './renderer.js?v=football-foundation-44';
import {createMeshyAthletes} from './reference-athlete.js?v=game-gear-1';
import {createPlayerDetailGeometry} from './geometry.js';
import {prepareJerseys} from './athlete.js';
import {miniTeam} from './mini-teams.js';
import {sanitizeGameGear} from './game-gear.js';
const status=document.querySelector('#status'),canvas=document.querySelector('canvas');
try{
 const renderer=new Renderer(canvas);renderer.setQuality('balanced');
 const model=createMeshyAthletes(renderer);
 const visor=createPlayerDetailGeometry().playerVisor;
 // The lens uses the outside of the curved surface for its reflections.
 for(let i=0;i<visor.v.length;i+=8){
  visor.v[i+3]*=-1;visor.v[i+4]*=-1;visor.v[i+5]*=-1;
 }
 renderer.shapes.previewVisor=visor;
 const visorFit=pose(0,1.535,-.024,.67,.74,.67);
 const player={index:5,team:0,role:'QB',x:0,z:0,heading:0,vx:0,vz:0,distance:0,hasBall:false,number:1,lastName:'MY PLAYER',gameGear:sanitizeGameGear(null)};
 let angle=.35,dirty=true,loaded=false;
 function update(data){
  const blackout=data.blackout===true;
  const team=blackout?{primary:'#18191d',secondary:'#24262b'}:miniTeam(data.team);
  canvas.dataset.uniform=blackout?'blackout':'team';
  renderer.gl.clearColor(...(blackout?[.025,.032,.041,1]:[.009,.016,.029,1]));
  Object.assign(player,{gameGear:sanitizeGameGear(blackout?{...data.gear,facemask:'black'}:data.gear),kitPrimary:team.primary,kitJersey:team.primary,kitTrim:team.secondary,kitInk:'#fff5dc',number:Math.max(0,Math.min(99,Math.floor(Number.isFinite(Number(data.number))?Number(data.number):1))),lastName:String(data.name||'MY PLAYER').trim().split(/\s+/).at(-1).slice(0,24)});
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
  if(loaded&&dirty&&!renderer.lost){
   dirty=false;
   renderer.begin();
   renderer.camera([Math.sin(angle)*2.65,1.45,Math.cos(angle)*2.65],[0,.95,0]);
   model.queueShadows([player],'pre',0);
   if(canvas.dataset.uniform==='blackout'){
    const head=model.joints.indexOf(model.namedNodes['mixamorig:Head']);
    const bones=model.frameBones?.get(player.index);
    if(head>=0&&bones){
     const skin=bones.subarray(head*16,head*16+16);
     renderer.add('previewVisor',mul(model.modelFor(player),mul(skin,visorFit)),[.045,.055,.07,1],'',false,.86,1);
    }
   }
   renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT|renderer.gl.DEPTH_BUFFER_BIT);
   model.draw([player],'pre',0);
   renderer.drawLate();
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
 parent.postMessage({type:'bk-game-gear-ready'},location.origin);
}catch{status.textContent='3D preview is unavailable on this device. You can still equip game gear.';}
