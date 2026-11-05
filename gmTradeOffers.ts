import { buildFranchiseTradeResult } from './soloFranchiseEngine';
import { getDraftPositionGroup } from './rosterRules';
import { DEFAULT_SALARY_CAP, type Player } from './types';

export type GmTradeOffer = { id: string; team: string; partner: string; year: number; week: number; incomingId: string; outgoingId: string };
export type GmTradeDecision = { id: string; status: 'accepted' | 'declined' | 'expired'; year: number; week: number };
export type GmTradeInbox = { pending: GmTradeOffer | null; decisions: GmTradeDecision[] };
export const emptyGmTradeInbox = (): GmTradeInbox => ({ pending: null, decisions: [] });
export const gmTradeWindowOpen = (week: number, draft: boolean) => !draft && Number.isInteger(week) && week >= 1 && week <= 9;
const hash = (key: string) => Array.from(key).reduce((n, ch) => Math.imul(n ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;

export function restoreGmTradeInbox(value: unknown, team: string): GmTradeInbox {
  if (!value || typeof value !== 'object') return emptyGmTradeInbox();
  const raw = value as Partial<GmTradeInbox>;
  const decisions = Array.isArray(raw.decisions) ? raw.decisions.filter(item => item && typeof item.id === 'string' && ['accepted', 'declined', 'expired'].includes(item.status) && Number.isInteger(item.year) && Number.isInteger(item.week)).slice(-90) : [];
  const p = raw.pending;
  const pending = p && p.team === team && typeof p.id === 'string' && typeof p.partner === 'string' && p.partner !== team && typeof p.incomingId === 'string' && typeof p.outgoingId === 'string' && Number.isInteger(p.year) && Number.isInteger(p.week) && gmTradeWindowOpen(p.week, false) && !decisions.some(item => item.id === p.id) ? p : null;
  return { pending, decisions };
}

export function finishGmTradeOffer(inbox: GmTradeInbox, offer: GmTradeOffer, status: GmTradeDecision['status']): GmTradeInbox {
  return { pending: null, decisions: [...inbox.decisions.filter(item => item.id !== offer.id), { id: offer.id, status, year: offer.year, week: offer.week }].slice(-90) };
}

export function validateGmTradeOffer(offer: GmTradeOffer, team: string, roster: Player[], league: Record<string, Player[]>, week: number, year: number, draft: boolean) {
  const partner = league[offer.partner] ?? [];
  const errors: string[] = [];
  if (offer.team !== team || offer.partner === team) errors.push('This offer does not belong to your franchise.');
  if (!gmTradeWindowOpen(week, draft) || year !== offer.year || week !== offer.week) errors.push('This trade offer has expired.');
  const result = buildFranchiseTradeResult(roster, team, partner, offer.partner, offer.incomingId, [offer.outgoingId]);
  errors.push(...result.errors);
  for (const [label, players] of [['Your roster', result.userRoster], ['The other roster', result.partnerRoster]] as const) {
    if (players.some(player => !Number.isFinite(player.salary) || player.salary < 0)) errors.push(`${label} has an invalid salary.`);
    if (players.reduce((sum, player) => sum + player.salary, 0) > DEFAULT_SALARY_CAP + 0.001) errors.push(`${label} would exceed the salary cap.`);
  }
  return { ...result, errors };
}

export function generateGmTradeOffer(team: string, roster: Player[], league: Record<string, Player[]>, week: number, year: number, draft: boolean, decisions: GmTradeDecision[]): GmTradeOffer | null {
  if (!gmTradeWindowOpen(week, draft) || ![3, 6, 9].includes(week)) return null;
  const id = `gm-trade:${team}:${year}:${week}`;
  if (decisions.some(item => item.id === id)) return null;
  const partners = Object.keys(league).filter(abbr => abbr !== team).sort((a, b) => hash(`${id}:${a}`) - hash(`${id}:${b}`) || a.localeCompare(b));
  const outgoing = [...roster].sort((a, b) => hash(`${id}:${a.id}`) - hash(`${id}:${b.id}`) || a.id.localeCompare(b.id));
  for (const partner of partners) {
    for (const player of outgoing) {
      const candidates = league[partner].filter(incoming => incoming.id !== player.id && getDraftPositionGroup(incoming) === getDraftPositionGroup(player) && Math.abs(incoming.ovr - player.ovr) <= 3).sort((a, b) => Math.abs(a.ovr - player.ovr) - Math.abs(b.ovr - player.ovr) || a.id.localeCompare(b.id));
      for (const incoming of candidates) {
        const offer = { id, team, partner, year, week, incomingId: incoming.id, outgoingId: player.id };
        if (!validateGmTradeOffer(offer, team, roster, league, week, year, draft).errors.length) return offer;
      }
    }
  }
  return null;
}
