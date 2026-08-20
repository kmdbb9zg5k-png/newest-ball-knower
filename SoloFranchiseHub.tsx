import React, { useState } from 'react';
import { BadgeDollarSign, BriefcaseBusiness, Building2, ChevronRight, Crown, Shuffle, Sparkles, Trophy, Users } from 'lucide-react';
import { SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { OwnerBusinessMode } from './OwnerBusinessMode';
import { PlayerAgentMode } from './PlayerAgentMode';

export type SoloExperience = 'hub' | 'cap' | 'fantasy' | 'real' | 'player';

type Props = {
  onOpen: (experience: Exclude<SoloExperience, 'hub'>) => void;
};

const MODES = [
  {
    id: 'cap' as const,
    eyebrow: 'THE ORIGINAL',
    title: 'CAP CHALLENGE',
    description: 'Draft your 20-player superteam under the cap, then survive 17 games and the playoffs.',
    icon: BadgeDollarSign,
    key: SOLO_FRANCHISE_SAVE_KEYS.cap,
    accent: 'from-amber-400/25 to-transparent',
  },
  {
    id: 'fantasy' as const,
    eyebrow: 'MADDEN-STYLE',
    title: 'FANTASY DRAFT',
    description: 'Pick an NFL team and build a full 53-man roster in a 32-team snake draft with intelligent CPU GMs.',
    icon: Shuffle,
    key: SOLO_FRANCHISE_SAVE_KEYS.fantasy,
    accent: 'from-sky-400/25 to-transparent',
  },
  {
    id: 'real' as const,
    eyebrow: '2026 ROSTERS',
    title: 'REAL TEAM',
    description: 'Take control of a current NFL roster and lead that franchise through a full season.',
    icon: Users,
    key: SOLO_FRANCHISE_SAVE_KEYS.real,
    accent: 'from-emerald-400/25 to-transparent',
  },
  {
    id: 'player' as const,
    eyebrow: 'STORY MODE',
    title: 'MY PLAYER',
    description: 'Create yourself, get drafted, earn XP and upgrade your ratings through an NFL career.',
    icon: Sparkles,
    key: SOLO_FRANCHISE_SAVE_KEYS.player,
    accent: 'from-violet-400/25 to-transparent',
  },
];

function hasSave(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    if (key === SOLO_FRANCHISE_SAVE_KEYS.player) {
      const profile = JSON.parse(raw);
      if (profile?.stage !== 'creator') return true;
      return Boolean(
        profile?.name || profile?.faceImage || profile?.renderImage || profile?.appearancePrompt ||
        profile?.position !== 'WR' || profile?.number !== 17 || profile?.heightInches !== 72 ||
        profile?.weightLbs !== 205 || profile?.bodyBuild !== 48 || profile?.shoulderWidth !== 52 ||
        profile?.armSize !== 46 || profile?.legSize !== 50 || profile?.viewRotation !== 0
      );
    }
    return true;
  } catch {
    return false;
  }
}

