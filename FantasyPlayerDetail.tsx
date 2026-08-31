import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, Shield, X } from 'lucide-react';
import { Player } from './types';
import { playerPortraitUrl } from './playerPortraits';
import { ModalPortal } from './ModalPortal';
import { FantasyRanking } from './fantasyRankingsCloud';
import { FantasyPlayerWeek, loadFantasyPlayerWeeks } from './fantasyPlayerDetailsCloud';

type Props = {
  player: Player | null;
  ownerName?: string;
  injuryStatus?: string;
  ranking?: FantasyRanking;
  watchAction?: { watched: boolean; onToggle: () => void };
  onClose: () => void;
};

const points = (week: FantasyPlayerWeek, kind: 'actual' | 'projected') =>
  Number((kind === 'actual' ? week.fantasyPoints : week.projectedPoints).ppr || 0);

const usefulStats = (stats: Record<string, unknown>) => Object.entries(stats)
  .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value !== 0)
  .slice(0, 8);

const statLabel = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toUpperCase();

export const FantasyPlayerDetail: React.FC<Props> = ({ player, ownerName, injuryStatus, ranking, watchAction, onClose }) => {
  const [season, setSeason] = useState<2026 | 2025>(2026);
  const [weeks, setWeeks] = useState<FantasyPlayerWeek[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!player) return;
    let active = true;
    setBusy(true);
    setError('');
    loadFantasyPlayerWeeks({ id: player.id, name: player.name, team: player.team, position: player.position })
      .then(rows => { if (active) setWeeks(rows); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Player history could not be loaded.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [player?.id, player?.name, player?.team, player?.position]);

  useEffect(() => {
    if (!player) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [player, onClose]);

  const visible = useMemo(() => weeks.filter(row => row.season === season), [weeks, season]);
  const finals = visible.filter(row => row.isFinal);
  const total = finals.reduce((sum, row) => sum + points(row, 'actual'), 0);
  const recent = finals.slice(-3);
  const recentAverage = recent.length ? recent.reduce((sum, row) => sum + points(row, 'actual'), 0) / recent.length : null;
  if (!player) return null;
  const portrait = playerPortraitUrl(player);

  return <ModalPortal>
    <div role="dialog" aria-modal="true" aria-label={`${player.name} fantasy details`} className="fixed inset-0 z-[9999] overflow-y-auto bg-black/85 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <div className="mx-auto my-auto max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1015] shadow-2xl">
        <header className="relative flex min-h-44 items-end gap-4 overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#28220e] via-[#151515] to-black p-5">
          {portrait ? <img src={portrait} alt="" className="h-32 w-28 shrink-0 object-contain object-bottom" /> : <div className="grid h-28 w-24 shrink-0 place-items-center rounded-2xl bg-white/5 text-2xl font-black">{player.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</div>}
          <div className="min-w-0 pb-2">
            <div className="text-[10px] font-black uppercase tracking-[.18em] text-[#D4AF37]">{player.position} · {player.team}</div>
            <h2 className="truncate text-3xl font-black uppercase">{player.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-black uppercase">
              <span className="rounded-full bg-white/10 px-2 py-1">{injuryStatus || (player.injured ? 'Injured' : 'Active')}</span>
              <span className="rounded-full bg-white/10 px-2 py-1">{ownerName || 'Ownership unavailable'}</span>
              {ranking && <span className="rounded-full bg-[#D4AF37]/15 px-2 py-1 text-[#D4AF37]">Overall #{ranking.overall_rank}</span>}
            </div>
          </div>
          <button aria-label="Close player details" onClick={onClose} className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/40"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2">
            <Summary label="Stored final points" value={finals.length ? total.toFixed(1) : '—'} />
            <Summary label="Stored final avg" value={finals.length ? (total / finals.length).toFixed(1) : '—'} />
            <Summary label="Last 3 stored" value={recentAverage === null ? '—' : recentAverage.toFixed(1)} />
          </div>
          {finals.length > 0 && <p className="text-[9px] leading-4 text-zinc-600">Aggregates include only the {finals.length} stored final week{finals.length === 1 ? '' : 's'} shown below; they are not presented as complete season totals.</p>}
          {ranking && <section className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4"><div className="text-[9px] font-black uppercase text-[#D4AF37]">Ball Knower season outlook</div><p className="mt-2 text-xs leading-5 text-zinc-300">{ranking.projection_reason}</p><div className="mt-2 text-[9px] leading-5 text-zinc-500">2026 projection: {ranking.projected_points_2026.toFixed(1)} points · Model: {ranking.projection_model} · Updated {new Date(ranking.updated_at).toLocaleDateString()}</div><div className="mt-2 flex flex-wrap gap-3 text-[9px] font-black uppercase">{ranking.projection_source_url ? <a href={ranking.projection_source_url} target="_blank" rel="noreferrer" className="text-[#D4AF37] underline">Projection source: {ranking.projection_source_name}</a> : <span className="text-zinc-500">Projection source: {ranking.projection_source_name}</span>}{ranking.actual_source_url && <a href={ranking.actual_source_url} target="_blank" rel="noreferrer" className="text-[#D4AF37] underline">2025 actual source: {ranking.actual_source_name}</a>}</div></section>}
          {watchAction && <button onClick={watchAction.onToggle} className="min-h-12 w-full rounded-xl bg-[#D4AF37] text-sm font-black text-black">{watchAction.watched ? 'REMOVE FROM MY GUYS' : 'ADD TO MY GUYS'}</button>}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/40 p-1">{([2026, 2025] as const).map(value => <button key={value} onClick={() => setSeason(value)} className={`min-h-11 rounded-lg text-[10px] font-black uppercase ${season === value ? 'bg-[#D4AF37] text-black' : 'text-zinc-400'}`}>{value} season</button>)}</div>
          {busy ? <Notice text="Loading authoritative weekly history…" /> : error ? <Notice text={error} warning /> : visible.length ? <div className="space-y-2">{visible.map(week => <WeekCard key={week.id} week={week} />)}</div> : <Notice text={`No verified ${season} weekly rows are stored for this player yet. Ball Knower will not invent missing stats.`} />}
        </div>
      </div>
    </div>
  </ModalPortal>;
};

const Summary = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl bg-white/[.04] p-3"><div className="text-[8px] font-black uppercase text-zinc-600">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>;
const Notice = ({ text, warning = false }: { text: string; warning?: boolean }) => <div className={`rounded-2xl border p-5 text-center text-xs ${warning ? 'border-red-400/20 text-red-200' : 'border-white/10 text-zinc-500'}`}>{text}</div>;
const WeekCard = ({ week }: { week: FantasyPlayerWeek }) => {
  const stats = usefulStats(week.stats);
  const hasProjection = Boolean(week.projectionCapturedAt);
  const opponent = week.opponentTeam ? `${week.isHome ? 'vs' : '@'} ${week.opponentTeam}` : 'Opponent unavailable';
  return <section className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[9px] font-black uppercase text-[#D4AF37]"><CalendarDays className="h-3.5 w-3.5" />Week {week.week} · {opponent}</div><div className="mt-1 text-[10px] text-zinc-500">{new Date(week.kickoffAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {week.status}</div></div><div className="text-right"><div className="text-lg font-black">{week.isFinal ? points(week, 'actual').toFixed(1) : hasProjection ? points(week, 'projected').toFixed(1) : '—'}</div><div className="text-[8px] uppercase text-zinc-600">{week.isFinal ? `Actual · ${hasProjection ? `${points(week, 'projected').toFixed(1)} pregame` : 'pregame projection unavailable'}` : hasProjection ? 'Pregame projection' : 'Projection unavailable'}</div></div></div>{hasProjection && <div className="mt-3 rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/5 p-3"><div className="text-[8px] font-black uppercase text-[#D4AF37]">Why this projection</div><p className="mt-1 text-[10px] leading-4 text-zinc-400">{week.projectionReason}</p><div className="mt-1 text-[8px] text-zinc-600">{week.projectionSource} · captured {new Date(week.projectionCapturedAt!).toLocaleString()}</div></div>}{!hasProjection && <p className="mt-3 text-[9px] leading-4 text-zinc-600">A verified pregame projection snapshot was not stored for this week, so Ball Knower does not reconstruct one after the fact.</p>}{stats.length > 0 && <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">{stats.map(([key, value]) => <div key={key} className="rounded-lg bg-white/[.04] p-2"><div className="text-[7px] font-black text-zinc-600">{statLabel(key)}</div><div className="mt-0.5 text-xs font-black">{String(value)}</div></div>)}</div>}<div className="mt-3 flex items-center gap-2 text-[8px] font-black uppercase text-zinc-600"><Activity className="h-3 w-3" />Verified {week.historySource === 'tank01_historical_boxscore' ? 'historical box score' : 'scoring row'} <Shield className="ml-auto h-3 w-3" /></div></section>;
};
