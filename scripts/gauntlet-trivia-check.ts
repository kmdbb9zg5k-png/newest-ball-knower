import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{
  GAUNTLET_CATALOG,GAUNTLET_MODES,GAUNTLET_TIERS,buildDailyGauntlet,buildGauntletRound,
  compactGauntletProgressForCloud,mergeGauntletProgress,recordGauntletAnswer,recordGauntletRun,scenariosFor,shouldEliminateGauntletRun,type GauntletProgress,
}from'../gauntletEngine';
import{parseTriviaAnswers}from'../triviaValidation';

assert.equal(GAUNTLET_CATALOG.length,400,'Gauntlet must contain exactly 100 scenario IDs per mode.');
assert.equal(new Set(GAUNTLET_CATALOG.map(item=>item.id)).size,GAUNTLET_CATALOG.length,'Gauntlet scenario IDs must be unique.');
for(const mode of GAUNTLET_MODES){
 const modePool=GAUNTLET_CATALOG.filter(item=>item.mode===mode);assert.equal(modePool.length,100,`${mode} must have 100 scenarios.`);
 assert.equal(new Set(modePool.map(item=>item.family)).size,100,`${mode} must have 100 genuinely distinct situation families across tiers.`);
 assert.equal(new Set(modePool.map(item=>`${item.context}\n${item.prompt}`)).size,100,`${mode} must not reuse the same situation with harder wording.`);
 for(const tier of GAUNTLET_TIERS){
  const pool=scenariosFor(mode,tier);assert.equal(pool.length,25,`${mode} ${tier} must have 25 scenario families.`);
  assert.equal(new Set(pool.map(item=>item.family)).size,25,`${mode} ${tier} contains repeated families.`);
  const first=buildGauntletRound(mode,tier,10,'fixed-seed');const again=buildGauntletRound(mode,tier,10,'fixed-seed');
  assert.deepEqual(first.map(item=>item.id),again.map(item=>item.id),'Seeded rounds must be reproducible.');
  assert.equal(first.length,10,'A standard Gauntlet round must contain 10 challenges.');
  assert.equal(new Set(first.map(item=>item.family)).size,10,'A round cannot repeat a scenario family.');
  assert.notDeepEqual(first.map(item=>item.id),buildGauntletRound(mode,tier,10,'different-seed').map(item=>item.id),'Different seeds must create a different round or scenario variation.');
 }
}
for(const item of GAUNTLET_CATALOG){
 assert.equal(item.options.length,4,`${item.id} must have four answers.`);
 assert.equal(new Set(item.options).size,4,`${item.id} contains duplicate answers.`);
 assert(item.correct>=0&&item.correct<4,`${item.id} has an invalid answer key.`);
 assert(item.context.length>35&&item.prompt.length>25&&item.explanation.length>25,`${item.id} is too shallow.`);
}

const daily=buildDailyGauntlet('2026-08-28');const sameDaily=buildDailyGauntlet('2026-08-28');const nextDaily=buildDailyGauntlet('2026-08-29');
assert.equal(daily.length,5,'Daily Gauntlet must contain five challenges.');
assert.deepEqual(daily.map(item=>item.id),sameDaily.map(item=>item.id),'Every user must receive the same date-seeded Daily Gauntlet.');
assert.notDeepEqual(daily.map(item=>item.id),nextDaily.map(item=>item.id),'Daily Gauntlet must rotate by date.');
assert.equal(new Set(daily.slice(0,4).map(item=>item.mode)).size,4,'Daily Gauntlet must represent every non-trivia mode.');
const dailySurvivor=daily.findIndex(item=>item.mode==='SURVIVOR');assert(dailySurvivor>=0,'Daily must include Survivor.');
let dailyIndex=0;for(const item of daily){const eliminated=shouldEliminateGauntletRun(item.mode,false,'2026-08-28');assert.equal(eliminated,false,'A Daily Survivor miss cannot eliminate the run.');dailyIndex++;}
assert.equal(dailyIndex,5,'Daily must reach question five even when Survivor is missed.');
assert.equal(shouldEliminateGauntletRun('SURVIVOR',false),true,'A standalone Survivor miss must end that run.');

const empty:GauntletProgress={xp:0,level:1,currentStreak:0,longestStreak:0,totalCorrect:0,totalAnswered:0,highScores:{},daily:{}};
const streaked=recordGauntletAnswer(recordGauntletAnswer(empty,true,50),true,50);assert.equal(streaked.currentStreak,2);assert.equal(streaked.longestStreak,2);assert.equal(streaked.totalCorrect,2);
const reset=recordGauntletAnswer(streaked,false,50);assert.equal(reset.currentStreak,0);assert.equal(reset.longestStreak,2);
const completed=recordGauntletRun(reset,'FILM ROOM:HALL OF FAME',10,10,'2026-08-28');assert.equal(completed.highScores['FILM ROOM:HALL OF FAME'],10);assert.equal(completed.daily['2026-08-28'].completed,true);

