import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('../FantasyLeaguePostDraft.tsx', import.meta.url), 'utf8');
const parity = readFileSync(new URL('../fantasyLeagueParityCloud.ts', import.meta.url), 'utf8');
const scoring = readFileSync(new URL('../api/fantasy-live-scoring.ts', import.meta.url), 'utf8');
const comparison = screen.slice(screen.indexOf('const HeadToHeadMatchup'), screen.indexOf('const Rule'));

assert.ok(!screen.includes('const MatchupRoster'), 'the stacked roster component must be completely removed');
assert.ok(!screen.includes('<MatchupRoster'), 'the matchup screen must not render stacked rosters');
assert.match(comparison, /aria-label={`\$\{displayManagerName\(away\)\} versus \$\{displayManagerName\(home\)\}`}/, 'the matchup must announce both teams as one head-to-head surface');
assert.match(comparison, /TeamMatchupHeader member={away}[\s\S]*>VS<[\s\S]*TeamMatchupHeader member={home}/, 'away must stay left and home must stay right');
assert.match(comparison, /LINEUP_SLOTS\.map/, 'the comparison must render the canonical ordered lineup slots');
assert.match(comparison, /grid-cols-\[minmax\(0,1fr\)_42px_minmax\(0,1fr\)\]/, 'each slot must be one balanced horizontal row');
assert.ok(comparison.includes('"FLEX/WRT"') && comparison.includes('"DST"'), 'FLEX/WRT and DST labels must use fantasy terminology');
assert.match(comparison, /MatchupPlayerSide player={awayPlayer}[\s\S]*MatchupPlayerSide player={homePlayer}/, 'corresponding players must be directly across from each other');
assert.ok(comparison.includes('Projected matchup advantage') && comparison.includes('Matchup advantage unavailable'), 'projection advantage must be data-gated');
assert.ok(screen.includes('member?.userAvatar'), 'team avatars must display when available');
assert.ok(comparison.includes('Opponent unavailable'), 'missing opponent metadata must have a truthful unavailable state');
assert.ok(comparison.includes('player.isHome === false ? "@" : "vs"'), 'NFL home and away designation must be explicit');
assert.ok(comparison.includes('player.isBye') && screen.includes('teamGames.length === 17'), 'bye labels must require a complete verified team schedule');
assert.ok(screen.includes('ball-knower:matchup-week:') && screen.includes('ball-knower:matchup-id:'), 'selected matchup state must survive refresh and player-card close');
assert.ok(comparison.includes('space-y-2') && screen.includes('aria-expanded={showAllMatchups}'), 'the primary matchup must remain visually separate from an on-demand league matchup picker');
assert.ok(screen.includes('aria-labelledby="all-matchups-title"') && screen.includes('role="dialog"'), 'All Matchups must open as a dedicated league matchup picker');
assert.ok(screen.includes('weekMatchups.map') && screen.includes('setViewedMatchupId(game.id)') && screen.includes('setShowAllMatchups(false)'), 'selecting any league matchup must close the picker and load the full comparison');
assert.ok(screen.includes('All matchups fantasy week') && screen.includes('visibleStandings.find'), 'the league matchup picker must support week changes and show team records');
assert.ok(screen.includes('aria-label="Previous fantasy week"') && screen.includes('aria-label="Next fantasy week"'), 'mobile week navigation must expose reliable previous and next controls');
assert.ok(screen.includes('Promise.allSettled') && screen.includes('parityViewCacheRef'), 'partial requests and week switching must preserve the last good week-specific data');
assert.match(screen, /<FantasyPlayerDetail[\s\S]*player={detailPlayer}/, 'matchup players must use the shared fantasy player detail component');

assert.ok(parity.includes('seasonGames') && parity.includes("teamGames.length === 17") === false, 'the parity layer must return the authoritative full-season NFL schedule');
assert.ok(parity.includes('hasProjectedTotal') && parity.includes('projectionAvailable'), 'projection availability must be carried independently from numeric zero');
assert.ok(scoring.includes("status:game?.game_status||'Opponent unavailable'"), 'the scorer must not turn missing schedule metadata into a fake bye');
assert.ok(scoring.includes('projectionAvailable') && scoring.includes('hasProjectedTotal'), 'the scorer must persist projection availability for rows and totals');
assert.ok(!scoring.includes("game?'Scheduled':'Bye'"), 'the old fake-bye fallback must remain removed');

console.log('Matchup head-to-head checks passed.');
