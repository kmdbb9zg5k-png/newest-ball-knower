import { BroadcastStage } from './BroadcastScene';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Play,
} from 'lucide-react';
import { OwnerBusinessMode } from './OwnerBusinessMode';
import { PlayerAgentMode } from './PlayerAgentMode';
import { SoloCareerDecision, progressLabel } from './SoloCareerDecision';
import {
  awardSoloChampionships,
  ensureSoloCareerSave,
  loadSoloUniverse,
  persistSoloUniverse,
  SOLO_MODE_META,
  SoloCareerMode,
  syncSoloUniverseFromStorage,
} from './soloCareerUniverse';

export type SoloExperience = 'hub' | 'cap' | 'fantasy' | 'real' | 'player';

type Props = {
  onOpen: (experience: Exclude<SoloExperience, 'hub'>) => void;
};

const CAREER_TILES = [
  { mode: 'player', label: 'My Player', portrait: '/solo-mode-scenes/career-my-player.webp' },
  { mode: 'real', label: 'GM', portrait: '/solo-mode-scenes/career-gm.webp' },
  { mode: 'owner', label: 'Owner', portrait: '/solo-mode-scenes/career-owner.webp' },
  { mode: 'agent', label: 'Agent', portrait: '/solo-mode-scenes/career-agent.webp' },
] as const;

const OTHER_MODES = ['cap', 'fantasy'] as const;

export const SoloFranchiseHub: React.FC<Props> = ({ onOpen }) => {
  const [chooseCareer, setChooseCareer] = useState(false);
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

  // These careers stay inside the hub instead of changing SoloMode.experience.
  useLayoutEffect(() => {
    const reset = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    reset();
    const frame = window.requestAnimationFrame(reset);
    return () => window.cancelAnimationFrame(frame);
  }, [agentOpen, ownerOpen]);

  const sortedSaves = useMemo(
    () => [...universe.saves].sort((first, second) => second.lastPlayedAt - first.lastPlayedAt),
    [universe.saves],
  );

  const refreshUniverse = () => {
    const next = awardSoloChampionships(syncSoloUniverseFromStorage(loadSoloUniverse()));
    persistSoloUniverse(next);
    setUniverse(next);
  };

  const openMode = (mode: SoloCareerMode) => {
    setChooseCareer(false);
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
    openMode(save.mode);
  };

  if (ownerOpen) return <><div className="mx-auto max-w-5xl px-4"><SoloCareerDecision mode="owner" /></div><OwnerBusinessMode onBack={() => { setOwnerOpen(false); refreshUniverse(); }} /></>;
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
        <section className="bk-career-feature" aria-labelledby="bk-career-feature-real">
          <img className="bk-career-feature-art" src="/solo-mode-scenes/franchise-coach.webp" alt="" loading="lazy" decoding="async" />
          <div className="bk-career-feature-copy">
            <h2 id="bk-career-feature-real">Franchise Command</h2>
            <p className="bk-career-feature-meta">Choose your football career</p>
            <button type="button" className="bk-career-feature-action" aria-expanded={chooseCareer} aria-controls="bk-franchise-career-choices" onClick={() => setChooseCareer(open => !open)}>
              <Play size={16} fill="currentColor" aria-hidden="true" /> Choose Career
            </button>
          </div>
        </section>
        <section id="bk-franchise-career-choices" className="bk-career-modes" aria-labelledby="bk-franchise-career-title" hidden={!chooseCareer}>
          <h2 id="bk-franchise-career-title">Choose your career</h2>
          <div className="bk-career-extra-modes">
            {[...CAREER_TILES.map(tile => tile.mode), ...OTHER_MODES].map(mode => (
              <button key={mode} type="button" className="bk-career-choice" onClick={() => openMode(mode)}>
                <strong>{mode === 'real' ? 'GM · Franchise Command' : SOLO_MODE_META[mode].title}</strong>
                <span>{universe.saves.some(save => save.mode === mode) ? 'Continue career' : 'Start career'}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="bk-career-modes" aria-labelledby="bk-career-modes-title">
          <h2 id="bk-career-modes-title">Career Modes</h2>
          <div className="bk-career-portrait-grid">
            {CAREER_TILES.filter(({ mode }) => mode !== 'player').map(({ mode, label, portrait }) => (
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

      </div>
    </BroadcastStage>
  );
};
