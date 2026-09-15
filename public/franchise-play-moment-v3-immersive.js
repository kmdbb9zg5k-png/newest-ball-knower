(()=>{
'use strict';
const $=id=>document.getElementById(id);
document.body.dataset.bkImmersive='1';

function ensureRotateGate(){
  if(document.querySelector('.rotate-gate'))return;
  const gate=document.createElement('div');
  gate.className='rotate-gate';
  gate.setAttribute('aria-live','polite');
  gate.innerHTML='<div class="rotate-card"><div class="rotate-phone"></div><b>ROTATE TO PLAY</b><p>Ball Knower gameplay is built for landscape so the field, players and thumb controls have room to breathe.</p><small>TURN YOUR PHONE SIDEWAYS</small></div>';
  document.body.appendChild(gate);
}

function tryLandscapeLock(){
  try{
    const lock=screen.orientation?.lock?.('landscape');
    if(lock&&typeof lock.catch==='function')lock.catch(()=>{});
  }catch{}
}

function pct(value){const n=parseFloat(String(value||''));return Number.isFinite(n)?n:null}
function anchorRoute(id){
  const player=document.querySelector('#field .player[data-id="'+id+'"]');
  const path=document.querySelector('#routes .route.'+id);
  if(!player||!path)return;
  const x=pct(player.style.left),y=pct(player.style.top);
  if(x===null||y===null)return;
  const d=path.getAttribute('d')||'';
  const next=d.replace(/^M\s*[-\d.]+\s+[-\d.]+/i,'M '+x.toFixed(1)+' '+Math.min(96,y+1.4).toFixed(1));
  if(next!==d)path.setAttribute('d',next);
}
function anchorRoutes(){['x','slot','z'].forEach(anchorRoute)}

function markPossession(){
  const runner=document.querySelector('#field .player.runner');
  const qb=document.querySelector('#field .player.qb');
  document.querySelectorAll('#field .player').forEach(p=>p.classList.remove('bk-focus'));
  if(document.body.dataset.playMode==='run'&&document.body.dataset.live==='1'&&runner)runner.classList.add('bk-focus');
  else if(qb)qb.classList.add('bk-focus');
}

function sync(){
  const run=$('runMode'),snap=$('snapBtn');
  document.body.dataset.bkImmersive='1';
  document.body.dataset.playMode=run?.classList.contains('active')?'run':'pass';
  document.body.dataset.live=snap?.classList.contains('live')?'1':'0';
  anchorRoutes();markPossession();
}

ensureRotateGate();
const observer=new MutationObserver(()=>requestAnimationFrame(sync));
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
document.addEventListener('click',event=>{
  if(event.target.closest('#snapBtn,#runMode,#passMode,.playcall,.skill,.joystick'))tryLandscapeLock();
  requestAnimationFrame(sync);
},true);
window.addEventListener('orientationchange',()=>setTimeout(sync,180));
window.addEventListener('resize',()=>requestAnimationFrame(sync));
requestAnimationFrame(sync);
})();
