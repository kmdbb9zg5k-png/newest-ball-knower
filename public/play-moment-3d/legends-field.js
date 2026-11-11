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
export function reportLegendsResult(launch, session, drive) {
  const { home, away } = session.stats;
  window.parent.postMessage({
    type: 'bk-legends-result',
    token: launch.token,
    result: {
      homeScore: drive.score, awayScore: session.awayScore,
      passYards: Math.round(home.passYards), rushYards: Math.round(home.rushYards),
      plays: home.plays + away.plays + home.fieldGoals + away.fieldGoals,
    },
  }, window.location.origin);
}
