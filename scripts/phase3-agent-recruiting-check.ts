import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRecruitingProfile,evaluateRecruitingDecision,recruitingPitchImpact,recruitingRoundChoices} from '../agentRecruiting';

const player={id:'career-player',age:24,salary:3,ovr:73,position:'WR'};
const agency={reputation:45,negotiation:50,brandPower:45,clientCare:55};
const profile=createRecruitingProfile(player);
assert.deepEqual(createRecruitingProfile(player),profile,'player personality and priorities must be stable');
assert.equal(profile.priorities.length,3,'each player needs a meaningful priority combination');
const roundOne=recruitingRoundChoices(player,profile,1);
assert.equal(roundOne.length,4,'round one must show four pitches');
const chosenOne=roundOne[0];
const roundTwo=recruitingRoundChoices(player,profile,2,roundOne);
assert.equal(roundTwo.length,4,'round two must show four new follow-up pitches');
assert.equal(roundTwo.some(pitch=>roundOne.includes(pitch)),false,'every first-round option must disappear in round two');
assert.equal(new Set([...roundOne,...roundTwo]).size,8,'the two rounds must contain eight distinct conversation paths');

const matched=profile.priorities.slice(0,2);
const mismatched=recruitingRoundChoices(player,profile,2,matched).slice(-2);
const matchedImpact=matched.reduce((sum,pitch)=>sum+recruitingPitchImpact(pitch,player,profile,agency),0);
const mismatchedImpact=mismatched.reduce((sum,pitch)=>sum+recruitingPitchImpact(pitch,player,profile,agency),0);
assert.ok(matchedImpact>mismatchedImpact,'player priorities must change which pitches are persuasive');
assert.equal(evaluateRecruitingDecision({player,profile,agency,pitches:[matched[0]],baseInterest:40,rivalPressure:40,firstClient:true}).signed,false,'a signing decision must reject fewer than exactly two pitches');
assert.equal(evaluateRecruitingDecision({player,profile,agency,pitches:[matched[0],matched[0]],baseInterest:40,rivalPressure:40,firstClient:true}).signed,false,'a signing decision must reject duplicate pitches');

const screen=readFileSync(new URL('../PlayerAgentMode.tsx',import.meta.url),'utf8');
assert.match(screen,/ROUND \{recruit\.round\} · CHOOSE ONE/,'the meeting must instruct one choice per round');
assert.doesNotMatch(screen,/CHOOSE BOTH PITCHES|askToSign/,'the old click-every-option flow must stay removed');
assert.match(screen,/recruitingRoundChoices\(\s*selected,\s*recruit\.profile,\s*2,\s*recruit\.choices,?\s*\)/,'the second round must replace every first-round choice');
assert.match(screen,/evaluateRecruitingDecision\(\{\s*player:\s*selected,\s*profile:\s*recruit\.profile/,'the meeting must end in the tested multi-factor decision');

console.log('Phase 3 Agent recruiting checks passed.');
