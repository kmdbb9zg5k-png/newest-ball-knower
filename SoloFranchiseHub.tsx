import { BroadcastStage } from './BroadcastScene';
import React, { useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Play,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { OwnerBusinessMode } from './OwnerBusinessMode';
import { PlayerAgentMode } from './PlayerAgentMode';
import {
  activateSoloCareer,
  activeSoloCareer,
  applySoloCareerDecision,
  awardSoloChampionships,
  ensureSoloCareerSave,
  isSoloCareerEventResolved,
  loadSoloUniverse,
  nativeSoloModeHasSave,
  persistSoloUniverse,
  SOLO_MODE_META,
  SoloCareerMode,
  soloCareerEvent,
  syncSoloUniverseFromStorage,
  xpForLevel,
} from './soloCareerUniverse';

export type SoloExperience = 'hub' | 'cap' | 'fantasy' | 'real' | 'player';

type Props = {
  onOpen: (experience: Exclude<SoloExperience, 'hub'>) => void;
};

type SceneKey = SoloCareerMode;

type SceneArt = {
  src: string;
  width: number;
  height: number;
  position: string;
};

const MODE_SCENES: Record<SceneKey, SceneArt> = {
  agent: {
    src: '/solo-mode-scenes/agent-mode.webp',
    width: 304,
    height: 368,
    position: '66% center',
  },
  owner: {
    src: '/solo-mode-scenes/owner-office.webp',
    width: 306,
    height: 368,
    position: '58% center',
  },
  cap: {
    src: '/solo-mode-scenes/cap-challenge.webp',
    width: 420,
    height: 211,
    position: '72% center',
  },
  fantasy: {
    src: '/solo-mode-scenes/fantasy-draft.webp',
    width: 304,
    height: 342,
    position: '56% center',
  },
  real: {
    src: '/solo-mode-scenes/franchise-command.webp',
    width: 306,
    height: 342,
    position: '66% center',
  },
  player: {
    src: '/solo-mode-scenes/my-player.webp',
    width: 638,
    height: 349,
    position: '69% center',
  },
};

const MODE_EYEBROW_STYLE: React.CSSProperties = {
  display: 'inline-block',
  width: 'fit-content',
  maxWidth: '100%',
  padding: '4px 7px',
  marginBottom: '7px',
  borderRadius: '999px',
  border: '1px solid rgba(223,185,84,.28)',
  background: 'rgba(5,8,12,.86)',
  color: '#f1f5fa',
  fontWeight: 900,
  lineHeight: 1.25,
  textShadow: '0 1px 3px rgba(0,0,0,.9)',
  boxShadow: '0 2px 8px rgba(0,0,0,.45)',
};

const MODE_TITLE_STYLE: React.CSSProperties = {
  color: '#fff6dc',
  textShadow: '0 2px 8px rgba(0,0,0,.95)',
};

const MODE_DESCRIPTION_STYLE: React.CSSProperties = {
  color: '#dce3ed',
  fontWeight: 600,
  textShadow: '0 1px 6px rgba(0,0,0,.9)',
};

const MODE_CONTINUE_STYLE: React.CSSProperties = {
  color: '#f0c96a',
  textShadow: '0 1px 4px rgba(0,0,0,.9)',
};

function ModeSceneArt({ seed }: { seed: SceneKey }) {
  const art = MODE_SCENES[seed];

  return (
    <span
      aria-hidden="true"
      data-scene-art={seed}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <img
        src={art.src}
        alt=""
        loading="lazy"
        decoding="async"
        width={art.width}
        height={art.height}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: art.position,
          opacity: 0.72,
          filter: 'saturate(.9) contrast(1.05)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg,rgba(4,7,11,.97) 0%,rgba(4,7,11,.92) 44%,rgba(4,7,11,.62) 72%,rgba(4,7,11,.30) 100%),linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.55))',
        }}
      />
    </span>
  );
}

