import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MESHY_CLIPS, meshyAnimationState, motionRecipeForState } from '../public/play-moment-3d/meshy-athlete.js';
import { samplePose } from '../public/play-moment-3d/motion.js';
import {
  CATCH_STYLES,
  canThrowAway,
  carrierControlVector,
  openingRunControl,
  blockOutcome,
  catchBreakupChance,
  carriedBallAnchor,
  contactOutcome,
  contactPresentation,
  cutSeverity,
  coverageShell,
  DEFENSIVE_CALLS,
  defensiveCallForSnap,
  defenderPursuitSpeed,
  forwardProgressSpot,
  hasCrossedScrimmage,
  identifyMikeAssignments,
  locomotionStep,
  passOutcomeChances,
  playerRatings,
  perimeterBlockAssignments,
  pocketPressure,
  QB_LATERAL_LIMIT,
  pursuitLaneOffset,
  pursuitTarget,
  qbMovementSpeed,
  ratingMultiplier,
  receiverSlotForKey,
  runBlockAssignments,
  runConceptDirection,
  runReadDelay,
  RUNS,
  sackLoss,
  situationalDefensiveCall,
  skillMoveForGesture,
  tackleRadius,
  THROW_PROFILES,
  throwKindForHold,
  throwKindForModifiers,
} from '../public/play-moment-3d/game.js';

