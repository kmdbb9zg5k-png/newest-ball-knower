import assert from 'node:assert/strict';
import {
  CAMPAIGN, CARD_BY_ID, CHAPTERS, PACK_POSITIONS, POSITIONS, TRAINING, boostPack, buyPack, chapterChoices, claimChapter,
  claimPack, cleared, duplicates, equip, exchangeCard, exchangeCardId, gameSquad, initialLegends, isLegendsResult, openStarter,
  playerOverall, recordClear, revealPack, trainCard, trainingCost,
} from '../bkLegends';
import { readLegendsField, setLegendsStart } from '../public/play-moment-3d/legends-field.js';
import { fullSession } from '../public/play-moment-3d/five-minute.js';

let state = openStarter(initialLegends());
assert.equal(state.lineup.length, 25);
assert.equal(new Set(state.lineup).size, 25);
assert.deepEqual(state.lineup.map(id => CARD_BY_ID.get(id)?.position), [...POSITIONS]);
assert.equal(openStarter(state), state);
assert.equal(CAMPAIGN.length, 80);
const openingChallenges = CHAPTERS.map((_, index) => CAMPAIGN[index * 10]);
assert.deepEqual(openingChallenges.map(scenario => scenario.difficulty),
  ['rookie', 'rookie', 'pro', 'pro', 'pro', 'all-pro', 'all-pro', 'all-pro']);
const roadToTitle = openingChallenges.slice(-3);
assert.deepEqual(roadToTitle.map(scenario => scenario.awayScore - scenario.score), [7, 10, 13]);
assert.ok(roadToTitle[0].clock > roadToTitle[1].clock && roadToTitle[1].clock > roadToTitle[2].clock);
assert.equal(openingChallenges[3].goal, 'shutout');
assert.equal(CAMPAIGN[41].timeouts, 0);
assert.equal(CAMPAIGN[79].awayScore - CAMPAIGN[79].score, 14);

assert.equal(new Set(CAMPAIGN.map(scenario => scenario.title)).size, 80);
const passing = { homeScore: 30, awayScore: 21, passYards: 70, rushYards: 70, plays: 6 };
assert.equal(isLegendsResult(passing), true);
assert.equal(isLegendsResult({ ...passing, passYards: '70' }), false);
assert.equal(isLegendsResult({ ...passing, plays: -1 }), false);
assert.equal(recordClear(state, CAMPAIGN[1], passing, state.lineup), state);
assert.equal(recordClear(state, CAMPAIGN[0], { ...passing, homeScore: 17 }, state.lineup), state);
assert.equal(cleared(CAMPAIGN[30], { ...passing, awayScore: 22 }), false);
assert.equal(cleared(CAMPAIGN[1], { ...passing, passYards: 0 }), false);
assert.equal(cleared(CAMPAIGN[0], { ...passing, plays: 0 }), false);

const first = recordClear(state, CAMPAIGN[0], passing, state.lineup);
assert.equal(first.coins, 1000);
assert.equal(recordClear(first, CAMPAIGN[0], passing, first.lineup), first);
assert.equal(buyPack(first, 'WR'), first);
assert.equal(claimChapter(first, 0, chapterChoices(0)[0]), first);
for (const scenario of CAMPAIGN) state = recordClear(state, scenario, passing, state.lineup);
assert.equal(state.complete, 80);
assert.equal(state.coins, 80_000);
for (let chapter = 0; chapter <= CHAPTERS.length; chapter++) {
  const choices = chapterChoices(chapter);
  assert.equal(new Set(choices).size, 3);
  state = claimChapter(state, chapter, choices[0]);
  assert.equal(claimChapter(state, chapter, choices[1]), state);
}
assert.equal(state.legacyClaimed, true);
for (const position of PACK_POSITIONS) {
  const premium = revealPack(boostPack(buyPack(state, position)), () => 0.25);
  assert.equal(premium.pack?.choices?.length, 3);
  assert.ok(premium.pack?.choices?.every(id => CARD_BY_ID.get(id)!.overall >= 84));
  assert.equal(revealPack(premium), premium);
  assert.equal(boostPack(premium), premium);
}
const buy = () => {
  const packed = revealPack(boostPack(buyPack(state, 'WR')), () => 0);
  const id = packed.pack!.choices![0];
  state = claimPack(packed, id);
  assert.equal(claimPack(state, id), state);
  return id;
};
const card = buy();
for (let i = 0; i < 3; i++) assert.equal(buy(), card);
const old = state.lineup[7];
assert.equal(equip(state, 5, card), state);
state = equip(state, 7, card);
assert.equal(state.lineup[7], card);
assert.ok(state.owned[old]);
assert.ok(duplicates(state) >= 3);
const target = exchangeCardId('K')!;
state = exchangeCard(state, 'K');
assert.ok(state.owned[target]);
assert.equal(state.lineup[7], card);

for (let i = 0; i < 8; i++) state = recordClear(state, TRAINING[0], passing, state.lineup);
assert.equal(state.training, 800);
const initial = playerOverall(state, card);
const level2 = trainCard(state, card);
assert.equal(playerOverall(level2, card), initial + 4);
assert.equal(trainingCost(level2, card), 400);
assert.equal(trainCard(level2, card), level2);
state = level2;
for (let i = 0; i < 3; i++) state = recordClear(state, TRAINING[0], passing, state.lineup);
state = trainCard(state, card);
const squad = gameSquad(state);
assert.equal(squad.lineup[7].id, card);
assert.equal(squad.lineup[7].overall, Math.min(99, initial + 8));
assert.ok(squad.lineup[7].attributes.receiving >= CARD_BY_ID.get(card)!.attributes.receiving!);
const token = '00000000-0000-4000-8000-000000000001';
const scenario = CAMPAIGN[30];
const storage = { getItem: (key: string) => key.endsWith(token) ? JSON.stringify({ squad, scenario }) : null };
assert.equal(readLegendsField('?bkLegends=' + token, storage, false), null);
assert.equal(readLegendsField('?bkLegends=' + token, storage, true)?.squad.lineup[7].id, card);
const session = fullSession('five-minute', true);
setLegendsStart(session, scenario);
assert.equal(session.possession, 'away');
assert.equal(session.cpu.ball, 98);
assert.equal(session.cpu.toGo, 2);
console.log('BK Legends: all 80 payouts, chapter and legacy rewards, pack upgrade guarantees, exchanges, player upgrades, and field handoff verified.');
