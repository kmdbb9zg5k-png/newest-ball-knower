import React, { useEffect, useRef, useState } from 'react';
import { MINI_TEAMS } from './public/play-moment-3d/mini-teams.js';
import { MINI_SELECTOR_ART } from './miniSelectorArt';

type Team = typeof MINI_TEAMS[number];
export function MiniTeamCarousel({ side, selected, excluded, onSelect, onCancel }: { side: 'home' | 'away'; selected: Team; excluded?: string; onSelect: (abbr: string) => void; onCancel: () => void }) {
  const teams = MINI_TEAMS.filter(team => team.abbr !== excluded);
  const [abbr, setAbbr] = useState(selected.abbr);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const index = Math.max(0, teams.findIndex(team => team.abbr === abbr));
  const team = teams[index];
  const art = MINI_SELECTOR_ART[team.abbr];
  const carousel = useRef<HTMLElement>(null);
  const touchStart = useRef<{x: number; y: number} | null>(null);
  const move = (direction: number) => setAbbr(teams[(index + direction + teams.length) % teams.length].abbr);
  useEffect(() => {
    for (const offset of [-1, 1]) {
      const neighbor = teams[(index + offset + teams.length) % teams.length];
      for (const player of MINI_SELECTOR_ART[neighbor.abbr].players) { const image = new Image(); image.src = player.portrait; }
    }
  }, [team.abbr, excluded]);
  const matches = teams.filter(item => (item.name + ' ' + item.abbr).toLowerCase().includes(search.toLowerCase()));
  return <section ref={carousel} className="bk-mini-carousel" aria-label={side === 'home' ? 'Select your team' : 'Select your opponent'} style={{ '--mini-team-color': team.primary, '--mini-team-trim': team.secondary } as React.CSSProperties} onKeyDown={event => {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
  }}>
    <img className="bk-mini-team-logo-backdrop" src={art.logo} alt="" aria-hidden="true"/>
    <div className="bk-mini-selector-label">{side === 'home' ? 'SELECT YOUR TEAM' : 'SELECT YOUR OPPONENT'}</div>
    <header className="bk-mini-carousel-heading">
      <button type="button" aria-label="Previous team" onClick={() => move(-1)}>‹</button>
      <div aria-live="polite" aria-atomic="true"><h4>{team.name}</h4><div className="bk-mini-carousel-ratings"><strong>{team.overall} <small>OVR</small></strong><span>OFF {team.offense} · DEF {team.defense}</span></div></div>
      <button type="button" aria-label="Next team" onClick={() => move(1)}>›</button>
    </header>
    <div className="bk-mini-carousel-art" onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => {
      if (touchStart.current !== null) { const distance = event.changedTouches[0].clientX - touchStart.current.x; const vertical = event.changedTouches[0].clientY - touchStart.current.y; if (Math.abs(distance) > 45 && Math.abs(distance) > Math.abs(vertical)) move(distance < 0 ? 1 : -1); }
      touchStart.current = null;
    }}>
      {art.players.map(player => <img key={player.id} src={player.portrait} alt={`${player.name}, ${team.name}`} width="362" height="362" draggable={false}/>)}
    </div>
    <div className="bk-mini-top-players-label">TOP 3 PLAYERS</div>
    <div className="bk-mini-star-players">{art.players.map(player => <div key={player.id} data-player-id={player.id}><strong><span>{player.name.split(' ')[0]}</span>{' '}<span>{player.name.split(' ').slice(1).join(' ')}</span></strong><span>{player.rating} <small>OVR</small></span><small>{player.position}</small></div>)}</div>
    <div className="bk-mini-carousel-position">TEAM {String(index + 1).padStart(2, '0')} / {teams.length}<span>{side === 'away' ? `${MINI_TEAMS.find(item => item.abbr === excluded)?.name} excluded` : 'Swipe or use the arrows to browse'}</span></div>
    <button type="button" className="bk-mini-confirm-team" onClick={() => onSelect(team.abbr)}>Select {team.name.split(' ').at(-1)} <span aria-hidden="true">→</span></button>
    <div className="bk-mini-carousel-footer"><button type="button" aria-expanded={showList} onClick={() => setShowList(value => !value)}>Browse all {teams.length} teams</button><button type="button" onClick={onCancel}>Back to matchup</button></div>
    {showList && <div className="bk-mini-team-picker" aria-label={side === 'home' ? 'Your team options' : 'Opponent options'}>
      <label>Find a Solo team<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Team or city"/></label>
      <div>{matches.map(item => <button type="button" key={item.abbr} aria-pressed={item.abbr === team.abbr} onClick={() => { setAbbr(item.abbr); setShowList(false); setSearch(''); requestAnimationFrame(() => carousel.current?.scrollIntoView({ block: 'start', behavior: 'auto' })); }}><span>{item.name}</span><strong>{item.overall} OVR</strong><small>OFF {item.offense} · DEF {item.defense}</small></button>)}</div>
      {matches.length === 0 && <p>No matching teams.</p>}
    </div>}
  </section>;
}
