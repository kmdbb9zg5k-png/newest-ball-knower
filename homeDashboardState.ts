import type { League } from './types';
import type { LeagueTransaction, TradeOffer, WaiverClaim, LeagueMessage } from './fantasySeasonCloud';

export type HomeLeagueSection = 'matchup' | 'activity' | 'messages' | 'standings';
export type HomeActivity = {
  id: string; label: string; detail: string; occurredAt?: string;
  kind: 'transaction' | 'trade' | 'claim' | 'announcement' | 'receipt' | 'schedule';
  section: 'activity' | 'messages';
};
type Operations = { transactions: readonly LeagueTransaction[]; trades: readonly TradeOffer[]; claims: readonly WaiverClaim[]; messages: readonly LeagueMessage[]; };

export function homeLeagueAction(league: League): { label: string; tab: 'lobby' | 'draft' | 'simulation'; section?: HomeLeagueSection } {
  if (league.settings?.fantasySeasonComplete) return { label: 'View Results', tab: 'lobby', section: 'standings' };
  if (league.liveDraft?.status === 'active') return { label: 'Enter Draft', tab: 'draft' };
  if (league.liveDraft?.status === 'completed' && league.settings?.fantasySeasonStarted) return { label: 'View Matchup', tab: 'lobby', section: 'matchup' };
  if (league.status === 'completed' && !league.liveDraft) return { label: 'View Draft Results', tab: 'simulation' };
  return { label: 'Open League', tab: 'lobby' };
}
export function homeLeaguePhase(league: League): string {
  if (league.settings?.fantasySeasonComplete) return 'Season complete';
  if (league.liveDraft?.status === 'active') return 'Live draft';
  if (league.settings?.fantasySeasonStarted) return `Week ${league.settings.currentWeek || 1}`;
  if (league.liveDraft?.status === 'completed') return 'Draft complete';
  if (league.status === 'completed') return 'Draft order set';
  return 'Draft setup';
}
export function homeRatingTier(rating?: number) {
  if (rating == null || !Number.isFinite(rating) || rating < 0 || rating > 99) return null;
  const tiers = [{ name: 'Rookie', at: 0 }, { name: 'Student', at: 60 }, { name: 'Knower', at: 70 }, { name: 'Elite', at: 80 }, { name: 'Certified', at: 90 }];
  const index = tiers.filter(tier => rating >= tier.at).length - 1;
  const current = tiers[index], next = tiers[index + 1];
  return { name: current.name, next: next?.name, remaining: next ? next.at - rating : 0, percent: next ? (rating - current.at) / (next.at - current.at) * 100 : 100 };
}
const timestamp = (value?: string) => { const parsed = value ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : 0; };
const linkedId = (transaction: LeagueTransaction, key: string) => {
  const metadata = transaction.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const value = metadata[key] ?? metadata[key.replace('Id', '_id')];
  return typeof value === 'string' && value ? value : undefined;
};
function hasReceipt(transactions: readonly LeagueTransaction[], key: string, id: string, at?: string) {
  const eventTime = timestamp(at);
  return eventTime > 0 && transactions.some(transaction => linkedId(transaction, key) === id && timestamp(transaction.createdAt) > 0 && Math.abs(timestamp(transaction.createdAt) - eventTime) <= 5000);
}
export function buildHomeActivity(operations: Operations, options: { leagueId: string; memberId?: string; scheduledDraft?: string | null; scheduledAt?: string }): HomeActivity[] {
  const { leagueId, memberId } = options;
  const transactions = operations.transactions.filter(item => item.leagueId === leagueId && item.summary?.trim());
  const rows: HomeActivity[] = transactions.map(item => ({ id: `transaction-${item.id}`, label: 'League transaction', detail: item.summary, occurredAt: item.createdAt, kind: 'transaction', section: 'activity' }));
  for (const item of operations.messages) {
    if (item.leagueId !== leagueId || !item.body?.trim() || !['announcement', 'receipt'].includes(item.kind)) continue;
    rows.push({ id: `message-${item.id}`, label: item.kind === 'announcement' ? 'Commissioner update' : 'League receipt', detail: item.body, occurredAt: item.createdAt, kind: item.kind as 'announcement' | 'receipt', section: 'messages' });
  }
  if (memberId) {
    for (const item of operations.trades) {
      if (item.leagueId !== leagueId || (item.proposerMemberId !== memberId && item.recipientMemberId !== memberId)) continue;
      const occurredAt = item.resolvedAt || item.createdAt;
      if (hasReceipt(transactions, 'tradeId', item.id, occurredAt)) continue;
      rows.push({ id: `trade-${item.id}`, label: 'Trade update', detail: `Your trade is ${item.status.replaceAll('_', ' ')}.`, occurredAt, kind: 'trade', section: 'activity' });
    }
    for (const item of operations.claims) {
      if (item.leagueId !== leagueId || item.memberId !== memberId) continue;
      const occurredAt = item.processedAt || item.createdAt;
      if (hasReceipt(transactions, 'claimId', item.id, occurredAt)) continue;
      rows.push({ id: `claim-${item.id}`, label: 'Waiver claim', detail: item.status === 'pending' ? 'Your claim is pending.' : `Claim ${item.status.replaceAll('_', ' ')}.`, occurredAt, kind: 'claim', section: 'activity' });
    }
  }
  if (options.scheduledDraft) rows.push({ id: 'draft-schedule', label: 'Draft scheduled', detail: options.scheduledDraft, occurredAt: options.scheduledAt, kind: 'schedule', section: 'activity' });
  const seen = new Set<string>();
  return rows.sort((a, b) => timestamp(b.occurredAt) - timestamp(a.occurredAt) || a.id.localeCompare(b.id)).filter(row => { if (seen.has(row.id)) return false; seen.add(row.id); return true; });
}
export function homeFeaturedActivity(rows: HomeActivity[], now: number) {
  return rows.find(row => row.kind === 'announcement' && timestamp(row.occurredAt) > 0 && now >= timestamp(row.occurredAt) && now - timestamp(row.occurredAt) <= 48 * 60 * 60 * 1000);
}
