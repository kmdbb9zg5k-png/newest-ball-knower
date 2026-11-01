import assert from 'node:assert/strict';
import { csvRecords } from '../server/bk/nflverse-csv';
import { normalizeRosters } from '../api/bk/v1/players';
import { normalizeInjuries } from '../api/bk/v1/injuries';
const parsed = csvRecords('gsis_id,full_name,team,position,season\n00-1,"Smith, John",PHI,QB,2026\n');
assert.equal(parsed[0].full_name, 'Smith, John');
assert.deepEqual(normalizeRosters(parsed), [{ id: '00-1', name: 'Smith, John', team: 'PHI', position: 'QB', jerseyNumber: null, season: 2026, rosterStatus: null }]);
assert.deepEqual(normalizeRosters([{ ...parsed[0], season: '2025' }]), []);
assert.equal(normalizeRosters([{ ...parsed[0], team: 'LA' }])[0].team, 'LAR');
assert.throws(() => normalizeRosters([parsed[0], { ...parsed[0], team: 'DAL' }]), /conflicting_player_identity/);
assert.equal(normalizeRosters([parsed[0], parsed[0]]).length, 1);
const base = { gsis_id: '00-1', full_name: 'Smith, John', team: 'PHI', season: '2026', week: '8', report_status: 'Questionable', report_primary_injury: 'Ankle', date_modified: '2026-10-30T12:00:00Z' };
const injury = normalizeInjuries([
  { ...base, week: '7', report_status: 'Out' }, base,
  { ...base, date_modified: '2026-10-29T12:00:00Z', report_status: 'Doubtful' },
  { ...base, season: '2025', week: '18', report_status: 'Out' },
]);
assert.equal(injury.length, 1);
assert.equal(injury[0].status, 'Questionable');
assert.equal(injury[0].week, 8);
assert.equal(injury[0].detail, 'Ankle');
assert.equal(injury[0].updatedAt, '2026-10-30T12:00:00.000Z');
const {date_modified, ...undated} = base;
assert.equal(normalizeInjuries([undated])[0].updatedAt, null);
assert.throws(() => csvRecords('id,name\n1,"unfinished'), /invalid_csv/);
assert.throws(() => csvRecords('id,id\n1,2'), /invalid_csv_header/);
assert.throws(() => csvRecords('id,name\n1,2,3'), /invalid_csv_row/);
assert.throws(() => normalizeInjuries([{ gsis_id: '1' }]), /invalid_source_schema/);
console.log('Free rosters/injuries parsing contract passed');
