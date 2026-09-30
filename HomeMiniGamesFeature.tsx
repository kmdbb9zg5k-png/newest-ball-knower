import React, { useRef } from 'react';

export function HomeMiniGamesFeature() {
  const dialog = useRef<HTMLDialogElement>(null);
  return <section className="bk-home-mini-games" aria-label="Mini Games">
    <button type="button" className="bk-mini-games-cover" aria-label="Explore Mini Games" onClick={() => dialog.current?.showModal()}>
      <img src="/mini-games-home-cover.webp" alt="Mini Games. Big plays. Quick games." width="1254" height="1254" loading="lazy" decoding="async" draggable={false}/>
    </button>
    <dialog ref={dialog} className="bk-mini-games-dialog" aria-labelledby="mini-games-heading" aria-describedby="mini-games-description" onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <div className="bk-mini-games-content">
        <span className="bk-mini-games-eyebrow">BIG PLAYS. QUICK GAMES.</span>
        <h2 id="mini-games-heading">Mini Games</h2>
        <p id="mini-games-description">New ways to hit the field. These modes are coming soon.</p>
        <ul>
          <li><strong>Two-Minute Drill</strong><p>Beat the clock and drive for the winning touchdown.</p><span>Coming soon</span></li>
          <li><strong>Five-Minute Game</strong><p>Take on the CPU with playable offense and play-by-play simulated defense.</p><span>Coming soon</span></li>
          <li><strong>Combine</strong><p>Test your speed, throwing accuracy, and catching skills.</p><span>Coming soon</span></li>
        </ul>
        <button type="button" className="bk-mini-games-close" onClick={() => dialog.current?.close()} autoFocus>Back to Home</button>
      </div>
    </dialog>
  </section>;
}