const MODES = [
  {
    id: 'agent' as const,
    eyebrow: 'PLAYER REPRESENTATION',
    title: 'AGENT MODE',
    description: 'Recruit clients, negotiate contracts, handle trade demands and build a powerhouse agency.',
    icon: BriefcaseBusiness,
  },
  {
    id: 'owner' as const,
    eyebrow: 'FRONT OFFICE / BUSINESS',
    title: 'OWNER OFFICE',
    description: 'Hire staff, manage money, protect fan trust and make decisions that shape the organization.',
    icon: Building2,
  },
  {
    id: 'cap' as const,
    eyebrow: 'THE ORIGINAL',
    title: 'CAP CHALLENGE',
    description: 'Draft your 20-player superteam under the cap, then survive 17 games and the playoffs.',
    icon: BadgeDollarSign,
  },
  {
    id: 'fantasy' as const,
    eyebrow: 'CREATE YOUR LEAGUE',
    title: 'FANTASY DRAFT',
    description: 'Create a custom football team, draft a full 53-man roster, then play through the Legacy Bowl.',
    icon: Shuffle,
  },
  {
    id: 'real' as const,
    eyebrow: 'FLAGSHIP CAREER',
    title: 'FRANCHISE COMMAND',
    description: 'Run football operations: weekly game plans, roster pressure, trades, development and championships.',
    icon: Users,
  },
  {
    id: 'player' as const,
    eyebrow: 'STORY MODE',
    title: 'MY PLAYER',
    description: 'Create yourself, earn your role, hit weekly goals, upgrade ratings and build a career legacy.',
    icon: Sparkles,
  },
];

function modeHasSave(mode: SoloCareerMode) {
  try {
    if (mode === 'cap') return Boolean(localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.cap));
    if (mode === 'fantasy') return Boolean(localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.fantasy));
    if (mode === 'real') return Boolean(localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.real));
    if (mode === 'player') {
      const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.player);
      if (!raw) return false;
      const profile = JSON.parse(raw);
      if (profile?.stage !== 'creator') return true;
      return Boolean(
        profile?.name || profile?.faceImage || profile?.renderImage || profile?.appearancePrompt ||
        profile?.position !== 'WR' || profile?.number !== 17 || profile?.heightInches !== 72 ||
        profile?.weightLbs !== 205 || profile?.bodyBuild !== 48 || profile?.shoulderWidth !== 52 ||
        profile?.armSize !== 46 || profile?.legSize !== 50 || profile?.viewRotation !== 0
      );
    }
    return nativeSoloModeHasSave(mode);
  } catch {
    return false;
  }
}

function progressLabel(week: number, stage: string) {
  if (stage.toLowerCase().includes('finished')) return 'Season complete';
  if (stage.toLowerCase().includes('draft')) return 'Draft';
  if (stage.toLowerCase().includes('playoff')) return stage;
  if (week <= 0) return stage || 'Preseason';
  return `Week ${week}`;
}

