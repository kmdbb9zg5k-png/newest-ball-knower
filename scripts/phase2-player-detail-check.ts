import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const detail = readFileSync(new URL('../FantasyPlayerDetail.tsx', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../fantasyPlayerDetailsCloud.ts', import.meta.url), 'utf8');
const postDraft = readFileSync(new URL('../FantasyLeaguePostDraft.tsx', import.meta.url), 'utf8');
const hub = readFileSync(new URL('../FantasyHub.tsx', import.meta.url), 'utf8');
const communications = readFileSync(new URL('../FantasyLeagueCommunications.tsx', import.meta.url), 'utf8');

assert.ok(detail.includes('loadFantasyPlayerWeeks({ id: player.id'), 'Player detail must load authoritative weekly history using the selected player identity.');
assert.ok(cloud.includes(".is('ball_knower_player_id', null)"), 'Weekly history must safely recover legacy score rows without an app player id.');
assert.match(cloud, /\.is\('ball_knower_player_id', null\)[\s\S]*?\.eq\('player_name', player\.name\)[\s\S]*?\.eq\('position', player\.position\)/, 'The same legacy query must require null app id, exact name, and exact position.');
assert.ok(!cloud.includes(".eq('team', player.team)"), 'Legacy identity fallback must retain history across NFL team changes.');
assert.ok(detail.includes("player?.name, player?.team, player?.position"), 'History must reload whenever a fallback identity field changes.');
assert.ok(detail.includes('Stored final points'), 'Partial stored history must not be labeled as a complete season total.');
assert.ok(detail.includes('projection_source_url'), 'Shared ranking details must preserve source provenance.');
assert.ok(detail.includes("event.key === 'Escape'"), 'Player details must close from the keyboard.');
assert.ok(detail.includes('Ball Knower will not invent missing stats'), 'Missing history must be disclosed instead of synthesized.');
assert.ok(detail.includes("useState<2026 | 2025>"), 'Player detail must expose 2026 and 2025 season views.');
assert.ok(cloud.includes("from('ball_knower_player_week_scores')"), 'Weekly detail must use the existing score source of truth.');
assert.ok(cloud.includes(".eq('ball_knower_player_id', player.id)"), 'Weekly history must query the permanent Ball Knower player identity.');
assert.ok(postDraft.includes('<FantasyPlayerDetail'), 'Online fantasy must render the reusable player detail surface.');
assert.ok(postDraft.includes('onOpenPlayer={(playerId)'), 'Matchup players must open the shared player detail surface.');
assert.ok(postDraft.includes('onOpenPlayer={(player) => openPlayerDetail(player, selectedTeam)}'), 'Other managers’ roster players must open the same detail surface.');
assert.ok(postDraft.includes('onClick={() => openPlayerDetail(player)}'), 'Free agents and waiver players must be inspectable without selecting a claim.');
assert.ok(postDraft.includes('const player = findPlayer(playerId);'), 'Historical matchup players must resolve outside current rosters.');
assert.ok(hub.includes('watchAction={{ watched: watchlist.includes'), 'Cheat Sheet details must preserve the My Guys action.');
assert.ok(hub.includes('<FantasyPlayerDetail'), 'Cheat Sheet rankings must open the shared detail surface.');
assert.ok(communications.includes('<FantasyPlayerDetail'), 'Trading Block entries must open the shared detail surface.');
assert.ok(communications.includes('onOpen={setDetailPlayer}'), 'Trading Block player buttons must wire into shared details.');

console.log('Phase 2 player detail checks passed: shared surface, permanent identity, honest history, and roster/matchup/free-agent entry points.');
