import React from 'react';
import type { FantasyDraftReport } from './fantasyDraftReport';

/** Additional evidence; the existing grade, W-L and main summary stay visible. */
export const FantasyDraftAnalysis = ({ report }: { report: FantasyDraftReport }) => (
  <details data-testid="fantasy-draft-analysis" className="mt-2 min-w-0 rounded-lg border border-white/10 bg-black/20 text-left [overflow-wrap:anywhere]">
    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">
      Full Draft Analysis<span className="text-[8px] text-zinc-500">{report.confidence} confidence</span>
    </summary>
    <div className="space-y-3 border-t border-white/10 px-3 py-3 text-[11px] leading-5 text-zinc-400">
      <section><h4 className="font-black uppercase text-emerald-300">Strengths</h4>{report.strengths.map(value => <p key={value}>{value}</p>)}</section>
      <section><h4 className="font-black uppercase text-amber-200">Risks</h4>{report.weaknesses.map(value => <p key={value}>{value}</p>)}</section>
      <section><h4 className="font-black uppercase text-zinc-300">Draft Value</h4>
        <p>{report.bestValue ? `${report.bestValue.playerName}: Pick ${report.bestValue.overall}, ${report.bestValue.delta} spots after Ball Knower rank.` : 'No ranked pick cleared the five-slot steal threshold.'}</p>
        <p>{report.biggestReach ? `${report.biggestReach.playerName}: Pick ${report.biggestReach.overall}, ${Math.abs(report.biggestReach.delta)} spots ahead of Ball Knower rank.` : 'No ranked pick cleared the five-slot reach threshold.'}</p>
      </section>
      <section><h4 className="font-black uppercase text-zinc-300">Bench Quality</h4><p>{report.benchQuality} · {report.benchScore}/100</p></section>
      <section><h4 className="font-black uppercase text-zinc-300">Projection Confidence</h4><p>{report.confidenceNote}</p><p>Projected records are preseason estimates, not a guarantee.</p></section>
    </div>
  </details>
);
