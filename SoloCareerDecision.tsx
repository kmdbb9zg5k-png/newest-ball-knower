import {MyPlayerArtwork} from './MyPlayerArtwork';
import { OwnerArtwork } from './OwnerArtwork';
import { AgentArtwork } from './AgentArtwork';
import { useState } from 'react';
import { ArrowRight, Clock3, Flame } from 'lucide-react';
import {
  applySoloCareerDecision,
  isSoloCareerEventResolved,
  loadSoloUniverse,
  persistSoloUniverse,
  soloCareerEvent,
  syncSoloUniverseFromStorage,
  type SoloCareerMode,
  type SoloCareerSave,
} from './soloCareerUniverse';

export function progressLabel(week: number, stage: string) {
  if (stage.toLowerCase().includes('finished')) return 'Season complete';
  if (stage.toLowerCase().includes('draft')) return 'Draft';
  if (stage.toLowerCase().includes('playoff')) return stage;
  if (week <= 0) return stage || 'Preseason';
  return `Week ${week}`;
}

type Props = {
  mode: SoloCareerMode;
  timing?: Pick<SoloCareerSave, 'season' | 'week'>;
};

export function SoloCareerDecision({ mode, timing }: Props) {
  const [universe, setUniverse] = useState(() => syncSoloUniverseFromStorage(loadSoloUniverse()));
  const saved = universe.saves.find(save => save.mode === mode);
  if (!saved) return null;
  const activeSave = { ...saved, ...timing };
  const activeEvent = soloCareerEvent(activeSave);
  const eventResolved = isSoloCareerEventResolved(activeSave, activeEvent);
  const history = universe.history.filter(item => item.saveId === saved.id).slice(0, 3);
  const isGamePlan = mode === 'real' && activeEvent.character === 'Coach meeting';

  const chooseEvent = (choiceId: string) => {
    const latest = loadSoloUniverse();
    const current = latest.saves.some(save => save.mode === mode) ? latest : syncSoloUniverseFromStorage(latest);
    const save = current.saves.find(item => item.id === activeSave.id);
    if (!save) return;
    const currentSave = { ...save, ...timing };
    const event = soloCareerEvent(currentSave);
    if (event.id !== activeEvent.id || isSoloCareerEventResolved(currentSave, event)) {
      setUniverse(current);
      return;
    }
    const next = applySoloCareerDecision(
      { ...current, saves: current.saves.map(item => item.id === currentSave.id ? currentSave : item) },
      currentSave.id,
      event,
      choiceId,
    );
    persistSoloUniverse(next);
    setUniverse(next);
  };

  const eventChoices = (
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
          {mode === 'player' && !eventResolved && <MyPlayerArtwork scene={activeEvent.character === 'Player podium' ? 'media' : activeEvent.character === 'Player development' ? 'training' : 'coach'} />}
          {mode === 'owner' && !eventResolved && <OwnerArtwork scene={activeEvent.character === 'Owner podium' ? 'podium' : activeEvent.character === 'Coach / GM meeting' ? 'staff' : 'business'} />}
          {mode === 'agent' && !eventResolved && <AgentArtwork scene={activeEvent.character === 'Media strategy' ? 'media' : activeEvent.character === 'Agency war room' ? 'growth' : 'role'} compact />}
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
      {history.length > 0 && (
        <details className="bk-career-saves mx-4">
          <summary><strong>Career Timeline</strong></summary>
          <div className="space-y-2 px-3 pb-3">
            {history.map(item => (
              <div key={item.id} className="rounded-lg bg-white/5 p-2 text-xs">
                <strong className="block">{item.title}</strong>
                <span className="text-zinc-400">Season {item.season} · Week {item.week} · {item.detail}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
