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
export function defensiveDiagram(call) {
 const dots=Array.from({length:11},(_,slot)=>{const [x,z]=defenseAlignment(call,slot);const px=100+x*3,py=96-z*3;const rush=slot<4||call.blitz.includes(11+slot);return `<circle cx="${px}" cy="${py}" r="4" fill="#edce77"/><path d="M${px} ${py} l${rush?'0 23':call.coverage==='man'?'7 -18':'0 -11'}" stroke="${rush?'#e88671':'#a5cbd7'}" stroke-width="2"/>${!rush&&call.coverage==='zone'?`<ellipse cx="${px}" cy="${py-14}" rx="14" ry="8" fill="#86b5ca33" stroke="#a5cbd7"/>`:''}`;}).join('');
 return `<svg viewBox="0 0 200 120" aria-hidden="true"><path d="M5 100H195" stroke="#ffffff55" stroke-dasharray="4 4"/>${dots}</svg>`;
}
