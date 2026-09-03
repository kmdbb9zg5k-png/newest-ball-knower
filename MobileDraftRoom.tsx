import React, { useEffect, useMemo, useState } from 'react';
import { Search, Shield, CheckCircle2, RotateCcw, Users } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { useSoundtrack } from './SoundtrackContext';
import { NFL_TEAMS, PLAYERS_DATABASE } from './players';
import { Player, PositionGroup, TOTAL_ROSTER_SIZE } from './types';

interface MobileDraftRoomProps {
  onBackToLobby: () => void;
  onSubmitSuccess: () => void;
}

const BATCH_SIZE = 36;

export const MobileDraftRoom: React.FC<MobileDraftRoomProps> = ({ onBackToLobby, onSubmitSuccess }) => {
  const {
    activeLeague,
    currentRoster,
    isRosterLocked,
    addToRoster,
    removeFromRoster,
    clearRoster,
    submitRoster,
    totalSpent,
    remainingCap,
    rosterCounts,
    rosterValidationErrors,
    isRosterValid,
    showToast,
  } = useBallKnower();
  const { playDraftPickSfx, playRemoveSfx, playLockSfx, playWarningSfx } = useSoundtrack();

  const [selectedGroup, setSelectedGroup] = useState<PositionGroup | 'ALL'>('ALL');
  const [selectedTeam, setSelectedTeam] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'ovr_desc' | 'price_asc' | 'value_desc'>('ovr_desc');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const salaryCap = activeLeague?.salaryCap || 200;

  const filteredPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PLAYERS_DATABASE.filter(player => {
      if (selectedGroup !== 'ALL') {
        if (selectedGroup === 'OL' && !['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'].includes(player.position)) return false;
        else if (selectedGroup === 'DL_EDGE' && !['EDGE', 'DT', 'DE', 'NT'].includes(player.position)) return false;
        else if (selectedGroup === 'RB' && !['RB', 'FB'].includes(player.position)) return false;
        else if (selectedGroup === 'S' && !['S', 'FS', 'SS'].includes(player.position)) return false;
        else if (!['OL', 'DL_EDGE', 'RB', 'S'].includes(selectedGroup) && player.position !== selectedGroup && player.positionGroup !== selectedGroup) return false;
      }
      if (selectedTeam !== 'ALL' && player.team !== selectedTeam) return false;
      if (q) {
        const haystack = `${player.name} ${player.team} ${player.teamCity || ''} ${player.teamName || ''} ${player.position} ${player.archetype || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return a.salary - b.salary;
      if (sortBy === 'value_desc') return (b.ovr / Math.max(b.salary, 1)) - (a.ovr / Math.max(a.salary, 1));
      return b.ovr - a.ovr;
    });
  }, [selectedGroup, selectedTeam, searchQuery, sortBy]);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [selectedGroup, selectedTeam, searchQuery, sortBy]);

  const visiblePlayers = filteredPlayers.slice(0, visibleCount);

  const handleAdd = (player: Player) => {
    const result = addToRoster(player, PLAYERS_DATABASE);
    if (result.success) playDraftPickSfx();
    else {
      playWarningSfx();
      showToast(result.message);
    }
  };

  const handleRemove = (playerId: string) => {
    removeFromRoster(playerId);
    playRemoveSfx();
  };

  const handleSubmit = async () => {
    const result = await submitRoster();
    if (result.success) {
      playLockSfx();
      onSubmitSuccess();
    } else {
      playWarningSfx();
      showToast(result.message);
    }
  };

  const tabs: { id: PositionGroup | 'ALL'; label: string; count?: number }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'QB', label: 'QB', count: rosterCounts.QB },
    { id: 'RB', label: 'RB', count: rosterCounts.RB },
    { id: 'WR', label: 'WR', count: rosterCounts.WR },
    { id: 'TE', label: 'TE', count: rosterCounts.TE },
    { id: 'OL', label: 'OL', count: rosterCounts.OL },
    { id: 'DL_EDGE', label: 'DL/EDGE', count: rosterCounts.DL_EDGE },
    { id: 'LB', label: 'LB', count: rosterCounts.LB },
    { id: 'CB', label: 'CB', count: rosterCounts.CB },
    { id: 'S', label: 'S', count: rosterCounts.S },
    { id: 'K', label: 'K', count: rosterCounts.K },
    { id: 'P', label: 'P', count: rosterCounts.P },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] px-3 pb-28 pt-3 text-white">
      <div className="sticky top-16 z-30 mb-3 rounded-xl border border-white/10 bg-[#111]/95 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-500">Draft Board</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-black font-mono">${totalSpent.toFixed(1)}M</span>
              <span className="text-xs font-bold text-zinc-500">/ ${salaryCap.toFixed(1)}M</span>
              <span className={remainingCap < 0 ? 'text-xs font-black text-red-400' : 'text-xs font-black text-[var(--bk-team-accent)]'}>${remainingCap.toFixed(1)}M left</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-500">Roster</div>
            <div className="text-lg font-black font-mono">{currentRoster.length}/{TOTAL_ROSTER_SIZE}</div>
          </div>
        </div>
        {!isRosterLocked && currentRoster.length > 0 && !isRosterValid && (
          <div className="mt-2 truncate rounded-md border border-amber-400/20 bg-amber-400/5 px-2 py-1 text-[10px] font-bold text-amber-300">{rosterValidationErrors[0]}</div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={onBackToLobby} className="min-h-11 rounded-xl border border-white/10 bg-[#151515] px-3 text-xs font-black uppercase tracking-wider">← Lobby</button>
        {!isRosterLocked && currentRoster.length > 0 && <button onClick={clearRoster} className="min-h-11 rounded-xl border border-red-500/25 bg-red-500/10 px-3 text-xs font-black uppercase text-red-300"><RotateCcw className="mr-1 inline h-3.5 w-3.5"/>Reset</button>}
        <button onClick={handleSubmit} disabled={!isRosterValid || isRosterLocked} className={`min-h-11 flex-1 rounded-xl px-3 text-xs font-black uppercase tracking-wider ${isRosterValid && !isRosterLocked ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]' : 'bg-zinc-800 text-zinc-500'}`}>
          {isRosterLocked ? 'Locked' : isRosterValid ? 'Submit Roster' : 'Build Roster'}
        </button>
      </div>

      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search player, team, position..." className="min-h-12 w-full rounded-xl border border-white/10 bg-[#121212] pl-10 pr-3 text-sm font-bold outline-none focus:border-[var(--bk-team-accent)]" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select aria-label="Position group" value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value as PositionGroup|'ALL')} className="min-h-11 min-w-0 rounded-xl border border-white/10 bg-[#121212] px-2 text-xs font-bold text-white">
            {tabs.map(tab=><option key={tab.id} value={tab.id}>{tab.label}{tab.count!==undefined?` · ${tab.count}`:''}</option>)}
          </select>
          <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} className="min-h-11 rounded-xl border border-white/10 bg-[#121212] px-2 text-xs font-bold text-white">
            <option value="ALL">All 32 Teams</option>
            {NFL_TEAMS.map(team => <option key={team.code} value={team.code}>{team.code} · {team.name}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="min-h-11 rounded-xl border border-white/10 bg-[#121212] px-2 text-xs font-bold text-white">
            <option value="ovr_desc">OVR High-Low</option>
            <option value="price_asc">Salary Low-High</option>
            <option value="value_desc">Best Value</option>
          </select>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-zinc-500">
        <span><Users className="mr-1 inline h-3.5 w-3.5" />{filteredPlayers.length} matches</span>
        <span>Showing {Math.min(visibleCount, filteredPlayers.length)}</span>
      </div>

      <div className="space-y-2">
        {visiblePlayers.map(player => {
          const onRoster = currentRoster.some(p => p.id === player.id);
          const canAfford = remainingCap >= player.salary;
          return (
            <div key={player.id} className={`flex min-h-[74px] items-center justify-between gap-3 rounded-xl border p-3 ${onRoster ? 'border-[var(--bk-team-accent)]/60 bg-[var(--bk-team-accent)]/5' : 'border-white/8 bg-[#121212]'}`}>
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{player.name}</div>
                <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider text-zinc-500">{player.position} · {player.team} · {player.overallRating ?? player.ovr} OVR</div>
                <div className="mt-1 text-xs font-black font-mono text-[var(--bk-team-accent)]">${player.salary}M</div>
              </div>
              {isRosterLocked ? (
                onRoster ? <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-400"><CheckCircle2 className="h-4 w-4"/>Rostered</div> : null
              ) : onRoster ? (
                <button onClick={() => handleRemove(player.id)} className="min-h-10 shrink-0 rounded-lg bg-red-600 px-3 text-[10px] font-black uppercase">Remove</button>
              ) : (
                <button aria-label={!canAfford?`${player.name} is over your remaining cap`:currentRoster.length>=TOTAL_ROSTER_SIZE?'Your roster is full':`Add ${player.name}`} onClick={() => handleAdd(player)} disabled={!canAfford || currentRoster.length >= TOTAL_ROSTER_SIZE} className={`min-h-10 shrink-0 rounded-lg px-3 text-[9px] font-black uppercase ${canAfford && currentRoster.length < TOTAL_ROSTER_SIZE ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-500'}`}>{!canAfford?'Over Cap':currentRoster.length>=TOTAL_ROSTER_SIZE?'Roster Full':'Add'}</button>
              )}
            </div>
          );
        })}
      </div>

      {visibleCount < filteredPlayers.length && (
        <button onClick={() => setVisibleCount(count => Math.min(count + BATCH_SIZE, filteredPlayers.length))} className="mt-4 min-h-12 w-full rounded-xl border border-[var(--bk-team-accent)]/40 bg-[var(--bk-team-accent)]/10 text-xs font-black uppercase tracking-wider text-[var(--bk-team-accent)]">Load {Math.min(BATCH_SIZE, filteredPlayers.length - visibleCount)} More Players</button>
      )}

      {filteredPlayers.length === 0 && <div className="rounded-xl border border-white/10 bg-[#121212] p-8 text-center text-sm font-bold text-zinc-500"><Shield className="mx-auto mb-2 h-7 w-7"/>No players match those filters.</div>}
    </div>
  );
};