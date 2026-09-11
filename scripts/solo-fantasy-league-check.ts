import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getDraftPositionGroup } from '../rosterRules';
import {
  FANTASY_DRAFT_ROUNDS,
  FANTASY_ROSTER_REQUIREMENTS,
  createFantasyDraft,
  fantasyAvailablePlayers,
  fantasyDraftComplete,
  fantasyRosterPlayers,
  isValidFantasyDraftState,
  makeFantasyUserPick,
} from '../soloFranchiseEngine';
import { SOLO_TEAM_THEMES } from '../soloUniverse';

let draft = createFantasyDraft(SOLO_TEAM_THEMES[0].abbr, 260911);
while (!fantasyDraftComplete(draft)) {
  const player = fantasyAvailablePlayers(draft)[0];
  assert.ok(player, 'The user must always have a legal player available.');
  const previousPick = draft.pickIndex;
  draft = makeFantasyUserPick(draft, player.id);
  assert.ok(draft.pickIndex > previousPick, 'A user selection must advance through the CPU picks to the next user turn.');
}

assert.equal(FANTASY_DRAFT_ROUNDS, 53);
assert.equal(draft.picks.length, SOLO_TEAM_THEMES.length * FANTASY_DRAFT_ROUNDS);
assert.equal(new Set(draft.draftedIds).size, draft.draftedIds.length, 'A simulated player cannot be drafted twice.');
assert.ok(isValidFantasyDraftState(draft, true), 'The completed Madden-style draft must restore safely.');

for (const team of SOLO_TEAM_THEMES) {
  const roster = fantasyRosterPlayers(draft, team.abbr);
  assert.equal(roster.length, 53, team.name + ' must finish with a full 53-player roster.');
  const counts = roster.reduce<Record<string, number>>((result, player) => {
    const group = getDraftPositionGroup(player);
    result[group] = (result[group] ?? 0) + 1;
    return result;
  }, {});
  for (const [group, required] of Object.entries(FANTASY_ROSTER_REQUIREMENTS)) {
    assert.equal(counts[group] ?? 0, required, team.name + ' must satisfy the ' + group + ' roster requirement.');
  }
}

const screen = readFileSync(new URL('../FantasyFranchise.tsx', import.meta.url), 'utf8');
const season = readFileSync(new URL('../FranchiseSeason.tsx', import.meta.url), 'utf8');
const cloudSync = readFileSync(new URL('../CloudSyncProvider.tsx', import.meta.url), 'utf8');
for (const requirement of ['MADDEN-STYLE FANTASY FRANCHISE', 'League name', 'Your team name', 'Team location', 'Upload custom team logo', '32 teams · 53 rounds', 'Create League & Start Draft', 'START SEASON', '17-game season']) {
  assert.ok(screen.includes(requirement), 'Solo Fantasy UI is missing ' + requirement + '.');
}
for (const logoName of ['flight-collective.jpeg', 'gridiron-shield.jpeg', 'champions-circle.jpeg', 'neon-guardians.jpeg']) {
  assert.ok(screen.includes(logoName), 'Solo Fantasy must expose stock logo ' + logoName + '.');
}
for (const seasonRequirement of ['SIMULATE WEEK', 'SELECTION SUNDAY', 'BK LEAGUE PLAYOFFS', 'LEGACY BOWL', 'ENTER OFFSEASON DRAFT', 'userLogoUrl']) {
  assert.ok(season.includes(seasonRequirement), 'Madden-style season is missing ' + seasonRequirement + '.');
}
assert.ok(cloudSync.includes("localKey: 'ballknower_solo_fantasy_v2', cloudKey: 'solo_fantasy'"), 'The current Solo Fantasy save must be included in cloud sync.');
assert.ok(cloudSync.includes("localKey: 'ballknower_solo_fantasy_v2:season', cloudKey: 'solo_fantasy_season'"), 'The Madden-style season must be included in cloud sync.');

console.log('Solo Madden Fantasy Franchise checks passed: custom team identity, 32-team 53-round draft, complete simulated rosters, 17-game season, playoffs, Legacy Bowl, persistence, and offseason.');
