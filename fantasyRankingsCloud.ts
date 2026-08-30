import {
  BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY,
  BALL_KNOWER_SUPABASE_URL,
} from './supabaseDefaults';
import { buildDstFantasyRankings } from './dstFantasyRankings';
import { TEAM_THEMES } from './teamTheme';

export type FantasyRanking = {
  player_key: string;
  player_name: string;
  team: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
  overall_rank: number;
  adp: number;
  position_rank: number;
  actual_points_2025: number | null;
  projected_points_2026: number;
  point_change: number | null;
  projection_reason: string;
  actual_source_name: string;
  actual_source_url: string;
  projection_source_name: string;
  projection_source_url: string | null;
  projection_model: string;
  updated_at: string;
};

type FantasyRankingRow = Omit<
  FantasyRanking,
  'overall_rank' | 'adp' | 'position_rank' | 'actual_points_2025' | 'projected_points_2026' | 'point_change'
> & {
  overall_rank: number | string;
  adp: number | string | null;
  position_rank: number | string;
  actual_points_2025: number | string | null;
  projected_points_2026: number | string;
  point_change: number | string | null;
};

const RANKINGS_TIMEOUT_MS = 7000;
const RANKINGS_MAX_ATTEMPTS = 2;
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || BALL_KNOWER_SUPABASE_URL;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY;

const rankingColumns = [
  'player_key',
  'player_name',
  'team',
  'position',
  'overall_rank',
  'adp',
  'position_rank',
  'actual_points_2025',
  'projected_points_2026',
  'point_change',
  'projection_reason',
  'actual_source_name',
  'actual_source_url',
  'projection_source_name',
  'projection_source_url',
  'projection_model',
  'updated_at',
].join(',');

async function fetchFantasyRankings(signal: AbortSignal): Promise<FantasyRanking[]> {
  if (!url || !key || url.includes('YOUR_PROJECT')) {
    throw new Error('Fantasy rankings are unavailable while cloud data is offline.');
  }

  const params = new URLSearchParams({
    select: rankingColumns,
    season: 'eq.2026',
    scoring_format: 'eq.ppr',
    order: 'overall_rank.asc',
  });
  const response = await fetch(`${url}/rest/v1/ball_knower_fantasy_rankings?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      apikey: key,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Could not load fantasy rankings (${response.status}).`);
  }

  const data = await response.json() as FantasyRankingRow[];
  const rankings = data.map(row => ({
    ...row,
    overall_rank: Number(row.overall_rank),
    adp: Number(row.adp ?? row.overall_rank),
    position_rank: Number(row.position_rank),
    actual_points_2025: row.actual_points_2025 == null ? null : Number(row.actual_points_2025),
    projected_points_2026: Number(row.projected_points_2026),
    point_change: row.point_change == null ? null : Number(row.point_change),
  }));
  const withoutDst = rankings.filter(row => row.position !== 'DST');
  const dst = rankings.filter(row => row.position === 'DST');
  const nflTeams = new Set(TEAM_THEMES.map(team => team.abbr));
  const dstTeams = new Set(dst.map(row => row.team));
  const completeCloudDst = dst.length === nflTeams.size && dstTeams.size === nflTeams.size
    && [...dstTeams].every(team => nflTeams.has(team));
  return [...withoutDst, ...(completeCloudDst ? dst : buildDstFantasyRankings())]
    .sort((a, b) => a.overall_rank - b.overall_rank || a.player_name.localeCompare(b.player_name))
    .map((row, index) => ({ ...row, overall_rank: index + 1 }));
}

export async function loadFantasyRankings(): Promise<FantasyRanking[]> {
  let lastError = new Error('Could not load fantasy rankings.');

  for (let attempt = 0; attempt < RANKINGS_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), RANKINGS_TIMEOUT_MS);
    try {
      return await fetchFantasyRankings(controller.signal);
    } catch (error) {
      lastError = error instanceof Error && error.name === 'AbortError'
        ? new Error('Fantasy rankings took too long to load. Check your connection and try again.')
        : error instanceof Error
          ? error
          : new Error('Could not load fantasy rankings.');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError;
}
