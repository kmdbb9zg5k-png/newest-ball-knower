import React, { lazy, Suspense, useState } from 'react';
import { League } from './types';
import { FantasyLeagueCommandCenter } from './FantasyLeagueCommandCenter';

const FantasySeasonHub = lazy(() => import('./FantasySeasonHub').then(module => ({ default: module.FantasySeasonHub })));

interface LeagueLobbyProps {
  league: League;
  onGoToDraft: () => void;
  onGoToSimulation: () => void;
}

export const LeagueLobby: React.FC<LeagueLobbyProps> = ({ league, onGoToDraft, onGoToSimulation }) => {
  const [mode, setMode] = useState<'command' | 'season'>('command');
  return (
    <div className="min-h-[calc(100dvh-7rem)] bg-[#07090c] text-white">
      <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-6">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#0d1015] p-2">
          <button onClick={() => setMode('command')} className={`min-h-12 rounded-xl text-[11px] font-black uppercase tracking-[.16em] ${mode === 'command' ? 'bg-[#D4AF37] text-black' : 'text-zinc-400'}`}>Command Center</button>
          <button onClick={() => setMode('season')} className={`min-h-12 rounded-xl text-[11px] font-black uppercase tracking-[.16em] ${mode === 'season' ? 'bg-white text-black' : 'text-zinc-400'}`}>Season Universe</button>
        </div>
      </div>
      {mode === 'command' ? (
        <FantasyLeagueCommandCenter league={league} onGoToDraft={onGoToDraft} onGoToSimulation={onGoToSimulation} />
      ) : (
        <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
          <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-[#101318] p-8 text-center text-xs font-black uppercase tracking-widest text-zinc-500">Loading Season Universe…</div>}>
            <FantasySeasonHub league={league} />
          </Suspense>
        </div>
      )}
    </div>
  );
};
