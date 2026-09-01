import { ensureOnlineSession, supabase } from './supabase';
import { canMergeHistoricalProviderRows } from './fantasyPlayerIdentity';

export type FantasyPlayerWeek = {
  id: string;
  providerGameId: string;
  season: number;
  week: number;
  playerName: string;
  team: string;
  opponentTeam: string;
  isHome: boolean | null;
  position: string;
  kickoffAt: string;
  status: string;
  isFinal: boolean;
  stats: Record<string, unknown>;
  fantasyPoints: Record<string, number>;
  projectedPoints: Record<string, number>;
  projectionReason: string;
  projectionSource: string;
  projectionCapturedAt: string | null;
  historySource: string;
  isBye?: boolean;
};

type WeekRow = {
  id: string;
  provider_game_id: string;
  provider_player_id: string;
  season: number;
  week_number: number;
  player_name: string;
  team: string;
  opponent_team: string | null;
  is_home: boolean | null;
  position: string | null;
  kickoff_at: string;
  game_status: string;
  is_final: boolean;
  stats: Record<string, unknown> | null;
  fantasy_points: Record<string, number> | null;
  projected_points: Record<string, number> | null;
  pregame_projected_points: Record<string, number> | null;
  pregame_projection_reason: string | null;
  pregame_projection_source: string | null;
  pregame_projection_captured_at: string | null;
  history_source: string | null;
};

type ScheduleRow = {
  provider_game_id: string;
  season: number;
  week_number: number;
  away_team: string;
  home_team: string;
  kickoff_at: string;
  game_status: string | null;
  is_final: boolean;
};

export type FantasyPlayerIdentity = {
  id: string;
  name: string;
  team: string;
  position: string;
};

const weekColumns = 'id,provider_game_id,provider_player_id,season,week_number,player_name,team,position,opponent_team,is_home,kickoff_at,game_status,is_final,stats,fantasy_points,projected_points,pregame_projected_points,pregame_projection_reason,pregame_projection_source,pregame_projection_captured_at,history_source';
const TEAM_ALIASES: Record<string, string> = { LA: 'LAR', WSH: 'WAS', JAC: 'JAX' };
const normalizeTeam = (value: string) => {
  const team = value.trim().toUpperCase();
  return TEAM_ALIASES[team] || team;
};

