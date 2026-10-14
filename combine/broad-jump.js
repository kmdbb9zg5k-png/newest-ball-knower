// All durations use active simulation time; backgrounding cannot consume a turn.
export const JUMP_RULESET = 'broad-jump-v4';
export const JUMP_STORAGE = 'bk-combine-broad-jump-v4';
export const JUMP_ATTEMPTS = 2;
export const REP_SECONDS = 1.6;
export const POWER_SECONDS = 2;
export const INPUT_PAUSE = .2;
export const inputReady = s => !['aim','flight'].includes(s.phase) || s.elapsed >= INPUT_PAUSE;
export const launchSeconds = s => Math.max(0, REP_SECONDS - Math.max(0, s.elapsed - INPUT_PAUSE));
export const LAND_GREEN_START = .78;
export const LAND_GREEN_END = .98;
export const STUMBLE_PENALTY = .45;
export const landingProgress = s => Math.max(0, Math.min(1, s.elapsed / s.flight));
export const isLandingGreen = s => s.phase === 'flight' && s.landing === null && landingProgress(s) >= LAND_GREEN_START && landingProgress(s) <= LAND_GREEN_END;
const clamp = n => Math.max(0, Math.min(1, n));
export const jumpMarker = s => clamp((s.elapsed-INPUT_PAUSE)/REP_SECONDS);
export const landingFeedback = s => s.landing===null?'':s.landing===1?'PERFECT':s.landingAt===1?'MISSED':s.landingAt<LAND_GREEN_START?'TOO EARLY':'TOO LATE';
export function newJump(athlete) { return { athlete, phase:'idle', elapsed:0, power:0, taps:0, lastTap:-1, lastPower:{}, launch:0, landing:null, landingAt:null, stumble:false, penalty:0, distance:0, target:0, visualDistance:0, flight:1.2, height:0 }; }
export function pressJump(s,control = 'auto') {
  if(control.startsWith('power') && !['idle','power'].includes(s.phase))return;
  if(control==='timing' && !['aim','flight'].includes(s.phase))return;
  if(!inputReady(s))return;
  if(s.phase==='idle'){s.phase='power';s.elapsed=0;}
  if(s.phase==='power') {
    // One physical press per impulse, bounded at 20/second; holding adds nothing.
    const side=control==='power-right'?'right':'left';
    if(s.elapsed-(s.lastPower[side]??-1) < .05)return;
    s.lastPower[side]=s.elapsed;s.lastTap=s.elapsed;s.taps++;s.power=clamp(s.taps/32);
  } else if(s.phase==='aim') {
    s.launch=clamp(1-Math.abs(jumpMarker(s)-.75)/.55);
    s.target=1.25+s.power*1.25+s.launch*.65;
    s.phase='flight';s.elapsed=0;
  } else if(s.phase==='flight' && s.landing===null) {
    s.landingAt=landingProgress(s);
    s.landing=isLandingGreen(s)?1:0;
    s.stumble=s.landing===0;
  }
}
export function stepJump(s,dt) {
  if(!Number.isFinite(dt)||dt<=0||['idle','finished'].includes(s.phase))return;
  s.elapsed+=dt;
  if(s.phase==='power'&&s.elapsed>=POWER_SECONDS){s.phase='aim';s.elapsed=0;}
  else if(s.phase==='aim'&&s.elapsed>=REP_SECONDS+INPUT_PAUSE){s.phase='finished';s.elapsed=0;s.distance=0;}
  else if(s.phase==='flight'){
    const t=clamp(s.elapsed/s.flight);s.distance=s.target*t;s.visualDistance=s.distance;s.height=4*.65*t*(1-t);
    if(t>=1){s.landing??=0;s.landingAt??=1;s.stumble=s.landing===0;s.penalty=s.stumble?STUMBLE_PENALTY:0;s.distance=Math.max(0,s.target-s.penalty);s.height=0;s.phase='landed';s.elapsed=0;}
  }else if(s.phase==='landed'&&s.elapsed>=1){s.phase='finished';s.elapsed=0;}
}
export function formatJump(m){const inches=Math.round(m/0.0254);return `${Math.floor(inches/12)}′ ${inches%12}″`;}
export function readJumps(){try{const rows=JSON.parse(localStorage.getItem(JUMP_STORAGE)||'[]');return Array.isArray(rows)?rows.filter(r=>r?.ruleset===JUMP_RULESET&&typeof r.playerId==='string'&&typeof r.context==='string'&&Number.isFinite(r.distance)&&r.distance>0&&r.distance<=3.2):[];}catch{return [];}}
export function saveJump(s,context){try{const row={ruleset:JUMP_RULESET,playerId:s.athlete.id,context,distance:s.distance,date:Date.now()};localStorage.setItem(JUMP_STORAGE,JSON.stringify([...readJumps(),row].slice(-500)));return true;}catch{return false;}}
