import React, { useState } from 'react';
import { LeagueMember } from './types';
import { X, Users } from 'lucide-react';

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

  const offense = roster.filter(p => ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'].includes(p.position));
  const defense = roster.filter(p => ['EDGE', 'DT', 'DE', 'NT', 'LB', 'CB', 'S', 'FS', 'SS'].includes(p.position));
  const specialTeams = roster.filter(p => ['K', 'P'].includes(p.position));
  const totalSpent = roster.reduce((sum, p) => sum + p.salary, 0);
  const memberPick = draftOrder?.find(d => d.memberId === selectedMember?.id)?.pickNumber;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-white/10 bg-[#121212] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0A0A0A] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#D4AF37] text-black"><Users className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display text-xl font-black uppercase tracking-tight text-white">LEAGUE ROSTERS & GM BREAKDOWNS</h2>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Inspect every member's 20-player build and evaluation metrics</p>
            </div>
          </div>
          <button aria-label="Close roster comparison" onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#1A1A1A] px-6 py-3">
          {members.map(member => {
            const isSelected = member.id === selectedMember?.id;
            const pick = draftOrder?.find(d => d.memberId === member.id)?.pickNumber;
            return (
              <button key={member.id} onClick={() => setSelectedMemberId(member.id)} className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-all ${isSelected ? 'bg-[#D4AF37] text-black shadow-sm' : 'border border-white/10 bg-[#121212] text-zinc-300 hover:border-zinc-500'}`}>
                <img src={member.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'} alt={member.userName} className="h-5 w-5 rounded-full object-cover" />
                <span>{member.userName}</span>
                {pick && <span className={`rounded-sm px-1.5 py-0.2 text-[9px] font-mono font-black ${isSelected ? 'bg-black/20 text-black' : 'bg-[#D4AF37]/20 text-[#D4AF37]'}`}>#{pick}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {selectedMember && (
            <div>
              <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-white/10 bg-[#0A0A0A] p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <img src={selectedMember.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'} alt={selectedMember.userName} className="h-12 w-12 rounded-sm border border-[#D4AF37] object-cover" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-black uppercase text-white">{selectedMember.userName}</h3>
                      {memberPick && <span className="rounded-sm border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-[#D4AF37]">👑 Pick #{memberPick} Overall</span>}
                    </div>
                    <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-zinc-400">{selectedMember.aiArchetype || 'Fantasy Football GM'}</p>
                  </div>
                </div>

                {ratings && (
                  <div className="flex items-center gap-2 text-center sm:gap-3">
                    <div className="rounded-sm border border-white/10 bg-[#1A1A1A] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">OVR Rating</p><p className="font-mono text-sm font-black text-[#D4AF37]">{ratings.overall}</p></div>
                    <div className="rounded-sm border border-white/10 bg-[#1A1A1A] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Offense</p><p className="font-mono text-sm font-black text-white">{ratings.offense}</p></div>
                    <div className="rounded-sm border border-white/10 bg-[#1A1A1A] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Defense</p><p className="font-mono text-sm font-black text-white">{ratings.defense}</p></div>
                    <div className="rounded-sm border border-white/10 bg-[#1A1A1A] px-3 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Salary</p><p className="font-mono text-sm font-black text-[#00FF00]">${totalSpent}M</p></div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400"><span>Offense ({offense.length})</span><span className="font-mono text-[11px] font-black text-[#00FF00]">${offense.reduce((s, p) => s + p.salary, 0)}M</span></h4>
                  <div className="space-y-1.5">{offense.map(p => <div key={p.id} className="flex items-center justify-between rounded-sm border border-white/5 bg-[#1A1A1A] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className="rounded-sm bg-[#D4AF37]/10 px-1.5 py-0.2 font-mono text-[10px] font-black text-[#D4AF37]">{p.position}</span><span className="truncate text-xs font-black uppercase text-white">{p.name}</span><span className="text-[11px] font-bold uppercase text-zinc-500">{p.team}</span></div><div className="flex items-center gap-3"><span className="font-mono text-xs font-black text-zinc-300">{p.overallRating ?? p.ovr} OVR</span><span className="font-mono text-xs font-black text-[#00FF00]">${p.salary}M</span></div></div>)}</div>
                </div>

                <div>
                  <h4 className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400"><span>Defense ({defense.length})</span><span className="font-mono text-[11px] font-black text-[#00FF00]">${defense.reduce((s, p) => s + p.salary, 0)}M</span></h4>
                  <div className="space-y-1.5">{defense.map(p => <div key={p.id} className="flex items-center justify-between rounded-sm border border-white/5 bg-[#1A1A1A] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className="rounded-sm bg-blue-500/10 px-1.5 py-0.2 font-mono text-[10px] font-black text-blue-400">{p.position}</span><span className="truncate text-xs font-black uppercase text-white">{p.name}</span><span className="text-[11px] font-bold uppercase text-zinc-500">{p.team}</span></div><div className="flex items-center gap-3"><span className="font-mono text-xs font-black text-zinc-300">{p.overallRating ?? p.ovr} OVR</span><span className="font-mono text-xs font-black text-[#00FF00]">${p.salary}M</span></div></div>)}</div>
                </div>
              </div>

              {specialTeams.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400"><span>Special Teams ({specialTeams.length})</span><span className="font-mono text-[11px] font-black text-[#00FF00]">${specialTeams.reduce((s, p) => s + p.salary, 0)}M</span></h4>
                  <div className="grid gap-1.5 md:grid-cols-2">{specialTeams.map(p => <div key={p.id} className="flex items-center justify-between rounded-sm border border-white/5 bg-[#1A1A1A] px-3 py-2"><div className="flex min-w-0 items-center gap-2"><span className="rounded-sm bg-violet-500/10 px-1.5 py-0.2 font-mono text-[10px] font-black text-violet-300">{p.position}</span><span className="truncate text-xs font-black uppercase text-white">{p.name}</span><span className="text-[11px] font-bold uppercase text-zinc-500">{p.team}</span></div><div className="flex items-center gap-3"><span className="font-mono text-xs font-black text-zinc-300">{p.overallRating ?? p.ovr} OVR</span><span className="font-mono text-xs font-black text-[#00FF00]">${p.salary}M</span></div></div>)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
