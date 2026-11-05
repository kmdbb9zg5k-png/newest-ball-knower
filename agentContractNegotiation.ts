import { contractStrategyModifiers, type ClientCareer, type ContractStrategy } from './agentClientCareer';
import { contractFeeK } from './agentAgencyGrowth';
import type { Player } from './types';

export type AgentFutureDeal = { totalM: number; annualM: number; guaranteedM: number; years: number; negotiatedAt: string; signingYear?: number; startYear?: number; endYear?: number; playerId?: string; team?: string };
export function normalizeAgentDeal(raw: AgentFutureDeal | undefined, seasonYear: number): AgentFutureDeal | undefined {
  if (!raw || ![raw.totalM, raw.annualM, raw.guaranteedM ?? 0, raw.years].every(value => Number.isFinite(value) && value >= 0) || !Number.isInteger(raw.years) || raw.years < 1 || raw.years > 5) return undefined;
  const signingYear = Number.isInteger(raw.signingYear) ? raw.signingYear! : seasonYear;
  const startYear = Number.isInteger(raw.startYear) ? raw.startYear! : signingYear + 1;
  return { ...raw, guaranteedM: raw.guaranteedM ?? 0, signingYear, startYear, endYear: startYear + raw.years - 1 };
}
export const canNegotiateAgentDeal = (deal: AgentFutureDeal | undefined, seasonYear: number) => !deal || seasonYear >= (deal.endYear ?? Infinity) && seasonYear > (deal.signingYear ?? seasonYear);
export type AgentNegotiationAsk = { years: number; annualM: number; guaranteedPct: number; gmPatience: number; strategy: ContractStrategy };
export function evaluateAgentCounter(ask: AgentNegotiationAsk, market: number, player: Player, career: ClientCareer, agency: { negotiation: number; reputation: number }) {
  const strategy = contractStrategyModifiers(ask.strategy, player, career);
  const askScore = ask.annualM / (market * strategy.annualMultiplier) * 55 + (ask.guaranteedPct - strategy.guaranteeDelta) * .35 + (ask.years - strategy.yearsDelta) * 2;
  const threshold = 69 + agency.negotiation * .23 + agency.reputation * .09;
  const totalM = Math.round(ask.annualM * ask.years * 10) / 10;
  return { accepted: askScore <= threshold, nextPatience: ask.gmPatience + strategy.patienceDelta - Math.max(12, Math.round(askScore - 54)), totalM, guaranteedM: Math.round(totalM * ask.guaranteedPct / 10) / 10, feeK: contractFeeK(totalM), strategy };
}
export type AgentSeasonCheckpoint = { year: number; clients: number; deals: number; reputation: number; cashK: number; promisesKept: number; promisesBroken: number };
