import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFantasyPowerRankings,
  fantasyAvailability,
  fantasyPlayerAction,
  lineupChangeCount,
} from '../fantasyUiSystem';
import { buildFantasyDraftReports, type FantasyDraftReportPosition } from '../fantasyDraftReport';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const main = read('main.tsx');
const nav = read('Navbar.tsx');
const league = read('FantasyLeaguePostDraft.tsx');
const player = read('FantasyPlayerDetail.tsx');
const draft = read('LeagueLiveDraftRoom.tsx');
const reportEngine=read('fantasyDraftReport.ts');
const styles = read('index.css');
const matchupMobileFix = read('fantasyMatchupMobileFix.css');

assert.deepEqual(fantasyPlayerAction('mine', 'Jalen Hurts'), { kind: 'manage', label: 'MANAGE LINEUP' });
assert.deepEqual(fantasyPlayerAction('opponent', 'Jalen Hurts'), { kind: 'trade', label: 'TRADE FOR JALEN HURTS' });
assert.deepEqual(fantasyPlayerAction('free_agent'), { kind: 'add', label: 'ADD' });
assert.deepEqual(fantasyPlayerAction('waiver'), { kind: 'claim', label: 'CLAIM' });
assert.equal(fantasyAvailability('instant'), 'free_agent');
assert.equal(fantasyAvailability('continuous'), 'waiver');

assert.equal(lineupChangeCount({ QB: 'a', RB1: 'b' }, { QB: 'a', RB1: 'c', WR1: 'd' }), 2);
assert.equal(lineupChangeCount({ QB: 'a' }, { QB: 'a' }), 0);

const power = buildFantasyPowerRankings([
  { memberId: 'projection', memberName: 'Projection', wins: 2, losses: 1, ties: 0, pointsFor: 330, pointsAgainst: 300, rosterProjection: 2500, injuryCount: 0 },
  { memberId: 'record', memberName: 'Record', wins: 3, losses: 0, ties: 0, pointsFor: 315, pointsAgainst: 280, rosterProjection: 2100, injuryCount: 0 },
  { memberId: 'injured', memberName: 'Injured', wins: 2, losses: 1, ties: 0, pointsFor: 330, pointsAgainst: 300, rosterProjection: 2500, injuryCount: 5 },
]);
assert.equal(power.length, 3);
assert.ok(power.find(row => row.memberId === 'projection')!.score > power.find(row => row.memberId === 'injured')!.score, 'availability must affect fantasy power without using Madden OVR');
assert.deepEqual(power.map(row => row.rank), [1, 2, 3]);

const reportPositions: FantasyDraftReportPosition[] = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'RB', 'K', 'DST', 'WR', 'WR', 'QB', 'TE', 'RB', 'WR'];
const reportTeam = (memberId: string, projectionScale: number) => ({
  memberId,
  picks: reportPositions.map((position, index) => ({
    overall: index + 1,
    playerName: `${memberId}-${position}-${index}`,
    position,
    projectedPoints: (320 - index * 9) * projectionScale,
    overallRank: index + 1,
  })),
});
const draftReports = buildFantasyDraftReports([
  reportTeam('strong', 1.15),
  reportTeam('weak', 0.85),
], 15);
const strongReport = draftReports.get('strong')!;
const weakReport = draftReports.get('weak')!;
assert.equal(draftReports.size, 2, 'every completed draft team must receive a report');
assert.ok(strongReport.projectionScore > weakReport.projectionScore, 'projected roster strength must affect the grade');
assert.ok(strongReport.projectedWins > weakReport.projectedWins, 'stronger projected rosters must receive better projected records');
assert.equal(strongReport.projectedWins + weakReport.projectedWins, 15, 'league-relative projected records must conserve wins in a two-team model');
assert.match(strongReport.explanation, /projected scoring roster/i, 'draft grades must explain their projection basis');
assert.ok(strongReport.strengths.length>=1&&strongReport.weaknesses.length>=1,'every report must explain at least one strength and one risk/context point');
assert.ok(Number.isFinite(strongReport.benchScore)&&strongReport.benchQuality,'every report must score and label bench quality');
assert.match(strongReport.confidenceNote,/projection/i,'every report must disclose projection coverage/confidence');

