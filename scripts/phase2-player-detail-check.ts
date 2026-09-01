import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canMergeHistoricalProviderRows } from '../fantasyPlayerIdentity';

const detail = readFileSync(new URL('../FantasyPlayerDetail.tsx', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../fantasyPlayerDetailsCloud.ts', import.meta.url), 'utf8');
const postDraft = readFileSync(new URL('../FantasyLeaguePostDraft.tsx', import.meta.url), 'utf8');
const hub = readFileSync(new URL('../FantasyHub.tsx', import.meta.url), 'utf8');
const communications = readFileSync(new URL('../FantasyLeagueCommunications.tsx', import.meta.url), 'utf8');

assert.ok(detail.includes('loadFantasyPlayerWeeks({ id: player.id'), 'Player detail must load authoritative weekly history using the selected player identity.');

const discoveryNameMatches = cloud.match(/\.eq\('player_name', player\.name\)/g) || [];
const discoveryPositionMatches = cloud.match(/\.eq\('position', player\.position\)/g) || [];
assert.equal(discoveryNameMatches.length, 1, 'Exactly one name-based historical discovery query is allowed.');
assert.equal(discoveryPositionMatches.length, 1, 'Exactly one position-scoped historical discovery query is allowed.');

const discoveryStart = cloud.indexOf('// Older weekly rows can retain a superseded Ball Knower id.');
const discoveryEnd = cloud.indexOf('  ]);', discoveryStart);
assert.ok(discoveryStart >= 0 && discoveryEnd > discoveryStart, 'The historical discovery query must be explicitly scoped.');
const discoveryQuery = cloud.slice(discoveryStart, discoveryEnd);
assert.match(discoveryQuery, /\.eq\('player_name', player\.name\)[\s\S]*?\.eq\('position', player\.position\)/, 'Historical discovery must require exact name and exact position.');
assert.ok(!discoveryQuery.includes(".eq('team', player.team)"), 'Historical discovery must retain history across NFL team changes.');

const anchorStart = cloud.indexOf('  const identityRows =');
const anchorEnd = cloud.indexOf('  const rows = [...identityRows', anchorStart);
assert.ok(anchorStart >= 0 && anchorEnd > anchorStart, 'Historical identity anchoring must be isolated before row merging.');
const anchorLogic = cloud.slice(anchorStart, anchorEnd);
assert.ok(anchorLogic.includes('allFallbackRowsHaveProviderIds'), 'Every discovered historical row must have a provider identity.');
assert.ok(anchorLogic.includes('canMergeHistoricalProviderRows(identityProviderIds, fallbackProviderIds)'), 'Historical rows must pass the provider identity guard.');
assert.ok(anchorLogic.includes('const anchoredProviderId = canMergeFallback'), 'Only an accepted provider identity may be used for fallback merging.');
assert.ok(anchorLogic.includes('const anchoredFallbackRows = anchoredProviderId'), 'Fallback rows must be gated on the accepted provider identity.');

assert.equal(canMergeHistoricalProviderRows(['provider-a'], ['provider-a']), true, 'Matching single provider identities may merge.');
assert.equal(canMergeHistoricalProviderRows([], ['provider-a']), false, 'No current-player identity anchor must fail closed.');
assert.equal(canMergeHistoricalProviderRows(['provider-a'], ['provider-b']), false, 'Different provider identities must not merge.');
assert.equal(canMergeHistoricalProviderRows(['provider-a'], ['provider-a', 'provider-b']), false, 'Ambiguous historical provider identities must not merge.');
assert.equal(canMergeHistoricalProviderRows(['provider-a', 'provider-b'], ['provider-a']), false, 'Ambiguous current-player provider identities must not merge.');

assert.ok(cloud.includes(".eq('ball_knower_player_id', player.id)"), 'Weekly history must query the permanent Ball Knower player identity first.');
assert.ok(cloud.includes('No current-id rows means there is no trustworthy provider identity anchor.'), 'An empty current identity must fail closed instead of guessing a player from name and position.');
assert.ok(detail.includes("player?.name, player?.team, player?.position"), 'History must reload whenever a fallback identity field changes.');
assert.ok(detail.includes("type DetailTab = 'overview' | 'gameLog' | 'stats'"), 'Player details must expose Overview, Game Log, and Stats destinations.');
assert.ok(detail.includes('2026 Projection'), 'The player header must prioritize useful season projection data.');
assert.ok(detail.includes('Game Log') && detail.includes('<table'), 'Game Log must render a real weekly comparison table.');
assert.ok(detail.includes('overflow-x-auto'), 'The Game Log table must remain usable on narrow mobile screens.');
assert.ok(detail.includes('max-h-[92dvh]') && detail.includes('overflow-y-auto'), 'The full player sheet must remain scrollable in short mobile viewports.');
assert.ok(detail.includes('env(safe-area-inset-bottom)'), 'The player sheet must always preserve the iPhone bottom safe area.');
assert.ok(detail.includes('aria-label="Player detail sections"') && detail.includes('aria-pressed={tab === value}'), 'Section controls must expose selected ordinary-button state without claiming an incomplete ARIA tab pattern.');
assert.ok(!detail.includes('role="tab"') && !detail.includes('role="tablist"'), 'Section controls must not promise the full ARIA tab interaction unless keyboard navigation is implemented.');
assert.ok(detail.includes("ranking.actual_points_2025 !== null"), 'Unavailable 2025 totals must remain unavailable instead of coercing null to zero.');
assert.ok(detail.includes("return 'Opponent unavailable'"), 'Missing legacy opponent metadata must not be mislabeled as a bye.');
assert.ok(detail.includes('const displayedFantasyPoints = rankingTotal !== null'), 'Published 2025 fantasy totals must beat partial weekly backfill sums when available.');
assert.ok(detail.includes('Final Games Stored') && detail.includes('Avg / Stored Game'), 'Partial weekly history summaries must be labeled as stored rows rather than complete-season stats.');
assert.ok(!detail.includes('Stored final points'), 'Dead stored-history summary boxes must not dominate the player header.');
assert.ok(!detail.includes('Ball Knower will not invent missing stats'), 'Missing history must use a helpful product empty state instead of defensive copy.');
assert.ok(detail.includes('weekly game log is not available yet'), 'Missing weekly history must still be disclosed honestly.');
assert.ok(detail.includes('projection_source_url'), 'Shared ranking details must preserve source provenance.');
assert.ok(detail.includes("event.key === 'Escape'"), 'Player details must close from the keyboard.');
assert.ok(detail.includes("useState<2026 | 2025>"), 'Player detail must expose 2026 and 2025 season views.');
assert.ok(cloud.includes("from('ball_knower_player_week_scores')"), 'Weekly detail must use the existing score source of truth.');
assert.ok(postDraft.includes('<FantasyPlayerDetail'), 'Online fantasy must render the reusable player detail surface.');
assert.ok(postDraft.includes('onOpenAway={(playerId)') && postDraft.includes('onOpenHome={(playerId)'), 'Both sides of a matchup must open the shared player detail surface.');
assert.ok(postDraft.includes('onOpenPlayer={(player) => openPlayerDetail(player, selectedTeam)}'), 'Other managers’ roster players must open the same detail surface.');
assert.ok(postDraft.includes('onClick={() => openPlayerDetail(player)}'), 'Free agents and waiver players must be inspectable without selecting a claim.');
assert.ok(postDraft.includes('const player = findPlayer(playerId);'), 'Historical matchup players must resolve outside current rosters.');
assert.ok(hub.includes('watchAction={{ watched: watchlist.includes'), 'Cheat Sheet details must preserve the My Guys action.');
assert.ok(hub.includes('<FantasyPlayerDetail'), 'Cheat Sheet rankings must open the shared detail surface.');
assert.ok(communications.includes('<FantasyPlayerDetail'), 'Trading Block entries must open the shared detail surface.');
assert.ok(communications.includes('onOpen={setDetailPlayer}'), 'Trading Block player buttons must wire into shared details.');

console.log('Phase 2 player detail checks passed: decision-first modal, safe game log, executable identity guard, and shared entry points.');
