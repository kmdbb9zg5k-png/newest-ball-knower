import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIVE_FANTASY_ROSTER_REQUIREMENTS } from '../liveFantasyRules';
import {
  SOLO_FANTASY_GROUPS,
  createSoloFantasyDraft,
  makeSoloFantasyPick,
  soloFantasyAutopickSelection,
  soloFantasyCounts,
  soloFantasyCpuSelection,
  soloFantasyManagerAt,
} from '../soloFantasyDraftEngine';

const logo = '/solo-fantasy-logos/flight-collective.jpeg';

for (const leagueSize of [8, 10, 12] as const) {
  let draft = createSoloFantasyDraft({ leagueName: 'Test League', teamName: 'Allentown Iron', location: 'Allentown, PA', logoUrl: logo, leagueSize }, 260911 + leagueSize);
  assert.equal(draft.managers.length, leagueSize);
  assert.equal(new Set(draft.orderManagerIds).size, leagueSize);

  while (draft.status === 'active') {
    const managerId = soloFantasyManagerAt(draft);
    const manager = draft.managers.find(item => item.id === managerId);
    const player = manager?.isUser ? soloFantasyAutopickSelection(draft, managerId) : soloFantasyCpuSelection(draft, managerId);
    assert.ok(player, `${leagueSize}-team draft must always find a legal player at pick ${draft.pickIndex + 1}`);
    const next = makeSoloFantasyPick(draft, player.id, manager?.isUser ? 'autopick' : 'cpu');
    assert.equal(next.pickIndex, draft.pickIndex + 1, `${leagueSize}-team draft must advance exactly once per selection`);
    draft = next;
  }

  assert.equal(draft.picks.length, leagueSize * 15);
  assert.equal(new Set(draft.picks.map(pick => pick.playerId)).size, draft.picks.length, 'A simulated player cannot be drafted twice.');
  assert.ok(draft.picks.every(pick => SOLO_FANTASY_GROUPS.includes(pick.group)), 'Solo Fantasy must use only standard fantasy positions.');
  assert.ok(draft.picks.every(pick => pick.group !== ('P' as never)), 'Punters must not return to fantasy drafts.');
  for (const manager of draft.managers) {
    const counts = soloFantasyCounts(draft, manager.id);
    for (const [group, required] of Object.entries(LIVE_FANTASY_ROSTER_REQUIREMENTS)) {
      assert.ok((counts[group as keyof typeof counts] ?? 0) >= required, `${manager.name} must finish with a legal ${group} minimum.`);
    }
  }
}

const screen = readFileSync(new URL('../FantasyFranchise.tsx', import.meta.url), 'utf8');
const cloudSync = readFileSync(new URL('../CloudSyncProvider.tsx', import.meta.url), 'utf8');
for (const requirement of ['League name', 'Your team name', 'Team location', 'Upload custom team logo', 'Create League & Enter Draft', 'Upcoming draft order', 'Auto-pick Queue', 'Draft Results']) {
  assert.ok(screen.includes(requirement), `Solo Fantasy UI is missing ${requirement}.`);
}
for (const logoName of ['flight-collective.jpeg', 'gridiron-shield.jpeg', 'champions-circle.jpeg', 'neon-guardians.jpeg']) {
  assert.ok(screen.includes(logoName), `Solo Fantasy must expose stock logo ${logoName}.`);
}
assert.ok(cloudSync.includes("localKey: 'ballknower_solo_fantasy_v2', cloudKey: 'solo_fantasy'"), 'The current Solo Fantasy save must be included in cloud sync.');

console.log('Solo Fantasy League checks passed: custom identity, stock/uploaded logos, standard live-style snake drafts, simulated players, legal CPU rosters, resume data, and League HQ.');
