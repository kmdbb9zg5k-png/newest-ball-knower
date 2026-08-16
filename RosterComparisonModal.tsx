import React, { useState } from 'react';
import { LeagueMember, Player } from '../types';
import { X, Shield, Award, Users, CheckCircle2, ChevronDown, ChevronRight, DollarSign } from 'lucide-react';

interface RosterComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: LeagueMember[];
  draftOrder?: { pickNumber: number; memberId: string; memberName: string }[];
}

export const RosterComparisonModal: React.FC<RosterComparisonModalProps> = ({
  isOpen,
  onClose,
  members,
  draftOrder,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');

  if (!isOpen) return null;

  const selectedMember = members.find(m => m.id === selectedMemberId) || members[0];
  const roster = selectedMember?.roster || [];
  const ratings = selectedMember?.teamRatings;

  const offense = roster.filter(p => ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(p.position));
  const defense = roster.filter(p => ['EDGE', 'DT', 'DE', 'LB', 'CB', 'S'].includes(p.position));
  const totalSpent = roster.reduce((sum, p) => sum + p.salary, 0);

  const memberPick = draftOrder?.find(d => d.memberId === selectedMember?.id)?.pickNumber;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg border border-white/10 bg-[#121212] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#0A0A0A]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#D4AF37] text-black">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-black uppercase tracking-tight text-white">
                LEAGUE ROSTERS & GM BREAKDOWNS
              </h2>
              <p className="text-xs text-zinc-400 uppercase tracking-wider font-bold">
                Inspect every member's 20-player build and evaluation metrics
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-sm p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Member Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto px-6 py-3 border-b border-white/10 bg-[#1A1A1A] no-scrollbar">
          {members.map(member => {
            const isSelected = member.id === selectedMember?.id;
            const pick = draftOrder?.find(d => d.memberId === member.id)?.pickNumber;

            return (
              <button
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#D4AF37] text-black shadow-sm'
                    : 'border border-white/10 bg-[#121212] text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <img
                  src={member.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                  alt={member.userName}
                  className="h-5 w-5 rounded-full object-cover"
                />
                <span>{member.userName}</span>
                {pick && (
                  <span
                    className={`rounded-sm px-1.5 py-0.2 text-[9px] font-mono font-black ${
                      isSelected ? 'bg-black/20 text-black' : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                    }`}
                  >
                    #{pick}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Roster & Metrics Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {selectedMember && (
            <div>
              {/* Member Summary Card */}
              <div className="rounded-lg border border-white/10 bg-[#0A0A0A] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedMember.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                    alt={selectedMember.userName}
                    className="h-12 w-12 rounded-sm object-cover border border-[#D4AF37]"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-black uppercase text-white">
                        {selectedMember.userName}
                      </h3>
                      {memberPick && (
                        <span className="rounded-sm bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-2 py-0.5 text-xs font-black text-[#D4AF37] uppercase tracking-wider">
                          👑 Pick #{memberPick} Overall
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mt-0.5">
                      {selectedMember.aiArchetype || 'Fantasy Football GM'}
                    </p>
                  </div>
                </div>

                {/* Rating Badges */}
                {ratings && (
                  <div className="flex items-center gap-2 sm:gap-3 text-center">
                    <div className="rounded-sm bg-[#1A1A1A] px-3 py-2 border border-white/10">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">OVR Rating</p>
                      <p className="text-sm font-black font-mono text-[#D4AF37]">{ratings.overall}</p>
                    </div>
                    <div className="rounded-sm bg-[#1A1A1A] px-3 py-2 border border-white/10">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Offense</p>
                      <p className="text-sm font-black font-mono text-white">{ratings.offenseRating}</p>
                    </div>
                    <div className="rounded-sm bg-[#1A1A1A] px-3 py-2 border border-white/10">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Defense</p>
                      <p className="text-sm font-black font-mono text-white">{ratings.defenseRating}</p>
                    </div>
                    <div className="rounded-sm bg-[#1A1A1A] px-3 py-2 border border-white/10">
                      <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Salary</p>
                      <p className="text-sm font-black font-mono text-[#00FF00]">${totalSpent}M</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Roster Grid */}
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                {/* Offense */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
                    <span>Offense ({offense.length}/10)</span>
                    <span className="font-mono text-[#00FF00] text-[11px] font-black">
                      ${offense.reduce((s, p) => s + p.salary, 0)}M
                    </span>
                  </h4>
                  <div className="space-y-1.5">
                    {offense.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-sm bg-[#1A1A1A] px-3 py-2 border border-white/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="rounded-sm bg-[#D4AF37]/10 px-1.5 py-0.2 font-mono text-[10px] font-black text-[#D4AF37]">
                            {p.position}
                          </span>
                          <span className="text-xs font-black uppercase text-white truncate">{p.name}</span>
                          <span className="text-[11px] text-zinc-500 font-bold uppercase">{p.team}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-black text-zinc-300">{p.overallRating ?? p.ovr} OVR</span>
                          <span className="font-mono text-xs font-black text-[#00FF00]">${p.salary}M</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Defense */}
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
                    <span>Defense ({defense.length}/10)</span>
                    <span className="font-mono text-[#00FF00] text-[11px] font-black">
                      ${defense.reduce((s, p) => s + p.salary, 0)}M
                    </span>
                  </h4>
                  <div className="space-y-1.5">
                    {defense.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-sm bg-[#1A1A1A] px-3 py-2 border border-white/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="rounded-sm bg-blue-500/10 px-1.5 py-0.2 font-mono text-[10px] font-black text-blue-400">
                            {p.position}
                          </span>
                          <span className="text-xs font-black uppercase text-white truncate">{p.name}</span>
                          <span className="text-[11px] text-zinc-500 font-bold uppercase">{p.team}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-black text-zinc-300">{p.overallRating ?? p.ovr} OVR</span>
                          <span className="font-mono text-xs font-black text-[#00FF00]">${p.salary}M</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
