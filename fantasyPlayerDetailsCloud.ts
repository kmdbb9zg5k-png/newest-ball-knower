import { ensureOnlineSession, supabase } from './supabase';

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

export type FantasyPlayerIdentity = {
  id: string;
  name: string;
  team: string;
  position: string;
};

const weekColumns = 'id,provider_game_id,provider_player_id,season,week_number,player_name,team,position,opponent_team,is_home,kickoff_at,game_status,is_final,stats,fantasy_points,projected_points,pregame_projected_points,pregame_projection_reason,pregame_projection_source,pregame_projection_captured_at,history_source';

export async function loadFantasyPlayerWeeks(player: FantasyPlayerIdentity): Promise<FantasyPlayerWeek[]> {
  if (!supabase) return [];
  await ensureOnlineSession();
  const [identityResult, legacyResult] = await Promise.all([
    supabase
    .from('ball_knower_player_week_scores')
    .select(weekColumns)
    .eq('ball_knower_player_id', player.id)
    .in('season', [2025, 2026])
    .order('season', { ascending: false })
    .order('week_number', { ascending: true }),
    // Older/unrostered score rows can predate the permanent app-id link. Exact
    // full name plus position safely retains those rows across NFL team changes.
    supabase
      .from('ball_knower_player_week_scores')
      .select(weekColumns)
      .is('ball_knower_player_id', null)
      .eq('player_name', player.name)
      .eq('position', player.position)
      .in('season', [2025, 2026])
      .order('season', { ascending: false })
      .order('week_number', { ascending: true }),
  ]);
  const error = identityResult.error || legacyResult.error;
  if (error) throw new Error(error.message || 'Player game history could not be loaded.');
  const identityRows = (identityResult.data || []) as WeekRow[];
  const legacyRows = (legacyResult.data || []) as WeekRow[];
  const legacyProviderIds = new Set(legacyRows.map(row => row.provider_player_id).filter(Boolean));
  const allLegacyRowsHaveProviderIds = legacyRows.every(row => Boolean(row.provider_player_id));
  const unambiguousLegacyRows = allLegacyRowsHaveProviderIds && legacyProviderIds.size === 1 ? legacyRows : [];
  const rows = [...identityRows, ...unambiguousLegacyRows];
  const uniqueRows = [...new Map(rows.map(row => [row.id, row])).values()]
    .sort((a, b) => b.season - a.season || a.week_number - b.week_number);
  return uniqueRows.map(row => ({
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
}
