// Use the physical letter when available so releasing Shift before W/A/S/D
// cannot leave a held movement key behind. Synthetic/accessible events may
// omit code; keep their case-insensitive key fallback too.
export function drillMovementKey(event){
 const physical={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d'}[event.code];
 const key=physical||(event.key?.length===1?event.key.toLowerCase():event.key);
 return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(key)?key:null;
}
export function drillMovement(keys){
 return {x:Number(keys.has('ArrowRight')||keys.has('d'))-Number(keys.has('ArrowLeft')||keys.has('a')),y:Number(keys.has('ArrowDown')||keys.has('s'))-Number(keys.has('ArrowUp')||keys.has('w'))};
}
