/* The shell observes state transitions, never the style changes it produces. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const field=$('field');if(!field)return;
let queued=0,disposed=false;
function setData(key,value){if(document.body.dataset[key]!==value)document.body.dataset[key]=value}
function sync(){
 queued=0;if(disposed)return;
 const ended=$('result')?.classList.contains('show')||false;
 const live=$('snapBtn')?.classList.contains('live')&&!ended;
 const run=$('runMode')?.classList.contains('active')||false;
 setData('bkImmersive','1');setData('playMode',run?'run':'pass');setData('live',live?'1':'0');setData('ended',ended?'1':'0');
 const id=run&&live?'runner':'qb';
 field.querySelectorAll('.player').forEach(p=>{const focus=p.dataset.id===id;if(p.classList.contains('bk-focus')!==focus)p.classList.toggle('bk-focus',focus)});
}
function queue(){if(!queued&&!disposed)queued=requestAnimationFrame(sync)}
if(!document.querySelector('.rotate-gate')){
 const gate=document.createElement('div');gate.className='rotate-gate';gate.setAttribute('aria-live','polite');
 gate.innerHTML='<div class="rotate-card"><div class="rotate-phone"></div><b>ROTATE TO PLAY</b><p>Turn your phone sideways to see the field and controls.</p><small>LANDSCAPE GAMEPLAY</small></div>';
 document.body.appendChild(gate);
}
function tryLandscapeLock(event){
 if(!(event.target instanceof Element)||!event.target.closest('#snapBtn,#runMode,#passMode,.playcall,.skill,.joystick'))return;
 try{screen.orientation?.lock?.('landscape')?.catch?.(()=>{})}catch{}
}
const observer=new MutationObserver(queue);
[$('runMode'),$('snapBtn'),$('result')].filter(Boolean).forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class','disabled']}));
observer.observe(field,{childList:true});
document.addEventListener('click',tryLandscapeLock,true);
window.addEventListener('pageshow',queue);
window.addEventListener('pagehide',event=>{cancelAnimationFrame(queued);queued=0;if(!event.persisted){disposed=true;observer.disconnect();document.removeEventListener('click',tryLandscapeLock,true);window.removeEventListener('pageshow',queue)}});
sync();
})();
