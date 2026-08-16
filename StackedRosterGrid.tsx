import React from 'react';
import { Player, PositionGroup, TOTAL_ROSTER_SIZE } from '../types';
import { Shield, Plus, Trash2, CheckCircle2, ChevronRight, Sparkles, AlertTriangle } from 'lucide-react';
import { calculateTeamRatings } from '../utils/evaluation';

export interface StackedRosterGridProps {
  roster: Player[];
  onRemove: (playerId: string) => void;
  onScout: (player: Player) => void;
  onSelectPositionFilter?: (group: PositionGroup) => void;
  isLocked?: boolean;
  compact?: boolean;
  totalSpent?: number;
  salaryCap?: number;
}

interface SlotDefinition {
  id: string;
  slotLabel: string;
  positionGroup: PositionGroup;
  category: 'offense' | 'defense';
  matchPosition: (p: Player) => boolean;
  slotIndex: number;
}

const ROSTER_SLOT_DEFINITIONS: SlotDefinition[] = [
  // OFFENSE (10 SLOTS)
  { id: 'qb-1', slotLabel: 'QB', positionGroup: 'QB', category: 'offense', matchPosition: p => p.position === 'QB', slotIndex: 0 },
  { id: 'rb-1', slotLabel: 'RB', positionGroup: 'RB', category: 'offense', matchPosition: p => p.position === 'RB', slotIndex: 0 },
  { id: 'wr-1', slotLabel: 'WR1', positionGroup: 'WR', category: 'offense', matchPosition: p => p.position === 'WR', slotIndex: 0 },
  { id: 'wr-2', slotLabel: 'WR2', positionGroup: 'WR', category: 'offense', matchPosition: p => p.position === 'WR', slotIndex: 1 },
  { id: 'te-1', slotLabel: 'TE', positionGroup: 'TE', category: 'offense', matchPosition: p => p.position === 'TE', slotIndex: 0 },
  { id: 'ol-1', slotLabel: 'LT', positionGroup: 'OL', category: 'offense', matchPosition: p => ['OT', 'OG', 'C'].includes(p.position), slotIndex: 0 },
  { id: 'ol-2', slotLabel: 'LG', positionGroup: 'OL', category: 'offense', matchPosition: p => ['OT', 'OG', 'C'].includes(p.position), slotIndex: 1 },
  { id: 'ol-3', slotLabel: 'C', positionGroup: 'OL', category: 'offense', matchPosition: p => ['OT', 'OG', 'C'].includes(p.position), slotIndex: 2 },
  { id: 'ol-4', slotLabel: 'RG', positionGroup: 'OL', category: 'offense', matchPosition: p => ['OT', 'OG', 'C'].includes(p.position), slotIndex: 3 },
  { id: 'ol-5', slotLabel: 'RT', positionGroup: 'OL', category: 'offense', matchPosition: p => ['OT', 'OG', 'C'].includes(p.position), slotIndex: 4 },

  // DEFENSE (10 SLOTS)
  { id: 'dl-1', slotLabel: 'EDGE1', positionGroup: 'DL_EDGE', category: 'defense', matchPosition: p => ['EDGE', 'DT', 'DE'].includes(p.position), slotIndex: 0 },
  { id: 'dl-2', slotLabel: 'EDGE2', positionGroup: 'DL_EDGE', category: 'defense', matchPosition: p => ['EDGE', 'DT', 'DE'].includes(p.position), slotIndex: 1 },
  { id: 'dl-3', slotLabel: 'DT1', positionGroup: 'DL_EDGE', category: 'defense', matchPosition: p => ['EDGE', 'DT', 'DE'].includes(p.position), slotIndex: 2 },
  { id: 'dl-4', slotLabel: 'DT2', positionGroup: 'DL_EDGE', category: 'defense', matchPosition: p => ['EDGE', 'DT', 'DE'].includes(p.position), slotIndex: 3 },
  { id: 'lb-1', slotLabel: 'LB1', positionGroup: 'LB', category: 'defense', matchPosition: p => p.position === 'LB', slotIndex: 0 },
  { id: 'lb-2', slotLabel: 'LB2', positionGroup: 'LB', category: 'defense', matchPosition: p => p.position === 'LB', slotIndex: 1 },
  { id: 'cb-1', slotLabel: 'CB1', positionGroup: 'CB', category: 'defense', matchPosition: p => p.position === 'CB', slotIndex: 0 },
  { id: 'cb-2', slotLabel: 'CB2', positionGroup: 'CB', category: 'defense', matchPosition: p => p.position === 'CB', slotIndex: 1 },
  { id: 's-1', slotLabel: 'S1', positionGroup: 'S', category: 'defense', matchPosition: p => p.position === 'S', slotIndex: 0 },
  { id: 's-2', slotLabel: 'S2', positionGroup: 'S', category: 'defense', matchPosition: p => p.position === 'S', slotIndex: 1 },
];

