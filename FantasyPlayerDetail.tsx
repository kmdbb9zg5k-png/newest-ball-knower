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

type DetailTab = 'overview' | 'gameLog' | 'stats';

const points = (week: FantasyPlayerWeek, kind: 'actual' | 'projected') => {
  const values = kind === 'actual' ? week.fantasyPoints : week.projectedPoints;
  const value = values.ppr;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const STAT_LABELS: Record<string, string> = {
  passYards: 'Pass Yds',
  passingYards: 'Pass Yds',
  passTd: 'Pass TD',
  passTD: 'Pass TD',
  passingTd: 'Pass TD',
  passingTD: 'Pass TD',
  interceptions: 'INT',
  passingInterceptions: 'INT',
  rushAttempts: 'Rush Att',
  rushingAttempts: 'Rush Att',
  rushYards: 'Rush Yds',
  rushingYards: 'Rush Yds',
  rushTd: 'Rush TD',
  rushTD: 'Rush TD',
  rushingTd: 'Rush TD',
  rushingTD: 'Rush TD',
  receptions: 'Rec',
  targets: 'Targets',
  recYards: 'Rec Yds',
  receivingYards: 'Rec Yds',
  recTd: 'Rec TD',
  recTD: 'Rec TD',
  receivingTd: 'Rec TD',
  receivingTD: 'Rec TD',
  fieldGoalsMade: 'FG',
  extraPointsMade: 'XP',
  sacks: 'Sacks',
  fumblesRecovered: 'FR',
  defensiveTouchdowns: 'DEF TD',
};

const statLabel = (key: string) =>
  STAT_LABELS[key] ||
  key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

const numericStats = (stats: Record<string, unknown>) =>
  Object.entries(stats)
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([key, value]) => [key, Number(value)] as const);

const DEFAULT_STAT_KEYS: Record<string, string[]> = {
  QB: ['passYards', 'passTd', 'interceptions', 'rushAttempts', 'rushYards', 'rushTd'],
  RB: ['rushAttempts', 'rushYards', 'rushTd', 'targets', 'receptions', 'recYards'],
  WR: ['targets', 'receptions', 'recYards', 'recTd', 'rushAttempts', 'rushYards'],
  TE: ['targets', 'receptions', 'recYards', 'recTd'],
  K: ['fieldGoalsMade', 'extraPointsMade'],
  DST: ['sacks', 'interceptions', 'fumblesRecovered', 'defensiveTouchdowns'],
};

const formatStat = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const formatKickoff = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const opponentLabel = (week: FantasyPlayerWeek) => {
  if (week.isBye) return 'Bye';
  if (!week.opponentTeam) return 'Opponent unavailable';
  if (week.isHome === null) return week.opponentTeam;
  return `${week.isHome ? 'vs' : '@'} ${week.opponentTeam}`;
};

const compactEmptyText = (season: 2026 | 2025) =>
  `${season} weekly game log is not available yet for this player.`;