for (const [key, slot] of [
  ['x', 0], ['X', 0], ['1', 0],
  ['y', 1], ['Y', 1], ['2', 1],
  ['z', 2], ['Z', 2], ['3', 2],
  ['4', 3], ['5', 4],
]) assert.equal(receiverSlotForKey(key), slot, `${key} should select receiver ${slot}`);
for (const key of ['0', '6', 'q', 'Shift', 'ArrowUp', '', null]) {
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
assert.equal(sackLoss(108, 103), 6, 'A stationary-pocket sack should preserve the established six-yard loss');
assert.equal(sackLoss(108, 105), 4, 'Climbing the pocket should reduce sack depth');
assert.equal(sackLoss(108, 99), 10, 'Dropping deeper should cost more yardage');
assert.equal(sackLoss(108, 80), 12, 'Sack loss must stay bounded');
assert.equal(hasCrossedScrimmage(100.14, 100), false);
assert.equal(hasCrossedScrimmage(100.15, 100), true);
assert.equal(canThrowAway(6), false, 'The quarterback is still inside the tackle box');
assert.equal(canThrowAway(6.01), true, 'The quarterback may throw away after escaping the tackle box');
assert.equal(canThrowAway(-8), true, 'Throwaways must work from either edge');
assert.equal(qbMovementSpeed(0), 4.4);
assert.equal(qbMovementSpeed(6), 4.4);
assert.equal(qbMovementSpeed(6.01), 5.8, 'A quarterback outside the tackle box should accelerate into a rollout');
assert.ok(qbMovementSpeed(0, 1) > 5.09, 'Climbing the pocket should be fast enough to create a fair scramble window');
assert.equal(QB_LATERAL_LIMIT, 12, 'The quarterback rollout must stay inside a playable camera and pursuit window');

const qbBall=carriedBallAnchor({role:'QB',x:2,z:20,heading:0},'pass');
assert.deepEqual(qbBall,[2.13,1.4,20.28,0],'The quarterback should hold the ball at chest height before release');
const runnerBall=carriedBallAnchor({role:'RB',x:0,z:30,heading:Math.PI/2},'run');
assert.ok(Math.abs(runnerBall[0]-.09)<1e-9&&Math.abs(runnerBall[2]-29.66)<1e-9,'A runner should tuck the ball relative to body heading');
const hurdleBall=carriedBallAnchor({role:'RB',x:0,z:30,heading:0,action:'hurdle',actionT:.5},'run');
assert.ok(hurdleBall[1]>1.6,'The football must remain attached to the runner during a hurdle');

let locomotion = { vx: 0, vz: 0 };
locomotion = locomotionStep(locomotion.vx, locomotion.vz, 0, 1, 9.2, 1 / 60);
assert.ok(locomotion.vz > 0 && locomotion.vz < 9.2, 'A runner should accelerate instead of teleporting to top speed');
for (let i = 0; i < 60; i++) locomotion = locomotionStep(locomotion.vx, locomotion.vz, 0, 1, 9.2, 1 / 60);
assert.ok(locomotion.vz > 9.1, 'Sustained input should still reach sprint speed');
const cut = locomotionStep(locomotion.vx, locomotion.vz, 1, 0, 9.2, 1 / 60);
assert.ok(cut.vz > 8.5 && cut.vx > 0, 'A hard cut should preserve momentum for at least one frame');
const coast = locomotionStep(cut.vx, cut.vz, 0, 0, 9.2, 1 / 60);
assert.ok(Math.hypot(coast.vx, coast.vz) < Math.hypot(cut.vx, cut.vz), 'Released input should decelerate predictably');

assert.deepEqual(carrierControlVector(false, 0, 0, .8, .6), { x: 0, z: 0, manual: false }, 'Manual mode must never auto-steer an untouched runner');
assert.deepEqual(carrierControlVector(false, -1, 0, .8, .6), { x: -1, z: 0, manual: true }, 'Manual stick input must fully override the run concept');
assert.deepEqual(carrierControlVector(true, 0, 0, .8, .6), { x: .8, z: .6, manual: false }, 'Assist mode should retain concept steering');
assert.deepEqual(openingRunControl(false, 0, 0, .8, .6, .2, .9, true), { x: .8, z: .6, manual: true }, 'A pre-snap direction must survive a canceled mobile touch through the handoff');
assert.deepEqual(openingRunControl(false, .5, .4, .8, .6, .2, .9, true), carrierControlVector(false, .5, .4, .2, .9), 'Fresh stick input must immediately override the opening buffer');
assert.deepEqual(openingRunControl(false, 0, 0, .8, .6, .2, .9, false), { x: 0, z: 0, manual: false }, 'The opening direction must expire instead of steering forever');
assert.deepEqual(openingRunControl(true, 0, 0, .8, .6, .2, .9, true), carrierControlVector(true, 0, 0, .2, .9), 'Assist mode must keep following its run concept');
assert.equal(cutSeverity(0, 7, 0, -1), 1, 'A full-speed reversal must trigger a hard plant');
assert.equal(cutSeverity(0, 2, 1, 0), 0, 'Low-speed direction changes should remain responsive');
assert.equal(blockOutcome(95, 72, .2, .5), 'steer', 'A leveraged elite blocker should steer the defender');
assert.equal(blockOutcome(65, 94, 0, .1), 'shed', 'An elite defender should be able to shed a weak block');
assert.equal(blockOutcome(96, 68, .25, .99), 'pancake', 'Dominant run blocks should occasionally finish on the ground');
assert.deepEqual(identifyMikeAssignments([[1, 15], [3, 16]], 15), [[1, 16], [3, 15]], 'Changing the Mike must swap assignments without duplicating him');
const pursuit = pursuitTarget({ x: 0, z: 0 }, { x: 12, z: 20, vx: 4, vz: 7 }, true);
assert.ok(pursuit.z > 20, 'A defender should aim ahead of a moving runner');
assert.ok(pursuit.x < 12 + 4 * .38, 'Sideline pursuit should retain inside leverage');
const leftLane = pursuitLaneOffset(11, 10, 0);
const rightLane = pursuitLaneOffset(12, 10, 0);
assert.ok(leftLane < 0 && rightLane > 0, 'Pursuit lanes must stagger defenders across both sides of the runner');
assert.ok(Math.abs(pursuitLaneOffset(11, 1.2, 0)) < Math.abs(leftLane), 'Pursuit lanes must collapse near contact');
assert.ok(Math.abs(pursuitLaneOffset(11, 10, 24)) < Math.abs(leftLane), 'Pursuit lanes must narrow near a sideline');
assert.equal(forwardProgressSpot(40, 0), 30);
assert.equal(forwardProgressSpot(40, 20), 30.72, 'Contact momentum should be useful but capped');

assert.equal(skillMoveForGesture(2, 3, 120, false), 'juke');
assert.equal(skillMoveForGesture(2, 3, 700, false), null, 'A long hold must not accidentally fire a juke');
assert.equal(skillMoveForGesture(-42, 4, 100, false), 'spin-left');
assert.equal(skillMoveForGesture(42, 4, 100, false), 'spin-right');
assert.equal(skillMoveForGesture(2, -42, 100, false), 'truck');
assert.equal(skillMoveForGesture(2, 42, 100, false), 'hurdle');
assert.equal(skillMoveForGesture(2, 42, 100, true), 'slide');

assert.deepEqual([0, 1, 2, 3].map(coverageShell), ['man', 'quarters', 'zone', 'robber']);
assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(i => defensiveCallForSnap(i).id), ['over-three', 'under-man', 'nickel-quarters', 'double-a-robber', 'edge-fire-three', 'press-trap', 'over-three']);
assert.deepEqual(DEFENSIVE_CALLS.map(call => call.coverage), ['zone', 'man', 'quarters', 'robber', 'zone', 'man']);
assert.deepEqual(DEFENSIVE_CALLS.map(call => call.blitzers.length), [0, 1, 0, 2, 1, 1], 'Pressure calls need real second-level rushers');
assert.equal(new Set(DEFENSIVE_CALLS.map(call => JSON.stringify(call.alignments))).size, 6, 'Every defensive call needs a visibly different alignment');
assert.equal(situationalDefensiveCall({ down: 3, toGo: 9, ball: 42, clock: 55, plays: 0 }).id, 'nickel-quarters');
assert.equal(situationalDefensiveCall({ down: 4, toGo: 2, ball: 42, clock: 55, plays: 0 }).id, 'under-man');
assert.equal(situationalDefensiveCall({ down: 1, toGo: 10, ball: 88, clock: 55, plays: 0 }).id, 'double-a-robber');
for (let runIndex = 0; runIndex < 4; runIndex++) {
  const assignments = runBlockAssignments(runIndex);
  assert.equal(assignments.length, 6, 'Every run concept needs six blocking assignments');
  assert.equal(new Set(assignments.map(([blocker]) => blocker)).size, 6, 'A blocker cannot receive two run-fit assignments');
  assert.equal(new Set(assignments.map(([, defender]) => defender)).size, 6, 'Two blockers cannot target the same defender');
  assert.ok(assignments.some(([, defender]) => defender === 16), 'Every run concept must account for the Mike linebacker');
  assert.ok([11, 12, 13, 14].every(defender => assignments.some(([, target]) => target === defender)), 'Every run concept must account for the defensive front');
  const perimeter = perimeterBlockAssignments(runIndex);
  assert.equal(perimeter.length, 2, 'Every run needs two receiver stalk-block assignments');
  assert.equal(new Set(perimeter.map(([blocker]) => blocker)).size, 2, 'A perimeter blocker cannot receive two assignments');
  assert.equal(new Set(perimeter.map(([, defender]) => defender)).size, 2, 'Perimeter blocks must target separate force defenders');
  assert.ok(perimeter.every(([blocker, defender]) => [7, 8, 9].includes(blocker) && [18, 19, 20].includes(defender)));
}
for (let callIndex = 0; callIndex < DEFENSIVE_CALLS.length; callIndex++) {
  for (const linebacker of [15, 16, 17]) assert.ok(runReadDelay(callIndex, linebacker, 0) >= .34, 'Linebackers cannot diagnose a run instantly');
}
assert.ok(runReadDelay(0, 16, 2) > runReadDelay(0, 16, 0), 'Counter action must hold the Mike longer than inside zone');
assert.equal(RUNS.length, 18);
assert.equal(new Set(RUNS.slice(0,4).map(run => `${run.handoff}:${run.speed}:${run.acceleration}:${run.blockLeverage}`)).size, 4, 'Run concepts need different timing and physical profiles');
const conceptDirections = RUNS.map((run, index) => runConceptDirection(index, .45, run.mesh[0], 92 + run.mesh[1], 92));
assert.ok(conceptDirections[0].x < 0, 'Inside zone should initially press the backside A gap');
assert.ok(conceptDirections[1].x > .6 && conceptDirections[3].x > .6, 'Stretch and toss must attack width');
assert.ok(conceptDirections[2].targetX < -4, 'Counter must sell the false step before redirecting');
const rbRatings = playerRatings('RB', 6, 0), mikeRatings = playerRatings('LB', 16, 1), qbRatings = playerRatings('QB', 5, 0);
assert.ok(rbRatings.speed > qbRatings.speed && mikeRatings.tackle > qbRatings.tackle, 'Position ratings must affect football strengths');
assert.ok(ratingMultiplier(95) > ratingMultiplier(65));
assert.equal(contactOutcome(rbRatings, mikeRatings, { momentum: .9, angle: .2, skill: 'truck', roll: .05 }).type, 'miss');
assert.equal(contactOutcome(rbRatings, mikeRatings, { momentum: .9, angle: .2, skill: 'truck', roll: .25 }).type, 'broken');
assert.ok(['wrap', 'gang', 'big-hit'].includes(contactOutcome(rbRatings, mikeRatings, { momentum: .2, angle: 1, gang: 1, roll: .8 }).type));
assert.notEqual(contactOutcome(rbRatings, mikeRatings, { momentum: .2, angle: 1, gang: 1, roll: .6 }).type, 'gang', 'One nearby helper must not automatically force a gang tackle');
assert.equal(contactOutcome(rbRatings, mikeRatings, { momentum: .2, angle: 1, gang: 2, roll: .8 }).type, 'gang', 'A true multi-defender collapse should still finish as a gang tackle');
assert.equal(contactOutcome(rbRatings,mikeRatings,{momentum:.72,defenderMomentum:.92,distance:.8,angle:.9,roll:.8}).type,'dive','A fast square tackler at the edge of contact should use a dive finish');
const wrapFinish=contactPresentation('wrap',.5,-1),gangFinish=contactPresentation('gang',.5,1),diveFinish=contactPresentation('dive',.75,1),hitFinish=contactPresentation('big-hit',.5,1);
assert.equal(wrapFinish.side,-1);
assert.ok(gangFinish.helper&&gangFinish.duration>wrapFinish.duration,'Gang tackles need a helper and a longer finish');
assert.ok(hitFinish.carrierDrive>wrapFinish.carrierDrive&&hitFinish.shake>wrapFinish.shake,'Big hits need more displacement and camera impact');
assert.ok(diveFinish.carrierDrive>wrapFinish.carrierDrive&&diveFinish.duration<wrapFinish.duration,'Diving tackles need a faster, longer finish than wraps');
assert.equal(contactPresentation('unknown').type,'wrap','Unknown contact presentation must fail safe to a wrap');
const cleanWindow = passOutcomeChances(2.5, .1, 'touch', .25, 0);
const dangerWindow = passOutcomeChances(.4, .9, 'lob', 1.4, 1);
assert.ok(dangerWindow.interception > cleanWindow.interception, 'Tight pressured throws need more interception risk');
assert.ok(dangerWindow.inaccurate > cleanWindow.inaccurate, 'Pressure and target error must affect accuracy');
assert.ok(dangerWindow.breakup > cleanWindow.breakup, 'Tight coverage must increase breakup risk');
const secureWindow = passOutcomeChances(.9, .3, 'touch', .3, .2, { catchStyle: 'secure', catchRating: 90, coverageRating: 82, throwRating: 90 });
const racWindow = passOutcomeChances(.9, .3, 'touch', .3, .2, { catchStyle: 'rac', catchRating: 90, coverageRating: 82, throwRating: 90 });
assert.ok(secureWindow.breakup < racWindow.breakup, 'Secure catches must trade YAC for stronger possession odds');
assert.ok(CATCH_STYLES.rac.yac > CATCH_STYLES.secure.yac && CATCH_STYLES.aggressive.yac < CATCH_STYLES.rac.yac);

