import {miniMatchup} from './mini-teams.js?v=five-minute-1';
/** Shared mini-game levels. Athlete speed and animation timing stay rating-driven. */
export const MINI_LEVELS = Object.freeze([
  Object.freeze({ id: 'rookie', name: 'Rookie', description: 'Forgiving coverage, easier tackles to break, slower defensive reads.', defense: -16, readScale: 1.45 }),
  Object.freeze({ id: 'pro', name: 'Pro', description: 'Balanced coverage, tackling, and defensive reads.', defense: -5, readScale: 1.12 }),
  Object.freeze({ id: 'all-pro', name: 'All-Pro', description: 'Tighter coverage, stronger tackling, faster defensive reads.', defense: 5, readScale: .8 }),
]);
export function miniLevel(id) { return MINI_LEVELS.find(level => level.id === id) || MINI_LEVELS[0]; }
export function miniGameFromSearch(search = '') {
  const params = new URLSearchParams(search);
  return ['two-minute','five-minute'].includes(params.get('mode')) ? { mode: params.get('mode'), level: miniLevel(params.get('difficulty')), matchup: miniMatchup(params.get('team'), params.get('opponent')) } : null;
}
export function miniRatings(ratings, team, level) {
  if (!level || team !== 1) return ratings;
  return Object.freeze(Object.fromEntries(Object.entries(ratings).map(([key, value]) => [key,
    ['coverage', 'tackle', 'awareness', 'blockShed'].includes(key) ? Math.max(35, Math.min(97, value + level.defense)) : value])));
}
export const miniInitialDrive = () => ({ ball: 25, down: 1, toGo: 10, clock: 120, score: 23, plays: 0 });
export const miniSession = () => ({ timeouts: 3, running: false, started: false, playClock: 40, log: [], result: null });
export function miniSnap(session) { session.started = true; session.running = true; session.playClock = 40; }
export function miniWhistle(session, drive, reason, gain, incomplete = false) {
  session.running = !incomplete && reason !== 'OUT OF BOUNDS' && reason !== 'TOUCHDOWN';
  session.playClock = 40;
  session.log.push({ reason, gain, clock: Math.max(0, drive.clock), ball: drive.ball });
}
/** Only dead-ball time runs here; the existing engine owns live-play time. */
export function miniBetweenPlays(session, drive, phase, dt) {
  if (session.result || !session.started || !['pre', 'dead'].includes(phase)) return null;
  if (session.running && !session.overtime) drive.clock = Math.max(0, drive.clock - dt);
  if (drive.clock <= 0 && !session.overtime) return 'TIME EXPIRED';
  // The play clock starts once the field is ready for the next snap.
  if (phase === 'pre') {
    session.playClock = Math.max(0, session.playClock - dt);
    if (session.playClock <= 0) {
      const loss = Math.min(5, Math.max(1, Math.floor(drive.ball / 2)));
      const actual = Math.min(loss, drive.ball - 1);
      drive.ball -= actual; drive.toGo += actual;
      session.playClock = 40;
      session.log.push({ ...(session.full ? { side: 'home', overtime: session.overtime } : {}), reason: 'DELAY OF GAME', gain: -actual, clock: drive.clock, ball: drive.ball });
      return 'DELAY OF GAME';
    }
  }
  return null;
}
export function miniTimeout(session, drive, phase) {
  if (session.result || !session.started || !session.running || session.timeouts <= 0 || (drive.clock <= 0 && !session.overtime) || !['pre', 'dead'].includes(phase)) return false;
  session.timeouts--; session.running = false; session.playClock = 40;
  session.log.push({ ...(session.full ? { side: 'home', overtime: session.overtime } : {}), reason: 'TIMEOUT', gain: null, clock: drive.clock, ball: drive.ball });
  return true;
}
export function miniSpike(session, drive, phase) {
  if (session.result || phase !== 'pre' || (drive.clock <= 0 && !session.overtime)) return false;
  session.started = true; session.running = false; session.playClock = 40;
  if (!session.overtime) drive.clock = Math.max(0, drive.clock - 1); drive.down++; drive.plays++;
  session.log.push({ ...(session.full ? { side: 'home', overtime: session.overtime } : {}), reason: 'SPIKE', gain: 0, clock: drive.clock, ball: drive.ball });
  return true;
}
export function miniFinish(session, drive, title) {
  if (session.result) return session.result;
  session.running = false;
  return session.result = { won: title === 'TOUCHDOWN', reason: title, remaining: Math.max(0, drive.clock), plays: drive.plays, yards: drive.ball - 25 };
}
export function miniClock(seconds) { const n = Math.max(0, Math.ceil(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; }
export function saveMiniBest(storage, level, result, matchup = '') {
  if (!result?.won) return null;
  const key = `bk-mini-two-minute-best-v1:${miniLevel(level).id}${matchup ? ':' + matchup : ''}`;
  try {
    const previous = Number(storage.getItem(key));
    const best = Math.max(Number.isFinite(previous) ? previous : 0, result.remaining);
    storage.setItem(key, String(best)); return best;
  } catch { return null; }
}
