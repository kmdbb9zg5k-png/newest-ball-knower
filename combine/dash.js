// Distances are metres; the event is exactly 40 yards. No wall-clock time enters
// the simulation, so refresh rate and background tabs cannot change a result.
export const YARD = .9144;
export const FINISH = 40 * YARD;
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
  return { athlete, phase: 'idle', clock: 0, distance: 0, velocity: 0, splits: [null, null, null], cue: 0, wait: 0, reaction: null, launch: 1, held: false };
}
export function pressDash(s, wait = 1.5) {
  if (s.phase === 'idle') { s.phase = 'set'; s.wait = clamp(wait, 1.1, 2.3); s.cue = 0; }
  else if (s.phase === 'set') { s.phase = 'false-start'; }
  else if (s.phase === 'ready') {
    s.reaction = s.cue; s.launch = clamp(1 - Math.max(0, s.reaction - .12) * .35, .70, 1);
    s.phase = 'running'; s.held = true;
  } else if (s.phase === 'running') s.held = true;
}
export function stepDash(s, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  if (s.phase === 'set') { s.cue += dt; if (s.cue >= s.wait) { s.phase = 'ready'; s.cue = 0; } return; }
  if (s.phase === 'ready') { s.cue += dt; return; }
  if (s.phase !== 'running') return;
  const before = s.distance, oldTime = s.clock, maxSpeed = 7.2 + (s.athlete.speed - 50) * .066;
  const target = maxSpeed * (s.held ? 1 : .78);
  const tau = (1.05 - (s.athlete.acceleration - 50) * .007) / s.launch;
  // Exact exponential integration, including time of crossing each gate.
  const v0 = s.velocity, travel = t => target * t + (v0 - target) * tau * (1 - Math.exp(-t / tau));
  s.distance += travel(dt); s.velocity = target + (v0 - target) * Math.exp(-dt / tau); s.clock += dt;
  [10, 20, 40].forEach((yards, i) => {
    const gate = yards * YARD;
    if (s.splits[i] !== null || s.distance < gate) return;
    let lo = 0, hi = dt;
    for (let n = 0; n < 24; n++) { const mid = (lo + hi) / 2; if (before + travel(mid) < gate) lo = mid; else hi = mid; }
    s.splits[i] = oldTime + (lo + hi) / 2;
  });
  if (s.distance >= FINISH) { s.phase = 'finished'; s.clock = s.splits[2]; s.distance = FINISH; s.held = false; }
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
  return rows.filter(r => r.context === context && r.playerId === id).sort((a, b) => a.splits[2] - b.splits[2])[0] || null;
}
