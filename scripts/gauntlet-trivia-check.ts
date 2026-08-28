import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{
  GAUNTLET_CATALOG,GAUNTLET_MODES,GAUNTLET_TIERS,buildDailyGauntlet,buildGauntletRound,
  recordGauntletAnswer,recordGauntletRun,scenariosFor,type GauntletProgress,
}from'../gauntletEngine';

assert.equal(GAUNTLET_CATALOG.length,400,'Gauntlet must contain exactly 100 scenario IDs per mode.');
assert.equal(new Set(GAUNTLET_CATALOG.map(item=>item.id)).size,GAUNTLET_CATALOG.length,'Gauntlet scenario IDs must be unique.');
for(const mode of GAUNTLET_MODES){
 const modePool=GAUNTLET_CATALOG.filter(item=>item.mode===mode);assert.equal(modePool.length,100,`${mode} must have 100 scenarios.`);
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

const empty:GauntletProgress={xp:0,level:1,currentStreak:0,longestStreak:0,totalCorrect:0,totalAnswered:0,highScores:{},daily:{}};
const streaked=recordGauntletAnswer(recordGauntletAnswer(empty,true,50),true,50);assert.equal(streaked.currentStreak,2);assert.equal(streaked.longestStreak,2);assert.equal(streaked.totalCorrect,2);
const reset=recordGauntletAnswer(streaked,false,50);assert.equal(reset.currentStreak,0);assert.equal(reset.longestStreak,2);
const completed=recordGauntletRun(reset,'FILM ROOM:HALL OF FAME',10,10,'2026-08-28');assert.equal(completed.highScores['FILM ROOM:HALL OF FAME'],10);assert.equal(completed.daily['2026-08-28'].completed,true);

const migration=readFileSync(new URL('../migrations/20260828_deep_gauntlet_and_1000_trivia.sql',import.meta.url),'utf8');
const generatedTemplates=(migration.match(/select 'deep_/g)||[]).length;
assert.equal(generatedTemplates,16,'Trivia expansion must define sixteen distinct generated views.');
assert(migration.includes("if v_count<1000"),'Trivia migration must refuse to ship fewer than 1,000 active questions.');
const selector=readFileSync(new URL('../migrations/20260825_zzzzzzzzzz_trivia_dual_repeat_families.sql',import.meta.url),'utf8');
assert(selector.includes('limit 20')&&selector.includes('recent_family.family=coalesce(q.repeat_family,q.question_key)'),'Verified trivia must suppress recent question families across a full round.');
assert(selector.includes('recent_template.template_family=q.template_family'),'Verified trivia must rotate prompt templates.');

console.log(`Gauntlet/trivia check passed: ${GAUNTLET_CATALOG.length} scenarios, 100 per mode, 25 per tier, 512-question server expansion.`);
