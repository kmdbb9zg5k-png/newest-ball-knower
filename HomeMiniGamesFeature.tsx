import React, { useEffect, useRef, useState } from 'react';
import { MINI_LEVELS, miniLevel } from './public/play-moment-3d/mini-games.js';
import { MINI_SELECTOR_ART } from './miniSelectorArt';
import { MiniTeamCarousel } from './MiniTeamCarousel';
import { MINI_TEAMS, miniMatchup } from './public/play-moment-3d/mini-teams.js';

const MINI_MODE_TABS = [{ id: 'two-minute', name: 'Two-Minute Drill' }, { id: 'five-minute', name: 'Five-Minute Game' }, { id: 'combine', name: 'Combine' }] as const;
type MiniModeTab = typeof MINI_MODE_TABS[number]['id'];

export function HomeMiniGamesFeature() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [level, setLevel] = useState(() => { try { return miniLevel(localStorage.getItem('bk-mini-level-v1')).id; } catch { return 'rookie'; } });
  const difficulty = miniLevel(level);
  const [gameMode, setGameMode] = useState<'two-minute' | 'five-minute'>(() => { try { return localStorage.getItem('bk-mini-mode-v1') === 'five-minute' ? 'five-minute' : 'two-minute'; } catch { return 'two-minute'; } });
  const [activeMode, setActiveMode] = useState<MiniModeTab>(gameMode);
  const tabButtons = useRef<Partial<Record<MiniModeTab, HTMLButtonElement>>>({});
  const switchingMode = useRef(false);
  const gameName = gameMode === 'five-minute' ? 'Five-Minute Game' : 'Two-Minute Drill';
  const [menuOpen, setMenuOpen] = useState(false);
  const [matchup, setMatchup] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('bk-mini-matchup-v1') || 'null'); return miniMatchup(saved?.home || MINI_TEAMS[15].abbr, saved?.away || MINI_TEAMS[16].abbr); } catch { return miniMatchup(MINI_TEAMS[15].abbr, MINI_TEAMS[16].abbr); } });
  const [picking, setPicking] = useState<'home' | 'away' | null>('home');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (menuOpen) { dialog.current?.scrollTo({ top: 0 }); if (!switchingMode.current) heading.current?.focus({ preventScroll: true }); switchingMode.current = false; }
  }, [picking, menuOpen, activeMode]);
  const chooseTeam = (abbr: string) => {
    if (picking === 'away' && abbr === matchup.home.abbr) return;
    const next = picking === 'home' ? miniMatchup(abbr, abbr === matchup.away.abbr ? matchup.home.abbr : matchup.away.abbr) : miniMatchup(matchup.home.abbr, abbr);
    setMatchup(next); setPicking(picking === 'home' ? 'away' : null);
    try { localStorage.setItem('bk-mini-matchup-v1', JSON.stringify({ home: next.home.abbr, away: next.away.abbr })); } catch {}
  };
  const openMenu = () => { setActiveMode(gameMode); setMenuOpen(true); setPicking('home'); dialog.current?.showModal(); };
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get('miniGames') === '1') {
      openMenu(); url.searchParams.delete('miniGames');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);
  const chooseMode = (id: MiniModeTab) => {
    if (id === activeMode) { tabButtons.current[id]?.focus({ preventScroll: true }); return; }
    switchingMode.current = true; setActiveMode(id); setPicking('home');
    if (id !== 'combine') { setGameMode(id); try { localStorage.setItem('bk-mini-mode-v1', id); } catch {} }
    tabButtons.current[id]?.focus({ preventScroll: true });
    tabButtons.current[id]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const chooseLevel = (id: typeof level) => { setLevel(id); try { localStorage.setItem('bk-mini-level-v1', id); } catch { /* Still playable when storage is unavailable. */ } };
  return <section className="bk-home-mini-games" aria-label="Mini Games">
    <button type="button" className="bk-mini-games-cover" aria-label="Explore Mini Games" onClick={openMenu}>
      <img src="/mini-games-home-cover.webp" alt="Mini Games. Big plays. Quick games." width="1254" height="1254" loading="lazy" decoding="async" draggable={false}/>
    </button>
    <dialog ref={dialog} className="bk-mini-games-dialog" aria-labelledby="mini-games-heading" aria-describedby="mini-games-description" onClose={() => setMenuOpen(false)} onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <div className="bk-mini-games-content">
        <div className="bk-mini-flow-top"><span className="bk-mini-games-eyebrow">MINI GAMES</span><button type="button" aria-label="Close Mini Games" onClick={() => dialog.current?.close()}>×</button></div>
        <div className="bk-mini-mode-tabs" role="tablist" aria-label="Mini game modes" onKeyDown={event => {
          const index = MINI_MODE_TABS.findIndex(tab => tab.id === activeMode);
          const next = event.key === 'ArrowRight' ? (index + 1) % MINI_MODE_TABS.length : event.key === 'ArrowLeft' ? (index + MINI_MODE_TABS.length - 1) % MINI_MODE_TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? MINI_MODE_TABS.length - 1 : -1;
          if (next >= 0) { event.preventDefault(); chooseMode(MINI_MODE_TABS[next].id); }
        }}>
          {MINI_MODE_TABS.map(tab => <button key={tab.id} ref={node => { tabButtons.current[tab.id] = node; }} type="button" role="tab" id={`mini-tab-${tab.id}`} aria-controls={`mini-panel-${tab.id}`} aria-selected={activeMode === tab.id} tabIndex={activeMode === tab.id ? 0 : -1} onClick={() => chooseMode(tab.id)}>{tab.name}</button>)}
        </div>
        <div role="tabpanel" id={`mini-panel-${activeMode}`} aria-labelledby={`mini-tab-${activeMode}`}>
        {activeMode !== 'combine' && <div className="bk-mini-flow-progress" aria-label={`Step ${picking === 'home' ? 1 : picking === 'away' ? 2 : 3} of 3`}>
          {['Your team', 'Opponent', 'Matchup'].map((label, index) => <span key={label} aria-current={index === (picking === 'home' ? 0 : picking === 'away' ? 1 : 2) ? 'step' : undefined}>{index + 1}. {label}</span>)}
        </div>}
        <h2 ref={heading} tabIndex={-1} id="mini-games-heading">{activeMode === 'combine' ? 'Combine Drills' : picking === 'home' ? 'Pick Your Team' : picking === 'away' ? 'Pick Opponent' : 'View Matchup'}</h2>
        <p id="mini-games-description" className="bk-mini-flow-description">{activeMode === 'combine' ? 'Test your speed, throwing accuracy, and catching skills.' : picking === 'home' ? 'Choose your squad. Own the field.' : picking === 'away' ? `Who will take on the ${matchup.home.name.split(' ').at(-1)}?` : 'The stage is set. Make your statement.'}</p>
        {activeMode === 'combine' ? <section className="bk-mini-combine-preview" aria-label="Combine drills">
          <span className="bk-mini-coming-soon">Coming soon</span>
          <ul><li><strong>Speed Challenge</strong><p>Timed runs and agility drills.</p></li><li><strong>Passing Accuracy</strong><p>Hit targets and sharpen your throws.</p></li><li><strong>Catching Challenge</strong><p>Test your hands and timing.</p></li></ul>
          <p>Combine drills are in development. Choose another tab to hit the field now.</p>
        </section> : <>
        <p className="bk-mini-active-mode-description">{gameMode === 'five-minute' ? 'Full game vs. CPU. Play offense; watch each defensive play.' : 'Down four. Two minutes to score the winning touchdown.'}</p>
        {picking === 'home' && <fieldset className="bk-mini-levels">
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
          <div className="bk-mini-review-game">{gameName.toUpperCase()} <span>•</span> {difficulty.name.toUpperCase()}</div>
          <p className="bk-mini-review-rules">{gameMode === 'five-minute' ? 'Five-minute clock. Three timeouts each. Equal-possession overtime.' : 'Own 25. Down four. Two minutes. Three timeouts.'}</p>
          <a className="bk-mini-confirm-team bk-mini-launch" href={`/play-moment-3d-preview.html?mode=${gameMode}&difficulty=${level}&team=${matchup.home.abbr}&opponent=${matchup.away.abbr}`}>Start Game <span aria-hidden="true">→</span></a>
          <div className="bk-mini-review-edits"><button type="button" onClick={() => setPicking('home')}>Change my team</button><button type="button" onClick={() => setPicking('away')}>Change opponent</button></div>
          <p className="bk-mini-tip">{gameMode === 'five-minute' ? 'Play in landscape. Simulated kicks, automatic extra points. Pause or step through the defensive play-by-play.' : 'Play in landscape. The clock starts at your first snap. Use timeouts, spikes, and the sidelines.'}</p>
        </section> : null}
        {!picking && <button type="button" className="bk-mini-review-back" onClick={() => setPicking('away')}>← Back</button>}
        </>}
        </div>
        {MINI_MODE_TABS.filter(tab => tab.id !== activeMode).map(tab => <div key={tab.id} role="tabpanel" id={`mini-panel-${tab.id}`} aria-labelledby={`mini-tab-${tab.id}`} hidden/>)}
      </div>
    </dialog>
  </section>;
}
