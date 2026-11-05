import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {transformSync} from 'esbuild';
import * as engine from '../gauntletEngine.ts';
import * as validation from '../triviaValidation.ts';

const compiled=transformSync(await readFile(new URL('../progressionCloud.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
function runtime(rpc){
 const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,console:{warn(){}},crypto:globalThis.crypto,performance,Date,Math:Object.assign(Object.create(Math),{random:()=>0}),require:name=>{
  if(name==='./supabase')return{supabase:rpc?{rpc}:null,ensureOnlineSession:async()=>({id:'qa-owner'})};
  if(name==='./gauntletEngine')return engine;if(name==='./triviaValidation')return validation;throw Error('Unexpected import '+name);
 }});return module.exports;
}
assert.throws(()=>validation.parseTriviaAnswers(['One',' One ','Three','Four']),'Duplicate choices make grading ambiguous');
const offline=runtime();let answered=0;
for(const tier of engine.GAUNTLET_TIERS){
 const seen=new Set();
 for(let i=0;i<10;i++){
  const question=await offline.fetchTriviaQuestion(tier);assert(question.practiceOnly);assert(question.attemptId<0);assert(!seen.has(question.question));seen.add(question.question);
  const result=await offline.submitTriviaAnswer(question.attemptId,0);assert.equal(result.xpAwarded,0);assert.equal(result.progressionRecorded,false);assert(result.correctIndex>=0&&result.correctIndex<4);answered++;
  await assert.rejects(()=>offline.submitTriviaAnswer(question.attemptId,0),/expired/i,'An attempt may be graded only once');
 }
}
const pending=await offline.fetchTriviaQuestion('ROOKIE');await assert.rejects(()=>offline.submitTriviaAnswer(pending.attemptId,4),/answer/i);assert.equal((await offline.submitTriviaAnswer(pending.attemptId,0)).xpAwarded,0,'An invalid selection cannot consume the live attempt');
let cloudCalls=0;
const fallback=runtime(async()=>{cloudCalls++;return{error:Error('Offline')};});const local=await fallback.fetchTriviaQuestion('ROOKIE');await fallback.submitTriviaAnswer(local.attemptId,0);const afterFetch=cloudCalls;await assert.rejects(()=>fallback.submitTriviaAnswer(local.attemptId,0),/expired/i);assert.equal(cloudCalls,afterFetch,'Expired offline attempts must not be sent to the online grader');
const malformed=runtime(async name=>name==='get_ball_knower_trivia_question'?{data:[{attempt_id:1,question_id:1,tier:'ROOKIE',question:'Bad server choices',answers:['A','A','C','D']}]}:{data:[{is_correct:true,correct_index:7,xp_awarded:20,progression_recorded:true}]});assert((await malformed.fetchTriviaQuestion('ROOKIE')).practiceOnly,'Malformed server choices fall back to usable offline practice');await assert.rejects(()=>malformed.submitTriviaAnswer(1,0),/score|scoring|answer/i,'Malformed grading receipts cannot award local progress');
const empty={xp:0,level:1,currentStreak:0,longestStreak:0,totalCorrect:0,totalAnswered:0,highScores:{},daily:{}};
assert.equal(engine.recordGauntletRun(empty,'TRIVIA:ROOKIE',0,0).xp,0,'An empty round cannot award a perfect-round bonus');
console.log(`PASS ${answered} offline questions across all tiers, zero rewards, one-time grading, invalid-selection recovery, no expired-attempt network writes, malformed choices/receipts and empty-round rewards`);