export const SoloFranchiseHub: React.FC<Props> = ({ onOpen }) => {
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  if (ownerOpen) return <OwnerBusinessMode onBack={() => setOwnerOpen(false)} />;
  if (agentOpen) return <PlayerAgentMode onBack={() => setAgentOpen(false)} />;

  return (
  <div className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <section className="relative mb-6 min-h-[22rem] overflow-hidden rounded-[2rem] border border-[var(--bk-team-accent)]/45 bg-[#07090d] shadow-2xl sm:min-h-[27rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_45%,rgba(255,255,255,.08),transparent_20%),radial-gradient(circle_at_72%_38%,var(--bk-team-glow),transparent_28%),linear-gradient(115deg,#050608_0%,#0b0e14_48%,#050608_100%)]" />
        <div className="absolute -left-16 top-20 h-px w-[80%] -rotate-12 bg-gradient-to-r from-transparent via-[var(--bk-team-accent)] to-transparent opacity-70 shadow-[0_0_24px_var(--bk-team-accent)]" />
        <div className="absolute -right-24 bottom-24 h-px w-[75%] rotate-12 bg-gradient-to-r from-transparent via-[var(--bk-team-accent)] to-transparent opacity-60" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black via-black/60 to-transparent" />

        <div className="relative z-10 flex min-h-[22rem] flex-col justify-between p-6 sm:min-h-[27rem] sm:p-9 md:w-[68%] md:ml-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 text-[var(--bk-team-accent)]">
              <Crown size={22} />
              <span className="text-[10px] font-black tracking-[.32em]">SOLO FRANCHISE</span>
            </div>
            <button type="button" onClick={() => onOpen('real')} className="min-h-11 rounded-full border border-[var(--bk-team-accent)]/70 bg-[var(--bk-team-accent)]/15 px-5 py-2.5 text-xs font-black tracking-wider shadow-[0_0_25px_var(--bk-team-glow)] transition active:scale-95">
              START <ChevronRight className="ml-1 inline" size={16} />
            </button>
          </div>

          <div className="py-8">
            <div className="mb-4 flex items-center gap-4 md:hidden">
              <div className="grid h-20 w-20 place-items-center rounded-full border border-white/15 bg-black/45 shadow-2xl">
                <Trophy className="text-[var(--bk-team-accent)]" size={42} strokeWidth={1.5} />
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-[var(--bk-team-accent)]/70 to-transparent" />
            </div>
            <h2 className="text-5xl font-black leading-[.84] tracking-[-.045em] sm:text-7xl">CHOOSE<br />YOUR ROAD.</h2>
            <p className="mt-5 max-w-xl text-sm font-semibold leading-relaxed text-zinc-300 sm:text-base">
              Build your roster. Take over a real team. Run the business. Represent NFL players. Create your legacy.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {['REAL TEAMS', '17 GAMES', 'OWNER OFFICE', 'PLAYER AGENT'].map((label) => (
              <div key={label} className="rounded-full border border-white/15 bg-black/45 px-3 py-2 text-center text-[9px] font-black tracking-wider text-zinc-100 backdrop-blur">{label}</div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-16 left-8 hidden md:block">
          <div className="grid h-44 w-44 place-items-center rounded-full border border-white/10 bg-black/35 shadow-[0_0_80px_var(--bk-team-glow)] backdrop-blur-sm">
            <Trophy className="text-[var(--bk-team-accent)] opacity-90" size={92} strokeWidth={1.1} />
          </div>
        </div>
      </section>

      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <button type="button" onClick={() => setOwnerOpen(true)} className="group relative w-full overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[#10151d] p-5 text-left transition active:scale-[.99] sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-400/20 via-transparent to-emerald-400/10" />
          <div className="relative flex h-full flex-col gap-5"><div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-200"><Building2 size={28}/></div><div><div className="text-[10px] font-black tracking-[.22em] text-amber-300">FRONT OFFICE / BUSINESS</div><div className="mt-1 text-3xl font-black">OWNER OFFICE</div><p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-zinc-400">Set stadium prices, invest in the organization, manage fan satisfaction, franchise value and realistic relocation studies.</p></div></div><div className="mt-auto flex items-center justify-between text-xs font-black text-amber-200"><span>ENTER OWNER OFFICE</span><ChevronRight className="transition group-hover:translate-x-1" size={20}/></div></div>
        </button>

        <button type="button" onClick={() => setAgentOpen(true)} className="group relative w-full overflow-hidden rounded-[2rem] border border-violet-300/25 bg-[#10151d] p-5 text-left transition active:scale-[.99] sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-violet-400/20 via-transparent to-sky-400/10" />
          <div className="relative flex h-full flex-col gap-5"><div className="flex items-start gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-violet-300/30 bg-violet-300/10 text-violet-200"><BriefcaseBusiness size={28}/></div><div><div className="text-[10px] font-black tracking-[.22em] text-violet-300">PLAYER REPRESENTATION</div><div className="mt-1 text-3xl font-black">AGENT MODE</div><p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-zinc-400">Recruit real NFL clients, convince them to choose your agency, compete with rival representation and negotiate their future money.</p></div></div><div className="mt-auto flex items-center justify-between text-xs font-black text-violet-200"><span>BUILD YOUR AGENCY</span><ChevronRight className="transition group-hover:translate-x-1" size={20}/></div></div>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map(mode => {
          const Icon = mode.icon;
          const saved = hasSave(mode.key);
          return (
            <button key={mode.id} type="button" onClick={() => onOpen(mode.id)} className="group relative min-h-52 overflow-hidden rounded-[2rem] border border-white/10 bg-[#10151d] p-5 text-left transition active:scale-[.99] sm:min-h-60 sm:p-7">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${mode.accent}`} />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/25 text-[var(--bk-team-accent)]"><Icon size={24} /></div>
                  <span className={`rounded-full border px-3 py-1 text-[9px] font-black tracking-widest ${saved ? 'border-green-400/30 bg-green-400/10 text-green-300' : 'border-white/10 text-zinc-400'}`}>{saved ? 'CONTINUE' : 'START'}</span>
                </div>
                <div className="mt-6 text-[10px] font-black tracking-[.22em] text-[var(--bk-team-accent)]">{mode.eyebrow}</div>
                <div className="mt-1 text-3xl font-black leading-none">{mode.title}</div>
                <p className="mt-3 max-w-md text-sm font-semibold leading-relaxed text-zinc-400">{mode.description}</p>
                <div className="mt-auto flex items-center justify-between pt-5 text-xs font-black"><span>{saved ? 'RESUME FRANCHISE' : 'CREATE FRANCHISE'}</span><ChevronRight className="transition group-hover:translate-x-1" size={20} /></div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
  );
};
