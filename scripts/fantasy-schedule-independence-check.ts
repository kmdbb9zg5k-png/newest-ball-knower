import assert from 'node:assert/strict';
import { createFantasyScheduleHandler, normalizeFantasySchedule, planFantasySchedule, validateFantasySchedule, fantasyScheduleContext } from '../server/bk/fantasy-schedule-sync';
import deployedHandler from '../api/fantasy-live-scoring';
import { resetNflverseCache } from '../server/bk/nflverse-csv';

const teams = 'ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' ');
const circle = [...teams], raw: Record<string, string>[] = [];
for (let round = 0; round < 17; round++) {
  for (let pair = 0; pair < 16; pair++) {
    const week = round === 16 && pair === 0 ? 18 : round + 1;
    const away = circle[pair], home = circle[31 - pair];
    const gameday = new Date(Date.parse('2026-09-10T00:00:00Z') + (week - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
    raw.push({ game_id: `2026_${String(week).padStart(2, '0')}_${away}_${home}`, season: '2026', game_type: 'REG',
      week: String(week), gameday, gametime: '13:00', away_team: away, home_team: home, away_score: '0', home_score: '14' });
  }
  circle.splice(1, 0, circle.pop()!);
}
const items = normalizeFantasySchedule(raw), now = Date.parse('2026-11-01T12:00:00Z');
const snapshot = { items, updatedAt: new Date(now).toISOString(), sourceUpdatedAt: null };
assert.equal(items.length, 272);
assert.equal(fantasyScheduleContext(items, Date.parse('2026-09-01')).week, 1);
assert.equal(fantasyScheduleContext(items, Date.parse('2027-01-10')).season, 2026, 'January must not invent a new NFL season');
for (const invalid of [raw.slice(1), [...raw, raw[0]], raw.map((row, i) => i === 0 ? { ...row, home_team: row.away_team } : row),
  raw.map((row, i) => i === 0 ? { ...row, gametime: '99:99' } : row),
  raw.map((row, i) => i === 0 ? { ...row, gameday: '2026-02-30' } : row)]) {
  assert.throws(() => normalizeFantasySchedule(invalid));
}
assert.throws(() => validateFantasySchedule(items.map((game, i) => i ? game : { ...game, startTime: '2099-09-10T17:00:00Z' })));
assert.throws(() => validateFantasySchedule(items.map((game, i) => i ? game : { ...game, startTime: '2026-09-10T17:00:00' })));
const tbd = normalizeFantasySchedule(raw.map((row, i) => i ? row : { ...row, gametime: '' }));
assert.equal(tbd[0].startTime, null);
const freshPlan = planFantasySchedule(items, [], now);
assert.equal(freshPlan.inserts.length, 272);
assert.ok(freshPlan.inserts.every(row => !row.is_final && !row.is_live), 'Published final game scores cannot certify fantasy stats');
assert.ok(freshPlan.inserts.every(row => !('last_polled_at' in row) && !('provider_updated_at' in row)));
assert.equal(planFantasySchedule(tbd, [], now).pendingKickoffs, 1, 'Unknown kickoff must not be invented');
assert.equal(planFantasySchedule(tbd, [], now).inserts.length, 271);
const existing = freshPlan.inserts.map((row, index) => ({ ...row, provider_game_id: `espn-${index}`,
  is_final: index === 0, game_status: index === 0 ? 'Final' : 'Scheduled', last_polled_at: '2026-09-11T01:00:00Z' }));
const original = structuredClone(existing);
const changed = items.map((game, index) => index === 0 ? { ...game, startTime: game.startTime!.replace('17:00', '18:00') } : game);
const preserved = planFantasySchedule(changed, existing, now);
assert.equal(preserved.inserts.length, 0);assert.equal(preserved.changedKickoffs, 1);
assert.equal(preserved.canonicalIds[items[0].id], 'espn-0');assert.deepEqual(existing, original);
assert.equal(planFantasySchedule(tbd, existing, now).pendingKickoffs, 0, 'Known existing kickoff remains usable');
assert.throws(() => planFantasySchedule(items, [...existing, { ...existing[0], provider_game_id: 'alternate-id' }], now), /existing_schedule_conflict/);
assert.throws(() => planFantasySchedule(items, [{ ...existing[0], week_number: 22 }], now), /existing_schedule_conflict/);

function database(rows: any[], readError = false, writeError = false) {
  const writes: any[] = [], calls: string[] = [];
  const db = { from(table: string) {
    calls.push(table);assert.equal(table, 'ball_knower_nfl_games', 'Schedule mode must never access score, identity, lineup or league tables');
    return { select() { const query = { eq() { return query; }, then(resolve: any) { return Promise.resolve({ data: rows, error: readError ? { message: 'private database detail' } : null }).then(resolve); } }; return query; },
      async upsert(values: any[], options: any) {
        assert.deepEqual(options, { onConflict: 'provider_game_id', ignoreDuplicates: true });
        writes.push(structuredClone(values));return { error: writeError ? { message: 'private write detail' } : null };
      }, update() { throw Error('Existing schedule rows must never be updated'); } };
  } };
  return { db, calls, writes };
}
const response = () => ({ statusCode: 0, headers: {} as Record<string, string>, body: null as any,
  setHeader(key: string, value: string) { this.headers[key] = value; }, status(code: number) { this.statusCode = code;return this; }, json(body: any) { this.body = body;return this; } });
const request = { method: 'GET', headers: { authorization: 'Bearer test-cron' } };
const run = async (handler: any, req: any = request) => { const res = response();await handler(req, res);return res; };
const make = (state: ReturnType<typeof database>, overrides: any = {}) => createFantasyScheduleHandler({ getDb: () => state.db,
  loadSchedule: async () => snapshot, now: () => now, getCronSecret: () => 'test-cron', canWrite: () => true, log: () => {}, ...overrides });
const complete = database(existing), completeResponse = await run(make(complete));
assert.equal(completeResponse.statusCode, 200);assert.equal(completeResponse.body.scoring.available, false);
assert.equal(completeResponse.body.leagueScoresWritten, 0);assert.equal(complete.writes.length, 0);assert.deepEqual(existing, original);
const empty = database([]);const inserted = await run(make(empty));
assert.equal(inserted.statusCode, 200);assert.equal(empty.writes.length, 1);assert.equal(empty.writes[0].length, 272);
assert.equal(inserted.body.schedule.status, 'insert_attempted');
for (const options of [{ canWrite: () => false }, {}]) {
  const preview = database([]), req = options.canWrite ? request : { ...request, query: { dryRun: '1' } };
  const result = await run(make(preview, options), req);assert.equal(result.body.dryRun, true);assert.equal(preview.writes.length, 0);
  assert.equal(result.body.schedule.status, 'dry_run', 'A preview must not claim to have synchronized missing games');
}
const untouched = database([]);
for (const req of [{ method: 'POST', headers: request.headers }, { method: 'GET', headers: {} }]) {
  const result = await run(make(untouched, { loadSchedule: async () => { throw Error('Unauthorized request fetched source'); } }), req);
  assert.ok([401, 405].includes(result.statusCode));
}
assert.equal(untouched.calls.length, 0);
for (const source of [{ ...snapshot, items: items.slice(1) }, { ...snapshot, updatedAt: '2000-01-01T00:00:00Z' }]) {
  const state = database([]), result = await run(make(state, { loadSchedule: async () => source }));
  assert.equal(result.statusCode, 503);assert.equal(state.calls.length, 0);assert.equal(result.body.scoring.existingScoresPreserved, true);
}
for (const state of [database([], true), database([...existing, existing[0]]), database([], false, true)]) {
  const result = await run(make(state));assert.equal(result.statusCode, 503);
  assert.doesNotMatch(JSON.stringify(result.body), /private (?:database|write)/);
}

// Exercise the deployed default route, real SDK and reader; all I/O is synthetic.
const keys = ['CRON_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TANK01_API_KEY', 'RAPIDAPI_KEY', 'VERCEL_ENV', 'BK_SPORTS_SNAPSHOT_CACHE'] as const;
const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));const originalFetch = globalThis.fetch;
try {
  Object.assign(process.env, { CRON_SECRET: 'test-cron', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
    TANK01_API_KEY: 'unused-paid-key', RAPIDAPI_KEY: 'unused-paid-key', VERCEL_ENV: 'preview', BK_SPORTS_SNAPSHOT_CACHE: 'false' });
  resetNflverseCache();const targets: string[] = [];
  const columns = Object.keys(raw[0]);const csv = [columns.join(','), ...raw.map(row => columns.map(column => row[column]).join(','))].join('\n');
  globalThis.fetch = (async (input: any, init: any) => {
    const url = new URL(input instanceof Request ? input.url : String(input));targets.push(url.hostname);
    assert.doesNotMatch(url.href, /tank01|rapidapi/i, 'The deployed route must never request an unpaid provider');
    if (url.hostname === 'github.com') return new Response(csv);
    assert.equal(url.hostname, 'fixture.supabase.co');assert.equal(init?.method ?? 'GET', 'GET', 'Preview must not write schedule or scoring data');
    assert.equal(url.pathname, '/rest/v1/ball_knower_nfl_games');
    return new Response('[]', { headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const result = await run(deployedHandler);
  assert.equal(result.statusCode, 200);assert.equal(result.body.mode, 'schedule_only');assert.equal(result.body.dryRun, true);
  assert.equal(result.body.scoring.available, false);assert.deepEqual(targets.sort(), ['fixture.supabase.co', 'github.com']);
} finally {
  globalThis.fetch = originalFetch;resetNflverseCache();
  for (const key of keys) { if (old[key] === undefined) delete process.env[key];else process.env[key] = old[key]; }
}
console.log('Fantasy independence: complete schedules, TBD handling, canonical IDs, unchanged locks/scores, no paid requests, authenticated dry runs and failure-safe writes passed.');
