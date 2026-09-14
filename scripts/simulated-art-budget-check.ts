import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD,
  SIMULATED_ART_BATCH_COST_MICRO_USD,
  SIMULATED_ART_MODELS,
  canReserveSimulatedArt,
  simulatedArtBudgetLimitMicroUsd,
} from '../solo/artBudget';

const remainingPlayers=1_677;
const firstPassReservation=remainingPlayers*SIMULATED_ART_BATCH_COST_MICRO_USD.economy;
const retryReserve=SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD-firstPassReservation;
const reviewRetries=Math.floor(retryReserve/SIMULATED_ART_BATCH_COST_MICRO_USD.review);

assert.equal(simulatedArtBudgetLimitMicroUsd(undefined),35_000_000);
assert.equal(simulatedArtBudgetLimitMicroUsd(100),35_000_000,'Configuration cannot raise the owner-approved $35 cap.');
assert.equal(simulatedArtBudgetLimitMicroUsd(25),25_000_000);
assert(firstPassReservation<=SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD,'The first-pass catalog would exceed the hard budget.');
assert(reviewRetries>=180,'The plan must retain a meaningful visual-QA retry reserve.');
assert(canReserveSimulatedArt(34_900_000,0,100_000));
assert(!canReserveSimulatedArt(34_900_000,0,100_001));
assert.equal(SIMULATED_ART_MODELS.economy,'gemini-3.1-flash-lite-image');
assert.equal(SIMULATED_ART_MODELS.review,'gemini-3.1-flash-image');

const api=readFileSync('api/simulated-player-art.ts','utf8');
const previewControl=readFileSync('api/simulated-player-art-preview-control.source.ts','utf8');
const migration=readFileSync('migrations/20260913191220_simulated_player_art_budget_cap.sql','utf8');
assert.match(api,/ai\.batches\.create/);assert.match(api,/responseModalities:\s*\[\s*['\"]IMAGE['\"]\s*\]/);assert.match(api,/aspectRatio:\s*['\"]1:1['\"]/);
assert.match(api,/sync-open-batches/);assert.match(api,/source_sheet_path/);assert.match(api,/status:\s*['\"]pending_review['\"]/);
assert.match(api,/Number\.isFinite\(priorAttempt\)\s*&&\s*stored\.attempt\s*<=\s*priorAttempt/);
assert.doesNotMatch(api,/tier\s*===\s*[\"']review[\"']\s*&&\s*Number\.isFinite\(priorAttempt\)/);
assert.match(previewControl,/action\s*===\s*['\"]retry-ids['\"]/);
assert.match(previewControl,/SOLO_TEAM_THEMES\\.find/,'Targeted QA can render a stable player identity in a new fictional-team uniform.');
assert.match(previewControl,/uniformTeam\\s*\\?\\s*\\{\\.\\.\\.player,team:uniformTeam\\.abbr\\}/);
assert.match(previewControl,/qualityTier:\s*['\"]economy['\"]/);
assert.match(migration,/35000000/);assert.match(migration,/reserve_simulated_art_generation/);assert.match(migration,/for update/);
assert.match(migration,/enable row level security/);assert.match(migration,/revoke all .* from public,anon,authenticated/);
assert.match(migration,/grant execute .* service_role/);

console.log(JSON.stringify({
  hardCapUsd:SIMULATED_ART_ABSOLUTE_BUDGET_MICRO_USD/1_000_000,
  remainingPlayers,
  firstPassReservedUsd:firstPassReservation/1_000_000,
  retryReserveUsd:retryReserve/1_000_000,
  maximumReviewRetries:reviewRetries,
  economyModel:SIMULATED_ART_MODELS.economy,
  reviewModel:SIMULATED_ART_MODELS.review,
},null,2));
