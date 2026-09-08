import type { League } from './types';
import type { WeeklyScore } from './fantasyLeagueParityCloud';

/** Labels must describe the destination we really open, not a made-up deep link. */
export function homeLeagueAction(league?: League) {
  if (!league) return { label: 'Find a league', tab: 'lobby' as const };
  if (league.liveDraft?.status === 'active') return { label: 'Enter draft', tab: 'draft' as const };
  if (league.status === 'completed' && !league.liveDraft && !league.settings?.fantasySeasonStarted)
    return { label: 'View draft-order results', tab: 'simulation' as const };
  return { label: league.settings?.fantasySeasonComplete ? 'View season in League HQ' : 'Open League HQ', tab: 'lobby' as const };
}

/** Keep the existing display tiers; the server still owns the rating itself. */
export function homeRatingTier(rating?: number) {
  if (rating == null || !Number.isFinite(rating) || rating < 0 || rating > 99) return null;
  const tiers = [{ name: 'Rookie', start: 0 }, { name: 'Student', start: 60 }, { name: 'Knower', start: 70 }, { name: 'Elite', start: 80 }, { name: 'Certified', start: 90 }];
  const index = tiers.reduce((found, tier, i) => rating >= tier.start ? i : found, 0);
  const tier = tiers[index], next = tiers[index + 1];
  return { name: tier.name, next: next?.name, remaining: next ? next.start - rating : 0,
    percent: next ? (rating - tier.start) / (next.start - tier.start) * 100 : 100 };
}

export function homeInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase() || 'BK';
}
export const homePoints = (value?: number | null) => value != null && Number.isFinite(value) ? value.toFixed(1) : '—';
export const homePublishedProjection = (score?: WeeklyScore) => score?.hasProjectedTotal === true && Number.isFinite(score.projectedPoints) ? score.projectedPoints : null;
export function homeTimestamp(value?: string) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

export type HomeActivityRow = { id: string; title: string; detail: string; time: string };
export type HomeActivitySources = {
  transactions: { id: string; summary: string; created_at: string }[];
  messages: { id: string; kind: string; body: string; created_at: string }[];
  claims: { id: string; member_id: string; status: string; created_at: string }[];
  trades: { id: string; proposer_member_id: string; recipient_member_id: string; status: string; created_at: string }[];
};
/** Even if a backend returns broader rows, never expose another member's private claim/trade. */
export function homeActivityRows(data: HomeActivitySources, memberId?: string): HomeActivityRow[] {
  const rows: HomeActivityRow[] = [
    ...data.transactions.map(item => ({ id: `t-${item.id}`, title: 'League transaction', detail: item.summary, time: item.created_at })),
    ...data.messages.filter(item => item.kind === 'announcement' || item.kind === 'receipt').map(item => ({ id: `m-${item.id}`, title: item.kind === 'receipt' ? 'League receipt' : 'Commissioner update', detail: item.body, time: item.created_at })),
    ...data.claims.filter(item => Boolean(memberId) && item.member_id === memberId).map(item => ({ id: `c-${item.id}`, title: 'Your waiver claim', detail: `Claim ${item.status}.`, time: item.created_at })),
    ...data.trades.filter(item => Boolean(memberId) && (item.proposer_member_id === memberId || item.recipient_member_id === memberId)).map(item => ({ id: `r-${item.id}`, title: 'Your trade', detail: `Trade ${item.status}.`, time: item.created_at })),
  ];
  return rows.filter(row => Boolean(row.detail?.trim())).sort((a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0)).slice(0, 10);
}
