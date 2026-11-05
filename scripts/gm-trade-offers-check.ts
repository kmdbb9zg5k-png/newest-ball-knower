import assert from 'node:assert/strict';
import { buildSoloTeamRoster, validateFranchiseRoster } from '../soloFranchiseEngine';
import { SOLO_TEAM_THEMES } from '../soloUniverse';
import { emptyGmTradeInbox, finishGmTradeOffer, generateGmTradeOffer, restoreGmTradeInbox, validateGmTradeOffer } from '../gmTradeOffers';

const league = Object.fromEntries(SOLO_TEAM_THEMES.map(team => [team.abbr, buildSoloTeamRoster(team.abbr)]));
for (const team of SOLO_TEAM_THEMES) {
  const roster = league[team.abbr];
  const offer = generateGmTradeOffer(team.abbr, roster, league, 3, 2026, false, []);
  assert.ok(offer, `${team.abbr} should have at least one valid incoming offer`);
  assert.deepEqual(generateGmTradeOffer(team.abbr, roster, league, 3, 2026, false, []), offer, 'Reload must retain the same offer');
  const result = validateGmTradeOffer(offer, team.abbr, roster, league, 3, 2026, false);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(validateFranchiseRoster(result.userRoster), []);
  assert.deepEqual(validateFranchiseRoster(result.partnerRoster), []);
  assert.equal(result.userRoster.find(player => player.id === offer.incomingId)?.team, team.abbr);
  assert.equal(result.partnerRoster.find(player => player.id === offer.outgoingId)?.team, offer.partner);
  assert.ok(!result.userRoster.some(player => player.id === offer.outgoingId));
  assert.ok(!result.partnerRoster.some(player => player.id === offer.incomingId));
  const inbox = { ...emptyGmTradeInbox(), pending: offer };
  assert.deepEqual(restoreGmTradeInbox(JSON.parse(JSON.stringify(inbox)), team.abbr), inbox);
  for (const status of ['accepted', 'declined', 'expired'] as const) {
    const resolved = finishGmTradeOffer(inbox, offer, status);
    assert.equal(resolved.pending, null);
    assert.equal(generateGmTradeOffer(team.abbr, roster, league, 3, 2026, false, resolved.decisions), null);
    assert.equal(restoreGmTradeInbox({ ...resolved, pending: offer }, team.abbr).pending, null);
  }
  assert.ok(validateGmTradeOffer(offer, team.abbr, roster, league, 4, 2026, false).errors.length);
  assert.ok(validateGmTradeOffer(offer, team.abbr, roster, league, 3, 2027, false).errors.length);
  assert.ok(validateGmTradeOffer(offer, team.abbr, roster, league, 3, 2026, true).errors.length);
  assert.ok(validateGmTradeOffer(offer, team.abbr, result.userRoster, { ...league, [offer.partner]: result.partnerRoster }, 3, 2026, false).errors.length, 'Accepted offers cannot execute twice');
  const expensive = { ...league, [offer.partner]: league[offer.partner].map(player => player.id === offer.incomingId ? { ...player, salary: 999 } : player) };
  assert.ok(validateGmTradeOffer(offer, team.abbr, roster, expensive, 3, 2026, false).errors.some(error => error.includes('salary cap')));
  const invalid = { ...league, [offer.partner]: league[offer.partner].filter(player => player.id !== offer.incomingId) };
  assert.ok(validateGmTradeOffer(offer, team.abbr, roster, invalid, 3, 2026, false).errors.length);
  for (const week of [1, 2, 10, 17, 18]) assert.equal(generateGmTradeOffer(team.abbr, roster, league, week, 2026, false, []), null);
  assert.equal(generateGmTradeOffer(team.abbr, roster, league, 3, 2026, true, []), null);
}
console.log(`GM incoming trade checks passed across ${SOLO_TEAM_THEMES.length} teams: deterministic requests, restore, decisions, both roster updates, salary caps, expired windows, stale ownership, and duplicate execution.`);
