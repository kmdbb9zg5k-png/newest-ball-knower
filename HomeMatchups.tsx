import React, { useEffect, useState } from 'react';
import { ArrowRight, Settings, Trophy } from 'lucide-react';
import type { League, LeagueMember, UserProfile } from './types';
import type { WeeklyScore } from './fantasyLeagueParityCloud';
import { ManagerAvatar } from './ManagerAvatar';
import { displayLeagueMemberName, resolveMyLeagueMember } from './leagueMemberDisplay';
import { homeLeagueAction, homeLeaguePhase } from './homeDashboardState';
import { FANTASY_DISPLAY_EVENT, readFantasyDisplayPreferences, type FantasyDisplayPreferences } from './fantasyDisplayPreferences';

type Props = {
  leagues: League[];
  currentUser: UserProfile | null;
  onSelectLeague: (league: League, tab: 'lobby' | 'draft' | 'simulation') => void;
  onViewMemberLocker: (member: LeagueMember) => void;
  onOpenSettings: () => void;
};
type MatchupState = Record<string, { scores: WeeklyScore[]; loading: boolean; unavailable: boolean }>;

const currentPairing = (league: League, memberId: string) => {
  const week = Math.max(1, Number(league.settings?.currentWeek) || 1);
  const persisted = (league.seasonResult?.games || []).find(game =>
    game.week === week && (game.homeMemberId === memberId || game.awayMemberId === memberId));
  if (persisted) return { week, homeMemberId: persisted.homeMemberId, awayMemberId: persisted.awayMemberId };
  const lastRegularWeek = Math.max(0, ...(league.seasonResult?.games || []).filter(game => !game.playoffRound).map(game => game.week));
  if (lastRegularWeek > 0 && week > lastRegularWeek) return null;
  const members = league.members;
  if (members.length < 2 || members.length % 2) return null;
  const rotation = [...members];
  const round = (week - 1) % (members.length - 1);
  for (let index = 0; index < round; index += 1) rotation.splice(1, 0, rotation.pop()!);
  const reverse = Math.floor((week - 1) / (members.length - 1)) % 2 === 1;
  for (let index = 0; index < members.length / 2; index += 1) {
    const first = rotation[index], second = rotation[members.length - 1 - index];
    const home = (round % 2 === 0) !== reverse ? first : second;
    const away = home.id === first.id ? second : first;
    if (home.id === memberId || away.id === memberId) return { week, homeMemberId: home.id, awayMemberId: away.id };
  }
  return null;
};

const started = (score?: WeeklyScore) => Boolean(score && (score.livePoints !== 0 || score.players.some(player => player.isLive || player.isFinal)));
const points = (score?: WeeklyScore) => score ? score.livePoints.toFixed(2) : '—';
const projection = (score?: WeeklyScore) => score?.hasProjectedTotal === true ? score.projectedPoints.toFixed(2) : '—';

