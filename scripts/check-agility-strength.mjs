import assert from 'node:assert/strict';
import {newSkill,startSkill,stepSkill,cutSkill,cutProgress,readSkills,saveSkill,DRILL_KEY} from '../combine/agility-strength.js';
const athlete={id:'tester',name:'Test Athlete',position:'WR',speed:90};
function runShuttle(hz,hit){const s=newSkill(athlete,'shuttle');startSkill(s);for(let i=0;i<hz*20&&s.phase!=='finished';i++){if(hit&&s.phase==='cut'&&cutProgress(s)>=.675)cutSkill(s,s.turn===0?'left':'right');stepSkill(s,1/hz);}return s;}
const clean=runShuttle(120,true),miss=runShuttle(120,false);assert.equal(clean.cuts.length,2);assert(clean.penalty<.002);assert.equal(miss.penalty,.9);assert(Math.abs(clean.distance-18.288)<1e-6);assert(Math.abs(clean.z)<1e-6);assert(clean.score<miss.score);for(const hz of [3,5,15,30,60,144])assert(Math.abs(runShuttle(hz,true).clock-clean.clock)<.02);
for(const hz of [5,15,60]){const s=newSkill(athlete,'shuttle');startSkill(s);for(let i=0;i<hz*4;i++)stepSkill(s,1/hz);assert(Math.abs(s.clock-1)<.01,'active clock must match elapsed time');}
const wrong=newSkill(athlete,'shuttle');startSkill(wrong);stepSkill(wrong,3.1);cutSkill(wrong,'right');assert.equal(wrong.penalty,.15);cutSkill(wrong,'right');assert.equal(wrong.penalty,.15);
const bench=newSkill(athlete,'bench');startSkill(bench);stepSkill(bench,3.1);bench.pressing=true;
while(!bench.lowering)stepSkill(bench,1/120);assert.equal(bench.reps,1);const fullEnergy=bench.energy;
stepSkill(bench,.7);assert(bench.topHold>=.55);assert(bench.energy<fullEnergy);stepSkill(bench,1);assert(bench.forcedLower);assert(bench.lift<1);
stepSkill(bench,3);assert.equal(bench.lift,0);assert(bench.needsRelease);assert.equal(bench.reps,1);stepSkill(bench,2);assert.equal(bench.reps,1);
bench.pressing=false;stepSkill(bench,3);assert(!bench.needsRelease&&!bench.lowering);bench.pressing=true;stepSkill(bench,2);assert.equal(bench.reps,2);
bench.pressing=false;stepSkill(bench,40);assert.equal(bench.phase,'finished');assert(Math.abs(bench.clock-30)<1e-8);assert.equal(bench.score,2);
const precision=p=>{const s=newSkill(athlete,'shuttle');s.phase='cut';s.cutElapsed=p*.8;cutSkill(s,'left');return s.penalty;};
assert(precision(.675)<precision(.55));assert(precision(.55)<precision(.45));assert(precision(.90)<precision(.99));
const partial=newSkill(athlete,'bench');startSkill(partial);stepSkill(partial,3.01);partial.pressing=true;stepSkill(partial,.2);partial.pressing=false;stepSkill(partial,.5);assert.equal(partial.reps,0);assert.equal(partial.lift,0);
let value='broken';globalThis.localStorage={getItem:()=>value,setItem:(k,v)=>{assert.equal(k,DRILL_KEY);value=v;}};assert.deepEqual(readSkills(),[]);assert(saveSkill(clean,'standalone'));assert.equal(readSkills()[0].score,clean.score);value='{}';assert.deepEqual(readSkills(),[]);globalThis.localStorage.setItem=()=>{throw Error('blocked');};assert.equal(saveSkill(clean,'standalone'),false);
console.log('PASS timing, penalties, 20-yard distance, refresh rates, full reps, partial lifts, release recovery, 30-second finish, corrupt and blocked storage');
