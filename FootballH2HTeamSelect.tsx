import React, { useRef, useState } from 'react';
import { FOOTBALL_ARENA_TEAMS } from './footballArenaTeams';
import { MINI_TEAMS } from './public/play-moment-3d/arena-teams-v1.js';
import { MINI_SELECTOR_ART } from './miniSelectorArt';
import './FootballH2HTeamSelect.css';

type Props = {
  selectedTeam: string;
  onSelect: (team: string) => void;
  onContinue: () => void;
  onBack: () => void;
};

/** Full-screen team selection using the same fictional roster and artwork as Game Modes. */
export function FootballH2HTeamSelect({ selectedTeam, onSelect, onContinue, onBack }: Props) {
  const [showTeams, setShowTeams] = useState(false);
  const [query, setQuery] = useState('');
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = Math.max(0, FOOTBALL_ARENA_TEAMS.findIndex(team => team.abbr === selectedTeam));
  const team = FOOTBALL_ARENA_TEAMS[index];
  const roster = MINI_TEAMS.find(item => item.abbr === team.abbr)!;
  const art = MINI_SELECTOR_ART[team.abbr];
  const previous = FOOTBALL_ARENA_TEAMS[(index + FOOTBALL_ARENA_TEAMS.length - 1) % FOOTBALL_ARENA_TEAMS.length];
  const next = FOOTBALL_ARENA_TEAMS[(index + 1) % FOOTBALL_ARENA_TEAMS.length];
  const matches = FOOTBALL_ARENA_TEAMS.filter(item => `${item.name} ${item.abbr}`.toLowerCase().includes(query.toLowerCase()));
  const move = (direction: number) => onSelect(FOOTBALL_ARENA_TEAMS[(index + direction + FOOTBALL_ARENA_TEAMS.length) % FOOTBALL_ARENA_TEAMS.length].abbr);

  return <section className="bk-h2h-select" aria-label="Choose your football team" style={{ '--h2h-team': roster.primary, '--h2h-trim': roster.secondary } as React.CSSProperties} onKeyDown={event => {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }}>
    <header className="bk-h2h-select-header"><button type="button" onClick={onBack}>‹ Back</button><span>FOOTBALL H2H</span><span>01 / 03</span></header>
    <div className="bk-h2h-select-title"><p>BUILD YOUR MATCHUP</p><h1>Pick your team.</h1><span>Three drives. Make every possession count.</span></div>
    <div className="bk-h2h-select-stage">
      <img className="bk-h2h-select-watermark" src={art.logo} alt="" aria-hidden="true" />
      <div className="bk-h2h-select-team" aria-live="polite" aria-atomic="true"><img src={art.logo} alt="" /><div><h2>{team.name}</h2><p><strong>{team.overall} <small>OVR</small></strong><span>OFF {roster.offense} · DEF {roster.defense}</span></p></div></div>
      <div className="bk-h2h-select-portraits" onTouchStart={event => { touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => {
        if (touch.current) {
          const dx = event.changedTouches[0].clientX - touch.current.x;
          const dy = event.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
        }
        touch.current = null;
      }}>
        {art.players.map(player => <img key={player.id} src={player.portrait} alt="" width="362" height="362" draggable={false} />)}
      </div>
      <p className="bk-h2h-select-stars-label">TOP 3 PLAYERS</p>
      <div className="bk-h2h-select-stars">{art.players.map(player => <article key={player.id} data-player-id={player.id}><span>{player.position}</span><h3>{player.name}</h3><strong>{player.rating} <small>OVR</small></strong></article>)}</div>
      <nav className="bk-h2h-select-neighbors" aria-label="Browse football teams">
        <button type="button" onClick={() => move(-1)} aria-label={`Previous team: ${previous.name}`}><span aria-hidden="true">‹</span><img src={MINI_SELECTOR_ART[previous.abbr].logo} alt="" /><span>{previous.abbr}</span></button>
        <span>{String(index + 1).padStart(2, '0')} / {FOOTBALL_ARENA_TEAMS.length}<small>SWIPE TO BROWSE</small></span>
        <button type="button" onClick={() => move(1)} aria-label={`Next team: ${next.name}`}><span>{next.abbr}</span><img src={MINI_SELECTOR_ART[next.abbr].logo} alt="" /><span aria-hidden="true">›</span></button>
      </nav>
    </div>
    <div className="bk-h2h-select-actions"><button className="bk-h2h-select-confirm" type="button" onClick={onContinue}>Find opponent <span aria-hidden="true">→</span></button><button type="button" aria-expanded={showTeams} aria-controls="h2h-all-teams" onClick={() => setShowTeams(value => !value)}>Browse all 32 teams</button></div>
    {showTeams && <div id="h2h-all-teams" className="bk-h2h-select-list"><label>Find your team<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Team or city" /></label><div>{matches.map(item => <button type="button" key={item.abbr} aria-pressed={item.abbr === team.abbr} onClick={() => { onSelect(item.abbr); setShowTeams(false); setQuery(''); }}><img src={MINI_SELECTOR_ART[item.abbr].logo} alt="" /><span>{item.name}</span><strong>{item.overall}</strong></button>)}</div>{matches.length === 0 && <p>No matching teams.</p>}</div>}
  </section>;
}
