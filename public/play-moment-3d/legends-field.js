/** Same-origin bridge for the device-local BK Legends campaign. */
export function readLegendsField(search, storage, embedded) {
  const token = new URLSearchParams(search).get('bkLegends');
  if (!embedded || !token || !/^[\da-f-]{36}$/i.test(token)) return null;
  try {
    const launch = JSON.parse(storage.getItem('bk-legends-attempt:' + token) ?? 'null');
    if (launch?.squad?.lineup?.length !== 22 || !launch.scenario) return null;
    return { ...launch, token };
  } catch { return null; }
}
export function setLegendsStart(session, scenario) {
  session.awayScore = scenario.awayScore;
  session.timeouts = scenario.timeouts;
  if (!scenario.defending) return;
  session.possession = 'away';
  session.cpu = { ball: scenario.ball, down: 1, toGo: Math.min(10, 100 - scenario.ball) };
}
export function finishLegendsGhost(session, drive) {
  session.running = false;
  session.pending = 'final';
  session.conversion = null;
  session.kickoff = null;
  const won = drive.score > session.awayScore;
  session.result = { won, reason: won ? 'WINNING DRIVE' : 'DRIVE OVER', remaining: drive.clock, mvp: null, mvpSide: 'home' };
}
export function reportLegendsResult(launch, session, drive) {
  const { home, away } = session.stats;
  const plays = home.plays + away.plays + home.fieldGoals + away.fieldGoals;
  const elapsed = clock => Math.round(Math.max(0, launch.scenario.clock - clock) * 1000);
  const ghost = launch.ghost && session.result?.won && plays > 0 ? {
    drive: {
      elapsedMs: elapsed(drive.clock),
      plays,
      steps: session.log.slice(-24).map(({ reason, gain, clock }) => ({
        reason, gain: Number.isFinite(gain) ? Math.round(gain) : null, elapsedMs: elapsed(clock),
      })),
    },
    receivers: launch.squad.lineup.slice(7, 10).map(({ id }) => ({
      id, yards: Math.round(home.players[id]?.receivingYards ?? 0),
    })),
  } : undefined;
  window.parent.postMessage({
    type: 'bk-legends-result',
    token: launch.token,
    result: {
      homeScore: drive.score, awayScore: session.awayScore,
      passYards: Math.round(home.passYards), rushYards: Math.round(home.rushYards),
      plays,
      ...(ghost && { ghost }),
    },
  }, window.location.origin);
}
