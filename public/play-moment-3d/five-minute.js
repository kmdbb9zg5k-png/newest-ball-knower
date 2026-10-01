/** Five-minute arcade rules. Pure state transitions; no timers or DOM. */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const fullInitialDrive = (mode = 'five-minute') => ({ ball: 25, down: 1, toGo: 10, clock: mode === 'two-minute' ? 120 : 300, score: mode === 'two-minute' ? 23 : 0, plays: 0 });
const teamStats = () => ({ plays: 0, yards: 0, passYards: 0, rushYards: 0, completions: 0, attempts: 0, touchdowns: 0, turnovers: 0, sacks: 0, fieldGoals: 0, players: {} });
export const fullSession = (mode = 'five-minute', interactive = false) => ({ interactive, mode, defenseMode: 'simulate', conversion: null, kickoff: null, timeouts: 3, awayTimeouts: 3, running: false, started: false, playClock: 40, log: [], result: null, full: true, awayScore: mode === 'two-minute' ? 27 : 0, possession: 'home', pending: null, nextBall: 25, cpu: { ball: 25, down: 1, toGo: 10 }, auto: true, wait: 2.8, overtime: 0, otPossessions: 0, stats: { home: teamStats(), away: teamStats() } });
const other = side => side === 'home' ? 'away' : 'home';
export function fullLog(s, d, side, reason, gain = null) {
  s.log.push({ side, reason, gain, clock: d.clock, overtime: s.overtime, ball: side === 'home' ? d.ball : s.cpu.ball });
}
function playerStats(s, side, player) {
  if (!player) return null;
  return s.stats[side].players[player.id] ||= { name: player.name, passYards: 0, rushYards: 0, receivingYards: 0, touchdowns: 0, fieldGoals: 0, attempts: 0, completions: 0 };
}
export function fullRecord(s, side, { gain = 0, pass = false, incomplete = false, sack = false, interception = false, touchdown = false, quarterback, runner }) {
  const stats = s.stats[side]; stats.plays++;
  const qb = playerStats(s, side, quarterback), carrier = playerStats(s, side, runner);
  if (sack) stats.sacks++;
  else if (pass) { stats.attempts++; if (qb) qb.attempts++; }
  if (interception) { stats.turnovers++; return; }
  if (incomplete) return;
  stats.yards += gain;
  if (pass || sack) {
    stats.passYards += gain;
    if (!sack) { stats.completions++; if (qb) { qb.completions++; qb.passYards += gain; } if (carrier) carrier.receivingYards += gain; }
  } else { stats.rushYards += gain; if (carrier) carrier.rushYards += gain; }
  if (touchdown) { stats.touchdowns++; if (carrier) carrier.touchdowns++; if (pass && qb && qb !== carrier) qb.touchdowns++; }
}
function addScore(s, d, side, points) { if (side === 'home') d.score += points; else s.awayScore += points; }
function finish(s, d) {
  s.running = false; s.pending = 'final';
  const won = d.score > s.awayScore, side = won ? 'home' : 'away';
  const players = Object.values(s.stats[side].players);
  const value = p => p.passYards * .04 + p.rushYards * .1 + p.receivingYards * .1 + p.touchdowns * 6 + p.fieldGoals * 3;
  const best = players.sort((a, b) => value(b) - value(a))[0];
  const mvp = best && value(best) > 0 ? best : null;
  s.result = { won, reason: won ? 'VICTORY' : 'DEFEAT', remaining: d.clock, mvp, mvpSide: side };
}
function startOvertime(s, d) {
  s.overtime++; s.otPossessions = 0; s.timeouts = 1; s.awayTimeouts = 1;
  s.pending = s.overtime % 2 ? 'home' : 'away'; s.nextBall = 75; s.running = false;
  fullLog(s, d, s.pending, `OVERTIME ${s.overtime} · Each team gets a possession from the opponent 25`);
}
export function fullExpired(s, d) {
  if (s.result || s.overtime || d.clock > 0) return false;
  if (d.score === s.awayScore) startOvertime(s, d); else finish(s, d);
  return true;
}
/** Called once when a possession ends. Both sides get a possession in each OT round. */
export function fullPossessionEnd(s, d, side, nextBall = 25) {
  s.running = false; s.wait = 2.8; s.defenseTimeout = false;
  if (s.overtime) {
    s.otPossessions++;
    if (s.otPossessions === 2) {
      if (d.score !== s.awayScore) finish(s, d); else startOvertime(s, d);
    } else { s.pending = other(side); s.nextBall = 75; }
  } else if (!fullExpired(s, d)) { s.pending = other(side); s.nextBall = clamp(nextBall, 1, 99); }
}
export function fullContinue(s, d) {
  if (!s.pending || s.result) return false;
  s.possession = s.pending; s.pending = null; s.wait = 2.8; s.playClock = 40; s.running = false;
  if (s.possession === 'home') { d.ball = s.nextBall; d.down = 1; d.toGo = Math.min(10, 100 - d.ball); }
  else s.cpu = { ball: s.nextBall, down: 1, toGo: Math.min(10, 100 - s.nextBall) };
  return true;
}
export function fullOffenseEnd(s, d, reason, { interceptionSpot = d.ball, quarterback } = {}) {
  if (s.result || s.pending) return;
  if (reason === 'TIME EXPIRED') { fullExpired(s, d); return; }
  fullLog(s, d, 'home', reason);
  if (reason === 'TOUCHDOWN') { if (s.interactive) { s.conversion = 'home'; s.running = false; } else { d.score++; fullLog(s, d, 'home', 'EXTRA POINT GOOD · +1'); fullPossessionEnd(s, d, 'home'); } }
  else if (reason === 'SAFETY') { s.awayScore += 2; fullPossessionEnd(s, d, 'home', 35); }
  else {
    if (reason === 'INTERCEPTED') fullRecord(s, 'home', { pass: true, interception: true, quarterback });
    if (reason === 'TURNOVER ON DOWNS') s.stats.home.turnovers++;
    fullPossessionEnd(s, d, 'home', reason === 'INTERCEPTED' && interceptionSpot >= 100 ? 20 : 100 - interceptionSpot);
  }
}
export const fieldGoalDistance = ball => 117 - ball;
export function fieldGoalChance(ball, kickerRating) {
  return clamp(.96 - Math.max(0, fieldGoalDistance(ball) - 30) * .019 + (kickerRating - 80) * .005, .08, .99);
}
export function fullKick(s, d, side, kind, team, random = Math.random) {
  if (s.result || s.pending || s.possession !== side || (s.overtime && kind === 'punt')) return false;
  const ball = side === 'home' ? d.ball : s.cpu.ball;
  if (kind === 'field-goal' && fieldGoalDistance(ball) > 65) return false;
  s.started = true;
  if (!s.overtime) d.clock = Math.max(0, d.clock - (kind === 'punt' ? 7 : 5));
  if (kind === 'punt') {
    const distance = Math.round(32 + (team.punter.overall - 70) * .35 + random() * 14);
    const landing = ball + distance;
    const returnYards = landing >= 100 ? 0 : Math.floor(random() * 10);
    fullLog(s, d, side, `PUNT · ${distance} yards${landing >= 100 ? ' · TOUCHBACK' : ` · ${returnYards}-yard return`}`);
    fullPossessionEnd(s, d, side, landing >= 100 ? 20 : 100 - landing + returnYards);
  } else {
    const good = random() < fieldGoalChance(ball, team.kicker.overall);
    fullLog(s, d, side, `${fieldGoalDistance(ball)}-YARD FIELD GOAL ${good ? 'GOOD · +3' : 'MISSED'}`);
    if (good) { addScore(s, d, side, 3); s.stats[side].fieldGoals++; playerStats(s, side, team.kicker).fieldGoals++; }
    fullPossessionEnd(s, d, side, good ? 25 : Math.max(20, 100 - ball + 7));
    if (good && s.interactive && !s.overtime && !s.result && d.clock > 0) s.kickoff = side;
  }
  return true;
}
export function fullCpuKickChoice(s, d) {
 const c=s.cpu, deficit=d.score-s.awayScore;
 const needTD=(!s.overtime&&d.clock<65&&deficit>3)||(s.overtime&&s.otPossessions===1&&deficit>3);
 if((c.down===4||!s.overtime&&d.clock<=8)&&fieldGoalDistance(c.ball)<=60&&!needTD)return 'field-goal';
 if(c.down===4&&c.ball<55&&!(d.clock<60&&deficit>0)&&!s.overtime)return 'punt';
 return null;
}
/** One CPU snap per call; the UI holds every result so no play disappears. */
export function fullCpuPlay(s, d, config, random = Math.random) {
  if (s.result || s.pending || s.possession !== 'away') return false;
  if (fullExpired(s, d)) return true;
  const c = s.cpu, team = config.matchup.away, home = config.matchup.home;
  const deficit = d.score - s.awayScore;
  const needTouchdown = !s.overtime && d.clock < 65 && deficit > 3 || s.overtime && s.otPossessions === 1 && deficit > 3;
  const desperation = !s.overtime && d.clock < 60 && deficit > 0;
  if ((c.down === 4 || !s.overtime && d.clock <= 8) && fieldGoalDistance(c.ball) <= 60 && !needTouchdown) return fullKick(s, d, 'away', 'field-goal', team, random);
  if (c.down === 4 && c.ball < 55 && !desperation && !s.overtime) return fullKick(s, d, 'away', 'punt', team, random);
  const pass = random() < (c.toGo > 7 || desperation ? .72 : .42);
  const edge = clamp((team.offense - home.defense + (config.level.id === 'rookie' ? -7 : config.level.id === 'all-pro' ? 5 : 0)) / 100, -.2, .2);
  const roll = random(), quarterback = team.lineup[5];
  const runner = team.lineup[pass ? 7 + Math.floor(random() * 4) : 6];
  let reason, gain = 0, incomplete = false, sack = false, interception = false;
  if (pass && roll < .045 - edge * .06) { interception = true; reason = 'INTERCEPTED'; }
  else if (pass && roll < .12 - edge * .15) { sack = true; gain = -Math.round(3 + random() * 6); reason = `${quarterback.name} SACKED`; }
  else if (pass && roll < .39 - edge) { incomplete = true; reason = `${quarterback.name} · INCOMPLETE`; }
  else {
    gain = pass ? Math.round(3 + random() * 18 + edge * 20) : Math.round(-2 + random() * 11 + edge * 15);
    if (random() < .055 + edge * .08) gain += Math.round(12 + random() * 22);
    reason = pass ? `${quarterback.name} → ${runner.name}` : `${runner.name} RUN`;
  }
  const out = !incomplete && !sack && !interception && random() < .13;
  let seconds = incomplete || interception || out ? 4 + Math.floor(random() * 4) : 12 + Math.floor(random() * 12);
  if (desperation && !incomplete && !interception && !out && s.awayTimeouts > 0) { seconds = 5; s.awayTimeouts--; reason += ' · CPU TIMEOUT'; }
  if (s.defenseTimeout) { seconds = 5; s.defenseTimeout = false; }
  fullCpuResult(s, d, config, {gain, pass, incomplete, sack, interception, out, reason, seconds, quarterback, runner}, random);
  return true;
}

