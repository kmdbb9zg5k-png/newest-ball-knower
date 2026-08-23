import React, { lazy, Suspense, useMemo, useState } from 'react';
import { League } from './types';
import { FantasyLeagueCommandCenter } from './FantasyLeagueCommandCenter';
import { LockedDraftOrderView } from './LockedDraftOrderView';
import { OwnerCareerSync } from './OwnerCareerSync';
import { FantasyLeagueEssentials } from './FantasyLeagueEssentials';

const loadFantasySeasonHub = () => import('./FantasySeasonHub').then(module => ({ default: module.FantasySeasonHub }));
const loadFantasySeasonAdmin = () => import('./FantasySeasonAdmin').then(module => ({ default: module.FantasySeasonAdmin }));
const loadLeagueIntelligenceHub = () => import('./LeagueIntelligenceHub').then(module => ({ default: module.LeagueIntelligenceHub }));
const loadIntelligenceExtras = () => import('./IntelligenceExtras').then(module => ({ default: module.IntelligenceExtras }));

interface LeagueLobbyProps {
  league: League;
  onGoToDraft: () => void;
  onGoToSimulation: () => void;
}

interface ModeErrorBoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
}

interface ModeErrorBoundaryState {
  error: Error | null;
}

class ModeErrorBoundary extends React.Component<ModeErrorBoundaryProps, ModeErrorBoundaryState> {
  state: ModeErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ModeErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('League mode failed to load', error);
  }

  private retry = () => {
    this.setState({ error: null });
    this.props.onRetry();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-6 text-center">
        <div className="text-sm font-black uppercase text-amber-300">This league view could not load.</div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">Your league data is still safe. Retry this view without leaving League HQ.</p>
        <button onClick={this.retry} className="mt-4 min-h-11 rounded-xl bg-[#D4AF37] px-5 text-[10px] font-black uppercase tracking-wider text-black">Retry View</button>
      </div>
    );
  }
}

export const LeagueLobby: React.FC<LeagueLobbyProps> = ({ league, onGoToDraft, onGoToSimulation }) => {
  const [mode, setMode] = useState<'command' | 'season' | 'intelligence'>('command');
  const [lazyVersion, setLazyVersion] = useState(0);
  const FantasySeasonHub = useMemo(() => lazy(loadFantasySeasonHub), [lazyVersion]);
  const FantasySeasonAdmin = useMemo(() => lazy(loadFantasySeasonAdmin), [lazyVersion]);
  const LeagueIntelligenceHub = useMemo(() => lazy(loadLeagueIntelligenceHub), [lazyVersion]);
  const IntelligenceExtras = useMemo(() => lazy(loadIntelligenceExtras), [lazyVersion]);
  const retryMode = () => setLazyVersion(version => version + 1);
  const result = league.seasonResult;
  const hasLockedDraftOrder = league.status === 'completed' && Boolean(result?.draftOrder?.length);

  return (
    <div className="min-h-[calc(100dvh-7rem)] bg-[#07090c] text-white">
      <OwnerCareerSync league={league} />
      <div className="mx-auto max-w-6xl px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-[#0d1015] p-1 sm:gap-2 sm:rounded-2xl sm:p-2">
          <button onClick={() => setMode('command')} className={`min-h-10 min-w-0 rounded-lg px-1 text-[9px] font-black uppercase tracking-[.06em] sm:min-h-12 sm:rounded-xl sm:text-[11px] sm:tracking-[.12em] ${mode === 'command' ? 'bg-[#D4AF37] text-black' : 'text-zinc-400'}`}><span className="sm:hidden">League HQ</span><span className="hidden sm:inline">Command Center</span></button>
          <button onClick={() => setMode('season')} className={`min-h-10 min-w-0 rounded-lg px-1 text-[9px] font-black uppercase tracking-[.06em] sm:min-h-12 sm:rounded-xl sm:text-[11px] sm:tracking-[.12em] ${mode === 'season' ? 'bg-white text-black' : 'text-zinc-400'}`}><span className="sm:hidden">Season</span><span className="hidden sm:inline">Season Universe</span></button>
          <button onClick={() => setMode('intelligence')} className={`min-h-10 min-w-0 rounded-lg px-1 text-[9px] font-black uppercase tracking-[.06em] sm:min-h-12 sm:rounded-xl sm:text-[11px] sm:tracking-[.12em] ${mode === 'intelligence' ? 'bg-[#D4AF37] text-black' : 'text-zinc-400'}`}><span className="sm:hidden">Intel</span><span className="hidden sm:inline">BK Intelligence</span></button>
        </div>
      </div>
      {mode === 'command' ? (
        hasLockedDraftOrder ? <LockedDraftOrderView league={league} onGoToDraft={onGoToDraft} onViewResults={onGoToSimulation} /> : <FantasyLeagueCommandCenter league={league} onGoToDraft={onGoToDraft} onGoToSimulation={onGoToSimulation} />
      ) : mode === 'season' ? (
        <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
          <ModeErrorBoundary key={`season-${lazyVersion}`} onRetry={retryMode}>
            <Suspense fallback={<Loading label="Loading Season Universe…" />}>
              <FantasySeasonHub league={league} />
              <FantasyLeagueEssentials league={league} />
              <FantasySeasonAdmin league={league} />
            </Suspense>
          </ModeErrorBoundary>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
          <ModeErrorBoundary key={`intelligence-${lazyVersion}`} onRetry={retryMode}>
            <Suspense fallback={<Loading label="Loading Ball Knower Intelligence…" />}>
              <LeagueIntelligenceHub league={league} />
              <IntelligenceExtras league={league} />
            </Suspense>
          </ModeErrorBoundary>
        </div>
      )}
    </div>
  );
};

const Loading=({label}:{label:string})=><div className="rounded-2xl border border-white/10 bg-[#101318] p-8 text-center text-xs font-black uppercase tracking-widest text-zinc-500">{label}</div>;
