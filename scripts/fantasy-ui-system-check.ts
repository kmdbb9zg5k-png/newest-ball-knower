import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFantasyPowerRankings,
  fantasyAvailability,
  fantasyGameHasStarted,
  fantasyPlayerAction,
  fantasyPlayerMarketAvailability,
  lineupChangeCount,
} from '../fantasyUiSystem';
import { buildFantasyDraftReports, type FantasyDraftReportPosition } from '../fantasyDraftReport';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const main = read('main.tsx');
const nav = read('Navbar.tsx');
const league = read('FantasyLeaguePostDraft.tsx');
const lobby = read('LeagueLobby.tsx');
const player = read('FantasyPlayerDetail.tsx');
const draft = read('LeagueLiveDraftRoom.tsx');
const styles = read('index.css');
const matchupMobileFix = read('fantasyMatchupMobileFix.css');
const fantasyHub = read('FantasyHub.tsx');
const fantasyHubStyles = read('fantasyHub.css');
const portraitHelper = read('playerPortraits.ts');
const portraitRegistry = read('licensedPlayerPortraits.ts');

assert.deepEqual(fantasyPlayerAction('mine', 'Jalen Hurts'), { kind: 'manage', label: 'MANAGE LINEUP' });
assert.deepEqual(fantasyPlayerAction('opponent', 'Jalen Hurts'), { kind: 'trade', label: 'TRADE FOR JALEN HURTS' });
assert.deepEqual(fantasyPlayerAction('free_agent'), { kind: 'add', label: 'ADD' });
assert.deepEqual(fantasyPlayerAction('waiver'), { kind: 'claim', label: 'CLAIM' });
assert.equal(fantasyAvailability('instant'), 'free_agent');
assert.equal(fantasyAvailability('continuous'), 'waiver');
const now = Date.parse('2026-09-11T12:00:00Z');
assert.equal(fantasyGameHasStarted({ kickoffAt: '2026-09-10T23:00:00Z', isFinal: true }, now), true);
assert.equal(fantasyGameHasStarted({ kickoffAt: '2026-09-13T17:00:00Z' }, now), false);
assert.equal(fantasyPlayerMarketAvailability('instant', false, { kickoffAt: '2026-09-10T23:00:00Z', isFinal: true }, now), 'waiver', 'a player who played last night cannot remain an immediate add');
assert.equal(fantasyPlayerMarketAvailability('instant', true, { kickoffAt: '2026-09-13T17:00:00Z' }, now), 'waiver', 'an explicit dropped-player waiver remains a claim');
assert.equal(fantasyPlayerMarketAvailability('instant', false, { kickoffAt: '2026-09-13T17:00:00Z' }, now), 'free_agent');

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

assert.ok(app.includes('const showProductChrome=!isIntroOpen&&!showFavoriteTeam'), 'intro and favorite-team takeovers must hide both app bars and page content');
assert.ok(app.includes('{showProductChrome&&<Navbar') && app.includes('{showProductChrome&&<main'), 'product chrome must render only after the intro flow is complete');
assert.ok(nav.includes('58px+env(safe-area-inset-top)') && styles.includes('padding-bottom: calc(6rem + env(safe-area-inset-bottom))'), 'fantasy screens must reserve both iPhone safe areas and the compact fantasy app bar');
assert.ok(styles.includes('@supports (-webkit-touch-callout: none)') && styles.includes('content-visibility: auto') && styles.includes('-webkit-backdrop-filter: none !important'), 'iPhone Fantasy surfaces must avoid unbounded WebKit compositing and off-screen row rendering');
assert.ok(portraitHelper.includes('width = 160') && portraitRegistry.includes('width = 160'), 'compact Fantasy rows must request memory-safe player thumbnails instead of full-size portraits');

