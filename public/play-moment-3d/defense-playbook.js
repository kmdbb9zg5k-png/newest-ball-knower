/** Defensive calls use actual assignments, not cosmetic labels. */
export const DEFENSE_FORMATIONS = ['4–3', 'Nickel', 'Dime', 'Goal Line'];
const call = (id, name, formation, coverage, blitz = [], depth = 11) => ({id, name, formation, coverage, blitz, depth});
export const DEFENSE_PLAYS = [
 call('43-man','Cover 1 Robber','4–3','man',[],12),call('43-zone','Cover 3 Sky','4–3','zone',[],14),call('43-blitz','Mike Fire','4–3','man',[16],10),
 call('nickel-2','Cover 2 Cloud','Nickel','zone',[],16),call('nickel-man','Cover 2 Man','Nickel','man',[],16),call('nickel-fire','Slot Blitz','Nickel','zone',[19],12),
 call('dime-4','Quarters','Dime','zone',[],20),call('dime-man','Double Wide','Dime','man',[],18),call('dime-fire','Double A Gap','Dime','man',[15,16],14),
 call('goal-man','Goal Line Man','Goal Line','man',[],5),call('goal-zone','Goal Line Zone','Goal Line','zone',[],5),call('goal-blitz','All Out Pressure','Goal Line','man',[15,16,17],3),
];
export function defenseAlignment(call, slot, press = 0, shift = 0) {
 const front = call.formation === 'Goal Line' ? 6 : 4;
 if(slot<front)return [(slot-(front-1)/2)*2.6+shift, .9];
 const base=[[-5,.9],[-1.7,.9],[1.7,.9],[5,.9],[-8,5],[0,5],[8,5],[-21,4],[-12,11],[21,4],[8,17]][slot];
 return [base[0],slot>=7?Math.max(1,Math.min(call.depth,base[1]+call.depth-11)+press):base[1]];
}
export function defenseAssignment(call, slot, snapZ, actors) {
 const defender = actors[11+slot];
 if(slot<4||call.blitz.includes(11+slot))return {type:'rush',x:actors[5].x,z:actors[5].z};
 if(call.coverage==='man'&&slot<10){const target=actors[[6,10,8,7,8,9][slot-4]];return {type:'man',x:target.x,z:target.z+.6,target:target.index};}
 const zones=[[-17,call.depth],[-7,call.depth*.55],[7,call.depth*.55],[17,call.depth],[0,call.depth+4],[0,call.depth+5],[12,call.depth+3]];
 const zone=zones[(slot-4)%zones.length];return {type:'zone',x:zone[0],z:Math.min(109,snapZ+zone[1])};
}
export function nearestDefender(actors, target, current = -1) {
 return actors.filter(p=>p.index>=11&&!p.fallen&&p.index!==current).sort((a,b)=>Math.hypot(a.x-target.x,a.z-target.z)-Math.hypot(b.x-target.x,b.z-target.z))[0]?.index ?? current;
}
export function defensiveTackleChance(tackler, runner, hit = false) {
 return Math.max(.18,Math.min(.96,(hit?.57:.83)+((tackler.ratings?.tackle||75)-(runner.ratings?.breakTackle||75))*.006));
}
// Compact SVG field art stays crisp on phones. Each card owns its gradient IDs.
export function defensiveDiagram(call, variant='card') {
 const id=call.id+'-'+variant;
 const zone=(x,y,rx,ry)=>`<g class="coverage-zone"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${id}-zone)" stroke="#75e6f4" stroke-width=".8"/><ellipse cx="${x}" cy="${y}" rx="${rx*.6}" ry="${ry}" fill="none" stroke="#76e7f5" stroke-opacity=".25" stroke-width=".5"/><path d="M${x-rx} ${y}H${x+rx} M${x} ${y-ry}V${y+ry}" stroke="#9becff" stroke-opacity=".3" stroke-width=".5"/></g>`;
 const figure=(x,y)=>`<g class="defense-figure" transform="translate(${x} ${y})" fill="#99ddeb18" stroke="#a9d6df" stroke-width=".65"><circle cy="-13" r="2.3"/><path d="M-3 -9L-4 -2L-2 0L-3 10L-1 10L1 1L3 10L5 10L3 -2L4 -7L6 -1L7 -2L5 -10Z"/><path d="M-3 -6L3 -6M-2 -2L3 -2M0 -9L1 0M-2 4L3 4" opacity=".6"/></g>`;
 const marks=Array.from({length:12},(_,i)=>{const y=12+i*12;return `<path d="M10 ${y}h7 M283 ${y}h7 M22 ${y}H278" stroke="#8cbbc5" stroke-opacity="${i%3===0?'.13':'.055'}" stroke-width=".6"/>`;}).join('');
 const dots=Array.from({length:11},(_,slot)=>{const [x,z]=defenseAlignment(call,slot),px=150+x*5.1,py=125-z*4.6,rush=slot<4||call.blitz.includes(11+slot);
  if(rush)return `<g class="defense-rush"><path d="M${px} ${py}v22m-3 -5l3 5 3 -5" fill="none" stroke="#f6a36b" stroke-width="1.8"/><ellipse cx="${px}" cy="${py}" rx="5" ry="2.6" fill="#9d632c88" stroke="#ffbc75"/></g>`;
  return `${call.coverage==='zone'?zone(px,Math.max(17,py-12),slot>=8?29:23,slot>=8?13:10):`<path d="M${px} ${py}l9 -24" stroke="#c4e5ed" stroke-width="1.4"/><circle cx="${px+9}" cy="${py-24}" r="1.8" fill="#e3f6fa"/>`}${figure(px,py+4)}<circle cx="${px}" cy="${py}" r="3.2" fill="#83e6ed" stroke="#d1ffff" stroke-width=".7"/>`;
 }).join('');
 return `<svg viewBox="0 0 300 170" aria-hidden="true"><defs><radialGradient id="${id}-zone"><stop stop-color="#70e3f8" stop-opacity=".1"/><stop offset=".8" stop-color="#4bdaef" stop-opacity=".23"/><stop offset="1" stop-color="#9aefff" stop-opacity=".5"/></radialGradient><linearGradient id="${id}-field" x2="0" y2="1"><stop stop-color="#75def2" stop-opacity=".02"/><stop offset="1" stop-color="#75def2" stop-opacity=".13"/></linearGradient></defs><path class="holo-field" d="M34 17H266L247 157H53Z" fill="url(#${id}-field)" stroke="#75d8eb" stroke-opacity=".3"/>${marks}<path d="M16 135H284" stroke="#bdced8" stroke-opacity=".65" stroke-dasharray="4 4" stroke-width=".8"/>${dots}<g fill="#7f99a5" stroke="#d0e1e8" stroke-width=".7"><circle cx="127" cy="152" r="3"/><circle cx="139" cy="152" r="3"/><path d="M147 149h6v6h-6Z"/><circle cx="163" cy="152" r="3"/><circle cx="175" cy="152" r="3"/></g></svg>`;
}
