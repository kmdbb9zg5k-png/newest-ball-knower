import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createFranchiseDraftPicks,
  ensureFranchiseDraftYear,
  franchiseDraftPickKey,
  ownedFranchiseDraftRounds,
  transferFranchiseDraftPicks,
} from '../franchiseDraftPicks';
import { agentTradeWindowMessage, canResolveAgentTradeRequest, isAgentTradeWindowOpen } from '../PlayerAgentMode';

const teams = ['PHI', 'DAL'];
let picks = createFranchiseDraftPicks(2027, teams);
assert.deepEqual(ownedFranchiseDraftRounds(picks, 'PHI', 2027), [1, 2, 3, 4, 5, 6, 7]);
picks = transferFranchiseDraftPicks(picks, 'PHI', 'DAL', 2027, picks.filter(pick => pick.ownerTeam === 'PHI' && [1, 3].includes(pick.round)).map(franchiseDraftPickKey));
assert.deepEqual(ownedFranchiseDraftRounds(picks, 'PHI', 2027), [2, 4, 5, 6, 7], 'traded picks must leave the original offseason inventory');
assert.equal(picks.find(pick => pick.year === 2027 && pick.originalTeam === 'PHI' && pick.round === 1)?.ownerTeam, 'DAL', 'acquired picks must record the acquiring team');
const twoFirsts = ownedFranchiseDraftRounds(picks, 'DAL', 2027).filter(round => round === 1);
assert.equal(twoFirsts.length, 2, 'acquiring another first-round pick must preserve both distinct assets');
picks = ensureFranchiseDraftYear(picks, 2028, teams);
assert.deepEqual(ownedFranchiseDraftRounds(picks, 'PHI', 2028), [1, 2, 3, 4, 5, 6, 7], 'future draft inventory must replenish by year');
assert.deepEqual(ownedFranchiseDraftRounds(picks, 'PHI', 2027), [2, 4, 5, 6, 7], 'future-year replenishment must not restore traded prior-year picks');

assert.equal(isAgentTradeWindowOpen('regular', 1), true);
assert.equal(isAgentTradeWindowOpen('regular', 9), true);
assert.equal(isAgentTradeWindowOpen('regular', 10), false);
assert.equal(isAgentTradeWindowOpen('postseason', 1), false);
assert.equal(canResolveAgentTradeRequest('resolved', 'regular', 9), true, 'Week 9 resolution mutation must remain open');
assert.equal(canResolveAgentTradeRequest('resolved', 'regular', 10), false, 'Week 10 resolution mutation must reject work');
assert.equal(canResolveAgentTradeRequest('denied', 'postseason', 1), true, 'Owners can still deny a request outside the work window');
assert.match(agentTradeWindowMessage('preseason'), /not open yet/i);
assert.match(agentTradeWindowMessage('postseason'), /deadline has passed/i);
assert.match(readFileSync(new URL('../RealTeamFranchise.tsx', import.meta.url), 'utf8'), /const PICK_VALUES = \[38, 22, 12, 7, 4, 2, 1\]/);
assert.match(readFileSync(new URL('../RealTeamFranchise.tsx', import.meta.url), 'utf8'), /LEGACY_TRADED/, 'legacy traded rounds must remain represented so replenishment cannot recreate them');

console.log('Phase 1 correctness checks passed: year-aware franchise picks and Agent trade-deadline mutation enforcement.');
