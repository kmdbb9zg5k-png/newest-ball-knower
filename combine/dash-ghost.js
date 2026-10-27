import {FINISH, RULESET, newDash, stepDash, tapStride} from './dash.js';

export const GHOST_KEY = 'bk-dash-ghosts-v1';
export const MAX_GHOST_BYTES = 64000;
const MAX_INPUTS = 500;
const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
const finite = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;

/** Replays use the actual recorded input clock, never an invented pace curve. */
export function createGhostPlayback(replay) {
  let state = newDash({...replay.athlete}), cursor = 0;
  state.phase = 'running';
  return {
    at(seconds) {
      const target = Math.max(0, Math.min(replay.time, Number.isFinite(seconds) ? (seconds >= replay.time ? replay.time : Math.floor(seconds * 120) / 120) : 0));
      if (target + 1e-8 < state.clock) {state = newDash({...replay.athlete}); state.phase = 'running'; cursor = 0;}
      while (cursor < replay.inputs.length && replay.inputs[cursor][0] <= target + 1e-9) {
        const [clock, side] = replay.inputs[cursor++];
        stepDash(state, Math.max(0, clock - state.clock));
        tapStride(state, side === 0 ? 'left' : 'right');
      }
      stepDash(state, Math.max(0, target - state.clock));
      return state;
    },
  };
}

export function validateGhost(raw) {
  if (!raw || raw.version !== 1 || raw.ruleset !== RULESET || !finite(raw.time, 2, 20)) return null;
  const a = raw.athlete;
  if (!a || !text(a.id, 100) || !text(a.name, 60) || !text(a.position, 8) || !finite(a.speed, 45, 99) || !finite(a.acceleration, 45, 99) || !Number.isInteger(a.seed) || !finite(a.seed, 0, 4294967295)) return null;
  if (!Array.isArray(raw.inputs) || raw.inputs.length > MAX_INPUTS || !finite(raw.recordedAt, 0, 8640000000000000)) return null;
  let previous = -1;
  for (const input of raw.inputs) {
    if (!Array.isArray(input) || input.length !== 2 || !finite(input[0], 0, raw.time) || input[0] < previous || ![0,1].includes(input[1])) return null;
    previous = input[0];
  }
  const replay = {version:1, ruleset:RULESET, athlete:{id:a.id,name:a.name,position:a.position,speed:a.speed,acceleration:a.acceleration,seed:a.seed}, time:raw.time, recordedAt:raw.recordedAt, inputs:raw.inputs.map(x=>[x[0],x[1]])};
  const playback = createGhostPlayback(replay);
  const finish = playback.at(replay.time);
  // Tolerate only floating-point integration rounding, not edited results.
  if (Math.abs(finish.distance - FINISH) > .025) return null;
  stepDash(finish, .02);
  if (finish.phase !== 'finished' || Math.abs(finish.clock - replay.time) > .003) return null;
  return replay;
}

export function recordGhost(athlete, inputs, time, recordedAt = Date.now()) {
  return validateGhost({version:1,ruleset:RULESET,athlete,inputs,time,recordedAt});
}
export function parseGhost(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_GHOST_BYTES) throw new Error('Replay file is too large. Choose a Ball Knower dash replay under 64 KB.');
  let raw; try { raw = JSON.parse(source); } catch { throw new Error('This file is not a valid Ball Knower replay.'); }
  const replay = validateGhost(raw);
  if (!replay) throw new Error('Replay is incompatible or its recorded inputs do not match its finish time.');
  return replay;
}
export function readGhosts(storage) {
  try { storage ??= globalThis.localStorage; const source=storage.getItem(GHOST_KEY) || '{}'; if(source.length > MAX_GHOST_BYTES * 2) return {best:null,imported:null}; const raw = JSON.parse(source);return {best:validateGhost(raw.best), imported:validateGhost(raw.imported)}; }
  catch { return {best:null, imported:null}; }
}
export function saveGhost(replay, kind = 'best', storage) {
  const valid = validateGhost(replay);if (!valid || !['best','imported'].includes(kind)) return false;
  try {
    storage ??= globalThis.localStorage;
    const current = readGhosts(storage);
    if (kind === 'best' && current.best && current.best.athlete.id === valid.athlete.id && current.best.athlete.speed === valid.athlete.speed && current.best.athlete.acceleration === valid.athlete.acceleration && current.best.time <= valid.time) return true;
    storage.setItem(GHOST_KEY, JSON.stringify({...current,[kind]:valid}));return true;
  } catch {return false;}
}
