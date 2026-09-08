import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYERS_DATABASE, NFL_TEAMS } from '../players';
import {
  SOLO_PLAYERS_DATABASE,
  SOLO_TEAM_THEMES,
  SOLO_UNIVERSE_VERSION,
} from '../soloUniverse';
import {
  buildSoloTeamRoster,
  createFantasyDraft,
  fantasyAvailablePlayers,
  fantasyDraftComplete,
  makeFantasyUserPick,
  validateFranchiseRoster,
} from '../soloFranchiseEngine';
import { chooseSmartPick } from '../smartDraft';
import { DEFAULT_SALARY_CAP } from '../types';

assert.equal(SOLO_UNIVERSE_VERSION, 1);
assert.equal(SOLO_TEAM_THEMES.length, 32, 'Solo must have a complete 32-team fictional league.');
assert.equal(SOLO_PLAYERS_DATABASE.length, 32 * 53, 'Every simulated team must have 53 generated players.');
assert.equal(new Set(SOLO_TEAM_THEMES.map(team => team.abbr)).size, 32, 'Solo team abbreviations must be unique.');
assert.equal(new Set(SOLO_TEAM_THEMES.map(team => team.name)).size, 32, 'Solo team names must be unique.');
assert.equal(new Set(SOLO_PLAYERS_DATABASE.map(player => player.id)).size, SOLO_PLAYERS_DATABASE.length, 'Simulated player IDs must be unique.');
assert.equal(new Set(SOLO_PLAYERS_DATABASE.map(player => player.name)).size, SOLO_PLAYERS_DATABASE.length, 'Simulated player names must be unique.');

const realNames = new Set(PLAYERS_DATABASE.map(player => player.name.toLowerCase()));
const realTeamNames = new Set(NFL_TEAMS.map(team => `${team.city} ${team.name}`.toLowerCase()));
const realTeamCodes = new Set(NFL_TEAMS.map(team => team.code));
assert.ok(SOLO_PLAYERS_DATABASE.every(player => player.id.startsWith('solo-')), 'Every Solo player must use a simulated identity namespace.');
assert.ok(SOLO_PLAYERS_DATABASE.every(player => player.ratingSource === 'Ball Knower simulated universe'), 'Solo ratings must identify the simulation model.');
assert.ok(SOLO_PLAYERS_DATABASE.every(player => !realNames.has(player.name.toLowerCase())), 'A real NFL player name leaked into Solo.');
assert.ok(SOLO_TEAM_THEMES.every(team => !realTeamCodes.has(team.abbr) && !realTeamNames.has(team.name.toLowerCase())), 'An NFL team identity leaked into Solo.');

for (const team of SOLO_TEAM_THEMES) {
  const fullTeam = SOLO_PLAYERS_DATABASE.filter(player => player.team === team.abbr);
  assert.equal(fullTeam.length, 53, `${team.abbr} does not have 53 simulated players.`);
  const franchiseRoster = buildSoloTeamRoster(team.abbr);
  assert.deepEqual(validateFranchiseRoster(franchiseRoster), [], `${team.abbr} cannot produce a legal Franchise roster.`);
}

const capRoster = [];
for (let attempt = 0; attempt < 60 && capRoster.length < 20; attempt += 1) {
  const pick = chooseSmartPick(SOLO_PLAYERS_DATABASE, capRoster, DEFAULT_SALARY_CAP, 'balanced');
  if (!pick) break;
  capRoster.push(pick);
}
assert.equal(capRoster.length, 20, 'Cap Challenge cannot auto-draft a complete simulated roster.');
assert.ok(capRoster.reduce((total, player) => total + player.salary, 0) <= DEFAULT_SALARY_CAP, 'Simulated Cap Challenge roster exceeds the cap.');

let fantasyDraft = createFantasyDraft(SOLO_TEAM_THEMES[0].abbr, 17);
while (!fantasyDraftComplete(fantasyDraft)) {
  const player = fantasyAvailablePlayers(fantasyDraft)[0];
  assert.ok(player, 'The simulated fantasy draft ran out of legal players.');
  const next = makeFantasyUserPick(fantasyDraft, player.id);
  assert.ok(next.pickIndex > fantasyDraft.pickIndex, 'A legal simulated fantasy pick did not advance the draft.');
  fantasyDraft = next;
}

const soloFiles = [
  'SoloMode.tsx','PlayerAgentMode.tsx','OwnerBusinessMode.tsx','SoloTeamPicker.tsx',
  'FantasyFranchise.tsx','RealTeamFranchise.tsx','MyPlayerStory.tsx','FranchiseSeason.tsx',
  'soloSeasonEngine.ts','soloFranchiseEngine.ts','ownerSeasonEngine.ts',
];
for (const file of soloFiles) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.ok(!/from ['"]\.\/players['"]/.test(source), `${file} imports the real NFL player database.`);
  assert.ok(!/\b(NFL|SUPER BOWL)\b/.test(source), `${file} still exposes NFL-specific Solo copy.`);
}

const agentSource = readFileSync(new URL('../PlayerAgentMode.tsx', import.meta.url), 'utf8');
assert.match(agentSource, /SOLO_PLAYERS_DATABASE/);
assert.match(agentSource, /WHO WILL YOU REPRESENT\?/);
assert.doesNotMatch(agentSource, /playerPortraitUrl\(/, 'Agent Mode may not resolve real-player portrait licenses.');

console.log(`Solo fictional universe passed: ${SOLO_TEAM_THEMES.length} original teams, ${SOLO_PLAYERS_DATABASE.length} simulated players, full Cap and 53-round draft coverage.`);