export const SoloFranchiseHub: React.FC<Props> = ({ onOpen }) => {
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [universe, setUniverse] = useState(() => {
    try {
      const synced = syncSoloUniverseFromStorage(loadSoloUniverse());
      const awarded = awardSoloChampionships(synced);
      persistSoloUniverse(awarded);
      return awarded;
    } catch {
      return loadSoloUniverse();
    }
  });

  const activeSave = activeSoloCareer(universe);
  const activeEvent = activeSave ? soloCareerEvent(activeSave) : null;
  const eventResolved = Boolean(activeSave && activeEvent && isSoloCareerEventResolved(activeSave, activeEvent));
  const sortedSaves = useMemo(
    () => [...universe.saves].sort((first, second) => second.lastPlayedAt - first.lastPlayedAt),
    [universe.saves],
  );
  const levelTarget = xpForLevel(universe.profile.level);
  const xpPct = Math.min(100, Math.round((universe.profile.xp / levelTarget) * 100));

  const refreshUniverse = () => {
    setUniverse(current => {
      const next = awardSoloChampionships(syncSoloUniverseFromStorage(current));
      persistSoloUniverse(next);
      return next;
    });
  };

  const openMode = (mode: SoloCareerMode) => {
    const next = ensureSoloCareerSave(universe, mode);
    setUniverse(next);
    persistSoloUniverse(next);
    if (mode === 'agent') {
      setAgentOpen(true);
      return;
    }
    if (mode === 'owner') {
      setOwnerOpen(true);
      return;
    }
    onOpen(mode);
  };

  const continueSave = (saveId: string) => {
    const save = universe.saves.find(item => item.id === saveId);
    if (!save) return;
    const next = activateSoloCareer(universe, saveId);
    setUniverse(next);
    persistSoloUniverse(next);
    openMode(save.mode);
  };

  const chooseEvent = (choiceId: string) => {
    if (!activeSave || !activeEvent) return;
    const next = applySoloCareerDecision(universe, activeSave.id, activeEvent, choiceId);
    setUniverse(next);
    persistSoloUniverse(next);
  };

  if (ownerOpen) return <OwnerBusinessMode onBack={() => { setOwnerOpen(false); refreshUniverse(); }} />;
  if (agentOpen) return <PlayerAgentMode onBack={() => { setAgentOpen(false); refreshUniverse(); }} />;

  return (
    <BroadcastStage scene="field" page="solo" className="min-h-[100dvh] bg-transparent pb-12 text-white">
      <div className="mx-auto max-w-6xl px-3 sm:px-5">
        <div className="bk-solo-universe-hero" aria-hidden="true">
          <img
            src="/solo-universe-edition.jpg?v=2"
            alt=""
            width="816"
            height="1203"
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
        </div>

        <header className="bk-solo-universe-heading">
          <p>THE BALL KNOWER UNIVERSE</p>
          <h1>YOUR FOOTBALL CAREER</h1>
          <span>Every mode now lives in one career universe. Your decisions, seasons and legacy follow you.</span>
        </header>

        <section className="mb-4 grid gap-3 sm:grid-cols-[1.35fr_.65fr]">
          <div className="overflow-hidden rounded-[28px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(22,17,8,.97),rgba(8,11,16,.96)_58%,rgba(17,24,34,.96))] p-4 shadow-2xl sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.24em] text-amber-300">Solo Career</div>
                <div className="mt-1 text-2xl font-black uppercase tracking-tight">BK Level {universe.profile.level}</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-200">
                <Crown size={23} />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span>{universe.profile.xp.toLocaleString()} XP</span>
              <span>{levelTarget.toLocaleString()} to level {universe.profile.level + 1}</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                ['REP', universe.profile.reputation],
                ['LEGACY', universe.profile.legacy],
                ['TITLES', universe.profile.championships],
                ['CALLS', universe.profile.decisions],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-black/25 px-2 py-3 text-center">
                  <div className="text-lg font-black text-white">{value}</div>
                  <div className="text-[8px] font-black uppercase tracking-wider text-zinc-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#080b10]/94 p-4 shadow-2xl sm:p-5">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.22em] text-zinc-500">
              <ShieldCheck size={14} /> Career Status
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Achievements</span>
                <strong className="text-sm text-white">{universe.profile.achievements.length}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Active careers</span>
                <strong className="text-sm text-white">{universe.saves.length}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Pressure</span>
                <strong className={activeSave && activeSave.pressure >= 70 ? 'text-sm text-red-400' : 'text-sm text-white'}>{activeSave?.pressure ?? 0}%</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">Morale</span>
                <strong className="text-sm text-emerald-300">{activeSave?.morale ?? 0}%</strong>
              </div>
            </div>
          </div>
        </section>

        {activeSave && (
          <section className="mb-4 overflow-hidden rounded-[30px] border border-amber-300/25 bg-[#070a0f]/96 shadow-[0_24px_70px_rgba(0,0,0,.48)]">
            <div className="relative min-h-[220px] p-5 sm:p-6">
              <ModeSceneArt seed={activeSave.mode} />
              <div className="relative z-[2] max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-300/30 bg-black/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.18em] text-amber-200">Continue Career</span>
                  <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-zinc-300">Season {activeSave.season}</span>
                </div>
                <h2 className="mt-4 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">{activeSave.title}</h2>
                <p className="mt-1 text-sm font-bold text-zinc-300">{activeSave.subtitle}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                  <span className="rounded-lg bg-white/8 px-2.5 py-1.5 text-white">{progressLabel(activeSave.week, activeSave.stage)}</span>
                  <span className="rounded-lg bg-white/8 px-2.5 py-1.5 text-white">{activeSave.wins}-{activeSave.losses}</span>
                  {activeSave.championships > 0 && <span className="inline-flex items-center gap-1 rounded-lg bg-amber-300/12 px-2.5 py-1.5 text-amber-200"><Trophy size={12} /> {activeSave.championships} title{activeSave.championships === 1 ? '' : 's'}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => continueSave(activeSave.id)}
                  className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-5 text-[11px] font-black uppercase tracking-wider text-black shadow-lg shadow-amber-300/10"
                >
                  <Play size={16} fill="currentColor" /> Continue {SOLO_MODE_META[activeSave.mode].title}
                </button>
              </div>
            </div>
          </section>
        )}

        {activeSave && activeEvent && (
          <section className="mb-4 rounded-[28px] border border-white/10 bg-[#0a0d13]/96 p-4 shadow-xl sm:p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-300/20 bg-orange-400/10 text-orange-300">
                <Flame size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-[.2em] text-orange-300">{activeEvent.eyebrow} · {progressLabel(activeSave.week, activeSave.stage)}</div>
                <h3 className="mt-1 text-xl font-black uppercase text-white">{activeEvent.title}</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-400">{activeEvent.description}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500"><Clock3 size={12} /> {activeEvent.character}</div>
              </div>
            </div>
            {eventResolved ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/8 px-4 py-3 text-xs font-bold text-emerald-200">
                Decision locked for this week. Your choice is now part of this career's history.
              </div>
            ) : (
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {activeEvent.choices.map(choice => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => chooseEvent(choice.id)}
                    className="rounded-2xl border border-white/10 bg-white/[.035] p-3 text-left transition hover:border-amber-300/30 hover:bg-amber-300/[.05]"
                  >
                    <strong className="block text-xs font-black uppercase text-white">{choice.label}</strong>
                    <span className="mt-1 block text-[11px] leading-5 text-zinc-400">{choice.detail}</span>
                    <span className="mt-2 block text-[9px] font-black uppercase tracking-wider text-amber-300">+{choice.xp} XP</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {sortedSaves.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[.22em] text-zinc-500">Persistent Careers</div>
                <h2 className="mt-1 text-xl font-black uppercase">Your Saves</h2>
              </div>
              <span className="text-[10px] font-bold uppercase text-zinc-600">{sortedSaves.length}/6 modes started</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortedSaves.map(save => (
                <button
                  key={save.id}
                  type="button"
                  onClick={() => continueSave(save.id)}
                  className={`rounded-2xl border p-3 text-left ${save.id === universe.activeSaveId ? 'border-amber-300/30 bg-amber-300/[.06]' : 'border-white/8 bg-black/25'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs font-black uppercase text-white">{save.title}</strong>
                    <ChevronRight size={15} className="text-zinc-600" />
                  </div>
                  <div className="mt-1 truncate text-[11px] text-zinc-400">{save.subtitle}</div>
                  <div className="mt-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-zinc-500">
                    <span>{progressLabel(save.week, save.stage)}</span>
                    <span>•</span>
                    <span>{save.wins}-{save.losses}</span>
                    {save.championships > 0 && <><span>•</span><span className="text-amber-300">{save.championships} title</span></>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {universe.history.length > 0 && (
          <section className="mb-6 rounded-[26px] border border-white/8 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-zinc-500"><Trophy size={13} /> Career Timeline</div>
            <div className="mt-3 space-y-2">
              {universe.history.slice(0, 3).map(item => (
                <div key={item.id} className="rounded-xl border border-white/6 bg-white/[.025] px-3 py-2.5">
                  <div className="text-[10px] font-black uppercase text-white">{item.title}</div>
                  <div className="mt-1 text-[11px] text-zinc-500">Season {item.season} · Week {item.week || 0} · {item.detail}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3">
            <div className="text-[9px] font-black uppercase tracking-[.22em] text-zinc-500">Choose Your Road</div>
            <h2 className="mt-1 text-xl font-black uppercase">{sortedSaves.length ? 'Start Or Enter A Mode' : 'Start Your First Career'}</h2>
          </div>
          <div className="bk-mode-grid bk-solo-universe-grid">
            {MODES.map(mode => {
              const Icon = mode.icon;
              const saved = modeHasSave(mode.id) || universe.saves.some(save => save.mode === mode.id);

              return (
                <button
                  key={mode.id}
                  type="button"
                  className="bk-mode-card"
                  onClick={() => openMode(mode.id)}
                >
                  <Icon style={{ zIndex: 2 }} />
                  <ModeSceneArt seed={mode.id} />
                  <div>
                    <small style={MODE_EYEBROW_STYLE}>{mode.eyebrow}</small>
                    <strong style={MODE_TITLE_STYLE}>{mode.title}</strong>
                    <p style={MODE_DESCRIPTION_STYLE}>{mode.description}</p>
                    <span className="bk-mode-continue" style={MODE_CONTINUE_STYLE}>
                      {saved ? 'CONTINUE CAREER' : 'NEW CAREER'}
                    </span>
                  </div>
                  <ChevronRight size={17} style={{ zIndex: 2 }} />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </BroadcastStage>
  );
};
