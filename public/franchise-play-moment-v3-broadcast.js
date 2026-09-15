(()=>{
'use strict';
document.body.dataset.broadcastReference='1';
document.body.dataset.paused='0';

const snap=document.getElementById('snapBtn');
const pause=document.getElementById('pauseBtn');

function syncPauseAvailability(){
  if(!pause||!snap)return;
  const live=snap.classList.contains('live');
  const throwing=document.querySelector('.player.qb.throw');
  pause.disabled=!live||Boolean(throwing);
  if(!live&&document.body.dataset.paused==='1'){
    document.body.dataset.paused='0';
    pause.setAttribute('aria-pressed','false');
    pause.setAttribute('aria-label','Pause gameplay');
    const icon=pause.querySelector('.pause-icon');if(icon)icon.textContent='Ⅱ';
  }
}

const observer=new MutationObserver(syncPauseAvailability);
observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
window.addEventListener('pageshow',syncPauseAvailability);
requestAnimationFrame(syncPauseAvailability);
})();
