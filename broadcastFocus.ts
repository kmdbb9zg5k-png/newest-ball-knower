import {useEffect,useSyncExternalStore} from 'react';

// Reference-counted: closing one nested dialog must not resume another active game.
const locks=new Set<symbol>();
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(notify=>notify());
export function useBroadcastFocus(active:boolean){
  useEffect(()=>{
    if(!active)return;
    const token=Symbol('focused-game');locks.add(token);emit();
    return()=>{locks.delete(token);emit()};
  },[active]);
}
export function useBroadcastFocused(){
  return useSyncExternalStore(notify=>{listeners.add(notify);return()=>{listeners.delete(notify)}},()=>locks.size>0,()=>false);
}
export function wantsNewsStrip(tab:string,fantasyView='leagues'){
  return ['home','news','sportsbook','solo','challenges','locker','legacy','partners'].includes(tab)||(tab==='fantasy'&&fantasyView==='leagues');
}
