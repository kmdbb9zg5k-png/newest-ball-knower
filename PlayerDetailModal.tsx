import React from 'react';
import { Player } from '../types';
import { X, Shield, Plus, Trash2, CheckCircle2, TrendingUp, Zap, Award, AlertTriangle } from 'lucide-react';
import { getTeamData } from '../data/players';

interface PlayerDetailModalProps {
  player: Player | null;
  onClose: () => void;
  onAdd: (player: Player) => void;
  onRemove: (playerId: string) => void;
  isOnRoster: boolean;
  isLocked?: boolean;
  remainingCap?: number;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  onClose,
  onAdd,
  onRemove,
  isOnRoster,
  isLocked = false,
  remainingCap = 200,
}) => {
  if (!player) return null;

  const team = getTeamData(player.team);
  const isAffordable = remainingCap >= player.salary;

  // Group attributes for display
  const attrs = [
    { label: 'Overall Rating', value: player.ovr, max: 99, color: 'text-amber-400' },
    { label: 'Athleticism & Speed', value: player.attributes.athleticism, max: 99, color: 'text-blue-400' },
    { label: 'Football IQ & Awareness', value: player.attributes.footballIQ, max: 99, color: 'text-purple-400' },
    ...(player.attributes.passing ? [{ label: 'Passing Precision', value: player.attributes.passing, max: 99, color: 'text-emerald-400' }] : []),
    ...(player.attributes.rushing ? [{ label: 'Rushing & Vision', value: player.attributes.rushing, max: 99, color: 'text-emerald-400' }] : []),
    ...(player.attributes.receiving ? [{ label: 'Receiving & Route Run', value: player.attributes.receiving, max: 99, color: 'text-emerald-400' }] : []),
    ...(player.attributes.passBlocking ? [{ label: 'Pass Protection', value: player.attributes.passBlocking, max: 99, color: 'text-cyan-400' }] : []),
    ...(player.attributes.runBlocking ? [{ label: 'Run Blocking Power', value: player.attributes.runBlocking, max: 99, color: 'text-cyan-400' }] : []),
    ...(player.attributes.passRush ? [{ label: 'Pass Rush Disruption', value: player.attributes.passRush, max: 99, color: 'text-red-400' }] : []),
    ...(player.attributes.runDefense ? [{ label: 'Run Defense & Tackling', value: player.attributes.runDefense, max: 99, color: 'text-red-400' }] : []),
    ...(player.attributes.coverage ? [{ label: 'Pass Coverage Lockdown', value: player.attributes.coverage, max: 99, color: 'text-indigo-400' }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-lg border border-white/10 bg-[#121212] p-6 sm:p-7 shadow-2xl">
        {/* Close Button */}
        <button
          id="close-player-detail-modal-btn"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Player Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-sm bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2 py-0.5 font-mono text-xs font-black text-[#D4AF37]">
                {player.position}
              </span>
              {player.position === 'QB' && (
                <span className={`rounded-sm px-2 py-0.5 font-mono text-xs font-black uppercase ${
                  player.starter
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
                }`}>
                  {player.starter ? (player.projectedStarter ? 'Projected Starter (QB1)' : 'Starter (QB1)') : 'Backup (QB2)'}
                </span>
              )}
              <span className="text-xs font-bold uppercase text-zinc-300">
                {player.team} • {player.teamCity} {team?.name}
              </span>
            </div>
            <h2 className="font-display text-3xl font-black uppercase tracking-tight text-white">
              {player.name}
            </h2>
            <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider mt-0.5">
              {player.archetype || 'NFL Pro Star'}
            </p>
          </div>

          {/* OVR + Price Pill */}
          <div className="flex flex-col items-end">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[#D4AF37] text-black font-mono text-2xl font-black shadow-inner">
              {player.ovr}
            </div>
            <span className="font-mono text-sm font-black text-[#00FF00] mt-1">
              ${player.salary}M
            </span>
          </div>
        </div>

            {/* Highlight Skill Badge */}
        {player.highlightStat && (
          <div className="rounded-sm border border-[#D4AF37]/30 bg-[#1A1A1A] p-3 mb-3 flex items-center gap-2.5 text-xs text-[#D4AF37]">
            <Zap className="h-4 w-4 text-[#D4AF37] shrink-0" />
            <span className="font-bold uppercase tracking-wider">
              <strong>Signature Trait:</strong> {player.highlightStat}
            </span>
          </div>
        )}

        {/* Official Madden Rating Source & Season Badge */}
        <div className="rounded-sm border border-white/10 bg-black/50 p-2.5 mb-4 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <Award className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span className="text-zinc-400">Rating Source:</span>
            <span className="font-bold text-white uppercase">{player.ratingSource || 'EA SPORTS Madden'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">Season:</span>
            <span className="font-bold text-[#00FF00]">{player.ratingSeason || 2026}</span>
            {player.overallRating === 99 && (
              <span className="bg-[#D4AF37] text-black px-1.5 py-0.2 rounded font-black text-[9px] uppercase">99 Club</span>
            )}
          </div>
        </div>

        {/* Attribute Breakdown */}
        <div className="space-y-3 my-5">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Scouting & Attribute Metrics
          </p>
          <div className="space-y-2.5">
            {attrs.map((attr, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300 font-bold uppercase tracking-wider text-[11px]">{attr.label}</span>
                  <span className={`font-mono font-black ${attr.color}`}>
                    {attr.value}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-[#1A1A1A] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-[#D4AF37] rounded-sm transition-all duration-300"
                    style={{ width: `${(attr.value / attr.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t border-white/10">
          {isLocked ? (
            <div className="w-full flex items-center justify-center gap-2 rounded-sm bg-zinc-800/80 border border-white/10 py-3 text-xs font-black uppercase tracking-wider text-zinc-400">
              <span>🔒 ROSTER IS LOCKED (NO CHANGES ALLOWED)</span>
            </div>
          ) : isOnRoster ? (
            <button
              onClick={() => {
                onRemove(player.id);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-sm border border-red-500/30 bg-red-500/10 py-3 text-xs font-black uppercase tracking-wider text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>REMOVE FROM ROSTER</span>
            </button>
          ) : !isAffordable ? (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 rounded-sm bg-zinc-800 border border-red-500/30 py-3 text-xs font-black uppercase tracking-wider text-red-400 cursor-not-allowed"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>EXCEEDS CAP (NEEDS ${player.salary}M, ONLY ${remainingCap}M LEFT)</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onAdd(player);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-sm bg-[#D4AF37] py-3 text-xs font-black uppercase tracking-wider text-black hover:bg-amber-300 transition-all shadow-md cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>ADD TO ROSTER (${player.salary}M)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
