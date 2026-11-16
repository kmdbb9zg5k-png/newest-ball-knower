import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ATHLETE_POSITIONS, ATHLETE_BODY_LIMITS, feetAndInches } from './athleteBuild';
import { readAthletePassport } from './athletePassport';
import { practiceAsset, STORE_PRODUCTS } from './storeCatalog';
import { GAME_ATHLETE_KEY, gameAthlete, readGameAthlete } from './public/play-moment-3d/game-athlete.js';

const characters = STORE_PRODUCTS.filter(practiceAsset);

export default function GameAthleteSetup({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(readGameAthlete);
  const [draft, setDraft] = useState(() => saved ?? gameAthlete(readAthletePassport()?.build ?? {})!);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      const next = gameAthlete(draft);
      localStorage.setItem(GAME_ATHLETE_KEY, JSON.stringify(next));
      setSaved(next);
      setOpen(false);
      onSaved?.();
    } catch {
      setError('Your athlete settings could not be saved on this device.');
    }
  }
  return <>
    <button type="button" className="rounded-xl border border-white/20 bg-[#18232e] px-4 py-3 text-sm font-bold text-white"
      onClick={() => { setDraft(saved ?? gameAthlete(readAthletePassport()?.build ?? {})!); setError(''); setOpen(true); }}>
      {saved ? 'Edit game athlete' : 'Set up game athlete'}
    </button>
    {open && createPortal(<dialog ref={dialog} onClose={() => setOpen(false)} aria-labelledby="bk-game-athlete-title"
      className="m-auto max-h-[90dvh] w-[min(92vw,420px)] rounded-2xl border border-white/20 bg-[#111923] p-5 text-white backdrop:bg-black/70">
      <form onSubmit={save} className="grid gap-4">
        <h2 id="bk-game-athlete-title" className="text-xl font-black">Game athlete</h2>
        <label className="grid gap-1 text-sm">Character
          <select value={draft.character} className="h-11 rounded-lg bg-[#243344] px-3"
            onChange={e => setDraft({ ...draft, character: e.target.value })}>
            <option value="">My Player</option>
            {characters.map(character => <option key={character.id} value={character.id}>{character.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Football position
          <select value={draft.position} className="h-11 rounded-lg bg-[#243344] px-3"
            onChange={e => setDraft({ ...draft, position: e.target.value })}>
            {ATHLETE_POSITIONS.map(position => <option key={position}>{position}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Height <b>{feetAndInches(draft.heightInches)}</b>
          <input type="range" min={ATHLETE_BODY_LIMITS.height[0]} max={ATHLETE_BODY_LIMITS.height[1]}
            value={draft.heightInches} onChange={e => setDraft({ ...draft, heightInches: +e.target.value })} />
        </label>
        <label className="grid gap-1 text-sm">Weight <b>{draft.weightLbs} lb</b>
          <input type="range" min={ATHLETE_BODY_LIMITS.weight[0]} max={ATHLETE_BODY_LIMITS.weight[1]}
            value={draft.weightLbs} onChange={e => setDraft({ ...draft, weightLbs: +e.target.value })} />
        </label>
        <p className="text-xs text-zinc-300">Position drills use the drill’s role. Online ratings are set by the game.</p>
        {error && <p role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="min-h-11 rounded-lg border border-white/20 px-3" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="min-h-11 rounded-lg bg-amber-300 px-4 font-bold text-black">Save athlete</button>
        </div>
      </form>
    </dialog>, document.body)}
  </>;
}
