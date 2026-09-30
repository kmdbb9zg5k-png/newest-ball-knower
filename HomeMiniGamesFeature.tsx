import React, { useEffect, useRef, useState } from 'react';
import { MINI_LEVELS, miniLevel } from './public/play-moment-3d/mini-games.js';

export function HomeMiniGamesFeature() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [level, setLevel] = useState(() => { try { return miniLevel(localStorage.getItem('bk-mini-level-v1')).id; } catch { return 'rookie'; } });
  const difficulty = miniLevel(level);
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get('miniGames') === '1') {
      dialog.current?.showModal(); url.searchParams.delete('miniGames');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);
  const chooseLevel = (id: typeof level) => { setLevel(id); try { localStorage.setItem('bk-mini-level-v1', id); } catch { /* Still playable when storage is unavailable. */ } };
  return <section className="bk-home-mini-games" aria-label="Mini Games">
    <button type="button" className="bk-mini-games-cover" aria-label="Explore Mini Games" onClick={() => dialog.current?.showModal()}>
      <img src="/mini-games-home-cover.webp" alt="Mini Games. Big plays. Quick games." width="1254" height="1254" loading="lazy" decoding="async" draggable={false}/>
    </button>
    <dialog ref={dialog} className="bk-mini-games-dialog" aria-labelledby="mini-games-heading" aria-describedby="mini-games-description" onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <div className="bk-mini-games-content">
        <span className="bk-mini-games-eyebrow">BIG PLAYS. QUICK GAMES.</span>
        <h2 id="mini-games-heading">Mini Games</h2>
        <p id="mini-games-description">Choose your level, then hit the field.</p>
        <fieldset className="bk-mini-levels">
          <legend>Difficulty</legend>
          <div>{MINI_LEVELS.map(option => <label key={option.id}>
            <input type="radio" name="mini-difficulty" value={option.id} checked={level === option.id} onChange={() => chooseLevel(option.id)}/>
            <span>{option.name}</span>
          </label>)}</div>
          <p aria-live="polite">{difficulty.description}</p>
        </fieldset>
        <ul>
          <li><strong>Two-Minute Drill</strong><p>Own 25. Down four. Two minutes and three timeouts to score the winning touchdown.</p><p className="bk-mini-tip">Play in landscape. The clock starts at your first snap. In-bounds plays keep it running; use timeouts, spikes, and the sidelines.</p><a className="bk-mini-start" href={`/play-moment-3d-preview.html?mode=two-minute&difficulty=${level}`}>Play Two-Minute Drill <span aria-hidden="true">→</span></a></li>
          <li><strong>Five-Minute Game</strong><p>Take on the CPU with playable offense and play-by-play simulated defense.</p><span>Coming soon</span></li>
          <li><strong>Combine</strong><p>Test your speed, throwing accuracy, and catching skills.</p><span>Coming soon</span></li>
        </ul>
        <button type="button" className="bk-mini-games-close" onClick={() => dialog.current?.close()} autoFocus>Back to Home</button>
      </div>
    </dialog>
  </section>;
}