const makePick=(overall:number,position:FantasyDraftReportPosition,projectedPoints:number|null,overallRank:number|null,name=`P${overall}`)=>({overall,position,projectedPoints,overallRank,playerName:name});
const balancedPositions:FantasyDraftReportPosition[]=['QB','RB','RB','WR','WR','TE','RB','K','DST','WR','RB','WR','TE','QB','WR'];
const hoarderPositions:FantasyDraftReportPosition[]=['QB','RB','RB','WR','WR','TE','RB','K','DST','QB','QB','QB','K','DST','TE'];
const balanced={memberId:'balanced',picks:balancedPositions.map((position,index)=>makePick(index+1,position,260-index*7,index+1,`Balanced ${index}`))};
const hoarder={memberId:'hoarder',picks:hoarderPositions.map((position,index)=>makePick(index+1,position,260-index*7,index+1,`Hoarder ${index}`))};
const constructionReports=buildFantasyDraftReports([balanced,hoarder],15);
assert.ok(constructionReports.get('balanced')!.constructionScore>constructionReports.get('hoarder')!.constructionScore,'balanced RB/WR depth must beat QB/K/DST hoarding in construction');
assert.ok(constructionReports.get('balanced')!.benchScore>constructionReports.get('hoarder')!.benchScore,'playable RB/WR bench depth must raise the bench score');
assert.ok(constructionReports.get('hoarder')!.weaknesses.some(value=>/quarterback|K\/D\/ST|depth/i.test(value)),'hoarding must produce a specific roster-risk explanation');

const valueTeam=reportTeam('value',1);
valueTeam.picks[2]={...valueTeam.picks[2],overall:30,overallRank:10,playerName:'Clear Steal'};
valueTeam.picks[4]={...valueTeam.picks[4],overall:5,overallRank:28,playerName:'Clear Reach'};
const valueReport=buildFantasyDraftReports([valueTeam,reportTeam('control',1)],15).get('value')!;
assert.equal(valueReport.bestValue?.playerName,'Clear Steal','the strongest meaningful value pick must be identified');
assert.equal(valueReport.bestValue?.delta,20,'best-value delta must be pick minus current fantasy rank');
assert.equal(valueReport.biggestReach?.playerName,'Clear Reach','the strongest meaningful reach must be identified');
assert.equal(valueReport.biggestReach?.delta,-23,'reach delta must remain negative when selected ahead of rank');

const missingTeam=reportTeam('missing',1);
missingTeam.picks=missingTeam.picks.map((pick,index)=>index<7?pick:{...pick,projectedPoints:null});
const missingReport=buildFantasyDraftReports([missingTeam,reportTeam('complete',1)],15).get('missing')!;
assert.notEqual(missingReport.confidence,'High','materially incomplete projections must lower confidence');
assert.match(missingReport.confidenceNote,/unavailable|coverage/i,'incomplete data must be disclosed rather than invented');

for(const size of [6,8,10,12,14,16]){
  const reports=buildFantasyDraftReports(Array.from({length:size},(_,index)=>reportTeam(`team-${size}-${index}`,1+index*.01)),15);
  assert.equal(reports.size,size,`${size}-team leagues must receive exactly one report per manager`);
  const wins=[...reports.values()].reduce((sum,item)=>sum+item.projectedWins,0);
  assert.equal(wins,Math.round(size*15/2),`${size}-team projected records must remain league-coherent`);
}
assert.doesNotMatch(reportEngine,/\.ovr|salary|salaryCap|cap efficiency/i,'standard fantasy draft grades must never use Madden OVR or salary-cap efficiency');

assert.ok(app.includes('const showProductChrome=!isIntroOpen&&!showFavoriteTeam'), 'intro and favorite-team takeovers must hide both app bars and page content');
assert.ok(app.includes('{showProductChrome&&<Navbar') && app.includes('{showProductChrome&&<main'), 'product chrome must render only after the intro flow is complete');
assert.ok(nav.includes('58px+env(safe-area-inset-top)') && styles.includes('padding-bottom: calc(6rem + env(safe-area-inset-bottom))'), 'fantasy screens must reserve both iPhone safe areas and the compact fantasy app bar');

