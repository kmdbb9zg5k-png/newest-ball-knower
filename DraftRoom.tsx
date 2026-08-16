import React, { useState, useMemo } from 'react';
import { useBallKnower } from '../context/BallKnowerContext';
import { useSoundtrack } from '../context/SoundtrackContext';
import { PLAYERS_DATABASE, NFL_TEAMS } from '../data/players';
import { Player, PositionGroup, TOTAL_ROSTER_SIZE, ROSTER_REQUIREMENTS } from '../types';
import { PlayerDetailModal } from './PlayerDetailModal';
import { StackedRosterGrid } from './StackedRosterGrid';
import {
  Shield,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  RotateCcw,
  LayoutGrid,
  Users,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { calculateTeamRatings } from '../utils/evaluation';

interface DraftRoomProps {
  onBackToLobby: () => void;
  onSubmitSuccess: () => void;
}

export const DraftRoom: React.FC<DraftRoomProps> = ({ onBackToLobby, onSubmitSuccess }) => {
  const {
    activeLeague,
    currentRoster,
    isRosterLocked,
    addToRoster,
    removeFromRoster,
    clearRoster,
    autoDraftTemplate,
    submitRoster,
    totalSpent,
    remainingCap,
    rosterCounts,
    rosterValidationErrors,
    isRosterValid,
    showToast,
  } = useBallKnower();

  const { playDraftPickSfx, playRemoveSfx, playLockSfx, playWarningSfx } = useSoundtrack();

  const handleAddPlayer = (player: Player) => {
    const res = addToRoster(player);
    if (res.success) {
      playDraftPickSfx();
    } else {
      playWarningSfx();
      showToast(res.message);
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    removeFromRoster(playerId);
    playRemoveSfx();
  };

  const handleAutoDraft = (type: 'balanced' | 'trench' | 'air_raid') => {
    autoDraftTemplate(type);
    playDraftPickSfx();
  };

  const handleClearRoster = () => {
    clearRoster();
    playRemoveSfx();
  };

  const salaryCap = activeLeague?.salaryCap || 200;

  // View state: 'market' (browse/draft players) or 'roster' (full stacked 20-slot grid)
  const [activeViewMode, setActiveViewMode] = useState<'market' | 'roster'>('market');

  // Filter & Search states
  const [selectedGroup, setSelectedGroup] = useState<PositionGroup | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'ovr_desc' | 'ovr_asc' | 'name_asc' | 'name_desc' | 'price_desc' | 'price_asc' | 'value_desc'>('ovr_desc');
  const [maxSalaryFilter, setMaxSalaryFilter] = useState<number>(70);

  // Selected player for detail modal
  const [inspectingPlayer, setInspectingPlayer] = useState<Player | null>(null);
  const [isRosterDrawerOpen, setIsRosterDrawerOpen] = useState(false);

  // Filtered player list
  const filteredPlayers = useMemo(() => {
    return PLAYERS_DATABASE.filter(player => {
      // Position filter
      if (selectedGroup !== 'ALL') {
        if (selectedGroup === 'OL') {
          if (!['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'].includes(player.position)) return false;
        } else if (selectedGroup === 'DL_EDGE') {
          if (!['EDGE', 'DT', 'DE', 'NT'].includes(player.position)) return false;
        } else if (selectedGroup === 'EDGE') {
          if (player.position !== 'EDGE') return false;
        } else if (selectedGroup === 'DL') {
          if (!['DT', 'DE', 'NT'].includes(player.position)) return false;
        } else if (selectedGroup === 'S') {
          if (!['S', 'FS', 'SS'].includes(player.position)) return false;
        } else if (selectedGroup === 'K') {
          if (player.position !== 'K') return false;
        } else if (selectedGroup === 'P') {
          if (player.position !== 'P') return false;
        } else if (selectedGroup === 'RB') {
          if (!['RB', 'FB'].includes(player.position)) return false;
        } else {
          if (player.position !== selectedGroup && player.positionGroup !== selectedGroup) return false;
        }
      }

      // Team filter
      if (selectedTeam !== 'ALL' && player.team !== selectedTeam) {
        return false;
      }

      // Max salary filter
      if (player.salary > maxSalaryFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = player.name.toLowerCase().includes(q);
        const matchesFirst = player.firstName ? player.firstName.toLowerCase().includes(q) : false;
        const matchesLast = player.lastName ? player.lastName.toLowerCase().includes(q) : false;
        const matchesTeam = player.team.toLowerCase().includes(q) || (player.teamCity && player.teamCity.toLowerCase().includes(q)) || (player.teamName && player.teamName.toLowerCase().includes(q));
        const matchesPos = player.position.toLowerCase() === q;
        const matchesArchetype = player.archetype ? player.archetype.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesFirst && !matchesLast && !matchesTeam && !matchesPos && !matchesArchetype) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'ovr_desc') return b.ovr - a.ovr;
      if (sortBy === 'ovr_asc') return a.ovr - b.ovr;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'price_desc') return b.salary - a.salary;
      if (sortBy === 'price_asc') return a.salary - b.salary;
      if (sortBy === 'value_desc') {
        const valA = a.ovr / Math.max(a.salary, 1);
        const valB = b.ovr / Math.max(b.salary, 1);
        return valB - valA;
      }
      return 0;
    });
  }, [selectedGroup, selectedTeam, searchQuery, sortBy, maxSalaryFilter]);

  // Live Synergy Feedback calculations
  const teamRatings = useMemo(() => {
    return calculateTeamRatings(currentRoster);
  }, [currentRoster]);

  const handleSubmit = async () => {
    const res = await submitRoster();
    if (res.success) {
      playLockSfx();
      onSubmitSuccess();
    } else {
      playWarningSfx();
      showToast(res.message);
    }
  };

  const POSITION_TABS: { id: PositionGroup | 'ALL'; label: string; countNeeded?: number; countHave?: number }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'QB', label: 'QB', countNeeded: 1, countHave: rosterCounts.QB },
    { id: 'RB', label: 'RB', countNeeded: 1, countHave: rosterCounts.RB },
    { id: 'WR', label: 'WR', countNeeded: 2, countHave: rosterCounts.WR },
    { id: 'TE', label: 'TE', countNeeded: 1, countHave: rosterCounts.TE },
    { id: 'OL', label: 'OL (4)', countNeeded: 4, countHave: rosterCounts.OL },
    { id: 'DL_EDGE', label: 'DL/EDGE (3)', countNeeded: 3, countHave: rosterCounts.DL_EDGE },
    { id: 'LB', label: 'LB (2)', countNeeded: 2, countHave: rosterCounts.LB },
    { id: 'CB', label: 'CB (2)', countNeeded: 2, countHave: rosterCounts.CB },
    { id: 'S', label: 'S (2)', countNeeded: 2, countHave: rosterCounts.S },
    { id: 'K', label: 'K', countNeeded: 1, countHave: rosterCounts.K },
    { id: 'P', label: 'P', countNeeded: 1, countHave: rosterCounts.P },
  ];

  const percentSpent = Math.min(Math.round((totalSpent / salaryCap) * 100), 100);

  return (
    <div className="min-h-screen pb-32 bg-[#0A0A0A] text-white">
      {/* 1. ALWAYS-PINNED TOP SALARY CAP HEADER (MOBILE & DESKTOP VIEWPORT PINNED) */}
      <div
        id="salary-cap-pinned-header"
        className="sticky top-16 sm:top-20 z-30 w-full border-b border-white/10 bg-[#121212]/95 backdrop-blur-md shadow-2xl transition-all"
      >
        <div className="mx-auto max-w-7xl px-3 py-2 sm:px-8 sm:py-3">
          {/* Main Top Metrics & Action Row */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Financial Cap Breakdown (Ultra-Space-Efficient on Mobile) */}
            <div className="flex items-center gap-2.5 sm:gap-6 min-w-0">
              {/* Cap Spent */}
              <div>
                <span className="hidden sm:block text-[9px] font-black tracking-widest text-zinc-500 uppercase">Salary Cap</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-lg sm:text-2xl font-black tracking-tight text-white font-mono">
                    ${totalSpent}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-500 font-mono">
                    /${salaryCap}M
                  </span>
                </div>
              </div>

              {/* Remaining Cap */}
              <div className="border-l border-white/10 pl-2.5 sm:pl-4">
                <span className="hidden sm:block text-[9px] font-black tracking-widest text-zinc-500 uppercase">Remaining</span>
                <div className="flex items-center gap-1">
                  <span
                    className={`text-sm sm:text-lg font-black font-mono tracking-tight ${
                      remainingCap < 0 ? 'text-red-500' : 'text-[#D4AF37]'
                    }`}
                  >
                    ${remainingCap}M
                  </span>
                  <span className="hidden md:inline text-[9px] font-bold text-zinc-500 uppercase">LEFT</span>
                </div>
              </div>

              {/* Roster Slots Count */}
              <div className="border-l border-white/10 pl-2.5 sm:pl-4">
                <span className="hidden sm:block text-[9px] font-black tracking-widest text-zinc-500 uppercase">Roster</span>
                <div className="flex items-center space-x-1">
                  <span
                    className={`text-sm sm:text-lg font-black font-mono ${
                      currentRoster.length === TOTAL_ROSTER_SIZE ? 'text-[#00FF00]' : 'text-white'
                    }`}
                  >
                    {currentRoster.length}/{TOTAL_ROSTER_SIZE}
                  </span>
                  {currentRoster.length === TOTAL_ROSTER_SIZE && (
                    <span className="hidden xs:inline bg-[#00FF00]/10 border border-[#00FF00]/30 text-[#00FF00] text-[8px] sm:text-[9px] px-1 py-0.2 font-black uppercase rounded-xs">
                      READY
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions & Roster View Switcher */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Stacked Roster View Mode Toggle */}
              <div className="hidden sm:flex rounded-sm bg-black/40 border border-white/10 p-0.5">
                <button
                  id="tab-market-view-btn"
                  onClick={() => setActiveViewMode('market')}
                  className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeViewMode === 'market'
                      ? 'bg-[#D4AF37] text-black shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Users className="h-3 w-3" />
                  <span>Market</span>
                </button>
                <button
                  id="tab-roster-grid-btn"
                  onClick={() => setActiveViewMode('roster')}
                  className={`flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeViewMode === 'roster'
                      ? 'bg-[#D4AF37] text-black shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" />
                  <span>Stacked Grid</span>
                </button>
              </div>

              {/* Roster Drawer Trigger Button (Mobile / Quick Access) */}
              <button
                id="toggle-roster-drawer-btn"
                onClick={() => setIsRosterDrawerOpen(!isRosterDrawerOpen)}
                className="flex items-center gap-1.5 rounded-sm border border-white/10 bg-[#1A1A1A] px-2.5 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-zinc-200 hover:bg-zinc-800 hover:border-[#D4AF37]/50 transition-colors cursor-pointer"
                title="Open 20-Man Roster Drawer"
              >
                <Layers className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span className="hidden xs:inline">Roster</span>
                <span className="font-mono text-[#D4AF37] font-bold">({currentRoster.length}/20)</span>
              </button>

              {/* Submit & Lock Button / Locked Indicator */}
              {isRosterLocked ? (
                <div
                  id="draft-roster-locked-indicator"
                  className="flex items-center gap-1.5 rounded-sm bg-[#00FF00]/10 border border-[#00FF00]/40 px-2.5 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#00FF00]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00FF00] shrink-0" />
                  <span className="hidden sm:inline">ROSTER LOCKED</span>
                  <span className="sm:hidden">LOCKED</span>
                </div>
              ) : (
                <button
                  id="draft-submit-roster-btn"
                  onClick={handleSubmit}
                  disabled={!isRosterValid}
                  className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 sm:px-5 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                    isRosterValid
                      ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 hover:bg-amber-300 cursor-pointer'
                      : 'bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed'
                  }`}
                  title={!isRosterValid ? rosterValidationErrors[0] : 'Submit & Lock 20-Man Roster'}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{isRosterValid ? 'Submit & Lock Roster' : 'Complete Roster'}</span>
                  <span className="sm:hidden">{isRosterValid ? 'Submit' : 'Incomplete'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Micro Progress Bar (Always Pinned at bottom edge of cap bar) */}
          <div className="mt-1.5 h-1 bg-zinc-900 rounded-full overflow-hidden w-full">
            <div
              className={`h-full transition-all duration-300 ${
                remainingCap < 0 ? 'bg-red-500' : percentSpent >= 95 ? 'bg-amber-400' : 'bg-[#D4AF37]'
              }`}
              style={{ width: `${percentSpent}%` }}
            />
          </div>

          {/* Validation Notice Strip */}
          {!isRosterLocked && currentRoster.length > 0 && !isRosterValid && (
            <div className="mt-1 flex items-center justify-between rounded-xs bg-zinc-900/90 border border-[#D4AF37]/30 px-2 py-1 text-[10px] text-[#D4AF37]">
              <div className="flex items-center gap-1.5 truncate">
                <AlertTriangle className="h-3 w-3 shrink-0 text-[#D4AF37]" />
                <span className="font-bold uppercase tracking-wider truncate">
                  {rosterValidationErrors[0]}
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold text-zinc-400 shrink-0 ml-2">
                {TOTAL_ROSTER_SIZE - currentRoster.length} SLOTS REMAINING
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. MAIN DRAFT CONTENT (MARKET VIEW vs STACKED GRID VIEW) */}
      <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-8 sm:pt-6">
        {/* Mobile View Switcher Tabs (Marketplace vs 20-Man Stacked Grid) */}
        <div className="flex sm:hidden items-center justify-between gap-2 mb-4 bg-[#121212] p-1 rounded-sm border border-white/5">
          <button
            onClick={() => setActiveViewMode('market')}
            className={`flex-1 py-1.5 text-center text-xs font-black uppercase tracking-wider rounded-xs transition-all ${
              activeViewMode === 'market'
                ? 'bg-[#D4AF37] text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Scout Market
          </button>
          <button
            onClick={() => setActiveViewMode('roster')}
            className={`flex-1 py-1.5 text-center text-xs font-black uppercase tracking-wider rounded-xs transition-all ${
              activeViewMode === 'roster'
                ? 'bg-[#D4AF37] text-black shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Stacked Grid ({currentRoster.length}/20)
          </button>
        </div>

        {/* VIEW 1: FULL STACKED ROSTER GRID VIEW */}
        {activeViewMode === 'roster' ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#D4AF37]" />
                  <span>20-MAN ROSTER • STACKED GRID VIEW</span>
                </h2>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-0.5">
                  10 Offensive Positions + 10 Defensive Positions • Total Salary: ${totalSpent}M / ${salaryCap}M
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveViewMode('market')}
                  className="rounded-sm border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all cursor-pointer"
                >
                  ← Return to Market
                </button>
                {currentRoster.length > 0 && !isRosterLocked && (
                  <button
                    onClick={clearRoster}
                    className="flex items-center gap-1 rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-red-400 hover:bg-red-500/20 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            {/* Render High-Density Stacked Roster Grid */}
            <StackedRosterGrid
              roster={currentRoster}
              onRemove={removeFromRoster}
              onScout={(p) => setInspectingPlayer(p)}
              onSelectPositionFilter={(group) => {
                setSelectedGroup(group);
                setActiveViewMode('market');
              }}
              isLocked={isRosterLocked}
              totalSpent={totalSpent}
              salaryCap={salaryCap}
            />
          </div>
        ) : (
          /* VIEW 2: PLAYER MARKET (WITH QUICK TOOLS & STACKED CARDS) */
          <div>
            {/* Quick Tools & Template Loaders */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <button
                  onClick={onBackToLobby}
                  className="rounded-sm border border-white/10 bg-[#1A1A1A] px-3 py-1 text-xs font-black uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  ← Back to Lobby
                </button>
                <span className="text-zinc-600">|</span>
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  {filteredPlayers.length} NFL Players
                </span>
              </div>

              {/* Quick Auto-Draft Archetypes */}
              {!isRosterLocked && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mr-1">
                    Presets:
                  </span>
                  <button
                    onClick={() => handleAutoDraft('balanced')}
                    className="flex items-center gap-1 rounded-sm border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-all cursor-pointer"
                    title="Load balanced analytics roster"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Balanced</span>
                  </button>
                  <button
                    onClick={() => handleAutoDraft('trench')}
                    className="rounded-sm border border-white/10 bg-[#1A1A1A] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
                    title="Load heavy OL/DL roster"
                  >
                    Trench
                  </button>
                  <button
                    onClick={() => handleAutoDraft('air_raid')}
                    className="rounded-sm border border-white/10 bg-[#1A1A1A] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
                    title="Load Patrick Mahomes Air Raid roster"
                  >
                    Air Raid
                  </button>
                  {currentRoster.length > 0 && (
                    <button
                      onClick={handleClearRoster}
                      className="flex items-center gap-1 rounded-sm border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-red-400 hover:bg-red-500/20 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Position Filter Tabs (Horizontal Scrolling on Mobile) */}
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {POSITION_TABS.map(tab => {
                  const isSelected = selectedGroup === tab.id;
                  const isFulfilled = tab.countNeeded !== undefined && (tab.countHave || 0) >= tab.countNeeded;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedGroup(tab.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#D4AF37] text-black shadow-md'
                          : 'border border-white/5 bg-[#1A1A1A] text-zinc-300 hover:bg-zinc-800 hover:border-white/20'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.countNeeded !== undefined && (
                        <span
                          className={`rounded-xs px-1.5 py-0.2 text-[9px] font-mono font-bold ${
                            isSelected
                              ? 'bg-black/20 text-black'
                              : isFulfilled
                              ? 'bg-[#00FF00]/20 text-[#00FF00]'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {tab.countHave || 0}/{tab.countNeeded}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search bar + Team Filter + Sort Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {/* Search Input */}
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="SEARCH PLAYER, TEAM, OR POSITION..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full rounded-sm border border-white/10 bg-[#121212] pl-9 pr-4 py-2 text-xs font-bold text-white placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none uppercase tracking-wider"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-[10px] font-black text-zinc-400 hover:text-white"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* Team Filter Dropdown */}
                <div className="relative">
                  <select
                    value={selectedTeam}
                    onChange={e => setSelectedTeam(e.target.value)}
                    className="w-full rounded-sm border border-white/10 bg-[#121212] px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-200 focus:border-[#D4AF37] focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">ALL 32 NFL TEAMS</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.code} value={team.code}>
                        {team.city} {team.name} ({team.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Options */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="w-full rounded-sm border border-white/10 bg-[#121212] px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-200 focus:border-[#D4AF37] focus:outline-none cursor-pointer"
                  >
                    <option value="ovr_desc">OVERALL: HIGH → LOW</option>
                    <option value="ovr_asc">OVERALL: LOW → HIGH</option>
                    <option value="name_asc">ALPHABETICAL: A → Z</option>
                    <option value="name_desc">ALPHABETICAL: Z → A</option>
                    <option value="value_desc">VALUE: OVR PER $M</option>
                    <option value="price_desc">SALARY: HIGH → LOW</option>
                    <option value="price_asc">SALARY: LOW → HIGH</option>
                  </select>
                </div>
              </div>
            </div>

            {/* PLAYER CARDS GRID (Vertically Efficient Stacked Tiles) */}
            {filteredPlayers.length === 0 ? (
              <div className="rounded-lg border border-white/5 bg-[#121212] p-10 text-center">
                <Search className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
                <h3 className="text-xs font-black uppercase text-white mb-1 tracking-wider">No Players Found</h3>
                <p className="text-[11px] text-zinc-400">
                  Try adjusting your search query, position tab, or team filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {filteredPlayers.map(player => {
                  const isOnRoster = currentRoster.some(p => p.id === player.id);
                  const isAffordable = remainingCap >= player.salary;

                  return (
                    <div
                      key={player.id}
                      id={`player-card-${player.id}`}
                      className={`bg-[#121212] p-3 rounded-md flex items-center justify-between transition-all duration-150 group ${
                        isOnRoster
                          ? 'border border-[#D4AF37] ring-1 ring-[#D4AF37]/30 shadow-md shadow-[#D4AF37]/5'
                          : 'border border-white/5 hover:border-[#D4AF37]/40'
                      }`}
                    >
                      {/* Left Info */}
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setInspectingPlayer(player)}
                            className="text-left font-display text-sm font-black tracking-tight text-white group-hover:text-[#D4AF37] transition-colors truncate block cursor-pointer"
                          >
                            {player.name}
                          </button>
                        </div>
                        <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest truncate flex items-center gap-1.5">
                          <span>{player.position} • {player.teamCity} {player.team}</span>
                          {player.position === 'QB' && (
                            player.starter ? (
                              <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[8px] px-1 py-0.2 font-black rounded-xs">
                                {player.projectedStarter ? 'PROJ QB1' : 'QB1'}
                              </span>
                            ) : (
                              <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 text-[8px] px-1 py-0.2 font-black rounded-xs">
                                QB2
                              </span>
                            )
                          )}
                        </div>

                        <div className="mt-1.5 flex items-center space-x-2">
                          <span className="bg-zinc-800 text-[#D4AF37] text-[9px] px-1.5 py-0.2 font-black rounded-xs font-mono">
                            {player.overallRating ?? player.ovr} OVR
                          </span>
                          <span className="text-white text-xs font-black font-mono">
                            ${player.salary}M
                          </span>
                          {player.overallRating === 99 && (
                            <span className="bg-[#D4AF37] text-black text-[8px] px-1 py-0.2 font-black rounded-xs font-mono uppercase">
                              99 CLUB
                            </span>
                          )}
                          {player.highlightStat && (
                            <span className="hidden xl:inline text-[9px] text-zinc-400 truncate max-w-[110px]">
                              • {player.highlightStat}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Action Button */}
                      <div className="shrink-0">
                        {isRosterLocked ? (
                          isOnRoster ? (
                            <span className="bg-[#00FF00]/10 border border-[#00FF00]/30 text-[#00FF00] px-2.5 py-1 rounded-xs text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>ROSTERED</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => setInspectingPlayer(player)}
                              className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-xs text-[9px] font-black uppercase tracking-wider hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
                            >
                              SCOUT
                            </button>
                          )
                        ) : isOnRoster ? (
                          <button
                            onClick={() => handleRemovePlayer(player.id)}
                            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xs text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            REMOVE
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddPlayer(player)}
                            disabled={!isAffordable || currentRoster.length >= TOTAL_ROSTER_SIZE}
                            className={`px-4 py-1.5 rounded-xs text-[10px] font-black uppercase tracking-wider transition-colors ${
                              isAffordable && currentRoster.length < TOTAL_ROSTER_SIZE
                                ? 'bg-white text-black hover:bg-[#D4AF37] cursor-pointer'
                                : 'bg-zinc-800 text-zinc-600 border border-white/5 cursor-not-allowed'
                            }`}
                          >
                            ADD
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SLIDE-OVER 20-MAN ROSTER DRAWER (FEATURING STACKED GRID VIEW) */}
      {isRosterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#0F0F0F] border-l border-white/10 p-4 sm:p-6 overflow-y-auto shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <h3 className="font-display text-lg sm:text-xl font-black text-white flex items-center gap-2 tracking-tight">
                    <Shield className="h-5 w-5 text-[#D4AF37]" />
                    <span>YOUR 20-MAN ROSTER</span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-mono">
                    ${totalSpent}M Spent • ${remainingCap}M Left • {currentRoster.length}/20 Slots
                  </p>
                </div>
                <button
                  onClick={() => setIsRosterDrawerOpen(false)}
                  className="rounded-sm p-1.5 text-zinc-400 hover:bg-[#1A1A1A] hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Locked Warning inside Drawer */}
              {isRosterLocked && (
                <div className="rounded-sm border border-[#00FF00]/40 bg-[#00FF00]/10 p-2.5 text-xs text-[#00FF00] flex items-center gap-2 font-black uppercase tracking-wider">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Roster submitted & locked for 16-game season</span>
                </div>
              )}

              {/* High-Density Stacked Roster Grid in Drawer */}
              <StackedRosterGrid
                roster={currentRoster}
                onRemove={handleRemovePlayer}
                onScout={(p) => setInspectingPlayer(p)}
                onSelectPositionFilter={(group) => {
                  setSelectedGroup(group);
                  setActiveViewMode('market');
                  setIsRosterDrawerOpen(false);
                }}
                isLocked={isRosterLocked}
                totalSpent={totalSpent}
                salaryCap={salaryCap}
              />
            </div>

            {/* Bottom Drawer Action */}
            <div className="pt-4 border-t border-white/5 mt-6">
              {isRosterLocked ? (
                <div className="w-full py-3.5 text-center font-black uppercase text-xs rounded-sm bg-[#00FF00]/10 border border-[#00FF00]/30 text-[#00FF00] flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>ROSTER SUBMITTED & LOCKED</span>
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!isRosterValid}
                  className={`w-full py-3.5 font-black uppercase text-xs sm:text-sm rounded-sm transition-all ${
                    isRosterValid
                      ? 'bg-[#D4AF37] text-black hover:bg-amber-300 shadow-md cursor-pointer'
                      : 'bg-zinc-800 text-zinc-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  {isRosterValid ? 'Submit & Lock Roster' : `Complete Roster (${TOTAL_ROSTER_SIZE - currentRoster.length} Slots Left)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. PLAYER DETAIL SCOUTING MODAL */}
      <PlayerDetailModal
        player={inspectingPlayer}
        onClose={() => setInspectingPlayer(null)}
        onAdd={handleAddPlayer}
        onRemove={handleRemovePlayer}
        isOnRoster={currentRoster.some(p => p.id === inspectingPlayer?.id)}
        isLocked={isRosterLocked}
        remainingCap={remainingCap}
      />
    </div>
  );
};
