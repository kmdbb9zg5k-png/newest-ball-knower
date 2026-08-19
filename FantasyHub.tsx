import React from 'react';
import { ArrowRight, Shield, Trophy, Users } from 'lucide-react';
import { League } from './types';
import { useBallKnower } from './BallKnowerContext';

interface FantasyHubProps {
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onSelectLeague: (league: League, tab: 'lobby' | 'draft' | 'simulation') => void;
}

export const FantasyHub: React.FC<FantasyHubProps> = ({ onOpenCreateLeague, onOpenJoinLeague, onSelectLeague }) => {
  const { leagues, currentUser } = useBallKnower();

  return (
    <div className="min-h-[calc(100vh-7rem)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.28em] text-[#D4AF37]"><Trophy className="h-4 w-4" /> Fantasy</div>
          <h2 className="font-display text-4xl font-black uppercase sm:text-6xl">League <span className="text-[#D4AF37]">HQ</span></h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Create a league, join with a code, build under the cap, and compete for fantasy draft order.</p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <button onClick={onOpenCreateLeague} className="group rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37] p-6 text-left text-black shadow-lg shadow-[#D4AF37]/10 transition hover:bg-amber-300">
            <Shield className="h-7 w-7" />
            <div className="mt-5 text-2xl font-black uppercase">Create League</div>
            <div className="mt-1 text-sm font-bold text-black/65">Start a new Ball Knower league and invite your group.</div>
            <div className="mt-5 flex items-center gap-2 text-xs font-black uppercase tracking-wider">Start league <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
          </button>
          <button onClick={onOpenJoinLeague} className="group rounded-xl border border-white/10 bg-[#121212]/90 p-6 text-left text-white transition hover:border-[#D4AF37]/40">
            <Users className="h-7 w-7 text-[#D4AF37]" />
            <div className="mt-5 text-2xl font-black uppercase">Join League</div>
            <div className="mt-1 text-sm font-medium text-zinc-400">Enter a league code and jump into the competition.</div>
            <div className="mt-5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#D4AF37]">Enter code <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-xl font-black uppercase">Your Leagues</h3>
            <p className="text-xs text-zinc-500">{leagues.length} active or saved league{leagues.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        {leagues.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#111]/90 p-10 text-center text-zinc-400">No leagues yet. Create one or join with a code.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {leagues.map(league => {
              const mine = league.members.find(m => m.userId === currentUser?.id);
              const submitted = league.members.filter(m => m.status === 'ready').length;
              return (
                <div key={league.id} className="rounded-xl border border-white/10 bg-[#111]/90 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-mono text-xs font-black text-[#D4AF37]">{league.code}</div><h4 className="mt-1 text-xl font-black uppercase">{league.name}</h4></div>
                    {league.commissionerId === currentUser?.id && <span className="border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#D4AF37]">Commissioner</span>}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-black/30 p-3 text-center">
                    <div><div className="text-[9px] font-black uppercase text-zinc-500">Owners</div><div className="mt-1 font-black">{league.members.length}/{league.maxMembers}</div></div>
                    <div><div className="text-[9px] font-black uppercase text-zinc-500">Ready</div><div className="mt-1 font-black text-[#D4AF37]">{submitted}</div></div>
                    <div><div className="text-[9px] font-black uppercase text-zinc-500">Your Team</div><div className="mt-1 font-black">{mine?.status === 'ready' ? 'LOCKED' : 'BUILD'}</div></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => onSelectLeague(league, league.status === 'completed' ? 'simulation' : 'lobby')} className="flex-1 border border-white/10 bg-[#181818] py-2.5 text-xs font-black uppercase tracking-wider hover:border-[#D4AF37]/40">{league.status === 'completed' ? 'Results' : 'Lobby'}</button>
                    {league.status !== 'completed' && <button onClick={() => onSelectLeague(league, 'draft')} className="flex-1 bg-[#D4AF37] py-2.5 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300">Draft Board</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
