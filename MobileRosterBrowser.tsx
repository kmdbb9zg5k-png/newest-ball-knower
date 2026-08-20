import React, { useMemo, useState } from 'react';
import { X, Search, Users } from 'lucide-react';
import { NFL_TEAMS, PLAYERS_DATABASE } from './players';

interface MobileRosterBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileRosterBrowser: React.FC<MobileRosterBrowserProps> = ({ isOpen, onClose }) => {
  const [selectedTeam, setSelectedTeam] = useState('PHI');
  const [query, setQuery] = useState('');

  const team = useMemo(() => NFL_TEAMS.find(t => t.code === selectedTeam) || NFL_TEAMS[0], [selectedTeam]);
  const roster = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLAYERS_DATABASE
      .filter(p => p.team === selectedTeam)
      .filter(p => !q || `${p.name} ${p.position}`.toLowerCase().includes(q))
      .sort((a, b) => (b.overallRating ?? b.ovr ?? 0) - (a.overallRating ?? a.ovr ?? 0));
  }, [selectedTeam, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0b0b0b]/95 backdrop-blur px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--bk-team-accent)]">2026 NFL Rosters</div>
            <h2 className="text-xl font-black uppercase">32 Team Roster Browser</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5" aria-label="Close roster browser">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {NFL_TEAMS.map(t => (
            <button
              key={t.code}
              onClick={() => { setSelectedTeam(t.code); setQuery(''); }}
              className={`min-h-12 rounded-xl border px-2 py-2 text-center transition ${selectedTeam === t.code ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/15 text-white' : 'border-white/10 bg-white/[.04] text-zinc-400'}`}
            >
              <div className="text-xs font-black">{t.code}</div>
              <div className="truncate text-[9px]">{t.name}</div>
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#111318] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--bk-team-accent)]">Selected Team</div>
              <h3 className="mt-1 text-2xl font-black uppercase leading-none">{team.city} {team.name}</h3>
              <div className="mt-1 text-xs font-bold text-zinc-500">{roster.length} players shown</div>
            </div>
            <Users className="h-8 w-8 text-[var(--bk-team-accent)]" />
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search this roster..."
              className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-3 text-sm outline-none focus:border-[var(--bk-team-accent)]"
            />
          </div>
        </section>

        <div className="space-y-2 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {roster.map(player => (
            <div key={player.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#111318] px-3 py-3">
              <div className="min-w-0 pr-3">
                <div className="truncate text-sm font-black uppercase">{player.name}</div>
                <div className="mt-0.5 text-[11px] font-bold text-zinc-500">{player.position} · {player.team}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-black text-[var(--bk-team-accent)]">{player.overallRating ?? player.ovr}</div>
                <div className="text-[9px] font-black uppercase text-zinc-600">OVR</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
