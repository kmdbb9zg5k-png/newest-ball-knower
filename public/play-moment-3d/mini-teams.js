import { MINI_TEAMS } from './mini-teams-data.js?v=teams-1';
export { MINI_TEAMS };
export function miniTeam(id) { return MINI_TEAMS.find(team => team.abbr === id) || MINI_TEAMS.find(team => team.abbr === 'JCY'); }
export function miniMatchup(homeId, awayId) {
  const home = miniTeam(homeId);
  const chosen = miniTeam(awayId || 'BRK');
  const away = chosen.abbr !== home.abbr ? chosen : MINI_TEAMS.find(team => team.abbr !== home.abbr);
  return { home, away };
}
export function rosterRatings(base, player) {
  if (!player) return base;
  const a = player.attributes, clamp = n => Math.max(35, Math.min(97, Math.round(n)));
  const athletic = (a.athleticism - 84) * .45;
  return Object.freeze({ ...base, speed: clamp(player.speed ?? base.speed + athletic), acceleration: clamp(base.acceleration + athletic), agility: clamp(base.agility + athletic),
    awareness: a.footballIQ, throw: a.passing ?? base.throw, catch: a.receiving ?? base.catch,
    block: a.runBlocking ?? a.passBlocking ?? base.block, blockShed: a.passRush ?? base.blockShed,
    coverage: a.coverage ?? base.coverage, tackle: a.runDefense ?? base.tackle,
    breakTackle: a.rushing ?? base.breakTackle });
}
export function rosterIdentity(player, team, away = false) {
  const sharedSurname = team.lineup.some(other => other.id !== player.id && other.lastName === player.lastName);
  return { playerId: player.id, lastName: player.lastName, jerseyName: sharedSurname ? `${player.name[0]}. ${player.lastName}` : player.lastName, fullName: player.name, number: player.number, overall: player.overall,
    kitPrimary: team.primary, kitTrim: team.secondary, kitJersey: away ? '#edf0ed' : team.primary, kitInk: away ? team.primary : '#fff5dc', teamAbbr: team.abbr };
}