assert.match(league, /label: "My Team"[\s\S]*label: "Matchup"[\s\S]*label: "Add Players"[\s\S]*label: "League"/, 'primary fantasy navigation must expose the approved four destinations');
assert.equal((league.match(/<LeaguePageBackButton onBack=\{backFromTab\} \/>/g) || []).length, 4, 'every primary fantasy league page must expose the shared back control');
assert.ok(league.includes('aria-label="Back to previous page"') && league.includes('h-11 w-11'), 'the shared back control must be labeled and meet the 44px mobile touch target');
assert.ok(
  league.includes('const tabHistory = useRef<Tab[]>([])') &&
  league.includes('tabHistory.current.push(tab)') &&
  league.includes('const previous = tabHistory.current.pop()') &&
  league.includes('else onBack()'),
  'fantasy page back controls must return through the actual league-page history before leaving the league',
);
assert.ok(
  lobby.includes('onBack: () => void') &&
  lobby.includes('onBack={onBack}') &&
  app.includes('const tabHistory=useRef<AppTab[]>([])') &&
  app.includes('tabHistory.current.push(current)') &&
  app.includes("return previous||'home'") &&
  app.includes('onBack={goBack}'),
  'league back navigation must continue through the actual app-page history with Home as the safe root',
);
assert.ok(league.includes('leagueNavItems') && league.includes('Standings') && league.includes('Power') && league.includes('Trades'), 'secondary league tools must live inside League');
assert.ok(league.includes('"Lineup Valid"') && !league.includes('"Lineup ready"'), 'lineup legality must not claim an optimized lineup');
assert.ok(league.includes('Optimize Lineup') && league.includes('Save Changes ({lineupChanges})') && league.includes('lineupDirty &&'), 'lineup suggestions and save controls must be dirty-state aware');
assert.ok(league.includes('fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))]') && league.includes('md:sticky'), 'dirty lineup saves must remain visible above the mobile app bar without changing desktop behavior');
assert.ok(league.includes('weeklyContextFor(player)') && league.includes('weekContext?.opponentText') && league.includes('weekContext?.projection'), 'lineup rows must prioritize weekly opponent and projection context');
assert.ok(league.includes('selectedPlayerAvailability === "waiver" ? "Submit Waiver Claim"') && league.includes('dropRequired ? "Add & Drop" : "Add Player"'), 'the simplified add/drop sheet must use distinct immediate-add and waiver actions');
assert.ok(league.includes('Step 1 · Select Player to Drop') && league.includes('dropGroups.map') && league.includes('h-[100dvh]'), 'Add Players must use the simple full-screen mobile roster picker');
assert.ok(league.includes('dropLockedFor(player)') && league.includes('<LockKeyhole') && league.includes('gameLockedFor(player)'), 'started lineup players must render as unavailable drop choices');
assert.ok(league.includes('activeWaiverIds') && league.includes('moveAvailabilityFor(player)') && league.includes('Immediate adds stay open only until each player'), 'started and explicitly waived free agents must move out of immediate adds');
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
assert.ok(fantasyHub.includes('displayLeagues.map') && fantasyHub.includes('LeagueDestinationCard'), 'Fantasy HQ league cards must render the live league state');
assert.ok(fantasyHub.includes('enterPublicLeague()') && fantasyHub.includes('onOpenCreateLeague') && fantasyHub.includes('onOpenJoinLeague') && fantasyHub.includes('onSelectLeague'), 'Fantasy HQ must preserve public, create, join, and saved-league actions');
assert.ok(fantasyHub.includes('triggerRef={guideTriggerRef}') && fantasyHub.includes('guideTriggerRef.current?.click()'), 'Fantasy HQ navigation and help banner must share one ModeGuide dialog');
assert.ok(fantasyHubStyles.includes('grid-template-columns: repeat(3, minmax(0, 1fr))') && fantasyHubStyles.includes('bk-fantasy-league-card--featured'), 'Fantasy HQ must keep equal premium league tools and a featured league destination');
assert.ok(fantasyHubStyles.includes('prefers-reduced-motion: reduce') && fantasyHubStyles.includes('[data-motion="off"]'), 'Fantasy HQ stadium motion must honor both OS and broadcast motion controls');

console.log('Fantasy UI system checks passed: ownership, navigation, weekly lineup context, safe areas, contained FLEX/WRT rows, rankings, Player Card actions, draft reports, and draft chat.');
