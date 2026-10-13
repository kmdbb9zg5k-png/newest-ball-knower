// All durations use active simulation time; backgrounding cannot consume a turn.
export const JUMP_RULESET = 'broad-jump-v1';
export const JUMP_STORAGE = 'bk-combine-broad-jump-v1';
const clamp = n => Math.max(0, Math.min(1, n));
export const jumpMarker = s => (Math.sin(s.elapsed * Math.PI * 2 / 1.2 - Math.PI / 2) + 1) / 2;
export function newJump(athlete) { return { athlete, phase:'idle', elapsed:0, power:0, taps:0, lastTap:-1, launch:0, landing:null, distance:0, target:0, visualDistance:0, flight:0.9, height:0 }; }
export function pressJump(s) {
  if(s.phase==='idle'){s.phase='power';s.elapsed=0;}
  if(s.phase==='power') {
    // One physical press per impulse, bounded at 20/second; holding adds nothing.
    if(s.elapsed-s.lastTap < .05)return;
    s.lastTap=s.elapsed;s.taps++;s.power=clamp(s.taps/24);
  } else if(s.phase==='aim') {
    s.launch=clamp(1-Math.abs(jumpMarker(s)-.75)/.55);
    s.target=1.25+s.power*1.25+s.launch*.65;
    s.phase='flight';s.elapsed=0;
  } else if(s.phase==='flight' && s.landing===null) {
    s.landing=clamp(1-Math.abs(s.elapsed/s.flight-.88)/.25);
  }
}
export function stepJump(s,dt) {
  if(!Number.isFinite(dt)||dt<=0||s.phase==='idle')return;
  s.elapsed+=dt;
  if(s.phase==='power'&&s.elapsed>=3){s.phase='aim';s.elapsed=0;}
  else if(s.phase==='aim'&&s.elapsed>=3){s.phase='finished';s.elapsed=0;s.distance=0;}
  else if(s.phase==='flight'){
    const t=clamp(s.elapsed/s.flight);s.distance=s.target*t;s.visualDistance=s.distance;s.height=4*.65*t*(1-t);
    if(t>=1){s.landing??=0;s.distance=Math.max(0,s.target-(1-s.landing)*.45);s.height=0;s.phase='landed';s.elapsed=0;}
  }else if(s.phase==='landed'&&s.elapsed>=1.1){s.phase='finished';s.elapsed=0;}
}
export function formatJump(m){const inches=Math.round(m/0.0254);return `${Math.floor(inches/12)}′ ${inches%12}″`;}
export function readJumps(){try{const rows=JSON.parse(localStorage.getItem(JUMP_STORAGE)||'[]');return Array.isArray(rows)?rows.filter(r=>r?.ruleset===JUMP_RULESET&&typeof r.playerId==='string'&&typeof r.context==='string'&&Number.isFinite(r.distance)&&r.distance>0&&r.distance<=3.2):[];}catch{return [];}}
export function saveJump(s,context){try{const row={ruleset:JUMP_RULESET,playerId:s.athlete.id,context,distance:s.distance,date:Date.now()};localStorage.setItem(JUMP_STORAGE,JSON.stringify([...readJumps(),row].slice(-500)));return true;}catch{return false;}}
