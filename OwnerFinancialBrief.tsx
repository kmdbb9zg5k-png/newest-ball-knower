import React from 'react';
import { ownerCalendarWeek, ownerGameRevenue, ownerPlayoffHomeGame, ownerStageLabel, type OwnerSeasonStage } from './ownerSeasonEngine';

export type OwnerCashStatement = { season: number; period: string; label: string; openingCashM: number; decisionCashM: number; revenueM: number; staffExpenseM: number; closingCashM: number };
type FinancialState = { abbr: string; season: number; week: number; stage: OwnerSeasonStage; wins: number; losses: number; cashM: number; ticketPrice: number; parkingPrice: number; fanTrust: number; stadium: number; playoffSeed: number; seasonRevenueM: number; seasonExpensesM: number; seasonStaffCommitmentsM: number; financeHistory?: OwnerCashStatement[] };
const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(1)}M`;
export function ownerFinancialOutlook(state: FinancialState) {
  const snapshot = { ...state, gmCostM: state.seasonStaffCommitmentsM, coachCostM: 0 };
  const calendar = ownerCalendarWeek(state.abbr, state.week, state.season);
  const home = state.stage === 'regular' ? Boolean(calendar?.isHome) : state.stage !== 'preseason' && ownerPlayoffHomeGame(snapshot);
  const gateM = state.stage === 'preseason' || calendar?.isBye && state.stage === 'regular' ? 0 : ownerGameRevenue(snapshot, home, state.stage !== 'regular');
  return { gateM, home, netM: state.seasonRevenueM - state.seasonExpensesM, cashAfterCommitmentsM: state.cashM - state.seasonStaffCommitmentsM, period: ownerStageLabel(state.stage, state.week) };
}
export function OwnerFinancialBrief({ state }: { state: FinancialState }) {
  const outlook = ownerFinancialOutlook(state);
  return <section aria-label="Owner finances" className="rounded-3xl border border-amber-300/20 bg-[#0d121b] p-5">
    <span className="text-[10px] font-black tracking-[.18em] text-amber-200">FINANCE DESK · {state.season}</span><h3 className="mt-2 text-2xl font-black">Know what your cash is doing.</h3>
    <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Cash available now', money(state.cashM)], ['Season cash received', money(state.seasonRevenueM)], ['Season cash spent', money(state.seasonExpensesM)], ['Season cash net', money(outlook.netM)]].map(([label, value]) => <div key={label} className="rounded-xl bg-black/25 p-3"><dt className="text-[10px] text-zinc-400">{label}</dt><dd className="mt-1 text-lg font-black">{value}</dd></div>)}</dl>
    <p className="mt-3 text-xs leading-5 text-zinc-300">{money(state.seasonStaffCommitmentsM)} in staff commitments settles at season close. Cash after reserving that amount: <b>{money(outlook.cashAfterCommitmentsM)}</b>. Firing a staff member adds an immediate buyout; existing annual commitments remain due.</p>
    <p className="mt-2 text-xs leading-5 text-zinc-400">{outlook.period}: estimated stadium receipts {money(outlook.gateM)}{outlook.gateM > 0 ? ' for a home game, using your current prices, fan trust, stadium and record' : ' because no home gate is scheduled'}. Decision costs and rewards are additional. Franchise value is an estimate of the organization, separate from cash.</p>
    <details className="mt-4 rounded-xl border border-white/10 p-3"><summary className="min-h-8 cursor-pointer text-xs font-black">Cash movement ledger · {state.financeHistory?.length ?? 0} recorded entries</summary><div className="mt-2 space-y-3">{state.financeHistory?.length ? state.financeHistory.slice(0, 12).map((entry, i) => <article key={`${entry.season}:${entry.period}:${i}`} className="border-t border-white/10 pt-3 text-xs"><strong>{entry.season} · {entry.period} · {entry.label}</strong><p className="mt-1 leading-5 text-zinc-400">Opening {money(entry.openingCashM)} · decision {money(entry.decisionCashM)} · receipts {money(entry.revenueM)} · staff settlement {money(entry.staffExpenseM)} · closing <b className="text-white">{money(entry.closingCashM)}</b></p></article>) : <p className="text-xs leading-5 text-zinc-400">New transactions will be recorded here. Existing season totals are preserved; earlier transactions are not reconstructed.</p>}</div></details>
  </section>;
}
