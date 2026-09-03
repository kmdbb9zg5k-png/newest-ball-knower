import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeTank01DefenseStats,normalizeTank01PlayerStats} from '../fantasyLiveScoring';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const detail=read('FantasyPlayerDetail.tsx');
const cloud=read('fantasyPlayerDetailsCloud.ts');
const api=read('api/fantasy-live-scoring.ts');

const qb=normalizeTank01PlayerStats({Passing:{passAttempts:39,passCompletions:26,passYds:301,passTD:3,int:1},Rushing:{rushAttempts:5,rushYds:31}});
assert.equal(qb.passingAttempts,39);
assert.equal(qb.passingCompletions,26);
assert.equal(qb.rushingAttempts,5);
const rb=normalizeTank01PlayerStats({Rushing:{carries:17,rushYds:88,rushTD:1},Receiving:{targets:6,receptions:4,recYds:35}});
assert.equal(rb.rushingAttempts,17);
assert.equal(rb.targets,6);
const wr=normalizeTank01PlayerStats({Receiving:{targets:11,receptions:7,recYds:102,recTD:1}});
assert.equal(wr.targets,11);
const kicker=normalizeTank01PlayerStats({Kicking:{fgMade:3,fgMissed:1,xpMade:2,xpMissed:0}});
assert.equal(kicker.fieldGoalsAttempted,4);
assert.equal(kicker.extraPointsAttempted,2);
const dst=normalizeTank01DefenseStats({sacks:4,fumblesRecovered:2,ptsAllowed:13});
assert.equal(dst.fumbleRecoveries,2);
assert.equal(dst.pointsAllowed,13);

for(const key of ['passingAttempts','passingCompletions','passingYards','passingTouchdowns','interceptionsThrown','rushingAttempts','rushingYards','rushingTouchdowns','targets','receptions','receivingYards','receivingTouchdowns','fieldGoalsAttempted','fieldGoalsMade','extraPointsAttempted','extraPointsMade','fumbleRecoveries','defensiveTouchdowns','pointsAllowed']){
  assert.ok(detail.includes(key),`Player detail must understand canonical ${key}`);
}
for(const key of ['passingAttempts','passingCompletions','rushingAttempts','targets','fieldGoalsAttempted','extraPointsAttempted']){
  assert.ok(api.includes(key),`Vercel scoring ingestion must persist canonical ${key}`);
}
assert.ok(api.includes('games.length!==272')&&api.includes('count!==17'),'schedule ingestion must reject anything short of 272 games and 17 games per team');
assert.ok(cloud.includes('byWeek.size !== 17')&&cloud.includes('if (conflicts.size'),'player schedule synthesis must fail closed on incomplete or conflicting 17-game schedules');
assert.ok(cloud.includes("const TEAM_ALIASES: Record<string, string> = { LA: 'LAR', WSH: 'WAS', JAC: 'JAX' }"),'team aliases must remain canonical across schedule/player identity');
assert.ok(cloud.includes('for (let week = 1; week <= 18; week += 1)')&&cloud.includes("status: 'Bye'")&&cloud.includes('isBye: true'),'a verified 17-game team schedule must produce one explicit bye across Weeks 1-18');
assert.ok(cloud.includes('stats: row.stats || {}')&&detail.includes("typeof value === 'number' && Number.isFinite(value) ? value : null"),'missing provider stats must remain unavailable instead of being coerced into display zero');
assert.ok(detail.includes('overflow-x-auto'),'position-specific game logs must remain horizontally scrollable on mobile');
assert.doesNotMatch(detail,/stats[^\n]{0,120}\.ovr|\.ovr[^\n]{0,120}stats/i,'Madden OVR must never populate player game-log statistics');
assert.ok(api.includes('stats:normalizeTank01PlayerStats(playerRaw)'),'historical backfill must persist canonical normalized player stats');
assert.ok(api.includes('stats:normalizeTank01DefenseStats(defenseRaw)'),'historical D/ST backfill must persist canonical defense stats');

console.log('Fantasy player data completeness checks passed: canonical usage stats, 17-game schedule/bye safety, D/ST fields, and honest missing-data behavior.');
