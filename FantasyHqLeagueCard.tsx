import React from 'react';
import { ArrowRight, Crown, Trophy } from 'lucide-react';
import type { League } from './types';
import { fantasyHqSummary } from './fantasyHqData';

export function LeagueDestinationCard({league,currentUserId,featured,onSelect}: {
  league: League; currentUserId?: string; featured: boolean;
  onSelect: (league: League, tab: 'lobby'|'draft'|'simulation') => void;
}) {
  const facts=fantasyHqSummary(league,currentUserId);
  const format=league.settings?.scoringFormat==='half_ppr'?'Half PPR':league.settings?.scoringFormat==='standard'?'Standard':'PPR';
  return <div className="bk-fantasy-league-pair" data-league-id={league.id}>
    <article className={`bk-fantasy-league-card${featured?' bk-fantasy-league-card--featured':''}`} aria-label={league.name}>
      <div className="bk-fantasy-league-summary">
        <div className="bk-fantasy-league-crest" aria-hidden="true"><span>{league.name.trim().slice(0,1).toUpperCase()||'F'}</span>{league.commissionerId===currentUserId&&<Crown/>}</div>
        <div className="bk-fantasy-league-copy"><h4>{league.name}</h4><p className="bk-hq-commissioner">Commissioner: <b>{league.commissionerName || 'Not available'}</b></p><small>Status</small><div className="bk-fantasy-league-status"><i aria-hidden="true"/>{facts.phase}</div></div>
      </div>
      <div className="bk-fantasy-league-facts" aria-label={`${league.name} status`}>
        <span><strong>{facts.ready}/{league.members.length} ready</strong><small>{league.members.length}/{league.maxMembers} teams · {format}</small></span>
        <span><strong>Players</strong><small>{facts.players === null ? 'Not drafted yet' : `${facts.players} ${facts.playersLabel}`}</small></span>
      </div>
      <div className="bk-fantasy-league-actions">
        <button type="button" className="bk-fantasy-league-actions-primary" onClick={()=>onSelect(league,facts.primaryTab)}>{facts.primaryLabel}<ArrowRight aria-hidden="true"/></button>
        <button type="button" onClick={()=>onSelect(league,facts.resultTab)}>{facts.resultTab==='simulation'?<><Trophy aria-hidden="true"/>Order results</>:'League HQ'}</button>
      </div>
    </article>
    <aside className="bk-hq-league-status-panel" aria-label={`${league.name} league status`}>
      <h3>League status</h3><p>{league.name}</p>
      <div className="bk-hq-status-hexes">
        <div><small>Draft pick</small><strong>{facts.pick===null?'Not set':`#${facts.pick}`}</strong></div>
        <div><small>Roster</small><strong>{facts.roster}</strong></div>
        <div><small>Players</small><strong>{facts.players===null?'—':facts.players}</strong><small>{facts.playersLabel}</small></div>
      </div>
    </aside>
  </div>;
}