const fastCarrier={index:6,team:0,role:'RB',vx:8.3,vz:0,hasBall:true,sprinting:false,action:null,throwT:0,catchT:0,engaged:false,motion:{speed:8.3,run:1,ready:0,block:0,turn:0,gait:0,fall:0,catch:0,throwTime:1}};
assert.equal(meshyAnimationState(fastCarrier,'run'),'carry-run','Normal movement must keep the regular carry-run animation even at high speed');
assert.equal(meshyAnimationState({...fastCarrier,sprinting:true},'run'),'carry-sprint','Holding Sprint must explicitly select the carry-sprint animation');
assert.equal(motionRecipeForState('carry-sprint').base,MESHY_CLIPS.sprint,'Carrier Sprint must use the verified Meshy sprint cycle');
assert.ok(motionRecipeForState('carry-sprint').rate>motionRecipeForState('carry-run').rate,'Carrier Sprint must have a visibly faster cadence than the regular run');
assert.equal(samplePose(fastCarrier).sprint,0,'The fallback regular run must not inherit the sprint posture from raw speed');
assert.ok(samplePose({...fastCarrier,sprinting:true}).sprint>0,'The fallback athlete must use a distinct sprint posture while boosting');

const source = readFileSync(new URL('../public/play-moment-3d/game.js', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../public/play-moment-3d-preview.html', import.meta.url), 'utf8');
const hud = readFileSync(new URL('../public/play-moment-3d/hud.css', import.meta.url), 'utf8');
const athleteSource = readFileSync(new URL('../public/play-moment-3d/athlete.js', import.meta.url), 'utf8');
const meshySource = readFileSync(new URL('../public/play-moment-3d/meshy-athlete.js', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../public/play-moment-3d/renderer.js', import.meta.url), 'utf8');
const stadiumSource = readFileSync(new URL('../public/play-moment-3d/stadium.js', import.meta.url), 'utf8');
for (const id of ['flipPlay', 'motionReceiver', 'identifyMike', 'juke', 'spin', 'power', 'airMove', 'sprint', 'scramble', 'throwAway', 'watchReplay']) assert.match(preview, new RegExp(`id="${id}"`), `${id} must remain in the mobile control deck`);
assert.match(hud, /#skillPad\{display:grid/, 'The four skill actions need a compact two-by-two mobile layout');
assert.match(hud, /button\.cooldown/, 'Skill cooldowns need visible feedback');
assert.match(meshySource, /p\.action==='cut'/, 'Hard direction changes must select the carry-cut animation');
assert.match(meshySource, /p\.action==='pancake'/, 'Dominant block finishes must select a grounded animation');
assert.match(meshySource, /ballAnchor\(p\)/, 'The football must bind to the live animated hand transform');
assert.match(meshySource, /mixamorig:RightHand/, 'The carry anchor must resolve the rig hand bone');
assert.match(source, /carrier\.sprinting=boosting/, 'The Sprint control must explicitly drive the carrier animation state');
assert.match(meshySource, /p\.hasBall&&p\.sprinting/, 'The rigged carrier must select Sprint from input state rather than a raw speed threshold');
assert.match(meshySource, /rimColor\*rim/, 'Detailed athletes need stadium rim light to separate them from the field');
assert.match(rendererSource, /crossGrain/, 'The turf shader must include cross-grain blade variation');
assert.match(rendererSource, /texture==='player-glow'/, 'The renderer must blend the controlled-player focus halo');
assert.match(rendererSource, /texture==='turf-fx'/, 'The renderer must blend live turf particles');
assert.match(rendererSource, /shadowCasters/, 'The renderer must accept detailed animated shadow casters');
assert.match(rendererSource, /skyHash/, 'The night sky must retain procedural depth instead of a flat clear color');
assert.match(stadiumSource, /r\.texture\('player-glow'/, 'The stadium must install the controlled-player focus texture');
assert.match(stadiumSource, /r\.texture\('impact-glow'/, 'The stadium must install the contact burst texture');
assert.match(stadiumSource, /r\.texture\('stadium-pool'/, 'The field must include subtle floodlight pools');
assert.match(stadiumSource, /if\(k%18===8\|\|k%18===9\)continue/, 'Crowd tiers need aisle breaks instead of an artificial solid grid');
assert.match(source, /phase==='pre'\|\|phase==='pass'\|\|phase==='handoff'/, 'The camera must remain stable through the snap and handoff');
assert.match(source, /'player-glow',true/, 'The live scene must render a soft focus halo below the controlled player');
assert.match(source, /pursuitLaneOffset/, 'Open-field pursuit needs staggered lane leverage');
assert.match(source, /emitRunFx\(\)/, 'A moving carrier must kick up live turf detail');
assert.match(source, /meshy\.queueShadows/, 'Detailed animated athletes must cast into the live field shadow map');
assert.match(meshySource, /uniform float controlled/, 'The controlled carrier needs a dedicated stadium-light rim');
assert.match(meshySource, /const depthVertex=/, 'Detailed players need a skinned depth pass for body-shaped shadows');
assert.match(athleteSource, /'meshy-number-'/, 'Every detailed uniform needs a roster-number texture to replace the baked source number');
assert.match(meshySource, /drawJerseyNumbers\(actors\)/, 'Detailed athletes must render live front-and-back jersey numbers');
assert.match(rendererSource, /drawLate\(\)/, 'The renderer must support depth-tested uniform decals after skinned players');
assert.match(source, /meshy\.drawJerseyNumbers\(actors\)/, 'The live scene must draw the roster-number pass');
assert.match(rendererSource, /crowdEnd:sphere/, 'The end-zone audience needs its own bounded instance batch');
assert.match(stadiumSource, /add\('crowdEnd'/, 'The end-zone deck must render spectators instead of empty seat blocks');
assert.match(hud, /#hud::before/, 'The field presentation needs a no-cost cinematic edge falloff');
assert.match(source, /receiverSlot=receiverSlotForKey\(key\)/, 'Keyboard receiver mapping is not wired to throws');
assert.match(source, /simTime<jukeReady/, 'Juke cooldown must use paused simulation time');
assert.match(source, /simTime>jukeUntil/, 'Juke contact immunity must use paused simulation time');
assert.match(source, /document\.querySelectorAll\('#skillPad button'\)/, 'Dedicated skill buttons must resolve directly on touch down');
assert.doesNotMatch(source, /finishSkillGesture/, 'Dedicated skill buttons should not depend on ambiguous swipe completion');
assert.match(source, /carrier\.vx=dx\*7\.4/, 'Juke must create a visible lateral acceleration');
assert.match(source, /nearest\.reactionT=\.001/, 'Nearby defenders must react visibly to skill moves');
assert.match(source, /carriedBallAnchor\(carrier,phase\)/, 'Possessed footballs must use the hand-relative anchor');
assert.match(source, /meshy\.ballAnchor\(carrier\)/, 'Detailed athletes must render the ball from the live hand bone');
assert.match(source, /endPlay\('QB SLIDE'/, 'A quarterback slide must safely end the play at the current spot');
assert.match(source, /beginSkillAction\('spin'/, 'Spin must drive its own presentation state');
assert.match(source, /beginSkillAction\(presentation,\.48/, 'Truck/stiff-arm must drive its own presentation state');
assert.match(source, /presentation=lateral>\.62\?'stiff-arm':'truck'/, 'A side defender must trigger a true stiff-arm state instead of reusing the truck pose');
assert.match(source, /beginSkillAction\('hurdle'/, 'Hurdle must drive its own presentation state');
assert.match(source, /!p\.fallen/, 'Fallen defenders must not immediately resume pursuit or tackling');
assert.match(source, /p\.team===1&&!p\.engaged/, 'An engaged defender should not make a tackle through a blocker');
assert.match(source, /runBlockAssignments\(selected\)/, 'Run blocking must use the concept-specific assignment plan');
assert.match(source, /perimeterBlockAssignments\(selected\)/, 'Run blocking must include receiver stalk blocks');
assert.match(source, /supportBlockers\(dt\)/, 'Receivers must find support blocks after catches and scrambles');
assert.match(source, /Math\.max\(blocker\.z,carrier\.z\+4\)/, 'Scramble support cannot make receivers turn backward');
assert.match(source, /blocker\.blockStyle='stalk'/, 'Perimeter and support receivers need a distinct stalk-block presentation');
assert.match(source, /p\.blockStyle='pass-anchor'/, 'Pass protectors need a distinct anchor state at contact');
assert.match(source, /'rush-rip':'rush-swim'/, 'Edge rushers must alternate independent rip and swim techniques');
assert.match(source, /qb\.throwStyle=kind/, 'Bullet, touch and lob passes must drive different quarterback releases');
assert.match(source, /p\.routeStyle=elapsed<\.48/, 'Route runners need release, stem and cut states');
assert.match(source, /d\.coverageStyle=elapsed<\.62/, 'Defensive backs need pedal, match and break states');
assert.match(source, /defensiveCall\.alignments\.forEach/, 'The defense must display its selected front before the snap');
assert.match(source, /const shell=defensiveCall\.coverage/, 'Pass coverage cannot be selected by the offense\'s route concept');
assert.match(source, /if\(elapsed<\.9\).*d\.startX/, 'An unblocked sixth rusher must disguise pressure long enough to preserve a scramble read');
assert.match(source, /runFit\(p,dt\)/, 'Free defenders must honor their read step before pursuit');
assert.match(source, /engagedWith/, 'Block engagements must preserve an explicit blocker-defender pairing');
assert.match(source, /pursuitTarget\(p,target/, 'Open-field pursuit must use predictive leverage instead of direct homing');
assert.match(source, /p\.role!=='DL'&&!p\.engaged/, 'A blocked linebacker must not pursue through his lineman');
assert.match(source, /\['pre','pass','run'\]\.includes\(phase\)/, 'The movement stick must accept a held direction before the snap');
assert.match(source, /snapDirectionUntil=simTime\+\.75/, 'A pre-snap direction must remain buffered briefly after the handoff');
assert.match(source, /\$\('snap'\)\.onpointerdown/, 'Snap must fire on touch down while the movement stick remains held');
assert.match(source, /b\.heading=Math\.atan2\(launch\[0\],launch\[1\]\)/, 'The runner must face the buffered direction as possession starts');
assert.match(source, /BALL CARRIER · YOU HAVE CONTROL/, 'The handoff must visibly confirm manual ball-carrier control');
assert.doesNotMatch(source, /else if\(guide\)\{x=guide\.x;z=guide\.z\}/, 'Manual run control must not fall back to automatic concept steering');
assert.match(source, /document\.querySelectorAll\('#skillPad button'\)/, 'Juke, spin, power and hurdle controls must use dedicated mobile buttons');
assert.match(source, /function flipPlay\(/, 'Pre-snap play flipping must be wired');
assert.match(source, /function motionReceiver\(/, 'Pre-snap receiver motion must be wired');
assert.match(source, /function identifyMike\(/, 'Pre-snap Mike identification must be wired');
assert.doesNotMatch(preview, /id="pumpFake"/, 'The approved control deck omits pump fake');
assert.doesNotMatch(source, /passLeadOffset\(input\.x,input\.z\)/, 'Quarterback movement input must not silently alter pass placement');
assert.match(source, /leadX=0,leadZ=0/, 'Receiver route prediction must own pass placement independently of movement');
assert.match(source, /QB_LATERAL_LIMIT,QB_LATERAL_LIMIT/, 'Quarterback lateral movement must stay inside the playable rollout boundary');
assert.match(source, /function watchReplay\(/, 'Explosive plays must be retained for an in-game replay');
assert.match(source, /function stadiumSound\(/, 'Snap, collision and touchdown presentation must include stadium audio feedback');
assert.match(source, /blocker\.blockResult=blockOutcome/, 'Run blocks must resolve individual win, steer, shed or pancake outcomes');
assert.match(source, /CONTESTED /, 'Contested catches need player feedback');
assert.match(source, /TIGHT WINDOW · PASS BROKEN UP/, 'Tight-window incompletions need player feedback');
assert.match(source, /DROPPED PASS/, 'Open-target drops must not be mislabeled as breakups');
assert.match(source, /if\(nearest<\.92\)/, 'Sacks must require actual rusher contact');
assert.doesNotMatch(source, /pressure>=\.995/, 'Pressure alone must not create an invisible sack');
assert.doesNotMatch(source, /elapsed>4\.6/, 'The old fixed sack timer must stay removed');
assert.match(source, /MOVE QB · TAP\/HOLD TARGET · PUMP · SCRAMBLE/, 'Passing controls need to teach target timing, pump fakes and scrambling');
assert.match(source, /endDrive\('INTERCEPTED'/, 'Interceptions must create a real turnover result');
assert.match(source, /QB SCRAMBLE · TAKE CONTROL/, 'Crossing the line of scrimmage must transition the quarterback to a runner');
assert.match(source, /phase='run';assist=false;elapsed=0/, 'A scramble must always hand manual control back to the player');
assert.match(source, /LEAVE THE POCKET TO THROW AWAY/, 'Throwaway control must teach the tackle-box rule');
assert.match(source, /flight\.throwAway/, 'A legal throwaway must travel to the sideline before ending the down');
assert.match(source, /beginContactSequence\(d,outcome,helpers,speed\)/, 'Successful tackles must start a timed contact sequence');
assert.match(source, /if\(phase==='dead'\)\{simTime\+=dt;if\(activeContact\)advanceContactSequence\(dt\)/, 'Contact animation must advance after the whistle');
assert.match(source, /if\(c\.elapsed>=c\.duration\)activeContact=null/, 'Completed contact must release its paused-loop continuation');
assert.match(source, /\(!paused\|\|activeContact\)&&!qaStepping/, 'Drive-ending hits must finish even after the result dialog pauses gameplay');
assert.match(source, /title==='TOUCHDOWN'&&carrier&&!activeContact/, 'A tackle at the goal line must finish before celebration can replace its contact pose');

console.log(JSON.stringify({
  status: 'PASS',
  receiverKeys: 11,
  invalidReceiverKeys: 7,
  coverageWindows: separations.length,
  contactWindows: 5,
  pursuitSamples: 4,
  throwTypes: Object.keys(THROW_PROFILES),
  coverageShells: [0, 1, 2, 3].map(coverageShell),
  defensiveCalls: DEFENSIVE_CALLS.map(call => call.id),
  checks: 'five eligible targets, catch choices, distinct bullet/touch/lob releases and legal throwaways, ratings-driven throws, role-specific line/perimeter/support blocks, alternating rip/swim rush techniques, timed wrap/dive/gang/big-hit contact, six situational defensive fronts with real blitzers, distinct run timing/landmarks/acceleration, linebacker read steps, momentum locomotion, predictive pursuit, forward progress, movable QB pocket, scramble/slide, contextual skills including true stiff arms, contact-only sacks and coverage-scaled outcomes',
}, null, 2));
