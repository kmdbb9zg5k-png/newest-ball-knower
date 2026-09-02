import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const ignoredDirectories = new Set(['.git', 'dist', 'migrations', 'node_modules', 'scripts']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const legacyTablePattern = /(?:from\s*\(\s*['"]|\.from\s*\(\s*['"])(fantasy_(?:activity|draft_picks|drafts|feed_posts|leagues|lineups|matchups|members|notifications|receipts|rosters|scoring_rules|season_history|transactions|weekly_reports))['"]/g;

const files: string[] = [];
const walk = (directory: string) => {
  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if ([...sourceExtensions].some(extension => entry.endsWith(extension))) files.push(path);
  }
};
walk(root);

const violations = files.flatMap(path => {
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(legacyTablePattern)].map(match => ({
    file: relative(root, path),
    table: match[1],
  }));
});

assert.deepEqual(
  violations,
  [],
  `Product code must use ball_knower_* fantasy tables; legacy references: ${JSON.stringify(violations)}`,
);

const migration = readFileSync(
  new URL('../migrations/20260902155320_isolate_legacy_fantasy_and_advisor_fixes.sql', import.meta.url),
  'utf8',
);
assert.ok(migration.includes('LEGACY FANTASY ENGINE'));
assert.ok(migration.includes('revoke all on table public.%I from public, anon, authenticated'));
assert.ok(migration.includes('grant all on table public.%I to service_role'));
assert.ok(migration.includes('join_fantasy_league_by_code'));

const privacyMigration = readFileSync(
  new URL('../migrations/20260902164240_allow_commissioner_insert_returning.sql', import.meta.url),
  'utf8',
);
const privacyIntegration = readFileSync(
  new URL('./postgres-league-privacy-integration.sql', import.meta.url),
  'utf8',
);
const hardeningWorkflow = readFileSync(
  new URL('../.github/workflows/hardening.yml', import.meta.url),
  'utf8',
);
assert.ok(privacyMigration.includes('commissioner_auth_id = public.fantasy_requester_id()'));
assert.ok(privacyIntegration.includes('returning id into returned_id'));
assert.ok(privacyIntegration.includes('Authenticated non-member') || privacyIntegration.includes('non-member enumerated'));
assert.ok(hardeningWorkflow.includes('scripts/postgres-league-privacy-integration.sql'));

console.log('Authoritative fantasy architecture checks passed.');
