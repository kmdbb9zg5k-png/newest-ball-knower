import React, { useEffect, useRef, useState } from 'react';
import { MINI_LEVELS, miniLevel } from './public/play-moment-3d/mini-games.js';
import { MINI_SELECTOR_ART } from './miniSelectorArt';
import { MiniTeamCarousel } from './MiniTeamCarousel';
import { MINI_TEAMS, miniMatchup } from './public/play-moment-3d/mini-teams.js';

export function HomeMiniGamesFeature() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [level, setLevel] = useState(() => { try { return miniLevel(localStorage.getItem('bk-mini-level-v1')).id; } catch { return 'rookie'; } });
  const difficulty = miniLevel(level);
  const [gameMode, setGameMode] = useState<'two-minute' | 'five-minute'>(() => { try { return localStorage.getItem('bk-mini-mode-v1') === 'five-minute' ? 'five-minute' : 'two-minute'; } catch { return 'two-minute'; } });
  const [screen, setScreen] = useState<'modes' | 'difficulty' | 'teams' | 'combine'>('modes');
  const gameName = gameMode === 'five-minute' ? 'Five-Minute Game' : 'Two-Minute Warning';
  const [menuOpen, setMenuOpen] = useState(false);
  const [matchup, setMatchup] = useState(() => { try { const saved = JSON.parse(localStorage.getItem('bk-mini-matchup-v1') || 'null'); return miniMatchup(saved?.home || MINI_TEAMS[15].abbr, saved?.away || MINI_TEAMS[16].abbr); } catch { return miniMatchup(MINI_TEAMS[15].abbr, MINI_TEAMS[16].abbr); } });
  const [picking, setPicking] = useState<'home' | 'away' | null>('home');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (menuOpen) { dialog.current?.scrollTo({ top: 0 }); heading.current?.focus({ preventScroll: true }); }
  }, [picking, menuOpen, screen]);
  const chooseTeam = (abbr: string) => {
    if (picking === 'away' && abbr === matchup.home.abbr) return;
    const next = picking === 'home' ? miniMatchup(abbr, abbr === matchup.away.abbr ? matchup.home.abbr : matchup.away.abbr) : miniMatchup(matchup.home.abbr, abbr);
    setMatchup(next); setPicking(picking === 'home' ? 'away' : null);
    try { localStorage.setItem('bk-mini-matchup-v1', JSON.stringify({ home: next.home.abbr, away: next.away.abbr })); } catch {}
  };
  const openMenu = () => { setScreen('modes'); setMenuOpen(true); setPicking('home'); dialog.current?.showModal(); };
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.get('miniGames') === '1') {
      openMenu(); url.searchParams.delete('miniGames');
      history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);
  const chooseMode = (id: 'two-minute' | 'five-minute') => {
    setGameMode(id); setPicking('home'); setScreen('difficulty');
    try { localStorage.setItem('bk-mini-mode-v1', id); } catch {}
  };
  const chooseLevel = (id: typeof level) => { setLevel(id); try { localStorage.setItem('bk-mini-level-v1', id); } catch { /* Still playable when storage is unavailable. */ } };
  return <section className="bk-home-mini-games" aria-label="Mini Games">
    <button type="button" className="bk-mini-games-cover" aria-label="Explore Mini Games" onClick={openMenu}>
      <img src="/mini-games-home-cover.webp" alt="Mini Games. Big plays. Quick games." width="1254" height="1254" loading="lazy" decoding="async" draggable={false}/>
    </button>
    <dialog ref={dialog} className="bk-mini-games-dialog" aria-labelledby="mini-games-heading" aria-describedby="mini-games-description" onClose={() => setMenuOpen(false)} onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <div className="bk-mini-games-content">
        <div className="bk-mini-flow-top"><span className="bk-mini-games-eyebrow">MINI GAMES</span><button type="button" aria-label="Close Mini Games" onClick={() => dialog.current?.close()}>×</button></div>
        {screen === 'teams' && <div className="bk-mini-flow-progress" aria-label={`Step ${picking === 'home' ? 1 : picking === 'away' ? 2 : 3} of 3`}>
          {['Your team', 'Opponent', 'Matchup'].map((label, index) => <span key={label} aria-current={index === (picking === 'home' ? 0 : picking === 'away' ? 1 : 2) ? 'step' : undefined}>{index + 1}. {label}</span>)}
        </div>}
        <h2 ref={heading} tabIndex={-1} id="mini-games-heading">{screen === 'modes' ? 'Pick Your Game' : screen === 'difficulty' ? 'Choose Difficulty' : screen === 'combine' ? 'Combine Drills' : picking === 'home' ? 'Pick Your Team' : picking === 'away' ? 'Pick Opponent' : 'View Matchup'}</h2>
        <p id="mini-games-description" className="bk-mini-flow-description">{screen === 'modes' ? 'Big plays. Quick games. Choose your challenge.' : screen === 'difficulty' ? `${gameName}. How tough do you want it?` : screen === 'combine' ? 'Test your speed, throwing accuracy, and catching skills.' : picking === 'home' ? 'Choose your squad. Own the field.' : picking === 'away' ? `Who will take on the ${matchup.home.name.split(' ').at(-1)}?` : 'The stage is set. Make your statement.'}</p>
        {screen === 'modes' ? <div className="bk-mini-mode-cards">
          <button type="button" className="bk-mini-mode-card" onClick={() => chooseMode('two-minute')}><span className="bk-mini-card-time">02:00</span><strong>Two-Minute Warning</strong><span>Down four. Two minutes. Finish the game.</span><b>Play now →</b></button>
          <button type="button" className="bk-mini-mode-card bk-mini-mode-card-full" onClick={() => chooseMode('five-minute')}><span className="bk-mini-card-time">05:00</span><strong>Five-Minute Game</strong><span>You vs. CPU. Offense, defense, and kick returns.</span><b>Play now →</b></button>
          <button type="button" className="bk-mini-mode-card bk-mini-mode-card-combine" onClick={() => setScreen('combine')}><span className="bk-mini-card-time">Coming soon</span><strong>Combine Drills</strong><span>Speed. Accuracy. Hands. Put your skills to the test.</span><b>View drills →</b></button>
        </div> : screen === 'difficulty' ? <div className="bk-mini-difficulty-screen">
          <div className="bk-mini-difficulty-options">{MINI_LEVELS.map(option => <button type="button" key={option.id} aria-pressed={level === option.id} onClick={() => { chooseLevel(option.id); setScreen('teams'); }}><strong>{option.name}</strong><span>{option.description}</span><b aria-hidden="true">→</b></button>)}</div>
          <button type="button" className="bk-mini-review-back" onClick={() => setScreen('modes')}>← Back to game modes</button>
        </div> : screen === 'combine' ? <section className="bk-mini-combine-preview" aria-label="Combine drills">
          <span className="bk-mini-coming-soon">Coming soon</span>
          <ul><li><strong>Speed Challenge</strong><p>Timed runs and agility drills.</p></li><li><strong>Passing Accuracy</strong><p>Hit targets and sharpen your throws.</p></li><li><strong>Catching Challenge</strong><p>Test your hands and timing.</p></li></ul>
          <p>Combine drills are in development. Choose another game mode to hit the field now.</p>
          <button type="button" className="bk-mini-review-back" onClick={() => setScreen('modes')}>← Back to game modes</button>
        </section> : <>
        <p className="bk-mini-active-mode-description">{gameMode === 'five-minute' ? 'Full game vs. CPU. Play or simulate defense.' : 'Down four. Play until the final whistle.'}</p>
        {picking && menuOpen ? <MiniTeamCarousel key={picking + matchup[picking].abbr} side={picking} selected={matchup[picking]} excluded={picking === 'away' ? matchup.home.abbr : undefined} onSelect={chooseTeam} onCancel={() => picking === 'away' ? setPicking('home') : setScreen('difficulty')} backLabel={picking === 'away' ? 'Back to your team' : 'Back to difficulty'}/> : menuOpen ? <section className="bk-mini-review" aria-label="Matchup comparison">
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
          <p className="bk-mini-review-rules">{gameMode === 'five-minute' ? 'Five-minute clock. Three timeouts each. Equal-possession overtime.' : 'Own 25. Down four. Two minutes. Three timeouts. Overtime if tied.'}</p>
          <a className="bk-mini-confirm-team bk-mini-launch" href={`/play-moment-3d-preview.html?mode=${gameMode}&difficulty=${level}&team=${matchup.home.abbr}&opponent=${matchup.away.abbr}`}>Start Game <span aria-hidden="true">→</span></a>
          <div className="bk-mini-review-edits"><button type="button" onClick={() => setPicking('home')}>Change my team</button><button type="button" onClick={() => setPicking('away')}>Change opponent</button></div>
          <p className="bk-mini-tip">{gameMode === 'five-minute' ? 'Play in landscape. Kick off, return kicks, and play or simulate defense.' : 'Play in landscape. The clock starts at your first snap. Use timeouts, spikes, and the sidelines.'}</p>
        </section> : null}
        {!picking && <button type="button" className="bk-mini-review-back" onClick={() => setPicking('away')}>← Back</button>}
        </>}

      </div>
    </dialog>
  </section>;
}
