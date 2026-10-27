import {readControls,saveControls,cleanControls,DEFAULT_CONTROLS,controlPulse} from '../player-controls.js';
export function installControlSettings(host){
 let controls=readControls();
 const apply=()=>{const root=document.documentElement;root.dataset.controlHand=controls.hand;root.dataset.controlSize=controls.size;root.dataset.controlHeight=controls.height;};apply();
 if(!host)return {get:()=>controls,pulse:pattern=>controlPulse(controls.vibration,pattern)};
 const details=document.createElement('details');details.className='game-control-settings';
 const summary=document.createElement('summary');summary.textContent='CUSTOMIZE CONTROLS';details.append(summary);
 const fields=[];const status=document.createElement('p');status.setAttribute('role','status');
 const update=patch=>{controls=cleanControls({...controls,...patch});apply();status.textContent=saveControls(controls)?'Saved on this device. Visual frame limits do not change physics or scoring.':'Settings apply now but could not save on this device.';};
 for(const [key,title,options] of [
  ['hand','Movement stick',[['left','Left side'],['right','Right side']]],
  ['size','Control size',[['standard','Standard'],['large','Large']]],
  ['height','Control height',[['low','Low'],['raised','Raised']]],
  ['frames','Visual frame rate',[['60','Display refresh rate'],['30','Up to 30 FPS · lower graphics workload']]]
 ]){const label=document.createElement('label'),select=document.createElement('select');select.setAttribute('aria-label',title);label.append(document.createTextNode(title));for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=String(controls[key]);select.addEventListener('change',()=>update({[key]:key==='frames'?Number(select.value):select.value}));label.append(select);details.append(label);fields.push([key,select]);}
 const label=document.createElement('label'),vibration=document.createElement('input');vibration.type='checkbox';vibration.checked=controls.vibration;vibration.disabled=typeof navigator.vibrate!=='function';label.className='game-control-vibration';label.append(vibration,document.createTextNode(vibration.disabled?'Action vibration · unavailable in this browser':'Action vibration'));vibration.addEventListener('change',()=>{update({vibration:vibration.checked});controlPulse(controls.vibration);});details.append(label);
 const reset=document.createElement('button');reset.type='button';reset.textContent='RESET CONTROLS';reset.className='secondary';reset.addEventListener('click',()=>{update(DEFAULT_CONTROLS);for(const [key,field] of fields)field.value=String(controls[key]);vibration.checked=controls.vibration;});details.append(reset,status);host.append(details);
 return {get:()=>controls,pulse:pattern=>controlPulse(controls.vibration,pattern)};
}