export const FantasyPlayerDetail: React.FC<Props> = ({
  player,
  ownerName,
  injuryStatus,
  ranking,
  watchAction,
  onClose,
}) => {
  const [season, setSeason] = useState<2026 | 2025>(2026);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [weeks, setWeeks] = useState<FantasyPlayerWeek[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!player) return;
    setSeason(2026);
    setTab('overview');
  }, [player?.id]);

  useEffect(() => {
    if (!player) return;
    let active = true;
    let hasGoodRows = false;
    setBusy(true);
    setError('');
    setWeeks([]);
    const refresh = async () => {
      try {
        const rows = await loadFantasyPlayerWeeks({
          id: player.id,
          name: player.name,
          team: player.team,
          position: player.position,
          projectedPoints2026: ranking?.projected_points_2026,
        });
        if (!active) return;
        setWeeks(rows);
        setError('');
        hasGoodRows = rows.length > 0;
      } catch (err) {
        if (active && !hasGoodRows) {
          setError(err instanceof Error ? err.message : 'Player history could not be loaded.');
        }
      } finally {
        if (active) setBusy(false);
      }
    };
    void refresh();
    const refreshTimer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [player?.id, player?.name, player?.team, player?.position, ranking?.projected_points_2026]);

  useEffect(() => {
    if (!player) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [player, onClose]);

  const visible = useMemo(
    () => weeks.filter(row => row.season === season).sort((a, b) => a.week - b.week),
    [weeks, season],
  );
  const finals = useMemo(() => visible.filter(row => row.isFinal), [visible]);
  const focusWeek = useMemo(
    () => visible.find(row => !row.isFinal) || visible[visible.length - 1],
    [visible],
  );
  const gameLogStatKeys = useMemo(() => {
    const counts = new Map<string, number>();
    finals.forEach(week => {
      numericStats(week.stats).forEach(([key, value]) => {
        if (value !== 0) counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([key]) => key);
  }, [finals]);
  const seasonStats = useMemo(() => {
    const totals = new Map<string, number>();
    finals.forEach(week => {
      numericStats(week.stats).forEach(([key, value]) => {
        totals.set(key, (totals.get(key) || 0) + value);
      });
    });
    return [...totals.entries()]
      .filter(([, value]) => value !== 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 12);
  }, [finals]);

  if (!player) return null;

  const portrait = playerPortraitUrl(player);
  const teamName = [player.teamCity, player.teamName].filter(Boolean).join(' ').trim();
  const status = injuryStatus || (player.injured ? 'Injured' : 'Active');
  const actualFinals = finals.filter(row => points(row, 'actual') !== null);
  const total = actualFinals.reduce((sum, row) => sum + (points(row, 'actual') || 0), 0);
  const seasonProjection = ranking && Number.isFinite(Number(ranking.projected_points_2026))
    ? Number(ranking.projected_points_2026)
    : null;
  const priorSeasonPoints = ranking && ranking.actual_points_2025 !== null && Number.isFinite(Number(ranking.actual_points_2025))
    ? Number(ranking.actual_points_2025)
    : null;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} fantasy details`}
        className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/85 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-4 sm:pb-4"
      >
        <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-[28px] border border-white/10 bg-[#171a20] text-white shadow-2xl sm:rounded-[28px]">
          <header className="relative min-h-48 overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#222631] via-[#181b21] to-[#0b0d11] p-5 pr-32 sm:min-h-52 sm:p-6 sm:pr-48">
            <button
              aria-label="Close player details"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="relative z-10 flex min-h-36 flex-col justify-end sm:min-h-40">
              <div className="text-xs font-black uppercase tracking-[.14em] text-zinc-300">
                {player.position} · {player.team}{player.jerseyNumber ? ` · #${player.jerseyNumber}` : ''}
              </div>
              <h2 className="mt-1 break-words text-3xl font-black leading-[1.02] tracking-tight sm:text-4xl">
                {player.name}
              </h2>
              {teamName && <div className="mt-1 text-xs font-semibold text-zinc-400">{teamName}</div>}
              {ownerName && <div className="mt-1 text-xs font-semibold text-zinc-400">Manager: {ownerName}</div>}
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase">
                <span className={`rounded-full px-3 py-1.5 ${player.injured || injuryStatus ? 'bg-red-500/15 text-red-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
                  {status}
                </span>
                {ranking && (
                  <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1.5 text-[#D4AF37]">
                    Overall #{ranking.overall_rank}
                  </span>
                )}
              </div>
            </div>

            {portrait ? (
              <img
                src={portrait}
                alt=""
                className="absolute bottom-0 right-5 h-40 w-28 object-contain object-bottom sm:right-10 sm:h-44 sm:w-36"
              />
            ) : (
              <div className="absolute bottom-5 right-5 grid h-24 w-24 place-items-center rounded-full border border-white/10 bg-[#20242d] text-2xl font-black text-zinc-200 sm:right-10">
                {player.name.split(' ').map(part => part[0]).slice(0, 2).join('')}
              </div>
            )}
          </header>

          <div className="grid grid-cols-3 border-b border-white/10 bg-[#1a1d24]">
            <Metric
              label="2026 Projection"
              value={seasonProjection === null ? '—' : seasonProjection.toFixed(1)}
              sublabel="Full PPR"
            />
            <Metric
              label="Pos Rank"
              value={ranking ? `#${ranking.position_rank}` : '—'}
              sublabel={player.position}
            />
            <Metric
              label="2025 Points"
              value={priorSeasonPoints === null ? '—' : priorSeasonPoints.toFixed(1)}
              sublabel={ownerName ? `Rostered by ${ownerName}` : 'Season total'}
            />
          </div>

          <nav aria-label="Player detail sections" className="grid grid-cols-3 border-b border-white/10 bg-[#171a20] px-2">
            {([
              ['overview', 'Overview'],
              ['gameLog', 'Game Log'],
              ['stats', 'Stats'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                aria-pressed={tab === value}
                className={`min-h-12 border-b-[3px] px-2 text-sm font-black transition ${tab === value ? 'border-[#D4AF37] text-white' : 'border-transparent text-zinc-400'}`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 border-b border-white/10 bg-[#14171c] px-4 py-2.5">
            {([2026, 2025] as const).map(value => (
              <button
                key={value}
                onClick={() => setSeason(value)}
                className={`min-h-10 rounded-full px-4 text-[11px] font-black ${season === value ? 'bg-[#D4AF37] text-black' : 'bg-white/[.05] text-zinc-400'}`}
              >
                {value}
              </button>
            ))}
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-zinc-600">
              {season} season
            </span>
          </div>

          <div className="bg-[#171a20]">
            {tab === 'overview' && (
              <OverviewTab
                season={season}
                week={focusWeek}
                ranking={ranking}
                busy={busy}
                error={error}
              />
            )}
            {tab === 'gameLog' && (
              <GameLogTab
                season={season}
                weeks={visible}
                statKeys={gameLogStatKeys}
                position={player.position}
                busy={busy}
                error={error}
              />
            )}
            {tab === 'stats' && (
              <StatsTab
                season={season}
                finals={finals}
                scoredFinals={actualFinals}
                total={total}
                stats={seasonStats}
                ranking={ranking}
                busy={busy}
                error={error}
              />
            )}
          </div>

          {watchAction && (
            <footer className="border-t border-white/10 bg-[#101217] px-4 py-3">
              <button
                onClick={watchAction.onToggle}
                className="min-h-12 w-full rounded-xl bg-[#D4AF37] text-sm font-black text-black"
              >
                {watchAction.watched ? 'REMOVE FROM MY GUYS' : 'ADD TO MY GUYS'}
              </button>
            </footer>
          )}
          <div aria-hidden="true" className="h-[max(.75rem,env(safe-area-inset-bottom))] bg-[#101217] sm:h-3" />
        </div>
      </div>
    </ModalPortal>
  );
};

const Metric = ({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) => (
  <div className="min-w-0 border-r border-white/10 px-2 py-3 text-center last:border-r-0 sm:px-4">
    <div className="truncate text-[9px] font-black uppercase tracking-wide text-zinc-500">{label}</div>
    <div className="mt-1 text-xl font-black">{value}</div>
    <div className="mt-0.5 truncate text-[9px] font-semibold text-zinc-500">{sublabel}</div>
  </div>
);

const OverviewTab = ({
  season,
  week,
  ranking,
  busy,
  error,
}: {
  season: 2026 | 2025;
  week?: FantasyPlayerWeek;
  ranking?: FantasyRanking;
  busy: boolean;
  error: string;
}) => (
  <div className="space-y-4 p-4 sm:p-5">
    {busy ? (
      <Notice title="Loading player details…" />
    ) : error ? (
      <Notice title="Player history could not be loaded." text={error} warning />
    ) : week ? (
      <section className="rounded-2xl border border-white/10 bg-[#1d2027] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black">
              <CalendarDays className="h-4 w-4 text-[#D4AF37]" />
              Week {week.week} Matchup
            </div>
            <div className="mt-1 text-lg font-black">{opponentLabel(week)}</div>
            <div className="mt-1 text-xs text-zinc-400">
              {[formatKickoff(week.kickoffAt), week.status].filter(Boolean).join(' · ')}
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase ${week.isFinal ? 'bg-zinc-700 text-zinc-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
            {week.isFinal ? 'Final' : 'Upcoming'}
          </span>
        </div>
        <div className="mt-4 flex items-end gap-5">
          <div>
            <div className="text-2xl font-black">
              {points(week, 'projected')?.toFixed(1) || '—'}
            </div>
            <div className="text-[10px] font-bold uppercase text-zinc-500">Projected Points</div>
          </div>
          {week.isFinal && (
            <div>
              <div className="text-2xl font-black">{points(week, 'actual')?.toFixed(1) || '—'}</div>
              <div className="text-[10px] font-bold uppercase text-zinc-500">Fantasy Points</div>
            </div>
          )}
        </div>
      </section>
    ) : (
      <Notice
        title={compactEmptyText(season)}
        text="Season ranking and projection information is still shown below when available."
      />
    )}

    {ranking && (
      <section className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[.05] p-4">
        <div className="text-[10px] font-black uppercase tracking-[.12em] text-[#D4AF37]">Ball Knower Outlook</div>
        <p className="mt-2 text-sm leading-6 text-zinc-300">{ranking.projection_reason}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SmallFact label="Overall" value={`#${ranking.overall_rank}`} />
          <SmallFact label="ADP" value={Number(ranking.adp).toFixed(1)} />
          <SmallFact label="Pos Rank" value={`#${ranking.position_rank}`} />
        </div>
        <div className="mt-3 text-[10px] leading-5 text-zinc-500">
          Model: {ranking.projection_model} · Updated {new Date(ranking.updated_at).toLocaleDateString()}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-black uppercase">
          {ranking.projection_source_url ? (
            <a
              href={ranking.projection_source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#D4AF37] underline"
            >
              Projection source
            </a>
          ) : (
            <span className="text-zinc-500">Projection source: {ranking.projection_source_name}</span>
          )}
          {ranking.actual_source_url && (
            <a
              href={ranking.actual_source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#D4AF37] underline"
            >
              2025 actual source
            </a>
          )}
        </div>
      </section>
    )}

    {week?.projectionReason && (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-[10px] font-black uppercase text-zinc-400">Why this projection</div>
        <p className="mt-2 text-xs leading-5 text-zinc-400">{week.projectionReason}</p>
        <div className="mt-2 text-[9px] text-zinc-600">
          {week.projectionSource}
          {week.projectionCapturedAt
            ? ` · captured ${new Date(week.projectionCapturedAt).toLocaleString()}`
            : ' · season pace until weekly projections publish'}
        </div>
      </section>
    )}
  </div>
);

const GameLogTab = ({
  season,
  weeks,
  statKeys,
  position,
  busy,
  error,
}: {
  season: 2026 | 2025;
  weeks: FantasyPlayerWeek[];
  statKeys: string[];
  position: string;
  busy: boolean;
  error: string;
}) => {
  if (busy) return <div className="p-4"><Notice title="Loading game log…" /></div>;
  if (error) return <div className="p-4"><Notice title="Game log could not be loaded." text={error} warning /></div>;
  if (!weeks.length) {
    return (
      <div className="p-4">
        <Notice
          title={compactEmptyText(season)}
          text="Verified weekly rows will appear here as they become available."
        />
      </div>
    );
  }

  const columns = statKeys.length ? statKeys : (DEFAULT_STAT_KEYS[position] || []).slice(0, 6);

  return (
    <div>
      <div className="overflow-x-auto [scrollbar-width:thin]">
        <table className="w-full min-w-[760px] border-collapse whitespace-nowrap text-left">
          <thead className="sticky top-0 z-10 bg-[#1b1e25]">
            <tr className="border-b border-white/10 text-[10px] font-black text-zinc-300">
              <th className="px-3 py-3">Wk</th>
              <th className="px-3 py-3">Opp</th>
              <th className="px-3 py-3 text-right">Fan Pts</th>
              <th className="px-3 py-3 text-right">Proj Pts</th>
              {columns.map(key => (
                <th key={key} className="whitespace-nowrap px-3 py-3 text-right">{statLabel(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map(week => (
              <tr key={week.id} className="border-b border-white/10 text-xs text-zinc-300 odd:bg-white/[.012]">
                <td className="px-3 py-3.5 font-black text-white">{week.week}</td>
                <td className="px-3 py-3.5">
                  <div className="font-bold">{opponentLabel(week)}</div>
                  {!week.isBye && <div className="mt-0.5 text-[9px] text-zinc-600">{formatKickoff(week.kickoffAt)}</div>}
                </td>
                <td className="px-3 py-3.5 text-right font-black">
                  {points(week, 'actual')?.toFixed(1) || '—'}
                </td>
                <td className="px-3 py-3.5 text-right font-black text-zinc-400">
                  {points(week, 'projected')?.toFixed(1) || '—'}
                </td>
                {columns.map(key => {
                  const raw = week.stats[key];
                  const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
                  return (
                    <td key={key} className="px-3 py-3.5 text-right">
                      {value === null ? '—' : formatStat(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 px-4 py-3 text-[9px] leading-4 text-zinc-600">
        <Activity className="h-3.5 w-3.5 shrink-0" />
        {season === 2026
          ? 'Schedule uses the published NFL slate. Proj Pts uses the Ball Knower Full PPR season pace until a provider weekly projection publishes.'
          : 'Final points and stats use stored scoring rows. Pregame projections appear only when a snapshot was captured.'}
        <Shield className="ml-auto h-3.5 w-3.5 shrink-0" />
      </div>
    </div>
  );
};

const StatsTab = ({
  season,
  finals,
  scoredFinals,
  total,
  stats,
  ranking,
  busy,
  error,
}: {
  season: 2026 | 2025;
  finals: FantasyPlayerWeek[];
  scoredFinals: FantasyPlayerWeek[];
  total: number;
  stats: Array<[string, number]>;
  ranking?: FantasyRanking;
  busy: boolean;
  error: string;
}) => {
  if (busy) return <div className="p-4"><Notice title="Loading stats…" /></div>;
  if (error) return <div className="p-4"><Notice title="Stats could not be loaded." text={error} warning /></div>;

  const rankingTotal = season === 2025 && ranking && ranking.actual_points_2025 !== null && Number.isFinite(Number(ranking.actual_points_2025))
    ? Number(ranking.actual_points_2025)
    : null;
  const displayedFantasyPoints = rankingTotal !== null
    ? rankingTotal.toFixed(1)
    : scoredFinals.length
      ? total.toFixed(1)
      : '—';

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid grid-cols-3 gap-2">
        <SmallFact label="Final Games Stored" value={String(scoredFinals.length)} />
        <SmallFact label="Fantasy Pts" value={displayedFantasyPoints} />
        <SmallFact label="Avg / Stored Game" value={scoredFinals.length ? (total / scoredFinals.length).toFixed(1) : '—'} />
      </div>

      {stats.length ? (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#1d2027]">
          {stats.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between border-b border-white/10 px-4 py-3 last:border-b-0">
              <span className="text-xs font-bold text-zinc-400">{statLabel(key)}</span>
              <span className="text-sm font-black text-white">{formatStat(value)}</span>
            </div>
          ))}
        </section>
      ) : (
        <Notice
          title={`Detailed ${season} weekly stats are not available yet.`}
          text={rankingTotal !== null ? 'The published 2025 fantasy-point total is shown above.' : 'Weekly stat totals will appear here when final scoring rows are available.'}
        />
      )}

      <p className="text-[9px] leading-4 text-zinc-600">
        Weekly aggregates and the stored-game average reflect only available final scoring rows. When a published 2025 season total is available, Fantasy Pts uses that complete season total instead of a partial backfill sum.
      </p>
    </div>
  );
};

const SmallFact = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-white/[.05] p-3 text-center">
    <div className="text-[9px] font-black uppercase text-zinc-500">{label}</div>
    <div className="mt-1 text-lg font-black">{value}</div>
  </div>
);

const Notice = ({
  title,
  text,
  warning = false,
}: {
  title: string;
  text?: string;
  warning?: boolean;
}) => (
  <div className={`rounded-2xl border p-5 text-center ${warning ? 'border-red-400/20 bg-red-500/[.05]' : 'border-white/10 bg-black/15'}`}>
    <div className={`text-sm font-black ${warning ? 'text-red-200' : 'text-zinc-300'}`}>{title}</div>
    {text && <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-zinc-500">{text}</p>}
  </div>
);
