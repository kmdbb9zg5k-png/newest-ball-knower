// Distances are metres; the event is exactly 40 yards. No wall-clock time enters
// the simulation, so refresh rate and background tabs cannot change a result.
export const YARD = .9144;
export const FINISH = 40 * YARD;
export const RULESET = 'rhythm-v2';
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
export function newDash(athlete) {
  return { athlete, phase: 'idle', clock: 0, distance: 0, velocity: 0, splits: [null, null, null], cue: 0, wait: 0, reaction: null, launch: 1, held: false,
    period: .30 - (athlete.speed - 45) * .0009, nextBeat: .40, beat: 0, judged: false, form: .8, hits: 0, opportunities: 0, quality: 0, mistakes: 0, feedback: '', feedbackUntil: 0, finishAt: null, finishQuality: null };
}
// Hold to set; release on green. Holding through green never starts a run.
export function pressDash(s, wait = 1.5) {
  if (s.phase === 'idle') { s.phase = 'set'; s.wait = clamp(wait, 1.1, 2.3); s.cue = 0; s.held = true; }
}
export function releaseDash(s) {
  if (!s.held) return;
  s.held = false;
  if (s.phase === 'set') { s.phase = 'false-start'; return; }
  if (s.phase === 'ready') {
    s.reaction = s.cue; s.launch = clamp(1 - Math.max(0, s.reaction - .08) * .8, .45, 1); s.phase = 'running';
  }
}
export function tapStride(s, side) {
  if(s.phase !== 'running') return;
  const error = Math.abs(s.clock-s.nextBeat), correct = side === (s.beat % 2 === 0 ? 'left' : 'right');
  if(!correct || s.judged || error > .115) {
    s.mistakes++; s.form = Math.max(0,s.form-.065); s.feedback=correct?'OFF BEAT':'ALTERNATE';
  } else {
    const quality=clamp(1-error/.115,0,1); s.judged=true; s.hits++; s.opportunities++; s.quality+=quality;
    s.form=.55*s.form+.45*quality; s.feedback=quality>.8?'PERFECT':quality>.45?'GOOD':'EARLY / LATE';
  }
  s.feedbackUntil=s.clock+.22;
}
export function finishEffort(s) {
  if(s.phase!=='running'||s.finishAt===null||s.finishQuality!==null) return;
  s.finishQuality=clamp(1-Math.abs(s.clock-s.finishAt)/.16,0,1);
  s.feedback=s.finishQuality>.7?'STRONG FINISH':'FINISH MISSED';s.feedbackUntil=s.clock+.5;
}
export function accuracy(s) {
  return {launch:Math.round(s.launch*100),rhythm:Math.round(100*s.quality/Math.max(1,s.opportunities+s.mistakes)),finish:Math.round((s.finishQuality||0)*100)};
}
// Estimated peer marks are explicitly presented as simulated benchmarks, not
// other people's runs or real-world combine results.
export function positionRanking(players, athlete, seconds) {
  const peers=players.filter(p=>p.position===athlete.position&&p.id!==athlete.id);
  const estimate=p=>{const target=(7.2+(p.speed-50)*.066)*.94,tau=1.05-(p.acceleration-50)*.007;let lo=0,hi=20;for(let i=0;i<40;i++){const t=(lo+hi)/2;if(target*(t-tau*(1-Math.exp(-t/tau)))<FINISH)lo=t;else hi=t;}return (lo+hi)/2;};
  return {rank:1+peers.filter(p=>estimate(p)<seconds).length,total:peers.length+1};
}
export function stepDash(s, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  if (s.phase === 'set') { s.cue += dt; if (s.cue >= s.wait) { s.phase = 'ready'; s.cue = 0; } return; }
  if (s.phase === 'ready') { s.cue += dt; return; }
  if (s.phase !== 'running') return;
  // Split at rhythm-window boundaries so missed beats have the same effect at
  // every refresh rate. The app drives this with a fixed simulation step too.
  const boundary=s.nextBeat+.115;
  if(s.clock+dt>boundary+1e-9) {
    const first=Math.max(0,boundary-s.clock);if(first>1e-9) integrate(s,first);
    if(s.phase!=='running')return;
    if(!s.judged){s.opportunities++;s.form=Math.max(0,s.form-.22);s.feedback='MISSED';s.feedbackUntil=s.clock+.18;}
    s.nextBeat+=s.period;s.beat++;s.judged=false;
    stepDash(s,dt-first);return;
  }
  integrate(s,dt);
}
function integrate(s,dt) {
  const before=s.distance,oldTime=s.clock,maxSpeed=7.2+(s.athlete.speed-50)*.066;
  const target=maxSpeed*(.53+.45*s.form+.02*(s.finishQuality||0));
  const tau=(1.05-(s.athlete.acceleration-50)*.007)/s.launch;
  const v0=s.velocity,travel=t=>target*t+(v0-target)*tau*(1-Math.exp(-t/tau));
  s.distance+=travel(dt);s.velocity=target+(v0-target)*Math.exp(-dt/tau);s.clock+=dt;
  [10,20,40].forEach((yards,i)=>{const gate=yards*YARD;if(s.splits[i]!==null||s.distance<gate)return;let lo=0,hi=dt;for(let n=0;n<24;n++){const mid=(lo+hi)/2;if(before+travel(mid)<gate)lo=mid;else hi=mid;}s.splits[i]=oldTime+(lo+hi)/2;});
  if(s.finishAt===null&&s.distance>=28*YARD)s.finishAt=s.clock+.75;
  if(s.finishAt!==null&&s.finishQuality===null&&s.clock>s.finishAt+.16)s.finishQuality=0;
  if(s.distance>=FINISH){s.phase='finished';s.clock=s.splits[2];s.distance=FINISH;s.held=false;}
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
