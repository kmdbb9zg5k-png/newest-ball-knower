(()=>{
'use strict';
const field=document.getElementById('field');
if(!field)return;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pct=el=>{const n=parseFloat(String(el?.style?.top||''));return Number.isFinite(n)?n:null};
const shell=document.querySelector('.shell');
const snapBtn=document.getElementById('snapBtn');

/* The gameplay UI must not scroll with the oversized world. */
['manualHud','pressureWrap','pressureLabel','toast','result'].forEach(id=>{
  const el=document.getElementById(id);
  if(el&&el.parentElement!==shell)shell?.appendChild(el);
});

function syncLiveFlag(){
  if(!snapBtn)return;
  const next=snapBtn.classList.contains('live')?'1':'0';
  if(document.body.dataset.live!==next)document.body.dataset.live=next;
}
function live(){syncLiveFlag();return document.body.dataset.live==='1'}
function runMode(){return document.body.dataset.playMode==='run'}
function player(id){return field.querySelector('.player[data-id="'+id+'"]')}
function tops(ids){return ids.map(id=>pct(player(id))).filter(Number.isFinite)}

function focusY(){
  const qbY=pct(player('qb'))??93;
  if(!live())return clamp(qbY-2,86,94);
  if(runMode())return pct(player('runner'))??qbY;

  const ball=document.getElementById('ball');
  const ballY=ball&&ball.style.display!=='none'?parseFloat(ball.style.top||''):NaN;
  if(Number.isFinite(ballY))return clamp(ballY,22,92);

  const rec=tops(['x','slot','z']);
  if(!rec.length)return qbY;
  const deepest=Math.min(...rec);
  /* Keep enough of the pocket visible while still leaning the camera toward the developing routes. */
  return clamp(qbY-(qbY-deepest)*.48,58,90);
}

function applyDepth(){
  field.querySelectorAll('.player').forEach(el=>{
    const y=pct(el);
    if(y===null)return;
    let scale=.66+y*.0049;
    if(el.classList.contains('runner'))scale+=.04;
    if(el.classList.contains('qb'))scale+=.02;
    scale=clamp(scale,.72,1.15);
    const next=scale.toFixed(3);
    if(el.style.getPropertyValue('--scale')!==next)el.style.setProperty('--scale',next);
    el.style.zIndex=String(20+Math.round(y));
  });
}

let cameraY=null;
let wasLive=false;
function cameraTarget(){
  const vh=window.innerHeight||420;
  const worldH=vh*1.90;
  const isLive=live();
  const y=focusY()/100;
  const desired=(isLive?(runMode()?0.68:0.65):0.77)*vh;
  let shift=desired-y*worldH;
  shift=clamp(shift,-1.02*vh,0);
  return shift;
}

function updateCamera(){
  const isLive=live();
  const target=cameraTarget();
  if(cameraY===null)cameraY=target;

  /* On dead-ball recovery, snap the camera back to the offense so the next play controls reappear in a stable frame. */
  if(wasLive&&!isLive)cameraY=target;
  else cameraY+=(target-cameraY)*(isLive?.14:.34);

  wasLive=isLive;
  field.style.setProperty('--bk-camera-y',cameraY.toFixed(1)+'px');
  applyDepth();
  requestAnimationFrame(updateCamera);
}

/* Re-anchor routes to where the receiver actually renders after masking/visual offsets. */
function anchorVisibleRoutes(){
  const routeLayer=document.getElementById('routes');
  const fieldRect=(routeLayer||field).getBoundingClientRect();
  const fw=fieldRect.width||1,fh=fieldRect.height||1;
  ['x','slot','z'].forEach(id=>{
    const el=player(id),path=document.querySelector('#routes .route.'+id);
    if(!el||!path)return;
    const r=el.getBoundingClientRect();
    const x=((r.left+r.width/2-fieldRect.left)/fw)*100;
    const y=((r.top+r.height*.70-fieldRect.top)/fh)*100;
    const d=path.getAttribute('d')||'';
    const next=d.replace(/^M\s*[-\d.]+\s+[-\d.]+/i,'M '+x.toFixed(1)+' '+y.toFixed(1));
    if(next!==d)path.setAttribute('d',next);
  });
}

/* If a dead-ball message is showing but the engine already cleared the live snap class, restore the UI immediately. */
function recoverDeadBallUi(){
  syncLiveFlag();
  if(document.body.dataset.live==='0'){
    document.querySelector('.controls')?.style.removeProperty('display');
  }
}

let anchorQueued=false;
function queueAnchor(){
  if(anchorQueued)return;
  anchorQueued=true;
  requestAnimationFrame(()=>{anchorQueued=false;anchorVisibleRoutes();recoverDeadBallUi()});
}
const observer=new MutationObserver(queueAnchor);
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
window.addEventListener('resize',()=>{cameraY=null;queueAnchor()});
window.addEventListener('orientationchange',()=>setTimeout(()=>{cameraY=null;queueAnchor()},180));
document.addEventListener('click',queueAnchor,true);

requestAnimationFrame(()=>{anchorVisibleRoutes();updateCamera()});
})();
