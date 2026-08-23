import { PLAYERS_DATABASE } from '../players';
import { getDraftPositionGroup, validateRosterShape } from '../rosterRules';
import { getLiveFantasyDraftGroup } from '../liveFantasyRules';
import {
  buildRealTeamRoster,
  FANTASY_DRAFT_ROUNDS,
  FANTASY_ROSTER_REQUIREMENTS,
} from '../soloFranchiseEngine';
import { TEAM_THEMES } from '../teamTheme';
import { TOTAL_ROSTER_SIZE } from '../types';

const failures: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) failures.push(message);
};

const EXPECTED_TEAM_CODES = [
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC',
  'LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WAS',
] as const;

const teamCodes = new Set(TEAM_THEMES.map(team => team.abbr));
check(TEAM_THEMES.length === 32, `Expected 32 NFL teams, found ${TEAM_THEMES.length}.`);
check(teamCodes.size === 32, 'NFL team abbreviations contain duplicates.');
check(EXPECTED_TEAM_CODES.every(code => teamCodes.has(code)), `NFL team set does not match the canonical 32-team code list.`);
check([...teamCodes].every(code => EXPECTED_TEAM_CODES.includes(code as typeof EXPECTED_TEAM_CODES[number])), 'Unexpected NFL team abbreviation found.');

const playerIds = PLAYERS_DATABASE.map(player => player.id);
check(new Set(playerIds).size === playerIds.length, 'Player database contains duplicate permanent player IDs.');

for (const player of PLAYERS_DATABASE) {
  check(Boolean(player.id && player.name), 'Found a player missing id or name.');
  check(Number.isFinite(player.ovr) && player.ovr >= 0 && player.ovr <= 99, `${player.name}: invalid OVR ${player.ovr}.`);
  check(Number.isFinite(player.salary) && player.salary >= 0, `${player.name}: invalid salary ${player.salary}.`);
  check(teamCodes.has(player.team) || player.team === 'FA', `${player.name}: invalid team ${player.team}.`);
  if (player.teamId) check(teamCodes.has(player.teamId) || player.teamId === 'FA', `${player.name}: invalid teamId ${player.teamId}.`);
  check(Boolean(getDraftPositionGroup(player) || getLiveFantasyDraftGroup(player)), `${player.name}: unsupported position ${player.position}.`);
}

for (const team of TEAM_THEMES) {
  const teamPlayers = PLAYERS_DATABASE.filter(player => player.team === team.abbr);
  check(teamPlayers.length > 0, `${team.abbr}: no active players in database.`);
  check(teamPlayers.some(player => player.position === 'QB'), `${team.abbr}: no QB in database.`);

  const standardRoster = buildRealTeamRoster(team.abbr);
  const shapeErrors = validateRosterShape(standardRoster);
  check(standardRoster.length === TOTAL_ROSTER_SIZE, `${team.abbr}: standard franchise roster builds ${standardRoster.length}/${TOTAL_ROSTER_SIZE}.`);
  check(shapeErrors.length === 0, `${team.abbr}: standard roster shape invalid: ${shapeErrors.join(' ')}`);
}

const fantasyRoundSum = Object.values(FANTASY_ROSTER_REQUIREMENTS).reduce((sum, value) => sum + value, 0);
check(FANTASY_DRAFT_ROUNDS === 53, `Fantasy Franchise must stay 53 rounds; found ${FANTASY_DRAFT_ROUNDS}.`);
check(fantasyRoundSum === 53, `Fantasy roster requirements sum to ${fantasyRoundSum}, not 53.`);

for (const [group, requiredPerTeam] of Object.entries(FANTASY_ROSTER_REQUIREMENTS)) {
  const available = PLAYERS_DATABASE.filter(player => getDraftPositionGroup(player) === group).length;
  const leagueNeed = requiredPerTeam * 32;
  check(available >= leagueNeed, `${group}: player pool has ${available}; 32 teams x ${requiredPerTeam} requires at least ${leagueNeed}.`);
}

console.log(`Ball Knower integrity check: ${PLAYERS_DATABASE.length} players, ${TEAM_THEMES.length} teams, ${FANTASY_DRAFT_ROUNDS}-round fantasy franchise.`);

if (failures.length) {
  console.error(`Integrity failures (${failures.length}):`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Integrity check passed.');
