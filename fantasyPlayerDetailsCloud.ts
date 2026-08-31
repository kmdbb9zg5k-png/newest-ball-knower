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

export async function loadFantasyPlayerWeeks(playerId: string): Promise<FantasyPlayerWeek[]> {
  if (!supabase) return [];
  await ensureOnlineSession();
  const { data, error } = await supabase
    .from('ball_knower_player_week_scores')
    .select('id,provider_game_id,season,week_number,player_name,team,position,kickoff_at,game_status,is_final,stats,fantasy_points,projected_points')
    .eq('ball_knower_player_id', playerId)
    .in('season', [2025, 2026])
    .order('season', { ascending: false })
    .order('week_number', { ascending: true });
  if (error) throw new Error(error.message || 'Player game history could not be loaded.');
  return ((data || []) as WeekRow[]).map(row => ({
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
