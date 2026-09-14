import type { Player } from '../types';
import { SOLO_TEAM_THEMES } from '../soloUniverse';

/** A view-only copy. Keep the player ID, ratings, salary and appearance stable after a trade. */
export function playerOnSoloTeam(player: Player, teamAbbr?: string): Player {
  if (!teamAbbr || teamAbbr === player.team) return player;
  const team = SOLO_TEAM_THEMES.find(item => item.abbr === teamAbbr);
  if (!team) return player; // Invalid legacy team codes must not introduce real-team art.
  return {
    ...player,
    team: team.abbr,
    teamId: team.abbr,
    teamAbbreviation: team.abbr,
    teamName: team.name,
    teamCity: team.name.split(' ').slice(0, -1).join(' '),
  };
}