export async function loadFantasyPlayerWeeks(player: FantasyPlayerIdentity): Promise<FantasyPlayerWeek[]> {
  if (!supabase) return [];
  await ensureOnlineSession();
  const [identityResult, namePositionResult, scheduleResult] = await Promise.all([
    supabase
      .from('ball_knower_player_week_scores')
      .select(weekColumns)
      .eq('ball_knower_player_id', player.id)
      .in('season', [2025, 2026])
      .order('season', { ascending: false })
      .order('week_number', { ascending: true }),
    // Older weekly rows can retain a superseded Ball Knower id. Name + position
    // is discovery only; rows are merged only after their provider identity is
    // anchored to rows already verified under the selected permanent player id.
    supabase
      .from('ball_knower_player_week_scores')
      .select(weekColumns)
      .eq('player_name', player.name)
      .eq('position', player.position)
      .in('season', [2025, 2026])
      .order('season', { ascending: false })
      .order('week_number', { ascending: true }),
    supabase
      .from('ball_knower_nfl_games')
      .select('provider_game_id,season,week_number,away_team,home_team,kickoff_at,game_status,is_final')
      .eq('season', 2026)
      .eq('season_type', 'reg')
      .order('week_number', { ascending: true }),
  ]);
  const error = identityResult.error || namePositionResult.error;
  if (error) throw new Error(error.message || 'Player game history could not be loaded.');

  const identityRows = (identityResult.data || []) as WeekRow[];
  const namePositionRows = (namePositionResult.data || []) as WeekRow[];
  const identityProviderIds = identityRows.map(row => row.provider_player_id).filter(Boolean);
  const fallbackProviderIds = namePositionRows.map(row => row.provider_player_id).filter(Boolean);
  const allFallbackRowsHaveProviderIds = namePositionRows.every(row => Boolean(row.provider_player_id));
  const canMergeFallback =
    allFallbackRowsHaveProviderIds &&
    canMergeHistoricalProviderRows(identityProviderIds, fallbackProviderIds);
  const anchoredProviderId = canMergeFallback ? [...new Set(identityProviderIds)][0] : '';

  // No current-id rows means there is no trustworthy provider identity anchor.
  // In that case, prefer an honest empty/partial history over attaching a same-
  // name player's rows to the selected player.
  const anchoredFallbackRows = anchoredProviderId
    ? namePositionRows.filter(row => row.provider_player_id === anchoredProviderId)
    : [];

  const rows = [...identityRows, ...anchoredFallbackRows];
  const uniqueRows = [...new Map(rows.map(row => [row.id, row])).values()]
    .sort((a, b) => b.season - a.season || a.week_number - b.week_number);

  const verifiedRows: FantasyPlayerWeek[] = uniqueRows.map(row => ({
    id: row.id,
    providerGameId: row.provider_game_id,
    season: Number(row.season),
    week: Number(row.week_number),
    playerName: row.player_name,
    team: row.team,
    opponentTeam: row.opponent_team || '',
    isHome: row.is_home,
    position: row.position || '',
    kickoffAt: row.kickoff_at,
    status: row.game_status,
    isFinal: Boolean(row.is_final),
    stats: row.stats || {},
    fantasyPoints: row.fantasy_points || {},
    projectedPoints: row.pregame_projection_captured_at ? (row.pregame_projected_points || {}) : {},
    projectionReason: row.pregame_projection_reason || '',
    projectionSource: row.pregame_projection_source || '',
    projectionCapturedAt: row.pregame_projection_captured_at,
    historySource: row.history_source || 'tank01',
  }));

  // Before player-level scoring rows are materialized, use the authoritative
  // NFL schedule to keep the current-season game log useful. Schedule rows add
  // only verified opponent/kickoff metadata; unavailable fantasy data remains —.
  const currentTeam = normalizeTeam(player.team);
  const schedule = scheduleResult.error ? [] : ((scheduleResult.data || []) as ScheduleRow[]);
  const teamGames = schedule.filter(row =>
    normalizeTeam(row.away_team) === currentTeam || normalizeTeam(row.home_team) === currentTeam,
  );
  if (teamGames.length !== 17) return verifiedRows;

  const verifiedByWeek = new Map(
    verifiedRows.filter(row => row.season === 2026).map(row => [row.week, row]),
  );
  const scheduledByWeek = new Map(teamGames.map(row => [Number(row.week_number), row]));
  const seasonWeeks: FantasyPlayerWeek[] = [];
  for (let week = 1; week <= 18; week += 1) {
    const verified = verifiedByWeek.get(week);
    if (verified) {
      seasonWeeks.push(verified);
      continue;
    }
    const game = scheduledByWeek.get(week);
    if (!game) {
      seasonWeeks.push({
        id: `schedule-2026-${player.id}-${week}-bye`, providerGameId: '', season: 2026, week,
        playerName: player.name, team: currentTeam, opponentTeam: '', isHome: null,
        position: player.position, kickoffAt: '', status: 'Bye', isFinal: false,
        stats: {}, fantasyPoints: {}, projectedPoints: {}, projectionReason: '',
        projectionSource: '', projectionCapturedAt: null, historySource: 'nfl_schedule', isBye: true,
      });
      continue;
    }
    const isHome = normalizeTeam(game.home_team) === currentTeam;
    seasonWeeks.push({
      id: `schedule-2026-${player.id}-${week}`, providerGameId: game.provider_game_id,
      season: 2026, week, playerName: player.name, team: currentTeam,
      opponentTeam: normalizeTeam(isHome ? game.away_team : game.home_team), isHome,
      position: player.position, kickoffAt: game.kickoff_at, status: game.game_status || 'Scheduled',
      isFinal: Boolean(game.is_final), stats: {}, fantasyPoints: {}, projectedPoints: {},
      projectionReason: '', projectionSource: '', projectionCapturedAt: null,
      historySource: 'nfl_schedule',
    });
  }
  return [...seasonWeeks, ...verifiedRows.filter(row => row.season !== 2026)];
}
