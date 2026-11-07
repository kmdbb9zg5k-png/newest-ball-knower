import { BroadcastStage } from './BroadcastScene';
import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Clock3,
  Flame,
  Play,
  Trophy,
} from 'lucide-react';
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
  persistSoloUniverse,
  SOLO_MODE_META,
  SoloCareerMode,
  soloCareerEvent,
  syncSoloUniverseFromStorage,
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

const CAREER_TILES = [
  { mode: 'player', label: 'My Player', portrait: '/solo-mode-scenes/career-my-player.webp' },
  { mode: 'real', label: 'GM', portrait: '/solo-mode-scenes/career-gm.webp' },
  { mode: 'owner', label: 'Owner', portrait: '/solo-mode-scenes/career-owner.webp' },
  { mode: 'agent', label: 'Agent', portrait: '/solo-mode-scenes/career-agent.webp' },
] as const;

const OTHER_MODES = ['cap', 'fantasy'] as const;

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
  const franchiseSave = universe.saves.find(save => save.mode === 'real');
  const featuredCareers = [
    { mode: 'real' as const, save: franchiseSave },
    ...(activeSave && activeSave.mode !== 'real' ? [{ mode: activeSave.mode, save: activeSave }] : []),
  ];
  const isGamePlan = activeSave?.mode === 'real' && activeEvent?.character === 'Coach meeting';
  const sortedSaves = useMemo(
    () => [...universe.saves].sort((first, second) => second.lastPlayedAt - first.lastPlayedAt),
    [universe.saves],
  );

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

  const eventChoices = activeEvent && (
    <div className="mt-4 grid gap-2 md:grid-cols-3">
      {activeEvent.choices.map(choice => (
        <button key={choice.id} type="button" onClick={() => chooseEvent(choice.id)} className="bk-career-choice">
          <strong>{choice.label}</strong>
          <span>{choice.detail}</span>
          <small>+{choice.xp} XP</small>
        </button>
      ))}
    </div>
  );

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
        {featuredCareers.map(({ mode, save }) => (
          <section className="bk-career-feature" key={mode} aria-labelledby={`bk-career-feature-${mode}`}>
            {mode === 'real' ? (
              <img className="bk-career-feature-art" src="/solo-mode-scenes/franchise-coach.webp" alt="" loading="lazy" decoding="async" />
            ) : (
              <ModeSceneArt seed={mode} />
            )}
            <div className="bk-career-feature-copy">
              <h2 id={`bk-career-feature-${mode}`}>{save?.title ?? SOLO_MODE_META.real.title}</h2>
              {save ? (
                <p className="bk-career-feature-meta">
                  {save.subtitle} · {save.season} · {progressLabel(save.week, save.stage)} · {save.wins}–{save.losses}
                  {save.championships > 0 && <span> · {save.championships} {save.championships === 1 ? 'title' : 'titles'}</span>}
                </p>
              ) : (
                <p className="bk-career-feature-meta">{SOLO_MODE_META.real.subtitle}</p>
              )}
              <button
                type="button"
                onClick={() => save ? continueSave(save.id) : openMode(mode)}
                className="bk-career-feature-action"
              >
                <Play size={16} fill="currentColor" aria-hidden="true" /> {save ? `Continue ${SOLO_MODE_META[mode].title}` : 'Start Franchise Command'}
              </button>
            </div>
          </section>
        ))}

        {activeSave && activeEvent && (
          <section key={activeEvent.id} className="mb-4 overflow-hidden rounded-[22px] border border-white/15 bg-[#0a0d13] shadow-xl">
            {isGamePlan && !eventResolved ? (
              <details className="bk-career-game-plan">
                <summary>
                  <img src="/solo-mode-scenes/coaches-game-plan.webp" alt="" loading="lazy" decoding="async" />
                  <span className="bk-career-game-plan-copy">
                    <span>{progressLabel(activeSave.week, activeSave.stage)} · Game Plan</span>
                    <strong>Two ways to win</strong>
                    <span className="bk-career-game-plan-action">Review Game Plan <ArrowRight size={15} aria-hidden="true" /></span>
                  </span>
                </summary>
                <div className="p-4 sm:p-5">
                  <p className="text-sm leading-6 text-zinc-300">{activeEvent.description}</p>
                  {eventChoices}
                </div>
              </details>
            ) : (
              <div className="p-4 sm:p-5">
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
                ) : eventChoices}
              </div>
            )}
          </section>
        )}

        <section className="bk-career-modes" aria-labelledby="bk-career-modes-title">
          <h2 id="bk-career-modes-title">Career Modes</h2>
          <div className="bk-career-portrait-grid">
            {CAREER_TILES.map(({ mode, label, portrait }) => (
              <button
                key={mode}
                type="button"
                className="bk-mode-card bk-career-portrait"
                aria-label={mode === 'real' ? 'GM · Franchise Command' : SOLO_MODE_META[mode].title}
                onClick={() => openMode(mode)}
              >
                <img src={portrait} alt="" width={280} height={280} loading="lazy" decoding="async" />
                <strong>{label}</strong>
                {label !== SOLO_MODE_META[mode].title && <span className="sr-only">{SOLO_MODE_META[mode].title}</span>}
              </button>
            ))}
          </div>
          <div className="bk-career-extra-modes">
            {OTHER_MODES.map(mode => (
              <button key={mode} type="button" className="bk-mode-card bk-career-extra-mode" onClick={() => openMode(mode)}>
                <span>{SOLO_MODE_META[mode].title}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        {sortedSaves.length > 0 && (
          <details className="bk-career-saves">
            <summary>
              <strong>Your Saves</strong>
              <span>{sortedSaves.length}/6 modes started</span>
              <ChevronRight size={16} aria-hidden="true" />
            </summary>
            <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-3">
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
          </details>
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

      </div>
    </BroadcastStage>
  );
};
