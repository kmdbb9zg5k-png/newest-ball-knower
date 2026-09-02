import { ensureOnlineSession, supabase } from './supabase';
import { historicalNameVariants, resolveHistoricalProviderId } from './fantasyPlayerIdentity';

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
  source?: string;
};

export type FantasyPlayerIdentity = {
  id: string;
  name: string;
  team: string;
  position: string;
  projectedPoints2026?: number | null;
};

const weekColumns = 'id,provider_game_id,provider_player_id,season,week_number,player_name,team,position,opponent_team,is_home,kickoff_at,game_status,is_final,stats,fantasy_points,projected_points,pregame_projected_points,pregame_projection_reason,pregame_projection_source,pregame_projection_captured_at,history_source';
const TEAM_ALIASES: Record<string, string> = { LA: 'LAR', WSH: 'WAS', JAC: 'JAX' };
const scheduleCacheKey = (team: string) => `ball-knower:2026-schedule:${team}`;
const normalizeTeam = (value: string) => {
  const team = value.trim().toUpperCase();
  return TEAM_ALIASES[team] || team;
};

const selectCompleteTeamSchedule = (rows: ScheduleRow[], team: string): ScheduleRow[] => {
  const byWeek = new Map<number, ScheduleRow>();
  const conflicts = new Set<number>();
  for (const row of rows) {
    const away = normalizeTeam(row.away_team);
    const home = normalizeTeam(row.home_team);
    if (away !== team && home !== team) continue;
    const week = Number(row.week_number);
    if (!Number.isInteger(week) || week < 1 || week > 18 || !row.kickoff_at) continue;
    const existing = byWeek.get(week);
    if (existing) {
      const sameMatchup = normalizeTeam(existing.away_team) === away
        && normalizeTeam(existing.home_team) === home;
      if (!sameMatchup) {
        conflicts.add(week);
        continue;
      }
      // Tank01 rows can later replace the preseason ESPN import without
      // creating a duplicate week in a player's game log.
      if (existing.provider_game_id.startsWith('espn-') && !row.provider_game_id.startsWith('espn-')) {
        byWeek.set(week, row);
      }
      continue;
    }
    byWeek.set(week, row);
  }
  if (conflicts.size || byWeek.size !== 17) return [];
  return [...byWeek.values()].sort((a, b) => Number(a.week_number) - Number(b.week_number));
};

const readCachedTeamSchedule = (team: string): ScheduleRow[] => {
  try {
    const raw = window.localStorage.getItem(scheduleCacheKey(team));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? selectCompleteTeamSchedule(parsed as ScheduleRow[], team) : [];
  } catch {
    return [];
  }
};

const cacheTeamSchedule = (team: string, rows: ScheduleRow[]) => {
  try {
    window.localStorage.setItem(scheduleCacheKey(team), JSON.stringify(rows));
  } catch {
    // The database remains authoritative when browser storage is unavailable.
  }
};

