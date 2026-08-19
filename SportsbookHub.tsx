import React, { useEffect, useState } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';

type Game = {
  id: string;
  date?: string;
  status?: string;
  away: string;
  home: string;
  awayAbbr?: string;
  homeAbbr?: string;
  details?: string;
  spread?: number | null;
  overUnder?: number | null;
};

export const SportsbookHub: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/nfl-sportsbook', { cache: 'no-store' });
      if (!r.ok) throw new Error('Odds feed unavailable');
      const data = await r.json();
      setGames(Array.isArray(data?.games) ? data.games : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load NFL odds.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-[calc(100vh-7rem)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[.28em] text-[#D4AF37]"><DollarSign className="h-4 w-4" /> Sportsbook Odds</div>
            <h2 className="font-display text-4xl font-black uppercase sm:text-6xl">NFL <span className="text-[#D4AF37]">Lines</span></h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">Game lines and totals for football context. Informational only.</p>
          </div>
          <button onClick={() => void load()} className="flex shrink-0 items-center gap-2 border border-white/10 bg-[#151515] px-3 py-2 text-xs font-black uppercase tracking-wider text-zinc-300 hover:border-[#D4AF37]/50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error && <div className="mb-5 border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-300">{error}</div>}
        {loading && games.length === 0 ? (
          <div className="space-y-3">{[0,1,2,3].map(i => <div key={i} className="h-32 animate-pulse rounded-xl border border-white/5 bg-white/[.03]" />)}</div>
        ) : games.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#111] p-10 text-center text-zinc-400">No NFL games or lines are posted right now.</div>
        ) : (
          <div className="space-y-3">
            {games.map(game => (
              <div key={game.id} className="rounded-xl border border-white/10 bg-[#111]/90 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">
                  <span>{game.date ? new Date(game.date).toLocaleString() : 'NFL'}</span><span className="text-[#D4AF37]">{game.status || 'Scheduled'}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div><div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Away</div><div className="mt-1 text-xl font-black">{game.away}</div></div>
                  <div className="text-center text-xs font-black uppercase tracking-widest text-zinc-600">AT</div>
                  <div className="sm:text-right"><div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Home</div><div className="mt-1 text-xl font-black">{game.home}</div></div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-black/30 p-3 text-center">
                  <div><div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Line</div><div className="mt-1 text-sm font-black text-[#D4AF37]">{game.details || 'Not posted'}</div></div>
                  <div><div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Spread</div><div className="mt-1 text-sm font-black">{game.spread == null ? '—' : game.spread}</div></div>
                  <div><div className="text-[9px] font-black uppercase tracking-wider text-zinc-500">O/U</div><div className="mt-1 text-sm font-black">{game.overUnder == null ? '—' : game.overUnder}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
