/** Real network contract smoke. Runs production handlers, not a duplicate CSV reader.
 * Run: node --import tsx scripts/bk-free-upstream-smoke.mjs
 * Requires public GitHub release downloads; no credentials or database writes.
 */
import assert from 'node:assert/strict';
import gamesHandler from '../api/bk/v1/games.ts';
import playersHandler from '../api/bk/v1/players.ts';
import injuriesHandler from '../api/bk/v1/injuries.ts';
import { resetNflverseCache } from '../server/bk/nflverse-csv.ts';

// Prove upstream access; never pass by reading a previously saved snapshot.
delete process.env.BK_SPORTS_SNAPSHOT_CACHE;
delete process.env.BK_SPORTS_SNAPSHOTS_ENABLED;
const season = 2026;
const expectedTeams = new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));
const responseCapture = () => ({
  code: 0, body: null, headers: {},
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
});
const now = Date.now();
for (const [kind, handler] of Object.entries({ games: gamesHandler, players: playersHandler, injuries: injuriesHandler })) {
  resetNflverseCache();
  const res = responseCapture();
  await handler({ method: 'GET', query: {} }, res);
  assert.equal(res.code, 200, `${kind} production handler returned ${res.code}: ${res.body?.error}`);
  const data = res.body;
  assert.equal(data.available, true);
  assert.equal(data.kind, kind);
  assert.equal(data.provider, 'nflverse');
  assert.equal(data.live, false, 'periodic source must not be described as live');
  assert.ok(Array.isArray(data.items) && data.items.length > 0, `${kind} has no valid records`);
  assert.ok(Date.parse(data.updatedAt) >= now - 1000, `${kind} did not read upstream this run`);
  assert.ok(typeof data.attribution === 'string' && data.attribution.startsWith('https://'));
  if (kind === 'games') {
    assert.ok(data.items.length >= 272, '2026 schedule lacks the full regular season');
    assert.equal(new Set(data.items.map(item => item.id)).size, data.items.length, 'duplicate game identities');
    const teams = new Set();
    for (const game of data.items) {
      assert.equal(game.season, season);
      assert.ok(expectedTeams.has(game.home) && expectedTeams.has(game.away));
      assert.notEqual(game.home, game.away);
      teams.add(game.home); teams.add(game.away);
      if (game.startTime !== null) {
        assert.match(game.startTime, /(?:Z|[+-]\d{2}:\d{2})$/, 'kickoff timezone omitted');
        assert.ok(Number.isFinite(Date.parse(game.startTime)));
      }
      for (const score of [game.homeScore, game.awayScore]) {
        assert.ok(score === null || Number.isInteger(score) && score >= 0 && score <= 100);
      }
    }
    assert.deepEqual(teams, expectedTeams, 'schedule must cover all 32 NFL teams');
  } else if (kind === 'players') {
    assert.ok(data.items.length >= 1000, 'roster is unexpectedly incomplete');
    assert.equal(new Set(data.items.map(item => item.id)).size, data.items.length, 'duplicate player identities');
    assert.deepEqual(new Set(data.items.map(item => item.team).filter(Boolean)), expectedTeams, 'rosters must cover all 32 teams');
    for (const player of data.items) assert.ok(typeof player.id === 'string' && player.name?.length > 0);
  } else {
    const weeks = new Set(data.items.map(item => item.week));
    assert.equal(weeks.size, 1, 'injuries mixed historical weeks with the latest report');
    assert.ok([...weeks].every(week => Number.isInteger(week) && week >= 1 && week <= 22));
    for (const injury of data.items) assert.ok(injury.id && injury.status);
  }
  console.log(`${kind}: production handler returned ${data.items.length} validated records; retrieved ${data.updatedAt}; source modified ${data.sourceUpdatedAt ?? 'unknown'}`);
}
console.log('Real upstream smoke passed. This does not certify current news, live scoring, or a deployed Vercel route.');
