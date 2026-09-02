import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildFantasyPowerRankings,
  fantasyAvailability,
  fantasyPlayerAction,
  lineupChangeCount,
} from '../fantasyUiSystem';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const league = read('FantasyLeaguePostDraft.tsx');
const player = read('FantasyPlayerDetail.tsx');
const draft = read('LeagueLiveDraftRoom.tsx');
const styles = read('index.css');

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

assert.ok(app.includes('const showProductChrome=!isIntroOpen&&!showFavoriteTeam'), 'intro and favorite-team takeovers must hide both app bars and page content');
assert.ok(app.includes('{showProductChrome&&<Navbar') && app.includes('{showProductChrome&&<main'), 'product chrome must render only after the intro flow is complete');
assert.ok(styles.includes('top: calc(58px + env(safe-area-inset-top))') && styles.includes('padding-bottom: calc(6rem + env(safe-area-inset-bottom))'), 'fantasy screens must reserve both iPhone safe areas and the compact fantasy app bar');

assert.match(league, /label: "My Team"[\s\S]*label: "Matchup"[\s\S]*label: "Add Players"[\s\S]*label: "League"/, 'primary fantasy navigation must expose the approved four destinations');
assert.ok(league.includes('leagueNavItems') && league.includes('Standings') && league.includes('Power') && league.includes('Trades'), 'secondary league tools must live inside League');
assert.ok(league.includes('"Lineup Valid"') && !league.includes('"Lineup ready"'), 'lineup legality must not claim an optimized lineup');
assert.ok(league.includes('Optimize Lineup') && league.includes('Save Changes ({lineupChanges})') && league.includes('lineupDirty &&'), 'lineup suggestions and save controls must be dirty-state aware');
assert.ok(league.includes('weeklyContextFor(player)') && league.includes('weekContext?.opponentText') && league.includes('weekContext?.projection'), 'lineup rows must prioritize weekly opponent and projection context');
assert.ok(league.includes('playerAvailability === "waiver" ? "Submit Claim" : "Add Player"'), 'free agents and waiver claims must use distinct actions');
assert.ok(league.includes('playerPosition') && league.includes('Weekly projection') && league.includes('Overall rank'), 'Add Players must keep mobile position and sorting controls');
assert.ok(league.includes('primaryAction={detailPrimaryAction') && league.includes('fantasyPlayerAction(detailOwnership'), 'shared Player Cards must receive ownership-aware primary actions');
assert.ok(league.includes('grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)]') && league.includes('sm:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]'), 'matchup rows must protect the FLEX/WRT label from projection overlap at phone and desktop widths');
assert.ok(league.includes('pointsFor.toFixed(0)') && league.includes('pointsAgainst.toFixed(0)') && league.includes('standing.streak'), 'mobile standings must expose PF, PA and streak');
assert.ok(league.includes('buildFantasyPowerRankings') && league.includes('rosterProjection') && !read('fantasyUiSystem.ts').includes('ovr'), 'power rankings must use fantasy inputs, never Madden OVR');

assert.ok(player.includes('primaryAction') && player.includes('sticky bottom-0') && player.includes('env(safe-area-inset-bottom)'), 'Player Card actions must remain reachable above the iPhone home indicator');
assert.ok(player.includes('Rostered by') && player.includes('Available player'), 'Player Card must disclose ownership state');
assert.ok(draft.includes('bk-fantasy-sticky-nav') && draft.includes('Live Draft') && draft.includes('League Chat'), 'the live draft must share the fantasy system and keep league chat available');
assert.ok(draft.includes('Auto-pick Queue') && draft.includes('Recent Picks') && draft.includes('Your Roster'), 'draft recovery tools, recent picks and roster context must remain present');

console.log('Fantasy UI system checks passed: ownership, navigation, weekly lineup context, safe areas, matchup layout, rankings, Player Card actions, and draft chat.');
