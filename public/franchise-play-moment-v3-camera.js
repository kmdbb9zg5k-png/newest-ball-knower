(()=>{
'use strict';
const field=document.getElementById('field');
if(!field)return;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pct=el=>{const n=parseFloat(String(el?.style?.top||''));return Number.isFinite(n)?n:null};

/* The gameplay UI must not scroll with the oversized world. */
['manualHud','pressureWrap','pressureLabel','toast','result'].forEach(id=>{
  const el=document.getElementById(id);
  if(el&&el.parentElement!==document.querySelector('.shell'))document.querySelector('.shell')?.appendChild(el);
});

function live(){return document.body.dataset.live==='1'}
function runMode(){return document.body.dataset.playMode==='run'}
function player(id){return field.querySelector('.player[data-id="'+id+'"]')}
function tops(ids){return ids.map(id=>pct(player(id))).filter(Number.isFinite)}

function focusY(){
  const qbY=pct(player('qb'))??93;
  if(!live())return qbY;
  if(runMode())return pct(player('runner'))??qbY;

  const ball=document.getElementById('ball');
  const ballY=ball&&ball.style.display!=='none'?parseFloat(ball.style.top||''):NaN;
  if(Number.isFinite(ballY))return ballY;

  const rec=tops(['x','slot','z']);
  if(!rec.length)return qbY;
  /* Follow the developing route without instantly jumping to the deepest receiver. */
  return clamp(Math.min(...rec)+10,32,94);
}

function applyDepth(){
  field.querySelectorAll('.player').forEach(el=>{
    const y=pct(el);
    if(y===null)return;
    let scale=.62+y*.00545;
    if(el.classList.contains('runner'))scale+=.035;
    if(el.classList.contains('qb'))scale+=.015;
    scale=clamp(scale,.70,1.17);
    const next=scale.toFixed(3);
    if(el.style.getPropertyValue('--scale')!==next)el.style.setProperty('--scale',next);
    el.style.zIndex=String(20+Math.round(y));
  });
}

let cameraY=null;
function cameraTarget(){
  const vh=window.innerHeight||420;
  const worldH=vh*2.20;
  const y=focusY()/100;
  const desired=(live()?0.63:0.80)*vh;
  let shift=desired-y*worldH;
  /* Slight overscroll at the bottom is intentional and hidden by the turf-colored viewport. */
  shift=clamp(shift,-1.30*vh,0);
  return shift;
}

function updateCamera(){
  const target=cameraTarget();
  if(cameraY===null)cameraY=target;
  const speed=live()?.16:.23;
  cameraY+=(target-cameraY)*speed;
  field.style.setProperty('--bk-camera-y',cameraY.toFixed(1)+'px');
  applyDepth();
  requestAnimationFrame(updateCamera);
}

/* Re-anchor routes to where the receiver actually renders after masking/visual offsets. */
function anchorVisibleRoutes(){
  const fieldRect=field.getBoundingClientRect();
  const fw=fieldRect.width||1,fh=fieldRect.height||1;
  ['x','slot','z'].forEach(id=>{
    const el=player(id),path=document.querySelector('#routes .route.'+id);
    if(!el||!path)return;
    const r=el.getBoundingClientRect();
    const x=((r.left+r.width/2-fieldRect.left)/fw)*100;
    const y=((r.top+r.height*.72-fieldRect.top)/fh)*100;
    const d=path.getAttribute('d')||'';
    const next=d.replace(/^M\s*[-\d.]+\s+[-\d.]+/i,'M '+x.toFixed(1)+' '+y.toFixed(1));
    if(next!==d)path.setAttribute('d',next);
  });
}

let anchorQueued=false;
function queueAnchor(){
  if(anchorQueued)return;
  anchorQueued=true;
  requestAnimationFrame(()=>{anchorQueued=false;anchorVisibleRoutes()});
}
const observer=new MutationObserver(queueAnchor);
observer.observe(field,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
window.addEventListener('resize',queueAnchor);
window.addEventListener('orientationchange',()=>setTimeout(queueAnchor,180));
document.addEventListener('click',queueAnchor,true);

requestAnimationFrame(()=>{anchorVisibleRoutes();updateCamera()});
})();
