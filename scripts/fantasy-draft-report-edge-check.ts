import assert from 'node:assert/strict';
import {
  buildFantasyDraftReports,
  type FantasyDraftReportPick,
  type FantasyDraftReportPosition,
  type FantasyDraftReportTeam,
} from '../fantasyDraftReport';

const pick=(overall:number,position:FantasyDraftReportPosition,projectedPoints:number|null,overallRank=overall,playerName=`P${overall}`):FantasyDraftReportPick=>({
  overall,position,projectedPoints,overallRank,playerName,
});

const baseTeam=(memberId:string):FantasyDraftReportTeam=>({memberId,picks:[
  pick(1,'QB',300),
  pick(2,'RB',300),pick(3,'RB',290),
  pick(4,'WR',300),pick(5,'WR',290),
  pick(6,'TE',250),
  pick(7,'K',120),pick(8,'DST',115),
  pick(9,'RB',200),
  pick(10,'WR',195),pick(11,'WR',190),
  pick(12,'QB',180),pick(13,'TE',170),pick(14,'RB',160),pick(15,'WR',150),
]});

const projectedBench=baseTeam('projected-bench');
const unknownBench=baseTeam('unknown-bench');
unknownBench.picks=unknownBench.picks.map(item=>item.overall>=10?{...item,projectedPoints:null}:item);
const benchReports=buildFantasyDraftReports([projectedBench,unknownBench],15);
assert.ok(
  benchReports.get('projected-bench')!.benchScore>benchReports.get('unknown-bench')!.benchScore,
  'unprojected RB/WR/TE backups must not receive the same usable-depth credit as projected backups',
);
assert.notEqual(
  benchReports.get('unknown-bench')!.confidence,'High',
  'unknown bench data must also reduce report confidence when coverage falls materially',
);

const threeTe=baseTeam('three-te');
threeTe.picks[14]={...threeTe.picks[14],position:'TE',playerName:'Third TE'};
const fourTe=baseTeam('four-te');
fourTe.picks[10]={...fourTe.picks[10],position:'TE',playerName:'Third TE'};
fourTe.picks[14]={...fourTe.picks[14],position:'TE',playerName:'Fourth TE'};
const teReports=buildFantasyDraftReports([threeTe,fourTe],15);
assert.ok(
  teReports.get('three-te')!.benchScore>teReports.get('four-te')!.benchScore,
  'a fourth TE must not improve bench quality when the report already penalizes TE hoarding',
);
assert.ok(
  teReports.get('four-te')!.weaknesses.some(value=>/backup tight ends/i.test(value)),
  'four or more TEs must produce a matching user-facing roster risk',
);

const threeQb=baseTeam('three-qb');
threeQb.picks[14]={...threeQb.picks[14],position:'QB',playerName:'Third QB'};
const threeQbReport=buildFantasyDraftReports([threeQb,baseTeam('qb-control')],15).get('three-qb')!;
assert.ok(
  threeQbReport.weaknesses.some(value=>/backup quarterbacks/i.test(value)),
  'the three-QB warning threshold must match the point where construction scoring begins penalizing QB hoarding',
);

const flexSurplus:FantasyDraftReportTeam={memberId:'flex-surplus',picks:[
  pick(1,'QB',300),pick(2,'RB',250),pick(3,'WR',245),pick(4,'WR',240),pick(5,'WR',235),
  pick(6,'TE',220),pick(7,'K',130),pick(8,'DST',125),
]};
const flexReport=buildFantasyDraftReports([flexSurplus,baseTeam('flex-control')],15).get('flex-surplus')!;
assert.ok(flexReport.weaknesses.some(value=>/RB is missing 1 required starter/i.test(value)),'the actual missing RB starter must be reported');
assert.ok(!flexReport.weaknesses.some(value=>/FLEX spot/i.test(value)),'the third WR must remain eligible for FLEX despite another missing base starter');

const missingStarter=baseTeam('missing-starter');
missingStarter.picks=missingStarter.picks.map(item=>item.position==='QB'?{...item,position:'WR' as const,playerName:`Converted ${item.playerName}`}:item);
missingStarter.picks[1]={...missingStarter.picks[1],position:'DST',playerName:'Extra DST'};
const missingStarterReport=buildFantasyDraftReports([missingStarter,baseTeam('starter-control')],15).get('missing-starter')!;
assert.equal(missingStarterReport.weaknesses[0],'QB is missing 1 required starter.','missing required starters must outrank generic depth and hoarding warnings');
assert.match(missingStarterReport.explanation,/Risk: QB is missing 1 required starter/i,'the visible report explanation must lead with the illegal lineup risk');

const starterConfidence=baseTeam('starter-confidence');
starterConfidence.picks[11]={...starterConfidence.picks[11],position:'WR',playerName:'Converted Backup QB'};
starterConfidence.picks=starterConfidence.picks.map(item=>(item.position==='QB'||item.position==='DST')?{...item,projectedPoints:null}:item);
assert.equal(starterConfidence.picks.filter(item=>item.projectedPoints!==null).length,13,'confidence fixture must preserve 13 of 15 aggregate projections');
const starterConfidenceReport=buildFantasyDraftReports([starterConfidence,baseTeam('confidence-control')],15).get('starter-confidence')!;
assert.notEqual(starterConfidenceReport.confidence,'High','missing required QB/DST projection data must prevent a High confidence label');
assert.match(starterConfidenceReport.confidenceNote,/starter\/FLEX projection coverage/i,'confidence text must disclose required-lineup projection coverage');

console.log('Fantasy draft report edge checks passed: usable bench data, TE/QB hoarding, FLEX legality, missing-starter priority, and starter-aware confidence.');