const legacySix:GauntletProgress={xp:300,level:2,currentStreak:6,longestStreak:6,totalCorrect:6,totalAnswered:6,highScores:{'FILM ROOM:PRO':8},daily:{'2026-08-28':{score:4,completed:true}},updatedAt:100};
const resetOnDevice=recordGauntletAnswer(legacySix,false,50,{id:'answer:device-a-reset',occurredAt:200});
const staleCloudSix:{[K in keyof GauntletProgress]:GauntletProgress[K]}={...legacySix};
const resetAfterSync=mergeGauntletProgress(resetOnDevice,staleCloudSix);
assert.equal(resetAfterSync.currentStreak,0,'A newer wrong-answer event must beat a stale cloud streak of six.');
assert.equal(resetAfterSync.longestStreak,6,'Resetting current streak cannot regress longest streak.');

const sharedBase:GauntletProgress={xp:100,level:1,currentStreak:0,longestStreak:2,totalCorrect:10,totalAnswered:12,highScores:{'FILM ROOM:PRO':7},daily:{'2026-08-27':{score:5,completed:true}},updatedAt:1000};
let deviceA=sharedBase;for(let i=0;i<3;i++)deviceA=recordGauntletAnswer(deviceA,true,10,{id:`answer:device-a-${i}`,occurredAt:1100+i*100});
let deviceB=sharedBase;for(let i=0;i<2;i++)deviceB=recordGauntletAnswer(deviceB,true,20,{id:`answer:device-b-${i}`,occurredAt:1150+i*100});
deviceA=recordGauntletRun(deviceA,'FILM ROOM:PRO',9,10,'2026-08-28',{id:'run:device-a-daily',occurredAt:1450});
deviceB=recordGauntletRun(deviceB,'FILM ROOM:PRO',8,10,undefined,{id:'run:device-b-score',occurredAt:1350});
const merged=mergeGauntletProgress(deviceA,deviceB);
assert.equal(merged.xp,170,'Both devices’ independently earned XP must be retained exactly once.');
assert.equal(merged.totalAnswered,17,'Three Device A answers plus two Device B answers must all survive sync.');
assert.equal(merged.totalCorrect,15);assert.equal(merged.currentStreak,5);assert.equal(merged.longestStreak,5);
assert.equal(merged.highScores['FILM ROOM:PRO'],9,'High scores cannot regress.');assert.deepEqual(merged.daily['2026-08-28'],{score:9,completed:true});
assert.deepEqual(merged.daily['2026-08-27'],{score:5,completed:true},'Older Daily completion cannot regress.');
const repeated=mergeGauntletProgress(mergeGauntletProgress(merged,deviceA),deviceB);
assert.equal(repeated.xp,170,'Repeated sync must not duplicate XP.');assert.equal(repeated.totalAnswered,17,'Repeated sync must not duplicate answers.');assert.equal(repeated.totalCorrect,15);
assert.deepEqual(mergeGauntletProgress(deviceB,deviceA),merged,'Event-ledger merging must be commutative across devices.');
const compact=compactGauntletProgressForCloud(merged);assert.equal(Object.keys(compact.sync?.events||{}).length,0,'Cloud snapshot must not duplicate the canonical event rows.');assert.equal(compact.xp,merged.xp);

assert.deepEqual(parseTriviaAnswers([' A ','B','C','D']),['A','B','C','D']);
for(const malformed of [[null,'B','C','D'],['null','B','C',7],['A','B','C'],['A','B','C','  ']])assert.throws(()=>parseTriviaAnswers(malformed),'Frontend must reject malformed Trivia answers.');

const migration=readFileSync(new URL('../migrations/20260828_deep_gauntlet_and_1000_trivia.sql',import.meta.url),'utf8');
const generatedTemplates=(migration.match(/select 'deep_/g)||[]).length;
assert.equal(generatedTemplates,16,'Trivia expansion must define sixteen distinct generated views.');
assert(migration.includes("if v_count<1000"),'Trivia migration must refuse to ship fewer than 1,000 active questions.');
assert(migration.includes("jsonb_typeof(choice)<>'string'"),'Trivia source migration must reject null and non-string answer choices.');
const qaMigration=readFileSync(new URL('../migrations/20260828_fix_gauntlet_trivia_post_merge_qa.sql',import.meta.url),'utf8');
assert(qaMigration.includes('if v_unique<1000'),'QA migration must enforce 1,000 genuinely unique active prompts.');
assert(qaMigration.includes("jsonb_typeof(choice)<>'string'"),'QA migration must enforce four non-null string choices.');
const syncMigration=readFileSync(new URL('../migrations/20260828_gauntlet_progress_event_sync.sql',import.meta.url),'utf8');
assert(syncMigration.includes('primary key (user_id,event_id)'),'Progress events must be idempotent per user and event ID.');
assert(syncMigration.includes('enable row level security')&&syncMigration.includes('(select auth.uid())=user_id'),'Progress events must remain owner-scoped by RLS.');
const selector=readFileSync(new URL('../migrations/20260825_zzzzzzzzzz_trivia_dual_repeat_families.sql',import.meta.url),'utf8');
assert(selector.includes('limit 20')&&selector.includes('recent_family.family=coalesce(q.repeat_family,q.question_key)'),'Verified trivia must suppress recent question families across a full round.');
assert(selector.includes('recent_template.template_family=q.template_family'),'Verified trivia must rotate prompt templates.');

console.log(`Gauntlet/trivia check passed: ${GAUNTLET_CATALOG.length} distinct tier-specific situations, Daily completion, idempotent event-ledger sync, strict answer validation, and 1,000+ unique server prompts.`);
