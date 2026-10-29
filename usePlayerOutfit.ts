import {useEffect,useState} from 'react';
import {CLOTHING_SLOTS,readOutfit,WARDROBE_CHANGED,WARDROBE_KEY} from './playerWardrobe';
export function usePlayerOutfit(){
 const [outfit,setOutfit]=useState(readOutfit);
 useEffect(()=>{const update=()=>{const next=readOutfit();setOutfit(current=>CLOTHING_SLOTS.every(slot=>current[slot]===next[slot])?current:next);};const storage=(e:StorageEvent)=>{if(!e.key||e.key===WARDROBE_KEY)update();};window.addEventListener(WARDROBE_CHANGED,update);window.addEventListener('storage',storage);return()=>{window.removeEventListener(WARDROBE_CHANGED,update);window.removeEventListener('storage',storage);};},[]);
 return outfit;
}
