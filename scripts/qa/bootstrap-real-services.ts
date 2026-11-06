import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PLAYERS_DATABASE, NFL_TEAMS } from '../../players';
import { getLiveFantasyDraftGroup } from '../../liveFantasyRules';
import { readStackConfig, assertLoopbackDatabase } from './real-service-config.mjs';
import { compareSchema, renderSchema, sha256 } from './schema-contract.mjs';

export function localSql(databaseUrl: string, sql: string, stage = 'fixture') {
  assertLoopbackDatabase(databaseUrl);
  const result = spawnSync('psql', [databaseUrl, '--no-psqlrc', '--quiet', '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=sqlstate'], { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  // SQL errors can contain fixture payloads. Keep stderr out of CI output.
  if (result.error || result.status !== 0) {
    const sqlState = result.stderr?.match(/ERROR:\s+([A-Z0-9]{5})\b/)?.[1] || 'unknown';
    throw Object.assign(new Error(`isolated_sql_failed:${stage}:${sqlState}`), { qaCode: `isolated_sql_${stage}_${sqlState}` });
  }
  return result.stdout.trim();
}
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

export function selectedPlayers() {
  return ['QB', 'RB', 'WR', 'TE', 'K', 'DST'].flatMap(group => PLAYERS_DATABASE
    .filter(player => getLiveFantasyDraftGroup(player) === group && player.active !== false)
    .sort((a, b) => a.id.localeCompare(b.id)).slice(0, group === 'RB' || group === 'WR' ? 12 : 8));
}

export function bootstrap(statusPath: string, outputDirectory: string) {
  const config = readStackConfig(JSON.parse(readFileSync(statusPath, 'utf8')));
  const snapshot = JSON.parse(readFileSync(new URL('./production-schema.snapshot.json', import.meta.url), 'utf8'));
  mkdirSync(outputDirectory, { recursive: true });
  localSql(config.databaseUrl, renderSchema(snapshot), 'restore_schema');
  // psql returns the selected JSON value directly; the hosted connector wraps
  // the same column in a row object during the read-only snapshot capture.
  const sourceExportSql = readFileSync(new URL('./production-schema-export.sql', import.meta.url), 'utf8');
  // Local application definitions are restored without a historical migration
  // replay. Do not require, populate, or compare a fabricated migration ledger.
  const localExportSql = sourceExportSql.replace(/-- BEGIN SOURCE MIGRATION METADATA[\s\S]*?-- END SOURCE MIGRATION METADATA/, "'[]'::jsonb");
  if (localExportSql === sourceExportSql) throw new Error('source_migration_metadata_marker_required');
  const local = JSON.parse(localSql(config.databaseUrl, localExportSql, 'export_local_metadata'));
  const parity = compareSchema(snapshot, local);
  writeFileSync(resolve(outputDirectory, 'schema-parity.json'), JSON.stringify({ ...parity, source: snapshot.source, appliedMigrationMetadata: snapshot.migrations, historicalReplay: false }, null, 2));
  if (!parity.matched) throw new Error('production_schema_parity_failed');
  const overlayInput = String(process.env.BK_QA_EXTRA_MIGRATIONS || '').trim();
  const overlays = overlayInput === 'none' ? [] : overlayInput.split(',').map(value => value.trim()).filter(Boolean);
  const appliedOverlays = [];
  for (const filename of overlays) {
    if (!/^(?:migrations|supabase\/migrations)\/[a-z0-9_]+\.sql$/.test(filename)) throw new Error('invalid_isolated_overlay_path');
    const sql = readFileSync(resolve(filename), 'utf8');
    // Feature migrations may add server RPCs, but isolated QA never schedules
    // jobs, contacts a provider, or loads credentials from a hosted project.
    if (/(?:net\.http_|extensions\.http|cron\.(?:schedule|unschedule)|vault\.|sb_secret_|eyJ[A-Za-z0-9_-]{8,}\.)/i.test(sql)) throw new Error('isolated_overlay_requires_review');
    localSql(config.databaseUrl, sql);
    appliedOverlays.push({ filename, sha256: sha256(sql) });
  }
  writeFileSync(resolve(outputDirectory, 'feature-overlays.json'), JSON.stringify({ appliedOverlays, baseSchemaParityBeforeOverlays: parity.matched }, null, 2));

  // Only repository catalog data and an explicitly synthetic future schedule.
  // Auth users are created later through GoTrue Admin, never through SQL.
  const players = selectedPlayers();
  const sql = ['begin;'];
  for (const player of players) {
    const group = getLiveFantasyDraftGroup(player)!;
    sql.push(`insert into public.ball_knower_fantasy_player_groups(player_id,draft_group) values (${literal(player.id)},${literal(group)});`);
    if (group !== 'DST') sql.push(`insert into ball_knower_private.draft_order_game_players(player_id,position_group,salary,ovr,player_json) values (${literal(player.id)},${literal(group)},${Math.max(0, Number(player.salary) || 1)},${Math.round(player.ovr)},${literal(JSON.stringify(player))}::jsonb);`);
  }
  for (let index = 0; index < NFL_TEAMS.length; index += 2) sql.push(`insert into public.ball_knower_nfl_games(provider_game_id,season,season_type,week_number,away_team,home_team,kickoff_at) values ('qa-synthetic-week18-${index}',2026,'reg',18,${literal(NFL_TEAMS[index].code)},${literal(NFL_TEAMS[index + 1].code)},now()+interval '7 days');`);
  sql.push('commit;');
  localSql(config.databaseUrl, sql.join('\n'));
  const receipt = { mode: 'isolated_real_supabase_services', schemaSnapshotSha256: sha256(snapshot), canonicalFixturePlayers: players.length, syntheticScheduleGames: 16, authUsersWrittenBySql: 0, productionWrites: 0, providerDataVerified: false, appliedOverlays };
  writeFileSync(resolve(outputDirectory, 'bootstrap.json'), JSON.stringify(receipt, null, 2));
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    if (!process.env.BK_QA_LOCAL_STATUS) throw new Error('local_stack_status_path_required');
    console.log(JSON.stringify(bootstrap(process.env.BK_QA_LOCAL_STATUS, process.env.BK_QA_OUTPUT || 'artifacts/launch-real-services')));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'isolated_bootstrap_failed' }));
    process.exitCode = 1;
  }
}
