import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyFranchiseOpportunities,
  createFranchiseInteractions,
  ensureFranchiseWeek,
  isFranchiseInteractionState,
  respondToFranchiseScenario,
  resolveFranchiseWeek,
  ratingsWithFranchiseMorale,
  upgradeFranchisePlayer,
} from '../franchiseInteractions';
import { buildSoloTeamRoster } from '../soloFranchiseEngine';
import type { PlayerLine } from '../soloSeasonEngine';
import { SOLO_TEAM_THEMES } from '../soloUniverse';
import { calculateTeamRatings } from '../evaluation';

let roster = buildSoloTeamRoster(SOLO_TEAM_THEMES[0].abbr);
let state = createFranchiseInteractions(roster, 1);
const scenarioKinds = new Set<string>();

for (let week = 1; week <= 17; week += 1) {
  state = ensureFranchiseWeek(state, roster, week);
  const scenario = state.pendingScenario;
  assert.ok(scenario, `Week ${week} must present a team interaction before simulation.`);
  scenarioKinds.add(scenario.kind);
  const choice = scenario.choices.some(item => item.id === 'commit') ? 'commit' : scenario.choices[0].id;
  state = respondToFranchiseScenario(state, choice, roster);
  assert.equal(state.pendingScenario, null);

  const line: PlayerLine = {
    playerId: scenario.playerId,
    name: roster.find(player => player.id === scenario.playerId)?.name ?? 'Player',
    position: roster.find(player => player.id === scenario.playerId)?.position ?? 'QB',
    fantasyScore: 35,
    passYds: 400, passTD: 4, rushYds: 180, rushTD: 2,
    receptions: 10, recYds: 180, recTD: 2,
    tackles: 12, sacks: 3, picks: 2,
    fgMade: 5, fgAtt: 5, puntsInside20: 4,
  };
  const outcome = resolveFranchiseWeek(state, roster, [line], week, week === 4 ? [{ playerId: roster[1].id, playerName: roster[1].name, position: roster[1].position, weeks: 2, week, severity: 'Moderate' }] : [], true);
  state = outcome.state;
  roster = outcome.roster;
}

assert.deepEqual([...scenarioKinds].sort(), ['breakout', 'mentor', 'playing_time']);
assert.ok(state.notifications.some(notification => notification.kind === 'injury'));
assert.ok(state.notifications.some(notification => notification.kind === 'breakout' && notification.title === 'Goal achieved'));
assert.ok(Object.values(state.development).some(player => player.upgradePoints > 0), 'Weekly performance must create upgrade points.');
assert.ok(isFranchiseInteractionState(JSON.parse(JSON.stringify(state))), 'Interaction state must survive persistence.');

const lowMorale = {
  ...state,
  development: Object.fromEntries(Object.entries(state.development).map(([id, development]) => [id, { ...development, morale: 35 }])),
};
const baseRatings = calculateTeamRatings(roster);
assert.ok(ratingsWithFranchiseMorale(baseRatings, lowMorale, roster).overall < baseRatings.overall, 'Low morale must reduce simulated team ratings.');
const highMorale = {
  ...state,
  development: Object.fromEntries(Object.entries(state.development).map(([id, development]) => [id, { ...development, morale: 92 }])),
};
assert.ok(ratingsWithFranchiseMorale(baseRatings, highMorale, roster).overall > baseRatings.overall, 'High morale must improve simulated team ratings.');

let opportunityState = createFranchiseInteractions(roster, 21);
while (opportunityState.pendingScenario && !opportunityState.pendingScenario.choices.some(choice => choice.id === 'commit')) {
  opportunityState = createFranchiseInteractions(roster, opportunityState.pendingScenario.week + 1);
}
assert.ok(opportunityState.pendingScenario);
const opportunityWeek = opportunityState.pendingScenario.week;
const opportunityPlayerId = opportunityState.pendingScenario.playerId;
opportunityState = respondToFranchiseScenario(opportunityState, 'commit', roster);
const opportunityLines = applyFranchiseOpportunities(opportunityState, roster, [], opportunityWeek);
assert.ok(opportunityLines.some(line => line.playerId === opportunityPlayerId), 'A promised role must generate an actual stat opportunity for the player.');

const upgrade = Object.values(state.development).find(player => player.upgradePoints > 0)!;
const before = roster.find(player => player.id === upgrade.playerId)!;
const upgraded = upgradeFranchisePlayer(state, roster, upgrade.playerId, 'position');
const after = upgraded.roster.find(player => player.id === upgrade.playerId)!;
assert.equal(after.ovr, before.ovr + 1, 'Spending an upgrade point must raise player OVR by one.');
assert.equal(upgraded.state.development[upgrade.playerId].upgradePoints, upgrade.upgradePoints - 1);

const seasonUi = readFileSync(new URL('../FranchiseSeason.tsx', import.meta.url), 'utf8');
const capUi = readFileSync(new URL('../SoloMode.tsx', import.meta.url), 'utf8');
const interactionUi = readFileSync(new URL('../FranchiseInteractionCenter.tsx', import.meta.url), 'utf8');
for (const source of [seasonUi, capUi]) {
  assert.ok(source.includes('FranchiseInteractionCenter'), 'Every Solo season engine must render the interaction center.');
  assert.ok(source.includes('resolveFranchiseWeek'), 'Every Solo season engine must resolve promises against game stats.');
}
for (const requirement of ['Playing-time meeting', 'Breakout opportunity', 'Player upgrades', 'Morale', 'Team notifications']) {
  assert.ok(interactionUi.includes(requirement) || readFileSync(new URL('../franchiseInteractions.ts', import.meta.url), 'utf8').includes(requirement), `Interaction system is missing ${requirement}.`);
}

console.log('Franchise interaction checks passed: weekly decisions, promises, stat goals, morale, injuries, notifications, XP, manual upgrades, OVR growth, persistence, and all shared Solo seasons.');