export const HomeMatchups = ({ leagues, currentUser, onSelectLeague, onViewMemberLocker, onOpenSettings }: Props) => {
  const active = leagues.filter(league => {
    const mine = resolveMyLeagueMember(league, currentUser);
    return Boolean(
      league.settings?.fantasySeasonStarted &&
      !league.settings?.fantasySeasonComplete &&
      mine &&
      currentPairing(league, mine.id),
    );
  });
  const activeIds = new Set(active.map(league => league.id));
  const otherLeagues = leagues.filter(league => !activeIds.has(league.id));
  const requestKey = active.map(league => `${league.id}:${Math.max(1, Number(league.settings?.currentWeek) || 1)}`).join('|');
  const [state, setState] = useState<MatchupState>({});
  const [display, setDisplay] = useState<FantasyDisplayPreferences>(readFantasyDisplayPreferences);

  useEffect(() => { const sync = () => setDisplay(readFantasyDisplayPreferences()); window.addEventListener(FANTASY_DISPLAY_EVENT, sync); return () => window.removeEventListener(FANTASY_DISPLAY_EVENT, sync); }, []);

  useEffect(() => {
    let live = true;
    const cleanups: (() => void)[] = [];
    setState(Object.fromEntries(active.map(league => [league.id, { scores: [], loading: true, unavailable: false }])));
    if (!active.length) return () => { live = false; };
    void import('./fantasyLeagueParityCloud').then(module => {
      active.forEach(league => {
        const week = Math.max(1, Number(league.settings?.currentWeek) || 1);
        const refresh = () => module.fetchHomeWeeklyScores(league.id, week)
          .then(scores => { if (live) setState(previous => ({ ...previous, [league.id]: { scores, loading: false, unavailable: false } })); })
          .catch(() => { if (live) setState(previous => ({ ...previous, [league.id]: { scores: previous[league.id]?.scores || [], loading: false, unavailable: true } })); });
        void refresh();
        if (live) cleanups.push(module.subscribeToFantasyParity(league.id, () => { void refresh(); }));
      });
    });
    return () => { live = false; cleanups.forEach(cleanup => cleanup()); };
  }, [requestKey]);

  if (!leagues.length) return null;
  const open = (league: League, tab: 'team' | 'matchup') => {
    window.sessionStorage.setItem(`ball-knower:league-tab:${league.id}`, tab);
    window.sessionStorage.setItem(`ball-knower:matchup-week:${league.id}`, String(Math.max(1, Number(league.settings?.currentWeek) || 1)));
    onSelectLeague(league, 'lobby');
  };

  return <section className="bk-home-matchups" data-density={display.density} data-show-projections={display.showProjections} data-spoiler-free={display.spoilerFree} aria-labelledby="home-matchups-heading">
    <div className="bk-home-matchups-title"><div className="bk-home-matchups-title-main"><h2 id="home-matchups-heading">My Matchups</h2><button type="button" className="bk-home-settings-trigger" aria-label="Open fantasy settings" onClick={onOpenSettings}><Settings aria-hidden="true"/></button></div><button type="button" className="bk-home-league-count" onClick={onOpenSettings}>{active.length} active · {leagues.length} leagues</button></div>
    <div className="bk-home-matchup-list">{active.map(league => {
      const mine = resolveMyLeagueMember(league, currentUser)!;
      const pairing = currentPairing(league, mine.id);
      if (!pairing) return null;
      const opponentId = pairing.homeMemberId === mine.id ? pairing.awayMemberId : pairing.homeMemberId;
      const opponent = league.members.find(member => member.id === opponentId);
      const snapshot = state[league.id];
      const myScore = snapshot?.scores.find(score => score.memberId === mine.id && score.week === pairing.week);
      const opponentScore = snapshot?.scores.find(score => score.memberId === opponent?.id && score.week === pairing.week);
      const status = myScore?.isFinal && opponentScore?.isFinal ? 'Final' : started(myScore) || started(opponentScore) ? 'Live' : 'Scheduled';
      const projectionsReady = myScore?.hasProjectedTotal === true && opponentScore?.hasProjectedTotal === true;
      const chance = projectionsReady ? Math.max(5, Math.min(95, 100 / (1 + Math.exp(-(myScore.projectedPoints - opponentScore.projectedPoints) / 30)))) : null;
      return <article
        key={league.id}
        className="bk-home-matchup-card"
        role="button"
        tabIndex={0}
        aria-label={`Open ${league.name}, Week ${pairing.week} matchup`}
        onClick={(event) => {
          if ((event.target as Element).closest('button, a')) return;
          open(league, 'matchup');
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          open(league, 'matchup');
        }}
      >
        <header><span><Trophy aria-hidden="true"/>{league.name}</span><strong>WEEK {pairing.week} · {status}</strong></header>
        <div className="bk-home-matchup-teams">
          <MatchupTeam member={mine} mine user={currentUser} score={myScore} onOpenLocker={onViewMemberLocker}/>
          <span className="bk-home-matchup-vs">VS</span>
          <MatchupTeam member={opponent} user={currentUser} score={opponentScore} onOpenLocker={onViewMemberLocker}/>
        </div>
        {chance !== null ? <div className="bk-home-matchup-odds">
          <div><strong>{chance.toFixed(0)}%</strong><span>Projected win chance</span><strong>{(100 - chance).toFixed(0)}%</strong></div>
          <div className="bk-home-matchup-meter"><i style={{ width: `${chance}%` }}/><i style={{ width: `${100 - chance}%` }}/></div>
        </div> : <p className="bk-home-matchup-sync">{snapshot?.loading ? 'Syncing matchup…' : snapshot?.unavailable ? 'Live scoring temporarily unavailable' : 'Projected win chance unavailable'}</p>}
        <footer><button type="button" onClick={() => open(league, 'team')}>My Team</button><button type="button" onClick={() => open(league, 'matchup')}>Matchup</button></footer>
      </article>;
    })}</div>
    {otherLeagues.length > 0 && <div className="bk-home-other-leagues">
      <div className="bk-home-matchups-title"><h3>Other Leagues</h3><span>{otherLeagues.length} more</span></div>
      <div className="bk-home-other-league-list">
        {otherLeagues.map(league => {
          const action = homeLeagueAction(league);
          return <button
            type="button"
            key={league.id}
            aria-label={`${action.label}: ${league.name}`}
            onClick={() => onSelectLeague(league, action.tab)}
          >
            <span className="bk-home-other-league-icon" aria-hidden="true"><Trophy/></span>
            <span className="bk-home-other-league-copy"><strong>{league.name}</strong><small>{league.members.length}/{league.maxMembers} teams · {homeLeaguePhase(league)}</small></span>
            <span className="bk-home-other-league-action">{action.label}<ArrowRight aria-hidden="true"/></span>
          </button>;
        })}
      </div>
    </div>}
  </section>;
};

const MatchupTeam = ({ member, mine = false, user, score, onOpenLocker }: { member?: LeagueMember; mine?: boolean; user: UserProfile | null; score?: WeeklyScore; onOpenLocker: (member: LeagueMember) => void }) => {
  const name = displayLeagueMemberName(member, mine, user);
  return <div className={`bk-home-matchup-team ${mine ? '' : 'bk-home-matchup-team-right'}`}>
    <strong>{name}</strong>
    <div>{member && !member.isAi ? <button type="button" aria-label={`View ${name}'s locker`} onClick={() => onOpenLocker(member)}><ManagerAvatar member={member} name={name} className="h-14 w-14"/></button> : <ManagerAvatar member={member} name={name} className="h-14 w-14"/>}<span><b>{points(score)}</b><small>{projection(score)} PROJ</small></span></div>
  </div>;
};
