import { PLAYERS_DATABASE } from './players';
import { getPlayerOvr } from './evaluation';
import { TEAM_THEMES } from './teamTheme';
import type { FantasyRanking } from './fantasyRankingsCloud';

const DEFENSE_POSITIONS = new Set(['EDGE','DT','DE','NT','LB','MLB','OLB','ILB','CB','S','FS','SS']);

const ROSTER_MODEL_UPDATED_AT = '2026-08-30T00:00:00.000Z';

export function buildDstFantasyRankings(): FantasyRanking[] {
  return TEAM_THEMES.map(team => {
    const defenders = PLAYERS_DATABASE.filter(player => player.team === team.abbr && DEFENSE_POSITIONS.has(player.position))
      .sort((a, b) => getPlayerOvr(b) - getPlayerOvr(a)).slice(0, 11);
    const strength = defenders.length ? defenders.reduce((sum, player) => sum + getPlayerOvr(player), 0) / defenders.length : 65;
    return { team, projected: Number(Math.max(55, 82 + (strength - 68) * 2.4).toFixed(1)) };
  }).sort((a, b) => b.projected - a.projected || a.team.abbr.localeCompare(b.team.abbr)).map((row, index) => ({
    player_key: `dst-${row.team.abbr.toLowerCase()}`,
    player_name: PLAYERS_DATABASE.find(player => player.team === row.team.abbr && player.position === 'DST')?.name || `${row.team.name} D/ST`,
    team: row.team.abbr,
    position: 'DST',
    overall_rank: 145 + index * 5,
    adp: 145 + index * 5,
    position_rank: index + 1,
    actual_points_2025: null,
    projected_points_2026: row.projected,
    point_change: null,
    projection_reason: `Ball Knower's D/ST projection is driven by the current roster's top defensive-unit ratings. It is a model estimate, not an invented 2025 stat.`,
    actual_source_name: '2025 D/ST actual not yet backfilled',
    actual_source_url: '',
    projection_source_name: 'Ball Knower current roster-strength model',
    projection_source_url: null,
    projection_model: 'Ball Knower D/ST roster-strength model v1',
    updated_at: ROSTER_MODEL_UPDATED_AT,
  }));
}
