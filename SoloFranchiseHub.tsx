import React from 'react';
import { BadgeDollarSign, ChevronRight, Crown, Shuffle, Sparkles, Users } from 'lucide-react';
import { SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';

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
        profile?.name ||
        profile?.faceImage ||
        profile?.renderImage ||
        profile?.appearancePrompt ||
        profile?.position !== 'WR' ||
        profile?.number !== 17 ||
        profile?.heightInches !== 72 ||
        profile?.weightLbs !== 205 ||
        profile?.bodyBuild !== 48 ||
        profile?.shoulderWidth !== 52 ||
        profile?.armSize !== 46 ||
        profile?.legSize !== 50 ||
        profile?.viewRotation !== 0
      );
    }
    return true;
  } catch {
    return false;
  }
}

export const SoloFranchiseHub: React.FC<Props> = ({ onOpen }) => (
  <div className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 rounded-[2rem] border border-white/10 bg-[#0d1118]/95 p-5 sm:p-8">
        <div className="flex items-center gap-3 text-[var(--bk-team-accent)]">
          <Crown size={22} />
          <span className="text-[10px] font-black tracking-[.3em]">SOLO FRANCHISE</span>
        </div>
        <h2 className="mt-3 text-4xl font-black leading-[.9] sm:text-6xl">CHOOSE YOUR ROAD</h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-zinc-400 sm:text-base">
          Build a roster, take over a real team, or create your own NFL story. Every road leads to the Super Bowl.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map(mode => {
          const Icon = mode.icon;
          const saved = hasSave(mode.key);
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onOpen(mode.id)}
              className="group relative min-h-52 overflow-hidden rounded-[2rem] border border-white/10 bg-[#10151d] p-5 text-left transition active:scale-[.99] sm:min-h-60 sm:p-7"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${mode.accent}`} />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-black/25 text-[var(--bk-team-accent)]">
                    <Icon size={24} />
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[9px] font-black tracking-widest ${saved ? 'border-green-400/30 bg-green-400/10 text-green-300' : 'border-white/10 text-zinc-400'}`}>
                    {saved ? 'CONTINUE' : 'START'}
                  </span>
                </div>
                <div className="mt-6 text-[10px] font-black tracking-[.22em] text-[var(--bk-team-accent)]">{mode.eyebrow}</div>
                <div className="mt-1 text-3xl font-black leading-none">{mode.title}</div>
                <p className="mt-3 max-w-md text-sm font-semibold leading-relaxed text-zinc-400">{mode.description}</p>
                <div className="mt-auto flex items-center justify-between pt-5 text-xs font-black">
                  <span>{saved ? 'RESUME FRANCHISE' : 'CREATE FRANCHISE'}</span>
                  <ChevronRight className="transition group-hover:translate-x-1" size={20} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
