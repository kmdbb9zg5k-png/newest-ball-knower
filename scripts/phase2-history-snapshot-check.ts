import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/fantasy-live-scoring.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/20260831_preserve_fantasy_history_snapshots.sql', import.meta.url), 'utf8');
const matchupFollowUp = readFileSync(new URL('../migrations/20260831_freeze_fantasy_matchup_snapshot.sql', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../fantasyPlayerDetailsCloud.ts', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../FantasyPlayerDetail.tsx', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

assert.match(migration, /pregame_projected_points jsonb not null/);
assert.match(migration, /preserve_ball_knower_pregame_projection/);
assert.match(migration, /old\.pregame_projection_captured_at is not null/);
assert.match(migration, /new\.opponent_team := old\.opponent_team/);
assert.match(migration, /new\.is_home := old\.is_home/);
assert.match(matchupFollowUp, /new\.opponent_team := old\.opponent_team/);
assert.match(migration, /ball_knower_fantasy_history_backfill/);
assert.match(migration, /generate_series\(1, 18\)/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on public\.ball_knower_fantasy_history_backfill/);

assert.match(api, /scheduledProjectionRows/);
assert.match(api, /Date\.parse\(game\.kickoff_at\)<=projectionsRetrievedAt\.getTime\(\)/);
assert.match(api, /pregame_projection_captured_at:projectionsRetrievedAt\.toISOString\(\)/);
assert.match(api, /processHistoricalBackfill/);
assert.match(api, /pollable\.length===0/);
assert.match(api, /history_source:'tank01_historical_boxscore'/);
assert.match(api, /games\.length!==rawGames\.length/);
assert.match(api, /if\(!isFinalGameStatus\(status\)\) throw new Tank01Error/);
assert.match(api, /if\(malformedPlayerRow\) throw new Tank01Error/);
assert.match(api, /if\(!rows\.length\) throw new Tank01Error/);
assert.match(api, /historical backfill remains active/);
assert.match(api, /req\.headers\?\.authorization!==`Bearer \$\{cronSecret\}`/);

assert.match(cloud, /pregame_projected_points/);
assert.match(cloud, /row\.pregame_projection_captured_at \? \(row\.pregame_projected_points \|\| \{\}\) : \{\}/);
assert.match(detail, /Why this projection/);
assert.match(detail, /does not reconstruct one after the fact/);
assert.equal(vercel.crons.length, 2, 'History backfill must reuse the existing cron instead of exceeding the two-job cap.');

console.log('Phase 2 history snapshot checks passed.');
