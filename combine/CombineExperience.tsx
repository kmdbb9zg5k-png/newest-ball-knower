import React, { useEffect, useRef, useState } from 'react';
import { bestResult, newDash, pressDash, readResults, saveResult, stepDash, YARD } from './dash.js';
import './combine.css';

type Athlete = { id: string; name: string; position: string; speed: number; acceleration: number; seed: number };
type Props = { players: Athlete[]; context: string; onClose: () => void };
const time = (n: number | null | undefined) => n == null ? '—' : `${n.toFixed(2)}`;

export default function CombineExperience({ players, context, onClose }: Props) {
  const [player, setPlayer] = useState(players[0]);
  const [attempt, setAttempt] = useState(1);
  const [view, setView] = useState(() => ({ ...newDash(players[0]) }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [picker, setPicker] = useState(false);
  const [rows, setRows] = useState<any[]>(() => readResults());
  const [showResults, setShowResults] = useState(false);
  const finishElapsed = useRef(0);
  const [runSplits, setRunSplits] = useState<Array<number[] | null>>([]);
  const [personalBest, setPersonalBest] = useState(false);
  const [saved, setSaved] = useState(true);
  const [runs, setRuns] = useState<Array<number | null>>([]);
  const host = useRef<HTMLDivElement>(null), action = useRef<HTMLButtonElement>(null), resultHeading = useRef<HTMLHeadingElement>(null);
  const run = useRef(newDash(player)), stopped = useRef(false), pickerOpen = useRef(false), finished = useRef(false);
  const currentContext = useRef(context);
  const scene = useRef<any>(null);
  const phase = view.phase;
  const best = bestResult(rows, context, player.id);
  const reset = (next: Athlete, n: number) => {
    setShowResults(false); finishElapsed.current = 0; setPersonalBest(false);
    run.current = newDash(next); finished.current = false; setView({ ...run.current }); setPlayer(next); setAttempt(n); setSaved(true);
    scene.current?.setAthlete(next); action.current?.focus();
  };
  const pause = () => { stopped.current = true; run.current.held = false; setPaused(true); };
  const resume = () => { stopped.current = false; setPaused(false); action.current?.focus(); };
  const press = () => { if (!ready || stopped.current || pickerOpen.current) return; pressDash(run.current, 1.2 + Math.random() * .8); setView({ ...run.current }); };
  const release = () => { run.current.held = false; };

  useEffect(() => {
    let gone = false, raf = 0, prior = performance.now(), accumulator = 0, lastDraw = 0, lastHud = 0;
    const finish = () => {
      const s = run.current;
      if (finished.current || !['finished', 'false-start'].includes(s.phase)) return;
      finished.current = true;
      setRunSplits(old => [...old, s.phase === 'finished' ? [...s.splits] : null]);
      if(s.phase === 'false-start') setShowResults(true);
      setRuns(old => [...old, s.phase === 'finished' ? s.splits[2] : null]);
      if (s.phase === 'finished') {
        const record = { context: currentContext.current, playerId: s.athlete.id, name: s.athlete.name, position: s.athlete.position, splits: [...s.splits], reaction: s.reaction, date: Date.now() };
        const previous = bestResult(readResults(), currentContext.current, s.athlete.id);
        setPersonalBest(!previous || s.splits[2] < previous.splits[2]);
        setSaved(saveResult(record)); setRows(old => [...old, record]);
      }
      setView({ ...s, splits: [...s.splits] });
    };
    const frame = (now: number) => {
      if (gone) return;
      raf = requestAnimationFrame(frame);
      const delta = (now - prior) / 1000; prior = now;
      // A suspended or badly stalled frame pauses the drill instead of granting
      // a free instant finish or letting the runner move during a hidden tab.
      if (delta > .5 && ['set', 'ready', 'running'].includes(run.current.phase)) pause();
      if (stopped.current || pickerOpen.current || document.hidden) { accumulator = 0; return; }
      accumulator += Math.min(delta, .1);
      while (accumulator >= 1 / 120) { stepDash(run.current, 1 / 120); accumulator -= 1 / 120; }
      finish();
      if(run.current.phase === 'finished') { finishElapsed.current += Math.min(delta,.1); if(finishElapsed.current >= 2.8) setShowResults(true); }
      if (now - lastDraw >= 1000 / 60 - .5) { scene.current?.draw(run.current, Math.min((now - lastDraw) / 1000, .05)); lastDraw = now; }
      if (now - lastHud > 50) { const s = run.current; setView({ ...s, splits: [...s.splits] }); lastHud = now; }
    };
    import('./scene.js').then(({ createCombineScene }) => {
      if (gone || !host.current) return;
      scene.current = createCombineScene(host.current, run.current.athlete, () => { pause(); setError('Graphics were interrupted. Reload the Combine to continue.'); });
      setReady(true); prior = performance.now(); raf = requestAnimationFrame(frame);
    }).catch(() => { if (!gone) setError('This device could not start the 3D Combine. Try reopening it in Safari or Chrome.'); });
    const hidden = () => { if (document.hidden && !['idle', 'finished', 'false-start'].includes(run.current.phase)) pause(); };
    const blur = () => { release(); if (['set', 'ready', 'running'].includes(run.current.phase)) pause(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('blur', blur); window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    return () => { gone = true; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('blur', blur); window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { if (showResults) resultHeading.current?.focus(); }, [showResults]);
  const openPicker = () => { pickerOpen.current = true; setPicker(true); };
  const closePicker = () => { pickerOpen.current = false; setPicker(false); };
  const status = phase === 'set' ? 'SET' : phase === 'ready' ? 'GO' : phase === 'running' ? (view.held ? 'FULL STRIDE' : 'HOLD TO SPRINT') : '';
  const ended = phase === 'finished' || phase === 'false-start';
  const terminal = ended && showResults;
  return <main className="combine-game" data-phase={phase} aria-label="Ball Knower Combine" onKeyDown={e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (picker) closePicker(); else if (paused) resume(); else pause(); }
    if (e.key === 'Tab' && (picker || paused || terminal || !ready || error)) {
      const overlays = e.currentTarget.querySelectorAll<HTMLElement>('.combine-overlay:not([inert])');
      const overlay = overlays[overlays.length - 1];
      const buttons = overlay?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  }}>
    <div ref={host} className="combine-scene" aria-hidden="true" />
    <div className="combine-hud" inert={paused || picker || terminal || !ready || !!error}>
    <header className="combine-top"><button className="combine-back" aria-label="Leave Combine" onClick={onClose}>‹</button><div className="combine-brand"><b>BALL KNOWER</b><span>{context === 'standalone' ? 'COMBINE' : 'FRANCHISE COMBINE'}</span></div><h1>40-YARD DASH</h1><span className="combine-attempt">ATTEMPT {attempt} / 2</span><button className="combine-pause" aria-label="Pause dash" onClick={pause}>Ⅱ</button></header>
    <div className="combine-timer" aria-label={`Time ${time(view.clock)} seconds`}>{time(view.clock)}<small>s</small></div>
    <aside className="combine-splits" aria-label="Split times">{[10, 20, 40].map((yards, i) => <div key={yards} data-crossed={view.splits[i] != null}><span>{yards} YD</span><b>{time(view.splits[i])}</b></div>)}</aside>
    {phase === 'finished' && !terminal && <div className="combine-cue go" role="status">FINISH · {time(view.clock)}s</div>}
    {['idle','set','ready'].includes(phase) && <div className="combine-start-lights" aria-label={phase === 'ready' ? 'Green light' : phase === 'set' ? 'Amber light — wait' : 'Ready to start'}><i data-on={phase === 'idle'} /><i data-on={phase === 'set'} /><i data-on={phase === 'ready'} /></div>}
    {status && !terminal && <div className={`combine-cue ${phase === 'ready' ? 'go' : ''}`} role="status">{status}</div>}
    <div className="combine-athlete"><span className="combine-monogram" aria-hidden="true">{player.position}</span><div><b>{player.name}</b><span>{player.position} · SPEED {player.speed}{best ? ` · BEST ${time(best.splits[2])}s` : ''}</span></div>{phase === 'idle' && <button onClick={openPicker} aria-label="Change athlete">↔</button>}</div>
    {phase === 'idle' && <div className="combine-start-note">Wait for GO. Press and hold to sprint.</div>}
    {phase === 'running' && <div className="combine-distance">{Math.min(40, view.distance / YARD).toFixed(1)} <small>/ 40 YD</small></div>}
    {!ended && <button ref={action} className="combine-action" data-held={view.held && phase === 'running'} aria-pressed={phase === 'running' ? view.held : undefined} disabled={!ready || !!error} aria-label={phase === 'idle' ? 'Start 40-yard dash' : phase === 'set' ? 'Wait for green' : 'Hold to sprint'}
      onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); press(); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onKeyDown={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); if (!e.repeat) press(); } }} onKeyUp={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); release(); } }}
      onClick={e => { if (e.detail === 0 && !['running', 'set'].includes(run.current.phase)) press(); }}>
      {phase === 'idle' ? 'START' : phase === 'set' ? 'WAIT' : phase === 'ready' ? 'GO' : 'SPRINT'}<small>{phase === 'running' ? (view.held ? 'HOLDING ●' : 'PRESS + HOLD') : phase === 'ready' ? 'PRESS + HOLD' : ''}</small>
    </button>}
    </div>
    {terminal && <section className="combine-overlay" inert={picker || paused || !!error} aria-label="Dash results"><div className="combine-result" data-personal-best={personalBest}><span className="combine-eyebrow">{phase === 'false-start' ? 'ATTEMPT USED' : personalBest ? '★ NEW PERSONAL BEST' : 'DRILL RESULT'}</span><h2 ref={resultHeading} tabIndex={-1}>{phase === 'false-start' ? 'FALSE START' : `${time(view.clock)} s`}</h2><p>{phase === 'false-start' ? 'You launched before GO.' : `${player.name} · ${player.position}`}</p>
      {phase === 'finished' && <><div className="combine-result-splits">{[10, 20, 40].map((n, i) => <div key={n}><span>{n} YD</span><b>{time(view.splits[i])}s</b></div>)}</div><p className="combine-scout">{view.clock < 4.5 ? 'Explosive long speed.' : view.clock < 4.85 ? 'Strong straight-line speed.' : 'Build speed through the drive phase.'} {view.reaction != null && view.reaction < .2 ? 'Sharp launch.' : 'Room for a quicker launch.'}</p></>}
      <div className="combine-attempts">{runs.map((r, i) => <span key={i}>Attempt {i + 1} <b>{r == null ? 'FS' : `${time(r)}s`}</b></span>)}</div>
      {runSplits.length > 1 && runSplits[0] && runSplits[1] && <div className="combine-comparison" aria-label="Attempt split comparison">{[10,20,40].map((yard,i) => { const delta = runSplits[1]![i]-runSplits[0]![i]; return <span key={yard}>{yard} YD <b data-faster={delta<0}>{delta>0?'+':''}{delta.toFixed(2)}s</b></span>; })}<small>Attempt 2 compared with attempt 1</small></div>}
      <p className="combine-save" role="status">{!saved ? 'Could not save on this device. Your result is shown above.' : best ? `Personal best: ${time(best.splits[2])}s · Saved on this device` : 'False starts do not post a time.'}</p>
      <div className="combine-result-actions">{attempt < 2 ? <button onClick={() => reset(player, 2)}>SECOND ATTEMPT</button> : <button onClick={() => { setRuns([]); setRunSplits([]); reset(player, 1); }}>NEW SESSION</button>}<button onClick={openPicker}>ATHLETES & RESULTS</button><button onClick={onClose}>{context === 'standalone' ? 'BACK TO MINI GAMES' : 'BACK TO FRANCHISE'}</button></div>
    </div></section>}
    {picker && <section className="combine-overlay combine-picker" role="dialog" aria-modal="true" aria-label="Choose athlete"><div className="combine-result"><div className="combine-picker-heading"><h2>Athletes & results</h2><button autoFocus onClick={closePicker} aria-label="Close athlete selection">×</button></div><p>{context === 'standalone' ? 'Fictional prospects · your local best times' : 'Franchise scouting · your local best times'}</p><div className="combine-athlete-list">{players.map(p => { const record = bestResult(rows, context, p.id); return <button key={p.id} onClick={() => { closePicker(); setRuns([]); setRunSplits([]); reset(p, 1); }}><span><b>{p.name}</b><small>{p.position} · SPEED {p.speed}</small></span><strong>{record ? `${time(record.splits[2])}s` : 'RUN →'}</strong></button>; })}</div></div></section>}
    {paused && !error && <section className="combine-overlay" role="dialog" aria-modal="true" aria-label="Dash paused"><div className="combine-result"><h2>PAUSED</h2><p>Your attempt is held here.</p><div className="combine-result-actions"><button autoFocus onClick={resume}>RESUME</button><button onClick={onClose}>LEAVE COMBINE</button></div></div></section>}
    {(!ready || error) && <section className="combine-overlay"><div className="combine-result"><h2>{error ? 'COMBINE UNAVAILABLE' : 'PREPARING COMBINE'}</h2><p role="status">{error || 'Setting the track…'}</p><button onClick={onClose}>BACK</button></div></section>}
  </main>;
}
