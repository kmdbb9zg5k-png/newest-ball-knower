(()=>{
'use strict';
const fallbackMap={
  ol0:'/solo-characters/v2/qa/solo-brk-02/full-body.webp',
  ol1:'/solo-characters/v2/qa/solo-brk-05/full-body.webp',
  ol2:'/solo-characters/v2/qa/solo-brk-10/full-body.webp',
  ol3:'/solo-characters/v2/qa/solo-brk-15/full-body.webp',
  ol4:'/solo-characters/v2/qa/solo-brk-21/full-body.webp',
  d0:'/solo-characters/v2/qa/solo-brk-30/full-body.webp',
  d1:'/solo-characters/v2/qa/solo-brk-38/full-body.webp',
  d2:'/solo-characters/v2/qa/solo-brk-46/full-body.webp',
  d3:'/solo-characters/v2/qa/solo-brk-52/full-body.webp',
  d4:'/solo-characters/v2/qa/solo-slc-02/full-body.webp',
  d5:'/solo-characters/v2/qa/solo-slc-05/full-body.webp',
  d6:'/solo-characters/v2/qa/solo-slc-10/full-body.webp',
  x:'/solo-characters/v2/my-player-presets/nico/full-body.webp',
  slot:'/solo-characters/v2/my-player-presets/malik/full-body.webp',
  z:'/solo-characters/v2/my-player-presets/mason/full-body.webp',
  qb:'/solo-characters/v2/my-player-presets/darius/full-body.webp',
  runner:'/solo-characters/v2/my-player-presets/malik/full-body.webp'
};

const isGenericFallback=src=>/\/solo-characters\/v2\/my-player-presets\/(darius|malik|nico|mason)\/full-body\.webp/i.test(String(src||''));

function applyPlayerPolish(){
  document.querySelectorAll('#field .player').forEach(player=>{
    const id=player.dataset.id||'';
    const img=player.querySelector('img');
    if(!img)return;
    if(!img.dataset.bkOriginalSrc)img.dataset.bkOriginalSrc=img.getAttribute('src')||'';
    const original=img.dataset.bkOriginalSrc;
    if(fallbackMap[id]&&isGenericFallback(original)&&img.getAttribute('src')!==fallbackMap[id]){
      img.setAttribute('src',fallbackMap[id]);
      img.dataset.bkVisualFallback='1';
    }
    if(id.startsWith('ol'))player.setAttribute('aria-label','Offensive lineman');
    if(id.startsWith('d'))player.setAttribute('aria-label','Defender');
  });
}

function syncState(){
  const run=document.getElementById('runMode');
  const snap=document.getElementById('snapBtn');
  document.body.dataset.playMode=run?.classList.contains('active')?'run':'pass';
  document.body.dataset.live=snap?.classList.contains('live')?'1':'0';
  applyPlayerPolish();
}

const observer=new MutationObserver(syncState);
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','src']});
document.addEventListener('click',()=>requestAnimationFrame(syncState),true);
window.addEventListener('pageshow',syncState);
requestAnimationFrame(syncState);
})();