/** Shared result path for simulated and on-field CPU snaps. */
export function fullCpuResult(s, d, config, {gain = 0, pass = false, incomplete = false, sack = false, interception = false, out = false, reason = 'TACKLED', seconds = 0, live = false, quarterback = config.matchup.away.lineup[5], runner = config.matchup.away.lineup[6]}, random = Math.random) {
  if (s.result || s.pending || s.possession !== 'away') return false;
  const c = s.cpu;
  const old = c.ball;
  c.ball = clamp(old + gain, 0, 100); gain = c.ball - old;
  const touchdown = !interception && !incomplete && c.ball >= 100, safety = !interception && !incomplete && c.ball <= 0;

  if (live && !s.overtime && !incomplete && !interception && !out && !touchdown && !safety) {
    if (d.clock-seconds<45 && s.awayScore<d.score && s.awayTimeouts>0) {s.awayTimeouts--;reason+=' · CPU TIMEOUT';}
    else if (!s.defenseTimeout) seconds+=d.clock<60&&s.awayScore<d.score?3:10;
    s.defenseTimeout=false;
  }
  if (!s.overtime) d.clock = Math.max(0, d.clock - seconds);
  fullRecord(s, 'away', { gain, pass, incomplete, sack, interception, touchdown, quarterback, runner });
  fullLog(s, d, 'away', reason + (touchdown ? ' · TOUCHDOWN +6' : safety ? ' · SAFETY +2' : out ? ' · OUT OF BOUNDS' : ''), interception ? null : gain);
  if (touchdown) { s.awayScore += 6; if (s.interactive) { s.conversion = 'away'; fullConversion(s, d, 'extra-point', random() < .95); } else { s.awayScore++; fullPossessionEnd(s, d, 'away'); } }
  else if (safety) { d.score += 2; fullPossessionEnd(s, d, 'away', 35); }
  else if (interception) fullPossessionEnd(s, d, 'away', 100 - c.ball);
  else {
    if (gain >= c.toGo) { c.down = 1; c.toGo = Math.min(10, 100 - c.ball); }
    else { c.down++; c.toGo = Math.max(1, c.toGo - gain); }
    if (c.down > 4) { s.stats.away.turnovers++; fullLog(s, d, 'away', 'TURNOVER ON DOWNS'); fullPossessionEnd(s, d, 'away', 100 - c.ball); }
    else fullExpired(s, d);
  }
  return true;
}
export function fullConversion(s, d, kind, good) {
  const side = s.conversion;
  if (!side || s.result) return false;
  const points = kind === 'two-point' ? 2 : 1;
  if (good) addScore(s, d, side, points);
  fullLog(s, d, side, `${kind === 'two-point' ? 'TWO-POINT TRY' : 'EXTRA POINT'} ${good ? 'GOOD · +' + points : 'NO GOOD'}`);
  s.conversion = null;
  fullPossessionEnd(s, d, side);
  if (!s.overtime && !s.result && d.clock > 0) s.kickoff = side;
  return true;
}
export function fullKickoffResult(s, d, {ball = 25, seconds = 0, touchdown = false}) {
  const kicking = s.kickoff;
  if (!kicking || s.result) return false;
  const receiving = other(kicking); s.kickoff = null;
  s.pending = receiving; s.nextBall = clamp(ball, 1, 99);
  fullContinue(s, d);
  if (!s.overtime) d.clock = Math.max(0, d.clock - seconds);
  fullLog(s, d, receiving, touchdown ? 'KICK RETURN TOUCHDOWN · +6' : `KICK RETURN · OWN ${Math.round(ball)}`);
  if (touchdown) { addScore(s, d, receiving, 6); s.conversion = receiving; if (receiving === 'away') fullConversion(s, d, 'extra-point', true); }
  else fullExpired(s, d);
  return true;
}
