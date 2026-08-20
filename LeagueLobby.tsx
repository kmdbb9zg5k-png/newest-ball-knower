import React, { lazy, Suspense, useState } from 'react';
import { League } from './types';
import { FantasyLeagueCommandCenter } from './FantasyLeagueCommandCenter';

const FantasySeasonHub = lazy(() => import('./FantasySeasonHub').then(module => ({ default: module.FantasySeasonHub })));
const FantasySeasonAdmin = lazy(() => import('./FantasySeasonAdmin').then(module => ({ default: module.FantasySeasonAdmin })));
const LeagueIntelligenceHub = lazy(() => import('./LeagueIntelligenceHub').then(module => ({ default: module.LeagueIntelligenceHub })));
const IntelligenceExtras = lazy(() => import('./IntelligenceExtras').then(module => ({ default: module.IntelligenceExtras })));

interface LeagueLobbyProps {
  league: League;
  onGoToDraft: () => void;
  onGoToSimulation: () => void;
}

export const LeagueLobby: React.FC<LeagueLobbyProps> = ({ league, onGoToDraft, onGoToSimulation }) => {
  const [mode, setMode] = useState<'command' | 'season' | 'intelligence'>('command');
  return (
    <div className="min-h-[calc(100dvh-7rem)] bg-[#07090c] text-white">
      <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-6">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#0d1015] p-2">
          <button onClick={() => setMode('command')} className={`min-h-12 rounded-xl text-[10px] font-black uppercase tracking-[.12em] sm:text-[11px] ${mode === 'command' ? 'bg-[#D4AF37] text-black' : 'text-zinc-400'}`}>Command Center</button>
          <button onClick={() => setMode('season')} className={`min-h-12 rounded-xl text-[10px] font-black uppercase tracking-[.12em] sm:text-[11px] ${mode === 'season' ? 'bg-white text-black' : 'text-zinc-400'}`}>Season Universe</button>
          <button onClick={() => setMode('intelligence')} className={`min-h-12 rounded-xl text-[10px] font-black uppercase tracking-[.12em] sm:text-[11px] ${mode === 'intelligence' ? 'bg-[#D4AF37] text-black' : 'text-zinc-400'}`}>BK Intelligence</button>
        </div>
      </div>
      {mode === 'command' ? (
        <FantasyLeagueCommandCenter league={league} onGoToDraft={onGoToDraft} onGoToSimulation={onGoToSimulation} />
      ) : mode === 'season' ? (
        <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
          <Suspense fallback={<Loading label="Loading Season Universe…" />}>
            <FantasySeasonHub league={league} />
            <FantasySeasonAdmin league={league} />
          </Suspense>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
          <Suspense fallback={<Loading label="Loading Ball Knower Intelligence…" />}>
            <LeagueIntelligenceHub league={league} />
            <IntelligenceExtras league={league} />
          </Suspense>
        </div>
      )}
    </div>
  );
};

const Loading=({label}:{label:string})=><div className="rounded-2xl border border-white/10 bg-[#101318] p-8 text-center text-xs font-black uppercase tracking-widest text-zinc-500">{label}</div>;
