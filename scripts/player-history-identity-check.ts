import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { historicalNameVariants, resolveHistoricalProviderId } from '../fantasyPlayerIdentity';

const migration = readFileSync(
  new URL('../migrations/20260902154723_backfill_verified_player_history_identities.sql', import.meta.url),
  'utf8',
);
const suffixMigration = readFileSync(
  new URL('../migrations/20260902171800_allow_unambiguous_player_name_suffixes.sql', import.meta.url),
  'utf8',
);

assert.ok(
  migration.includes('player_provider_identities')
    && migration.includes('provider_player_id text primary key')
    && migration.includes('ball_knower_player_id text not null unique'),
  'Provider and Ball Knower identities must be permanently one-to-one.',
);
assert.ok(
  migration.includes("regexp_replace(lower(player_name), '[^a-z0-9]', '', 'g')"),
  'Identity normalization must lowercase before removing punctuation.',
);
assert.ok(
  migration.includes('provider.teams && catalog.teams')
    && migration.includes("catalog.position in ('QB', 'RB', 'WR', 'TE', 'K')")
    && migration.includes('ranking.position = catalog.position'),
  'Backfill matches must be corroborated by team or an exact fantasy position.',
);
assert.ok(
  migration.includes('same_name_provider_count = 1')
    && migration.includes('catalog.player_id_count = 1')
    && migration.includes('verified_candidates'),
  'Same-name and many-to-one identity candidates must fail closed.',
);
assert.ok(
  migration.includes('ball_knower_player_week_scores_verified_identity_fkey')
    && migration.includes('assign_player_provider_identity'),
  'History writes must be enforced by both the registry foreign key and a validation trigger.',
);
assert.ok(
  migration.includes('is already bound to a different Ball Knower player')
    && migration.includes('Unverified provider identity'),
  'Conflicting and unverified live identities must be rejected.',
);
assert.ok(
  suffixMigration.includes('normalized_player_identity_name')
    && suffixMigration.includes("(jr|sr|ii|iii|iv)")
    && suffixMigration.includes('catalog_match_count <> 1')
    && suffixMigration.includes('Unverified or ambiguous provider identity'),
  'Live identity writes may ignore a generational suffix only after a unique same-team catalog match.',
);

assert.equal(resolveHistoricalProviderId(['provider-a'], ['provider-a']), 'provider-a');
assert.equal(resolveHistoricalProviderId([], ['provider-a']), '');
assert.equal(resolveHistoricalProviderId(['provider-a'], ['provider-b']), '');
assert.equal(resolveHistoricalProviderId(['provider-a'], ['provider-a', 'provider-b']), '');
assert.equal(resolveHistoricalProviderId(['provider-a', 'provider-b'], ['provider-a']), '');
assert.ok(historicalNameVariants('Travis Etienne').includes('Travis Etienne Jr.'));

console.log('Player-history identity checks passed.');
