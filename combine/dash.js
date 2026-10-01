// Distances are metres; the event is exactly 40 yards. No wall-clock time enters
// the simulation, so refresh rate and background tabs cannot change a result.
export const YARD = .9144;
export const FINISH = 40 * YARD;
export const RULESET = 'flow-v3';
export const RESULT_KEY = 'bk-combine-forty-v1';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function seedFor(id) { return [...id].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7); }
export function combineAthlete(player) {
  const seed = seedFor(player.id), pos = player.position;
  const base = ({ WR: 90, CB: 91, RB: 87, FS: 87, SS: 84, TE: 78, LB: 77, EDGE: 76, DE: 72, DT: 58, NT: 55, LT: 55, RT: 55, LG: 53, RG: 53, C: 54, QB: 74, K: 65, P: 66 })[pos] || 75;
  const physical = player.attributes?.athleticism ?? player.grade ?? 78;
  const speed = clamp(Math.round(player.speed ?? base + (physical - 80) * .25 + seed % 9 - 4), 45, 99);
  return { id: player.id, name: player.name, position: pos, speed, acceleration: clamp(speed + seed % 11 - 5, 45, 99), seed };
}
export function topSpeed(athlete) { return 7.2+(athlete.speed-50)*.066; }
export function speedPercent(s) { return Math.min(100,Math.round(s.velocity/topSpeed(s.athlete)*100)); }
export function newDash(athlete) {
  return { athlete, phase:'idle',clock:0,distance:0,velocity:0,splits:[null,null,null],cue:0,wait:0,reaction:null,launch:1,
    nextSide:'left',lastTap:0,lastInput:-1,lastPenalty:-1,form:.35,hits:0,mistakes:0,peakVelocity:0 };
}
// One tap starts the countdown. Green launches automatically; extra taps do nothing.
export function pressDash(s,wait=1.5) {
  if(s.phase==='idle'){s.phase='set';s.wait=clamp(wait,1.1,2.3);s.cue=0;}
}
export function tapStride(s,side) {
  if(s.phase!=='running'||!['left','right'].includes(side))return;
  const tooSoon=s.clock-s.lastInput<.08;s.lastInput=s.clock;
  if(side!==s.nextSide||tooSoon){s.mistakes++;if(s.clock-s.lastPenalty>=.18){s.form=Math.max(0,s.form-.30);s.velocity*=.88;s.lastPenalty=s.clock;}return;}
  s.hits++;s.lastTap=s.clock;s.nextSide=side==='left'?'right':'left';s.form=Math.min(1,s.form+.22);
}
export function accuracy(s) {
  return {launch:Math.round(s.launch*100),flow:Math.round(100*s.hits/Math.max(1,s.hits+s.mistakes)),topSpeed:s.peakVelocity*2.236936};
}
// Estimated peer marks are explicitly presented as simulated benchmarks, not
// other people's runs or real-world combine results.
export function positionRanking(players, athlete, seconds) {
  const peers=players.filter(p=>p.position===athlete.position&&p.id!==athlete.id);
  const estimate=p=>{const target=(7.2+(p.speed-50)*.066)*.94,tau=1.05-(p.acceleration-50)*.007;let lo=0,hi=20;for(let i=0;i<40;i++){const t=(lo+hi)/2;if(target*(t-tau*(1-Math.exp(-t/tau)))<FINISH)lo=t;else hi=t;}return (lo+hi)/2;};
  return {rank:1+peers.filter(p=>estimate(p)<seconds).length,total:peers.length+1};
}
export function stepDash(s,dt) {
  if(!Number.isFinite(dt)||dt<=0)return;
  if(s.phase==='set'){const remaining=Math.max(0,s.wait-s.cue);if(dt+1e-9<remaining){s.cue+=dt;return;}s.phase='running';s.cue=0;dt=Math.max(0,dt-remaining);}
  // Small integration steps keep speed decay stable at different display rates.
  while(dt>1e-9&&s.phase==='running'){const step=Math.min(dt,1/120);integrate(s,step);dt-=step;}
}
function integrate(s,dt) {
  const before=s.distance,oldTime=s.clock;
  // A generous grace period supports a natural pace; stopping loses momentum.
  const decay=s.clock-s.lastTap>.6?.9:.12;s.form=Math.max(0,s.form-decay*dt);
  const target=topSpeed(s.athlete)*(.53+.47*s.form);
  const tau=target<s.velocity?.22:(1.05-(s.athlete.acceleration-50)*.007)/s.launch;
  const v0=s.velocity,travel=t=>target*t+(v0-target)*tau*(1-Math.exp(-t/tau));
  s.distance+=travel(dt);s.velocity=target+(v0-target)*Math.exp(-dt/tau);s.clock+=dt;s.peakVelocity=Math.max(s.peakVelocity,s.velocity);
  [10,20,40].forEach((yards,i)=>{const gate=yards*YARD;if(s.splits[i]!==null||s.distance<gate)return;let lo=0,hi=dt;for(let n=0;n<24;n++){const mid=(lo+hi)/2;if(before+travel(mid)<gate)lo=mid;else hi=mid;}s.splits[i]=oldTime+(lo+hi)/2;});
  if(s.distance>=FINISH){s.phase='finished';s.clock=s.splits[2];s.distance=FINISH;}
}
export function validResult(r) {
  return r && typeof r.context === 'string' && typeof r.playerId === 'string' && typeof r.name === 'string' && typeof r.position === 'string'
    && Array.isArray(r.splits) && r.splits.length === 3 && r.splits.every(n => Number.isFinite(n) && n > 0 && n < 30)
    && r.splits[0] < r.splits[1] && r.splits[1] < r.splits[2] && Number.isFinite(r.date);
}
export function readResults(storage) {
  try { const rows = JSON.parse((storage || globalThis.localStorage).getItem(RESULT_KEY) || '[]'); return Array.isArray(rows) ? rows.filter(validResult).slice(-400) : []; } catch { return []; }
}
export function saveResult(result, storage) {
  if (!validResult(result)) return false;
  try { (storage || globalThis.localStorage).setItem(RESULT_KEY, JSON.stringify([...readResults(storage), result].slice(-400))); return true; } catch { return false; }
}
export function bestResult(rows, context, id) {
  return rows.filter(r => r.context === context && r.playerId === id && r.ruleset === RULESET).sort((a, b) => a.splits[2] - b.splits[2])[0] || null;
}
