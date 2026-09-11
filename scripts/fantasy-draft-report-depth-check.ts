import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildFantasyDraftReports, type FantasyDraftReportPosition } from '../fantasyDraftReport';
import { FantasyDraftAnalysis } from '../FantasyDraftAnalysis';

const positions: FantasyDraftReportPosition[] = ['QB','RB','RB','WR','WR','TE','RB','K','DST','WR','WR','QB','TE','RB','WR','RB','WR','TE','WR','RB'];
const team = (memberId: string, scale = 1, count = 15) => ({ memberId, picks: positions.slice(0,count).map((position,index) => ({ overall:index+1, playerName:`${memberId}-${index}`, position, projectedPoints:(320-index*9)*scale, overallRank:index+1 })) });
for (const size of [6,8,10,12,14,16]) {
  for (const rosterSize of [15,16,17,18,19,20]) {
    const teams=Array.from({length:size},(_,index)=>team(`team-${size}-${index}`,0.8+index*0.04,rosterSize));
    const reports=buildFantasyDraftReports(teams,14);
    assert.equal(reports.size,size);
    assert.equal([...reports.values()].reduce((sum,report)=>sum+report.projectedWins,0),size*7);
    assert.ok([...reports.values()].every(report=>report.projectedWins+report.projectedLosses===14));
    const stronger=reports.get(`team-${size}-${size-1}`)!;
    const weaker=reports.get(`team-${size}-0`)!;
    assert.ok(stronger.projectionScore>weaker.projectionScore);
    assert.ok(stronger.projectedWins>weaker.projectedWins);
    assert.deepEqual(buildFantasyDraftReports([...teams].reverse(),14),new Map([...reports].reverse()),'reports must not depend on input ordering');
  }
}
const balanced=team('balanced');
const hoarder=team('hoarder');
hoarder.picks=hoarder.picks.map((pick,index)=>index<9?pick:{...pick,position:(index%2?'QB':'K') as FantasyDraftReportPosition});
const shapes=buildFantasyDraftReports([balanced,hoarder],14);
assert.ok(shapes.get('balanced')!.constructionScore>shapes.get('hoarder')!.constructionScore);
assert.ok(shapes.get('balanced')!.benchScore>shapes.get('hoarder')!.benchScore);
const value=team('value');
value.picks[2]={...value.picks[2],overall:30,overallRank:10,playerName:'Clear Steal'};
value.picks[4]={...value.picks[4],overall:5,overallRank:28,playerName:'Clear Reach'};
const report=buildFantasyDraftReports([value,team('control')],14).get('value')!;
assert.equal(report.bestValue?.playerName,'Clear Steal');
assert.equal(report.bestValue?.delta,20);
assert.equal(report.biggestReach?.delta,-23);
const markup=renderToStaticMarkup(React.createElement(FantasyDraftAnalysis,{report}));
for (const text of ['Full Draft Analysis','Strengths','Risks','Clear Steal','Clear Reach','Bench Quality','Projection Confidence',report.confidenceNote]) assert.ok(markup.includes(text.replace(/'/g,'&#x27;')),`draft disclosure must render ${text}`);
assert.ok(markup.includes('<details')&&markup.includes('<summary'));
assert.ok(markup.includes('min-h-11')&&markup.includes('overflow-wrap:anywhere'));
const nearTie=[team('near-a'),team('near-b')];
nearTie[0].picks[0].projectedPoints+=0.01;
const stable=[...buildFantasyDraftReports(nearTie,14).values()];
assert.ok(Math.abs(stable[0].score-stable[1].score)<=1,'tiny projection changes must not swing the entire grade');
assert.ok(Math.abs(stable[0].projectedWins-stable[1].projectedWins)<=1,'tiny projection differences must not produce dramatic projected W-L splits');
assert.ok([...buildFantasyDraftReports([team('invalid-season')],NaN).values()].every(report=>Number.isFinite(report.projectedWins)));
const source=readFileSync(new URL('../fantasyDraftReport.ts',import.meta.url),'utf8');
assert.doesNotMatch(source,/\.ovr|salary|salaryCap|cap efficiency/i);
const draft=readFileSync(new URL('../LeagueLiveDraftRoom.tsx',import.meta.url),'utf8');
assert.ok(draft.includes('<ManagerAvatar')&&draft.includes('<FantasyDraftAnalysis report={myGrade}')&&draft.includes('<FantasyDraftAnalysis report={report}'));
assert.ok(draft.includes('report.benchScore')&&draft.includes('report.explanation'));
console.log('Draft report depth passed: 36 league-size/roster-size combinations, coherent W-L, deterministic ordering, legal depth, value/reach evidence, tiny-spread stability, and rendered disclosure.');
