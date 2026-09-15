import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  catchBreakupChance,
  coverageShell,
  defenderPursuitSpeed,
  passOutcomeChances,
  pocketPressure,
  receiverSlotForKey,
  tackleRadius,
  THROW_PROFILES,
  throwKindForHold,
  throwKindForModifiers,
} from '../public/play-moment-3d/game.js';

for (const [key, slot] of [
  ['x', 0], ['X', 0], ['1', 0],
  ['y', 1], ['Y', 1], ['2', 1],
  ['z', 2], ['Z', 2], ['3', 2],
]) assert.equal(receiverSlotForKey(key), slot, `${key} should select receiver ${slot}`);
for (const key of ['0', '4', 'q', 'Shift', 'ArrowUp', '', null]) {
  assert.equal(receiverSlotForKey(key), -1, `${key} should not select a receiver`);
}

const separations = [.5, .9, 1.5, 2.5];
const breakup = separations.map(catchBreakupChance);
assert.deepEqual(breakup, [.9, .68, .3, .04]);
assert.ok(breakup.every((chance, index) => index === 0 || chance < breakup[index - 1]));

assert.equal(tackleRadius(.1, false), 0, 'A handoff must finish before run contact');
assert.equal(tackleRadius(.3, false), 0, 'Run handoff grace should still be active');
assert.equal(tackleRadius(.56, false), .86, 'Run contact should activate after the handoff settles');
assert.equal(tackleRadius(.1, true), 0, 'A catch should complete before contact');
assert.equal(tackleRadius(.19, true), 1.05, 'Catch contact should activate quickly');

for (const separation of [0, 2, 8, 20]) {
  const runSpeed = defenderPursuitSpeed(separation, false);
  const passSpeed = defenderPursuitSpeed(separation, true);
  assert.ok(runSpeed >= 6.55 && runSpeed <= 7.2);
  assert.ok(passSpeed >= 7.55 && passSpeed <= 8.4);
  assert.ok(passSpeed > runSpeed, 'Open-field pass pursuit should close faster than box pursuit');
  assert.ok(passSpeed < 9.2, 'A full-stamina sprint must still be able to win a footrace');
}

assert.equal(throwKindForHold(0), 'bullet');
assert.equal(throwKindForHold(219), 'bullet');
assert.equal(throwKindForHold(220), 'touch');
assert.equal(throwKindForHold(519), 'touch');
assert.equal(throwKindForHold(520), 'lob');
assert.equal(throwKindForModifiers(false, false), 'bullet');
assert.equal(throwKindForModifiers(true, false), 'touch');
assert.equal(throwKindForModifiers(true, true), 'lob', 'Alt should take priority for a keyboard lob');
assert.ok(THROW_PROFILES.bullet.duration < THROW_PROFILES.touch.duration);
assert.ok(THROW_PROFILES.touch.duration < THROW_PROFILES.lob.duration);
assert.ok(THROW_PROFILES.bullet.arc < THROW_PROFILES.touch.arc);
assert.ok(THROW_PROFILES.touch.arc < THROW_PROFILES.lob.arc);

assert.equal(pocketPressure(8, 0), 0);
assert.ok(pocketPressure(2, 2) > pocketPressure(4, 2), 'A closer rusher must create more pressure');
assert.ok(pocketPressure(4, 5) > pocketPressure(4, 2), 'A late pocket must become less stable');
assert.equal(pocketPressure(0, 8), 1);

assert.deepEqual([0, 1, 2, 3].map(coverageShell), ['man', 'quarters', 'zone', 'robber']);
const cleanWindow = passOutcomeChances(2.5, .1, 'touch', .25, 0);
const dangerWindow = passOutcomeChances(.4, .9, 'lob', 1.4, 1);
assert.ok(dangerWindow.interception > cleanWindow.interception, 'Tight pressured throws need more interception risk');
assert.ok(dangerWindow.inaccurate > cleanWindow.inaccurate, 'Pressure and target error must affect accuracy');
assert.ok(dangerWindow.breakup > cleanWindow.breakup, 'Tight coverage must increase breakup risk');

const source = readFileSync(new URL('../public/play-moment-3d/game.js', import.meta.url), 'utf8');
assert.match(source, /receiverSlot=receiverSlotForKey\(key\)/, 'Keyboard receiver mapping is not wired to throws');
assert.match(source, /simTime<jukeReady/, 'Juke cooldown must use paused simulation time');
assert.match(source, /simTime>jukeUntil/, 'Juke contact immunity must use paused simulation time');
assert.match(source, /p\.team===1&&!p\.engaged/, 'An engaged defender should not make a tackle through a blocker');
assert.match(source, /CONTESTED CATCH · TAKE CONTROL/, 'Contested catches need player feedback');
assert.match(source, /TIGHT WINDOW · PASS BROKEN UP/, 'Tight-window incompletions need player feedback');
assert.match(source, /DROPPED PASS/, 'Open-target drops must not be mislabeled as breakups');
assert.match(source, /nearest<\.92\|\|pressure>=\.995/, 'Sacks must come from pocket pressure rather than a fixed timer');
assert.doesNotMatch(source, /elapsed>4\.6/, 'The old fixed sack timer must stay removed');
assert.match(source, /MOVE QB · HOLD TARGET FOR TOUCH \/ LOB/, 'Passing controls need to teach pocket movement and trajectories');
assert.match(source, /endDrive\('INTERCEPTED'/, 'Interceptions must create a real turnover result');

console.log(JSON.stringify({
  status: 'PASS',
  receiverKeys: 9,
  invalidReceiverKeys: 7,
  coverageWindows: separations.length,
  contactWindows: 4,
  pursuitSamples: 4,
  throwTypes: Object.keys(THROW_PROFILES),
  coverageShells: [0, 1, 2, 3].map(coverageShell),
  checks: 'X/Y/Z and 1/2/3 throws, tap/hold and modifier trajectories, movable QB pocket, proximity pressure and sacks, four coverage shells, interceptions, coverage-scaled outcomes, contact windows, pursuit balance and simulation-time jukes',
}, null, 2));
