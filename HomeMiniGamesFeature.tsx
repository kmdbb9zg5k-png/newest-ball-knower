import React, { useEffect, useRef, useState } from 'react';
import { MINI_LEVELS, miniLevel } from './public/play-moment-3d/mini-games.js';
import { MINI_TEAMS, miniMatchup } from './public/play-moment-3d/mini-teams.js';

export function HomeMiniGamesFeature() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [level, setLevel] = useState(() => { try { return miniLevel(localStorage.getItem('bk-mini-level-v1')).id; } catch { return 'rookie'; } });
  const difficulty = miniLevel(level);
  const [matchup, setMatchup] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('bk-mini-matchup-v1') || 'null'); return miniMatchup(saved?.home || localStorage.getItem('ball-knower-solo-team-v1'), saved?.away); } catch { return miniMatchup(); } });
  const [picking, setPicking] = useState<'home' | 'away' | null>(null);
  const [search, setSearch] = useState('');
  const teamButtons = useRef<Partial<Record<'home' | 'away', HTMLButtonElement>>>({});
  const chooseTeam = (abbr: string) => {
    const next = picking === 'home' ? miniMatchup(abbr, abbr === matchup.away.abbr ? matchup.home.abbr : matchup.away.abbr) : miniMatchup(matchup.home.abbr, abbr);
    setMatchup(next); setPicking(null); setSearch(''); if (picking) teamButtons.current[picking]?.focus();
    try { localStorage.setItem('bk-mini-matchup-v1', JSON.stringify({ home: next.home.abbr, away: next.away.abbr })); } catch {}
  };
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
        <section className="bk-mini-matchup" aria-label="Choose your matchup">
          <h3>Choose your matchup</h3>
          <div className="bk-mini-team-pair">{(['home', 'away'] as const).map(side => {
            const team = matchup[side];
            return <button type="button" key={side} ref={node => { teamButtons.current[side] = node; }} aria-label={`Choose ${side === 'home' ? 'your team' : 'opponent'}: ${team.name}`} aria-expanded={picking === side} onClick={() => { setPicking(picking === side ? null : side); setSearch(''); }}>
              <small>{side === 'home' ? 'YOUR TEAM' : 'OPPONENT'}</small><span className="bk-mini-badge" style={{ background: team.primary, color: team.secondary }}>{team.abbr}</span><strong>{team.name}</strong>
              <span className="bk-mini-team-ovr">{team.overall} <small>OVR</small></span><span className="bk-mini-team-ratings">OFF {team.offense} · DEF {team.defense}</span><span className="bk-mini-team-change">Change team</span>
            </button>;
          })}</div>
          {picking && <div className="bk-mini-team-picker" aria-label={picking === 'home' ? 'Your team options' : 'Opponent options'}>
            <label>Find a Solo team<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Team or city"/></label>
            <div>{MINI_TEAMS.filter(team => team.name.toLowerCase().includes(search.toLowerCase()) || team.abbr.toLowerCase().includes(search.toLowerCase())).map(team => <button type="button" key={team.abbr} disabled={picking === 'away' && team.abbr === matchup.home.abbr} aria-pressed={team.abbr === matchup[picking].abbr} onClick={() => chooseTeam(team.abbr)}><span>{team.name}</span><strong>{team.overall} OVR</strong><small>OFF {team.offense} · DEF {team.defense}</small></button>)}</div>
            {!MINI_TEAMS.some(team => (team.name + ' ' + team.abbr).toLowerCase().includes(search.toLowerCase())) && <p>No matching teams.</p>}
          </div>}
          <p className="bk-mini-tip">Solo starting-lineup ratings. Team attributes affect play; difficulty adjusts the defense.</p>
        </section>
        <ul>
          <li><strong>Two-Minute Drill</strong><p>Own 25. Down four. Two minutes and three timeouts to score the winning touchdown.</p><p className="bk-mini-tip">Play in landscape. The clock starts at your first snap. In-bounds plays keep it running; use timeouts, spikes, and the sidelines.</p><a className="bk-mini-start" href={`/play-moment-3d-preview.html?mode=two-minute&difficulty=${level}&team=${matchup.home.abbr}&opponent=${matchup.away.abbr}`}>Play Two-Minute Drill <span aria-hidden="true">→</span></a></li>
          <li><strong>Five-Minute Game</strong><p>Take on the CPU with playable offense and play-by-play simulated defense.</p><span>Coming soon</span></li>
          <li><strong>Combine</strong><p>Test your speed, throwing accuracy, and catching skills.</p><span>Coming soon</span></li>
        </ul>
        <button type="button" className="bk-mini-games-close" onClick={() => dialog.current?.close()}>Back to Home</button>
      </div>
    </dialog>
  </section>;
}
