import React from 'react';
import { ArrowRight, Shield, Trophy, Users, Crown } from 'lucide-react';
import { League } from './types';
import { useBallKnower } from './BallKnowerContext';

interface FantasyHubProps {
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onSelectLeague: (league: League, tab: 'lobby' | 'draft' | 'simulation') => void;
}

export const FantasyHub: React.FC<FantasyHubProps> = ({ onOpenCreateLeague, onOpenJoinLeague, onSelectLeague }) => {
  const { leagues, currentUser } = useBallKnower();
  const memberCount = leagues.reduce((sum, league) => sum + league.members.length, 0);

  return (
    <div className="min-h-[calc(100dvh-7rem)] px-4 pb-10 pt-5 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="relative mb-7 overflow-hidden rounded-[2rem] border border-[#D4AF37]/25 bg-[#080a0d] p-6 shadow-2xl sm:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_38%,rgba(212,175,55,.22),transparent_24%),radial-gradient(circle_at_15%_100%,rgba(212,175,55,.10),transparent_35%),linear-gradient(115deg,#070809,#111318_55%,#060708)]" />
          <div className="pointer-events-none absolute -right-8 top-5 hidden h-64 w-64 place-items-center rounded-full border border-[#D4AF37]/15 bg-black/30 shadow-[0_0_90px_rgba(212,175,55,.16)] sm:grid"><Trophy className="h-36 w-36 text-[#D4AF37]/80" strokeWidth={1} /></div>
          <div className="relative z-10 max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.3em] text-[#D4AF37]"><Trophy className="h-4 w-4" /> Fantasy</div>
            <h2 className="font-display text-5xl font-black uppercase leading-[.88] tracking-[-.045em] sm:text-7xl">League <span className="text-[#D4AF37]">HQ</span></h2>
            <h3 className="mt-5 text-xl font-black uppercase leading-tight sm:text-2xl">Build your league. Beat your friends.<br/><span className="text-[#D4AF37]">Prove you know ball.</span></h3>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-relaxed text-zinc-400">Create a league, invite your crew, build under the cap, and compete for fantasy draft-order glory.</p>
            <div className="mt-5 flex items-center gap-3 text-xs font-black uppercase tracking-wider text-zinc-300"><div className="flex -space-x-2">{[0,1,2,3].map(i => <div key={i} className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#090a0d] bg-zinc-800 text-[10px] text-[#D4AF37]">BK</div>)}</div><span>{memberCount || 0} league members</span></div>
          </div>
        </section>

        <div className="mb-9 grid gap-3 sm:grid-cols-2">
          <button onClick={onOpenCreateLeague} className="group flex min-h-28 items-center gap-4 rounded-2xl border border-[#D4AF37]/50 bg-[#D4AF37] p-5 text-left text-black shadow-lg shadow-[#D4AF37]/10 transition active:scale-[.99]"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-black/15 bg-black/5"><Shield className="h-6 w-6" /></div><div><div className="text-xl font-black uppercase">Create League</div><div className="mt-1 text-xs font-bold text-black/65">Start a new league and invite your group.</div></div><ArrowRight className="ml-auto transition group-hover:translate-x-1" /></button>
          <button onClick={onOpenJoinLeague} className="group flex min-h-28 items-center gap-4 rounded-2xl border border-white/10 bg-[#111318]/95 p-5 text-left transition hover:border-[#D4AF37]/40 active:scale-[.99]"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5"><Users className="h-6 w-6 text-[#D4AF37]" /></div><div><div className="text-xl font-black uppercase">Join With Code</div><div className="mt-1 text-xs font-semibold text-zinc-400">Enter a league code to join instantly.</div></div><ArrowRight className="ml-auto text-[#D4AF37] transition group-hover:translate-x-1" /></button>
        </div>

        <div className="mb-4 flex items-end justify-between border-b border-white/10 pb-4"><div><h3 className="font-display text-2xl font-black uppercase">Your Leagues</h3><p className="mt-1 text-xs font-semibold text-zinc-500">{leagues.length} active or saved league{leagues.length === 1 ? '' : 's'}</p></div><button onClick={onOpenCreateLeague} className="min-h-11 rounded-lg border border-[#D4AF37]/35 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#D4AF37]">+ New League</button></div>

        {leagues.length === 0 ? <div className="rounded-2xl border border-white/10 bg-[#101216]/90 p-10 text-center"><Trophy className="mx-auto mb-3 h-10 w-10 text-[#D4AF37]/60"/><div className="font-black uppercase">Your trophy case is empty</div><p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">Create your first league or join your friends with a code.</p></div> : <div className="grid gap-4">{leagues.map(league => {
          const mine = league.members.find(m => m.userId === currentUser?.id);
          const submitted = league.members.filter(m => m.status === 'ready').length;
          const completed = league.status === 'completed';
          return <article key={league.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1014]/95 p-5 shadow-xl sm:p-6"><div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_80%_45%,rgba(212,175,55,.12),transparent_55%)]"/><div className="relative z-10"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">{league.commissionerId === currentUser?.id && <><Crown className="h-3.5 w-3.5"/> Commissioner · </>}{league.code}</div><h4 className="mt-2 font-display text-2xl font-black uppercase sm:text-3xl">{league.name}</h4><div className="mt-1 text-xs font-bold uppercase tracking-wider text-zinc-500">{league.members.length}/{league.maxMembers} members · {completed ? 'Complete' : 'Private league'}</div></div></div>
          <div className="mt-5 grid grid-cols-2 gap-2 border-y border-white/5 py-4 sm:grid-cols-4"><div><div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Current Phase</div><div className="mt-1 text-sm font-black text-[#D4AF37]">{completed ? 'FINAL' : league.status === 'simulating' ? 'SIMULATING' : submitted === league.members.length && submitted > 1 ? 'READY' : 'DRAFT'}</div></div><div><div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Owners Ready</div><div className="mt-1 text-sm font-black">{submitted}/{league.members.length}</div></div><div><div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Your Roster</div><div className="mt-1 text-sm font-black">{mine?.status === 'ready' ? 'LOCKED' : 'BUILD'}</div></div><div><div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Cap</div><div className="mt-1 text-sm font-black">${league.salaryCap}M</div></div></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"><button onClick={() => onSelectLeague(league, completed ? 'simulation' : 'lobby')} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs font-black uppercase tracking-wider hover:border-[#D4AF37]/35">{completed ? <Trophy className="h-4 w-4"/> : <Users className="h-4 w-4"/>}{completed ? 'View Results' : 'League Lobby'}</button>{!completed && <button onClick={() => onSelectLeague(league, 'draft')} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-xs font-black uppercase tracking-wider text-black">{mine?.status === 'ready' ? 'View Draft Board' : 'Build Your Team'}<ArrowRight className="h-4 w-4"/></button>}</div></div></article>;
        })}</div>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0d10]/90 p-4">
          <div><div className="text-[10px] font-black uppercase tracking-[.22em] text-[#D4AF37]">League Command Center</div><p className="mt-1 text-xs font-semibold text-zinc-500">Open a league above to manage its lobby, roster, draft and results.</p></div>
          <div className="flex gap-2"><button onClick={onOpenJoinLeague} className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-300">Join Code</button><button onClick={onOpenCreateLeague} className="min-h-11 rounded-xl bg-[#D4AF37] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black">New League</button></div>
        </div>
      </div>
    </div>
  );
};