assert.match(league, /label: "My Team"[\s\S]*label: "Matchup"[\s\S]*label: "Add Players"[\s\S]*label: "League"/, 'primary fantasy navigation must expose the approved four destinations');
assert.ok(league.includes('leagueNavItems') && league.includes('Standings') && league.includes('Power') && league.includes('Trades'), 'secondary league tools must live inside League');
assert.ok(league.includes('"Lineup Valid"') && !league.includes('"Lineup ready"'), 'lineup legality must not claim an optimized lineup');
assert.ok(league.includes('Optimize Lineup') && league.includes('Save Changes ({lineupChanges})') && league.includes('lineupDirty &&'), 'lineup suggestions and save controls must be dirty-state aware');
assert.ok(league.includes('fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))]') && league.includes('md:sticky'), 'dirty lineup saves must remain visible above the mobile app bar without changing desktop behavior');
assert.ok(league.includes('weeklyContextFor(player)') && league.includes('weekContext?.opponentText') && league.includes('weekContext?.projection'), 'lineup rows must prioritize weekly opponent and projection context');
assert.ok(league.includes('playerAvailability === "waiver" ? "Submit Claim" : "Add Player"'), 'free agents and waiver claims must use distinct actions');
assert.ok(league.includes('playerPosition') && league.includes('Weekly projection') && league.includes('Overall rank'), 'Add Players must keep mobile position and sorting controls');
assert.ok(league.includes('primaryAction={detailPrimaryAction') && league.includes('fantasyPlayerAction(detailOwnership'), 'shared Player Cards must receive ownership-aware primary actions');
assert.ok(
  league.includes('grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)]') &&
  league.includes('sm:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]') &&
  league.includes('"FLEX/WRT"') &&
  main.includes("import './fantasyMatchupMobileFix.css'") &&
  matchupMobileFix.includes('52px') &&
  matchupMobileFix.includes('overflow: hidden') &&
  matchupMobileFix.includes('white-space: nowrap'),
  'the FLEX/WRT matchup badge must stay contained in a dedicated phone-width center rail',
);
assert.ok(league.includes('pointsFor.toFixed(0)') && league.includes('pointsAgainst.toFixed(0)') && league.includes('standing.streak'), 'mobile standings must expose PF, PA and streak');
assert.ok(league.includes('buildFantasyPowerRankings') && league.includes('rosterProjection') && !read('fantasyUiSystem.ts').includes('ovr'), 'power rankings must use fantasy inputs, never Madden OVR');

assert.ok(player.includes('primaryAction') && player.includes('sticky bottom-0') && player.includes('env(safe-area-inset-bottom)'), 'Player Card actions must remain reachable above the iPhone home indicator');
assert.ok(player.includes('Rostered by') && player.includes('Available player'), 'Player Card must disclose ownership state');
assert.ok(draft.includes('bk-fantasy-sticky-nav') && draft.includes('Live Draft') && draft.includes('League Chat'), 'the live draft must share the fantasy system and keep league chat available');
assert.ok(draft.includes('Auto-pick Queue') && draft.includes('Recent Picks') && draft.includes('Your Roster'), 'draft recovery tools, recent picks and roster context must remain present');
assert.ok(draft.includes('Projected W-L') && draft.includes('Draft Grade') && draft.includes('report.explanation') && draft.includes('buildFantasyDraftReports'), 'completed draft cards must show every manager a grade explanation and projected record');
assert.ok(
  draft.includes('report.explanation') &&
  reportEngine.includes('Bench: ${benchQuality}') &&
  reportEngine.includes('Strength: ${uniqueStrengths[0]}') &&
  reportEngine.includes('Risk: ${uniqueWeaknesses[0]}'),
  'completed-draft cards must visibly render bench quality, a strength, and a risk through the report explanation',
);
assert.ok(
  draft.includes('report.explanation') &&
  reportEngine.includes('Best value:') &&
  reportEngine.includes('Biggest reach:') &&
  reportEngine.includes('Confidence: ${confidence}.'),
  'completed-draft cards must visibly render meaningful pick value and confidence context through the report explanation',
);

console.log('Fantasy UI system checks passed: ownership, navigation, weekly lineup context, safe areas, contained FLEX/WRT rows, rankings, rich draft reports, Player Card actions, and draft chat.');
