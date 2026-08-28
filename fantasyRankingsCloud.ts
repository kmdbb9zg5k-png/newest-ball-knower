import { supabase } from './supabase';

export type FantasyRanking = {
  player_key: string;
  player_name: string;
  team: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K';
  overall_rank: number;
  adp: number;
  position_rank: number;
  actual_points_2025: number;
  projected_points_2026: number;
  point_change: number;
  projection_reason: string;
  actual_source_name: string;
  actual_source_url: string;
  projection_source_name: string;
  projection_source_url: string | null;
  projection_model: string;
  updated_at: string;
};

export async function loadFantasyRankings(): Promise<FantasyRanking[]> {
  if (!supabase) throw new Error('Fantasy rankings are unavailable while cloud data is offline.');
  const { data, error } = await supabase
    .from('ball_knower_fantasy_rankings')
    .select('*')
    .eq('season', 2026)
    .eq('scoring_format', 'ppr')
    .order('overall_rank', { ascending: true });
  if (error) throw new Error(error.message || 'Could not load fantasy rankings.');
  return (data || []).map(row => ({
    ...row,
    actual_points_2025: Number(row.actual_points_2025),
    adp: Number(row.adp ?? row.overall_rank),
    projected_points_2026: Number(row.projected_points_2026),
    point_change: Number(row.point_change),
  })) as FantasyRanking[];
}
