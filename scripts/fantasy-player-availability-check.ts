import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createAvailabilityHandler, normalizeAvailabilityReports, normalizeAvailabilityStatus } from '../api/nfl-player-availability.ts';

assert.equal(normalizeAvailabilityStatus('Questionable'), 'questionable');
assert.equal(normalizeAvailabilityStatus('Q'), 'questionable');
assert.equal(normalizeAvailabilityStatus('Out'), 'out');
assert.equal(normalizeAvailabilityStatus('Injured Reserve'), 'out');
assert.equal(normalizeAvailabilityStatus('PUP'), 'out');
assert.equal(normalizeAvailabilityStatus('Doubtful'), null, 'unsupported labels must not be relabeled');
assert.equal(normalizeAvailabilityStatus('Probable'), null, 'healthy/probable players must not receive a badge');

const report = {
  injuries: [{
    displayName: 'Chicago Bears',
    injuries: [
      { status: 'Questionable', date: '2026-09-10T12:00:00Z', athlete: { id: '1', displayName: 'Rome Odunze', position: { abbreviation: 'WR' }, team: { abbreviation: 'CHI' } }, details: { type: 'Calf' } },
      { status: 'Out', date: '2026-09-10T13:00:00Z', athlete: { id: '2', displayName: 'D. Swift', position: { abbreviation: 'RB' }, team: { abbreviation: 'CHI' } }, details: { fantasyStatus: { abbreviation: 'OUT' }, type: 'Ankle' } },
      { status: 'Doubtful', athlete: { displayName: 'Ignored Player', team: { abbreviation: 'CHI' } } },
    ],
  }],
};
const normalized = normalizeAvailabilityReports([report], '2026-09-10T14:00:00.000Z');
assert.deepEqual(normalized.map(row => [row.playerName, row.label, row.injury]), [
  ['D. Swift', 'OUT', 'Ankle'],
  ['Rome Odunze', 'Q', 'Calf'],
]);

function responseRecorder() {
  return {
    code: 0,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return body; },
  };
}

let calls = 0;
const handler = createAvailabilityHandler({
  now: () => Date.parse('2026-09-10T14:00:00Z'),
  fetchImpl: (async () => {
    calls += 1;
    return new Response(JSON.stringify(report), { status: 200 });
  }) as typeof fetch,
});
const first = responseRecorder();
await handler({ method: 'GET' }, first);
const second = responseRecorder();
await handler({ method: 'GET' }, second);
assert.equal(first.code, 200);
assert.equal(first.body.players.length, 2);
assert.equal(calls, 1, 'server cache should deduplicate the large injury report');
assert.match(first.headers['Cache-Control'], /s-maxage=300/);

const unavailable = createAvailabilityHandler({ fetchImpl: (async () => { throw new Error('offline'); }) as typeof fetch });
const failed = responseRecorder();
await unavailable({ method: 'GET' }, failed);
assert.deepEqual([failed.code, failed.body.available, failed.body.players.length], [200, false, 0]);

const detail = fs.readFileSync(new URL('../FantasyPlayerDetail.tsx', import.meta.url), 'utf8');
const league = fs.readFileSync(new URL('../FantasyLeaguePostDraft.tsx', import.meta.url), 'utf8');
const hub = fs.readFileSync(new URL('../FantasyHub.tsx', import.meta.url), 'utf8');
const badge = fs.readFileSync(new URL('../FantasyAvailabilityBadge.tsx', import.meta.url), 'utf8');
assert.match(detail, /FantasyAvailabilityBadge availability=\{availability\} full/);
assert.doesNotMatch(detail, /player\.injured \|\| injuryStatus/, 'healthy players should have no availability badge');
assert.match(league, /availabilityForId/);
assert.match(hub, /FantasyAvailabilityBadge availability=/, 'Fantasy rankings should show the same live designation');
assert.doesNotMatch(league, /injury \? "bg-red-950/, 'the full matchup row must not be injury color-coded');
assert.match(badge, /bg-yellow-400\/15 text-yellow-300/);
assert.match(badge, /bg-red-500\/15 text-red-400/);

console.log('Fantasy player availability checks passed.');
