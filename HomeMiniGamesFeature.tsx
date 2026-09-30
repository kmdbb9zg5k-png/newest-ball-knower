import React, { useEffect, useRef, useState } from 'react';
import { MINI_LEVELS, miniLevel } from './public/play-moment-3d/mini-games.js';
import { MINI_SELECTOR_ART } from './miniSelectorArt';
import { MiniTeamCarousel } from './MiniTeamCarousel';
import { MINI_TEAMS, miniMatchup } from './public/play-moment-3d/mini-teams.js';

export function HomeMiniGamesFeature() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [level, setLevel] = useState(() => { try { return miniLevel(localStorage.getItem('bk-mini-level-v1')).id; } catch { return 'rookie'; } });
  const difficulty = miniLevel(level);
  const [menuOpen, setMenuOpen] = useState(false);
  const [matchup, setMatchup] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('bk-mini-matchup-v1') || 'null'); return miniMatchup(saved?.home || MINI_TEAMS[15].abbr, saved?.away || MINI_TEAMS[16].abbr); } catch { return miniMatchup(MINI_TEAMS[15].abbr, MINI_TEAMS[16].abbr); } });
  const [picking, setPicking] = useState<'home' | 'away' | null>('home');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (menuOpen) { dialog.current?.scrollTo({ top: 0 }); heading.current?.focus({ preventScroll: true }); }
  }, [picking, menuOpen]);
  const chooseTeam = (abbr: string) => {
    if (picking === 'away' && abbr === matchup.home.abbr) return;
    const next = picking === 'home' ? miniMatchup(abbr, abbr === matchup.away.abbr ? matchup.home.abbr : matchup.away.abbr) : miniMatchup(matchup.home.abbr, abbr);
    setMatchup(next); setPicking(picking === 'home' ? 'away' : null);
    try { localStorage.setItem('bk-mini-matchup-v1', JSON.stringify({ home: next.home.abbr, away: next.away.abbr })); } catch {}
  };
  const openMenu = () => { setMenuOpen(true); setPicking('home'); dialog.current?.showModal(); };
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get('miniGames') === '1') {
      openMenu(); url.searchParams.delete('miniGames');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);
  const chooseLevel = (id: typeof level) => { setLevel(id); try { localStorage.setItem('bk-mini-level-v1', id); } catch { /* Still playable when storage is unavailable. */ } };
  return <section className="bk-home-mini-games" aria-label="Mini Games">
    <button type="button" className="bk-mini-games-cover" aria-label="Explore Mini Games" onClick={openMenu}>
      <img src="/mini-games-home-cover.webp" alt="Mini Games. Big plays. Quick games." width="1254" height="1254" loading="lazy" decoding="async" draggable={false}/>
    </button>
    <dialog ref={dialog} className="bk-mini-games-dialog" aria-labelledby="mini-games-heading" aria-describedby="mini-games-description" onClose={() => setMenuOpen(false)} onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <div className="bk-mini-games-content">
        <div className="bk-mini-flow-top"><span className="bk-mini-games-eyebrow">MINI GAMES</span><button type="button" aria-label="Close Mini Games" onClick={() => dialog.current?.close()}>×</button></div>
        <div className="bk-mini-flow-progress" aria-label={`Step ${picking === 'home' ? 1 : picking === 'away' ? 2 : 3} of 3`}>
          {['Your team', 'Opponent', 'Matchup'].map((label, index) => <span key={label} aria-current={index === (picking === 'home' ? 0 : picking === 'away' ? 1 : 2) ? 'step' : undefined}>{index + 1}. {label}</span>)}
        </div>
        <h2 ref={heading} tabIndex={-1} id="mini-games-heading">{picking === 'home' ? 'Pick Your Team' : picking === 'away' ? 'Pick Opponent' : 'View Matchup'}</h2>
        <p id="mini-games-description" className="bk-mini-flow-description">{picking === 'home' ? 'Choose your squad. Own the field.' : picking === 'away' ? `Who will take on the ${matchup.home.name.split(' ').at(-1)}?` : 'The stage is set. Make your statement.'}</p>
        {picking === 'home' &&         <fieldset className="bk-mini-levels">
          <legend>Difficulty</legend>
          <div>{MINI_LEVELS.map(option => <label key={option.id}>
            <input type="radio" name="mini-difficulty" value={option.id} checked={level === option.id} onChange={() => chooseLevel(option.id)}/>
            <span>{option.name}</span>
          </label>)}</div>
          <p aria-live="polite">{difficulty.description}</p>
        </fieldset>}
        {picking && menuOpen ? <MiniTeamCarousel key={picking + matchup[picking].abbr} side={picking} selected={matchup[picking]} excluded={picking === 'away' ? matchup.home.abbr : undefined} onSelect={chooseTeam} onCancel={() => picking === 'away' ? setPicking('home') : dialog.current?.close()} backLabel={picking === 'away' ? 'Back to your team' : 'Back to Home'}/> : menuOpen ? <section className="bk-mini-review" aria-label="Matchup comparison">
          <div className="bk-mini-review-teams">{(['home', 'away'] as const).map(side => {
            const team = matchup[side];
            return <div key={side} className="bk-mini-review-team" style={{ '--mini-team-color': team.primary } as React.CSSProperties}>
              <span>{side === 'home' ? 'YOUR TEAM' : 'CPU OPPONENT'}</span>
              <img src={MINI_SELECTOR_ART[team.abbr].logo} alt={`${team.name} logo`} width="240" height="240"/>
              <h3>{team.name}</h3><strong>{team.overall} <small>OVR</small></strong>
            </div>;
          })}<span className="bk-mini-review-vs" aria-hidden="true">VS</span></div>
          <table className="bk-mini-comparison"><caption className="sr-only">Team ratings comparison</caption><thead><tr><th scope="col">{matchup.home.abbr}</th><th scope="col">RATINGS</th><th scope="col">{matchup.away.abbr}</th></tr></thead><tbody>
            {[{ label: 'Offense', home: matchup.home.offense, away: matchup.away.offense }, { label: 'Defense', home: matchup.home.defense, away: matchup.away.defense }, { label: 'Special Teams', home: MINI_SELECTOR_ART[matchup.home.abbr].specialTeams, away: MINI_SELECTOR_ART[matchup.away.abbr].specialTeams }].map(row => <tr key={row.label}><td data-leading={row.home > row.away}>{row.home}</td><th scope="row">{row.label}</th><td data-leading={row.away > row.home}>{row.away}</td></tr>)}
          </tbody></table>
          <p className="bk-mini-ratings-note">Base Solo rosters · Special teams: kicker + punter average</p>
          <div className="bk-mini-review-game">TWO-MINUTE DRILL <span>•</span> {difficulty.name.toUpperCase()}</div>
          <p className="bk-mini-review-rules">Own 25. Down four. Two minutes. Three timeouts.</p>
          <a className="bk-mini-confirm-team bk-mini-launch" href={`/play-moment-3d-preview.html?mode=two-minute&difficulty=${level}&team=${matchup.home.abbr}&opponent=${matchup.away.abbr}`}>Start Game <span aria-hidden="true">→</span></a>
          <div className="bk-mini-review-edits"><button type="button" onClick={() => setPicking('home')}>Change my team</button><button type="button" onClick={() => setPicking('away')}>Change opponent</button></div>
          <p className="bk-mini-tip">Play in landscape. The clock starts at your first snap. Use timeouts, spikes, and the sidelines.</p>
        </section> : null}
        {picking === 'home' && <details className="bk-mini-modes"><summary>Game modes</summary>
        <ul>
          <li><strong>Two-Minute Drill</strong><p>Own 25. Down four. Two minutes and three timeouts to score the winning touchdown.</p><p className="bk-mini-tip">Play in landscape. The clock starts at your first snap. In-bounds plays keep it running; use timeouts, spikes, and the sidelines.</p></li>
          <li><strong>Five-Minute Game</strong><p>Take on the CPU with playable offense and play-by-play simulated defense.</p><span>Coming soon</span></li>
          <li><strong>Combine</strong><p>Test your speed, throwing accuracy, and catching skills.</p><span>Coming soon</span></li>
        </ul></details>}
        {!picking && <button type="button" className="bk-mini-review-back" onClick={() => setPicking('away')}>← Back</button>}
      </div>
    </dialog>
  </section>;
}
