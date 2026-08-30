import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDstFantasyRankings } from '../dstFantasyRankings';
import { PLAYERS_DATABASE } from '../players';

const rankings = buildDstFantasyRankings();
assert.equal(rankings.length, 32, 'Every NFL team needs a D/ST projection.');
assert.equal(new Set(rankings.map(row => row.team)).size, 32, 'D/ST rows must cover 32 unique teams.');
assert.ok(rankings.every(row => row.position === 'DST' && row.projected_points_2026 > 0), 'Every D/ST needs a usable projection.');
assert.deepEqual(rankings.map(row => row.position_rank), Array.from({ length: 32 }, (_, index) => index + 1));
assert.ok(rankings.every((row, index) => index === 0 || rankings[index - 1].projected_points_2026 >= row.projected_points_2026), 'D/ST rows must be ordered by projected points.');
assert.ok(rankings.every(row => row.projection_reason.includes('model estimate') && row.actual_source_name.includes('not yet backfilled')), 'D/ST copy must not present unavailable 2025 actuals as verified data.');
assert.ok(rankings.every(row => row.actual_points_2025 === null && row.point_change === null), 'Unavailable D/ST actuals and changes must stay null rather than becoming invented zeroes.');
assert.ok(rankings[0].overall_rank < 200, 'D/ST must be integrated into the overall draft order rather than appended after every player.');
assert.ok(rankings.every(row => row.updated_at === '2026-08-30T00:00:00.000Z'), 'D/ST rows must use the roster model snapshot date rather than the viewer clock.');
assert.ok(rankings.every(row => PLAYERS_DATABASE.some(player => player.position === 'DST' && player.team === row.team && player.name === row.player_name)), 'Generated D/ST names must match canonical draft-player names.');
const hub = readFileSync(new URL('../FantasyHub.tsx', import.meta.url), 'utf8');
assert.match(hub, /fantasyPositions\s*=\s*\[\s*["']QB["'],\s*["']RB["'],\s*["']WR["'],\s*["']TE["'],\s*["']K["'],\s*["']DST["']\s*\]/, 'Cheat Sheet must expose a D/ST filter.');

console.log('D/ST rankings checks passed: 32-team projection coverage, projection ordering, explicit source limits, and Cheat Sheet filter.');