export const StackedRosterGrid: React.FC<StackedRosterGridProps> = ({
  roster,
  onRemove,
  onScout,
  onSelectPositionFilter,
  isLocked = false,
  compact = false,
  totalSpent = 0,
  salaryCap = 200,
}) => {
  // Map roster players to slots
  const assignedSlots = React.useMemo(() => {
    // Categorize roster players
    const pool = {
      QB: roster.filter(p => p.position === 'QB'),
      RB: roster.filter(p => p.position === 'RB'),
      WR: roster.filter(p => p.position === 'WR'),
      TE: roster.filter(p => p.position === 'TE'),
      OL: roster.filter(p => ['OT', 'OG', 'C'].includes(p.position)),
      DL_EDGE: roster.filter(p => ['EDGE', 'DT', 'DE'].includes(p.position)),
      LB: roster.filter(p => p.position === 'LB'),
      CB: roster.filter(p => p.position === 'CB'),
      S: roster.filter(p => p.position === 'S'),
    };

    return ROSTER_SLOT_DEFINITIONS.map(slot => {
      const candidates = pool[slot.positionGroup] || [];
      const player = candidates[slot.slotIndex] || null;
      return {
        ...slot,
        player,
      };
    });
  }, [roster]);

  const offenseSlots = assignedSlots.filter(s => s.category === 'offense');
  const defenseSlots = assignedSlots.filter(s => s.category === 'defense');

  const offenseFilled = offenseSlots.filter(s => s.player !== null).length;
  const defenseFilled = defenseSlots.filter(s => s.player !== null).length;

  const teamRatings = React.useMemo(() => calculateTeamRatings(roster), [roster]);

  const getPositionBadgeColor = (posGroup: PositionGroup) => {
    switch (posGroup) {
      case 'QB':
        return 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40';
      case 'RB':
      case 'WR':
      case 'TE':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'OL':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'DL_EDGE':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'LB':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'CB':
      case 'S':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-white/10';
    }
  };

  const renderSlotRow = (slot: (typeof assignedSlots)[0]) => {
    const { player, slotLabel, positionGroup } = slot;
    const badgeColor = getPositionBadgeColor(positionGroup);

    if (!player) {
      return (
        <div
          key={slot.id}
          id={`roster-slot-empty-${slot.id}`}
          onClick={() => onSelectPositionFilter?.(positionGroup)}
          className="group flex items-center justify-between rounded-sm border border-dashed border-white/10 bg-[#0E0E0E] px-2.5 py-1.5 hover:border-[#D4AF37]/50 hover:bg-[#141414] transition-all cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`flex h-5 w-8 items-center justify-center rounded-xs border text-[9px] font-black font-mono tracking-tight shrink-0 opacity-60 group-hover:opacity-100 ${badgeColor}`}
            >
              {slotLabel}
            </span>
            <span className="text-[11px] font-bold text-zinc-500 group-hover:text-zinc-300 uppercase tracking-wider truncate">
              Empty Slot
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-wider text-zinc-600 group-hover:text-[#D4AF37] flex items-center gap-0.5">
              <span>+ Draft {slot.positionGroup.replace('_', '/')}</span>
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        key={slot.id}
        id={`roster-slot-filled-${player.id}`}
        className="group flex items-center justify-between rounded-sm border border-white/5 bg-[#121212] px-2.5 py-1.5 hover:border-[#D4AF37]/40 hover:bg-[#161616] transition-all"
      >
        {/* Left Slot Identifier + Player Name */}
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <span
            className={`flex h-5 w-8 items-center justify-center rounded-xs border text-[9px] font-black font-mono tracking-tight shrink-0 ${badgeColor}`}
          >
            {slotLabel}
          </span>
          <button
            onClick={() => onScout(player)}
            className="text-left font-display text-xs font-black uppercase tracking-tight text-white hover:text-[#D4AF37] transition-colors truncate block cursor-pointer"
            title={`${player.name} (${player.position}, ${player.teamCity} ${player.team})`}
          >
            {player.name}
          </button>
          <span className="hidden sm:inline rounded-xs bg-zinc-800/80 px-1 py-0.2 text-[8px] font-mono font-bold text-zinc-400 shrink-0">
            {player.team}
          </span>
        </div>

        {/* Right Details & Quick Action */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-xs bg-[#D4AF37]/15 border border-[#D4AF37]/30 px-1.5 py-0.2 font-mono text-[9px] font-black text-[#D4AF37]">
            {player.overallRating ?? player.ovr}
          </span>
          <span className="font-mono text-xs font-black text-white w-10 text-right">
            ${player.salary}M
          </span>

          {!isLocked && (
            <button
              id={`remove-player-btn-${player.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(player.id);
              }}
              className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xs transition-colors cursor-pointer"
              title="Remove from roster"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* Compact Team Ratings Ribbon (Ultra-Space-Efficient) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-white/10 bg-[#121212] px-3 py-2 text-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">OVR</span>
            <span className="font-mono text-sm font-black text-[#D4AF37]">{teamRatings.overall}</span>
          </div>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">OFF</span>
            <span className="font-mono text-xs font-black text-white">{teamRatings.offense}</span>
          </div>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">DEF</span>
            <span className="font-mono text-xs font-black text-white">{teamRatings.defense}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold text-zinc-400">
            {roster.length}/{TOTAL_ROSTER_SIZE} SLOTS
          </span>
          <span className="font-mono text-xs font-black text-[#D4AF37]">
            ${totalSpent}M / ${salaryCap}M
          </span>
        </div>
      </div>

      {/* 2-Column Stacked Grid: Offense (10) on Left, Defense (10) on Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* OFFENSE STACKED GRID */}
        <div className="rounded-lg border border-white/5 bg-[#0A0A0A] p-3 space-y-1.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/5 mb-1 px-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white">
                OFFENSE ({offenseFilled}/10)
              </span>
            </div>
            <span className="text-[9px] font-mono text-zinc-500 font-bold">
              ${offenseSlots.reduce((sum, s) => sum + (s.player?.salary || 0), 0)}M
            </span>
          </div>

          <div className="space-y-1">
            {offenseSlots.map(slot => renderSlotRow(slot))}
          </div>
        </div>

        {/* DEFENSE STACKED GRID */}
        <div className="rounded-lg border border-white/5 bg-[#0A0A0A] p-3 space-y-1.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/5 mb-1 px-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white">
                DEFENSE ({defenseFilled}/10)
              </span>
            </div>
            <span className="text-[9px] font-mono text-zinc-500 font-bold">
              ${defenseSlots.reduce((sum, s) => sum + (s.player?.salary || 0), 0)}M
            </span>
          </div>

          <div className="space-y-1">
            {defenseSlots.map(slot => renderSlotRow(slot))}
          </div>
        </div>
      </div>
    </div>
  );
};
