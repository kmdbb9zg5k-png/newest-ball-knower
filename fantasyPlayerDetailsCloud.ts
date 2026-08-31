import { ensureOnlineSession, supabase } from './supabase';

export type FantasyPlayerWeek = {
  id: string;
  providerGameId: string;
  season: number;
  week: number;
  playerName: string;
  team: string;
  position: string;
  kickoffAt: string;
  status: string;
  isFinal: boolean;
  stats: Record<string, unknown>;
  fantasyPoints: Record<string, number>;
  projectedPoints: Record<string, number>;
};

type WeekRow = {
  id: string;
  provider_game_id: string;
  provider_player_id: string;
  season: number;
  week_number: number;
  player_name: string;
  team: string;
  position: string | null;
  kickoff_at: string;
  game_status: string;
  is_final: boolean;
  stats: Record<string, unknown> | null;
  fantasy_points: Record<string, number> | null;
  projected_points: Record<string, number> | null;
};

export type FantasyPlayerIdentity = {
  id: string;
  name: string;
  team: string;
  position: string;
};

const weekColumns = 'id,provider_game_id,provider_player_id,season,week_number,player_name,team,position,kickoff_at,game_status,is_final,stats,fantasy_points,projected_points';

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
  const unambiguousLegacyRows = legacyProviderIds.size === 1 ? legacyRows : [];
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
    position: row.position || '',
    kickoffAt: row.kickoff_at,
    status: row.game_status,
    isFinal: Boolean(row.is_final),
    stats: row.stats || {},
    fantasyPoints: row.fantasy_points || {},
    projectedPoints: row.projected_points || {},
  }));
}