export async function loadFantasyPlayerWeeks(player: FantasyPlayerIdentity): Promise<FantasyPlayerWeek[]> {
  if (!supabase) return [];
  await ensureOnlineSession();
  const nameVariants = historicalNameVariants(player.name);
  const [identityResult, exactNameResult, variantNameResult, scheduleResult] = await Promise.all([
    supabase
      .from('ball_knower_player_week_scores')
      .select(weekColumns)
      .eq('ball_knower_player_id', player.id)
      .in('season', [2025, 2026])
      .order('season', { ascending: false })
      .order('week_number', { ascending: true }),
    // Name queries are discovery-only. A row is merged below only when its
    // provider id agrees with the permanent Ball Knower identity query.
    supabase
      .from('ball_knower_player_week_scores')
      .select(weekColumns)
      .eq('player_name', player.name)
      .in('season', [2025, 2026])
      .order('season', { ascending: false })
      .order('week_number', { ascending: true }),
    // Suffix and verified nickname variants are discovery only. They are used
    // only when exact-name history is absent and all rows share one provider id.
    supabase
      .from('ball_knower_player_week_scores')
      .select(weekColumns)
      .in('player_name', nameVariants)
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
  const error = identityResult.error || exactNameResult.error || variantNameResult.error;
  if (error) throw new Error(error.message || 'Player game history could not be loaded.');

  const identityRows = (identityResult.data || []) as WeekRow[];
  const exactNameRows = (exactNameResult.data || []) as WeekRow[];
  const variantNameRows = (variantNameResult.data || []) as WeekRow[];
  const identityProviderIds = identityRows.map(row => row.provider_player_id).filter(Boolean);
  const exactProviderIds = exactNameRows.map(row => row.provider_player_id).filter(Boolean);
  const allExactRowsHaveProviderIds = exactNameRows.every(row => Boolean(row.provider_player_id));
  const exactProviderId = allExactRowsHaveProviderIds
    ? resolveHistoricalProviderId(identityProviderIds, exactProviderIds)
    : '';
  const variantProviderIds = variantNameRows.map(row => row.provider_player_id).filter(Boolean);
  const allVariantRowsHaveProviderIds = variantNameRows.every(row => Boolean(row.provider_player_id));
  const variantProviderId = exactNameRows.length === 0 && allVariantRowsHaveProviderIds
    ? resolveHistoricalProviderId(identityProviderIds, variantProviderIds)
    : '';

  // Exact-name rows win over variants, but neither may establish identity by
  // itself. Ambiguity, missing provider ids, or a missing permanent-id anchor
  // fails closed.
  const verifiedFallbackRows = exactProviderId
    ? exactNameRows.filter(row => row.provider_player_id === exactProviderId)
    : variantProviderId
      ? variantNameRows.filter(row => row.provider_player_id === variantProviderId)
      : [];

  const rows = [...identityRows, ...verifiedFallbackRows];
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
    position: row.position || player.position,
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
  const databaseSchedule = scheduleResult.error ? [] : ((scheduleResult.data || []) as ScheduleRow[]);
  let teamGames = selectCompleteTeamSchedule(databaseSchedule, currentTeam);
  if (teamGames.length === 17) {
    cacheTeamSchedule(currentTeam, teamGames);
  } else {
    teamGames = readCachedTeamSchedule(currentTeam);
  }
  if (teamGames.length !== 17) return verifiedRows;

  const verifiedByWeek = new Map<number, FantasyPlayerWeek>();
  for (const row of verifiedRows.filter(item => item.season === 2026)) {
    const existing = verifiedByWeek.get(row.week);
    const rowPriority = Number(row.isFinal) * 4 + Number(Object.keys(row.fantasyPoints).length > 0) * 2 + Number(Boolean(row.projectionCapturedAt));
    const existingPriority = existing
      ? Number(existing.isFinal) * 4 + Number(Object.keys(existing.fantasyPoints).length > 0) * 2 + Number(Boolean(existing.projectionCapturedAt))
      : -1;
    if (!existing || rowPriority > existingPriority) verifiedByWeek.set(row.week, row);
  }
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
        projectionSource: '', projectionCapturedAt: null, historySource: 'espn_schedule', isBye: true,
      });
      continue;
    }
    const isHome = normalizeTeam(game.home_team) === currentTeam;
    const seasonProjection = Number(player.projectedPoints2026);
    const hasSeasonProjection = Number.isFinite(seasonProjection) && seasonProjection > 0;
    const projectedPace = hasSeasonProjection ? Math.round((seasonProjection / 17) * 10) / 10 : null;
    seasonWeeks.push({
      id: `schedule-2026-${player.id}-${week}`, providerGameId: game.provider_game_id,
      season: 2026, week, playerName: player.name, team: currentTeam,
      opponentTeam: normalizeTeam(isHome ? game.away_team : game.home_team), isHome,
      position: player.position, kickoffAt: game.kickoff_at, status: game.game_status || 'Scheduled',
      isFinal: Boolean(game.is_final), stats: {}, fantasyPoints: {},
      projectedPoints: projectedPace === null ? {} : { ppr: projectedPace },
      projectionReason: projectedPace === null ? '' : 'Ball Knower season projection pace: the published Full PPR season projection divided across the 17 verified scheduled games. A provider weekly projection replaces this when published.',
      projectionSource: projectedPace === null ? '' : 'Ball Knower preseason season projection',
      projectionCapturedAt: null, historySource: game.source || 'nfl_schedule',
    });
  }
  return [...seasonWeeks, ...verifiedRows.filter(row => row.season !== 2026)];
}
