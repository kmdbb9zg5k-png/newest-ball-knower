import React, { useEffect, useState } from 'react';
import { ArrowRight, Bell, RefreshCw, ShieldCheck } from 'lucide-react';
import type { League } from './types';
import type { WeeklyScore } from './fantasyLeagueParityCloud';
import type { ProgressEvent } from './progressionCloud';
import { supabase, ensureOnlineSession } from './supabase';
import { fantasyHqScheduleFacts } from './fantasyHqData';
import { homeActivityRows, homeInitials, homePoints, homePublishedProjection, homeTimestamp, type HomeActivityRow, type HomeActivitySources } from './homeCommandData';

type ActivityResult = { rows: HomeActivityRow[]; partial: boolean };
/** Only fetch the active league's public receipts and the current member's private updates. */
async function readHomeActivity(leagueId: string, memberId?: string): Promise<ActivityResult> {
  if (!supabase) throw new Error('Online league activity is unavailable.');
  await ensureOnlineSession();
  const empty = Promise.resolve({ data: [], error: null });
  const results = await Promise.all([
    supabase.from('ball_knower_transactions').select('id,summary,created_at').eq('league_id', leagueId).order('created_at', { ascending: false }).limit(10),
    supabase.from('ball_knower_league_messages').select('id,kind,body,created_at').eq('league_id', leagueId).in('kind', ['announcement', 'receipt']).order('created_at', { ascending: false }).limit(10),
    memberId ? supabase.from('ball_knower_waiver_claims').select('id,member_id,status,created_at').eq('league_id', leagueId).eq('member_id', memberId).order('created_at', { ascending: false }).limit(5) : empty,
    memberId ? supabase.from('ball_knower_trades').select('id,proposer_member_id,recipient_member_id,status,created_at').eq('league_id', leagueId).or(`proposer_member_id.eq.${memberId},recipient_member_id.eq.${memberId}`).order('created_at', { ascending: false }).limit(5) : empty,
  ]);
  const partial = results.some(result => result.error);
  if (results.slice(0, memberId ? 4 : 2).every(result => result.error)) throw new Error('League activity could not sync.');
  const data = { transactions: results[0].error ? [] : results[0].data || [], messages: results[1].error ? [] : results[1].data || [], claims: results[2].error ? [] : results[2].data || [], trades: results[3].error ? [] : results[3].data || [] } as HomeActivitySources;
  return { rows: homeActivityRows(data, memberId), partial };
}

export function HomeLeagueActivity({ league, memberId, onOpen }: { league?: League; memberId?: string; onOpen: () => void }) {
  const [data, setData] = useState<ActivityResult | null>(null), [busy, setBusy] = useState(Boolean(league)), [error, setError] = useState(false), [retry, setRetry] = useState(0), [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null); setError(false); setBusy(Boolean(league));
    if (!league) return;
    void readHomeActivity(league.id, memberId).then(result => { if (active) setData(result); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [league?.id, memberId, retry]);
  const rows = data?.rows || [];
  return <section className="bk-command-activity bk-home-activity" aria-label="League Activity" aria-busy={busy}>
    <Bell className="bk-command-bell" aria-hidden="true"/>
    <div className="bk-command-activity-copy"><h2>League Activity</h2>
      {busy ? <p role="status">Checking league updates…</p> : error ? <p role="alert">Activity unavailable. Your league is unchanged.</p> : <>
        {data?.partial && <p role="status">Some updates could not sync.</p>}
        {rows.length ? <><strong>{rows.length === 10 ? 'Latest 10' : rows.length} recent {rows.length === 1 ? 'update' : 'updates'}</strong><p className="bk-command-latest">{rows[0].detail}</p></> : <p>{league ? data?.partial ? 'Retry to load the remaining updates.' : 'No recent league updates.' : 'Join a league to see its updates.'}</p>}
      </>}
    </div>
    <div className="bk-command-activity-actions">
      {(error || data?.partial) ? <button type="button" aria-label="Retry activity" onClick={() => setRetry(value => value + 1)}><RefreshCw aria-hidden="true"/></button> : rows.length > 1 ? <button type="button" aria-label={expanded ? 'Hide recent league updates' : 'Show recent league updates'} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span>{expanded ? 'Less' : 'All'}</span></button> : null}
      <button type="button" aria-label="Open league activity" onClick={onOpen}><ArrowRight aria-hidden="true"/></button>
    </div>
    {expanded && rows.length > 0 && <ol className="bk-command-update-list">{rows.map(row => <li key={row.id}><strong>{row.title}</strong><p>{row.detail}</p><small>{homeTimestamp(row.time)}</small></li>)}</ol>}
  </section>;
}

type Featured = { week: number; homeName: string; awayName: string; home?: WeeklyScore; away?: WeeklyScore };
/** Use actual saved playoff pairings, never invent playoff opponents. */
export function HomeFeaturedMatchup({ league, memberId, onOpen }: { league?: League; memberId?: string; onOpen: () => void }) {
  const [matchup, setMatchup] = useState<Featured | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const ready = Boolean(league && league.liveDraft?.status === 'completed' && league.members.length >= 2 && league.members.length % 2 === 0);
  useEffect(() => {
    let active = true;
    setMatchup(null); setError(false); setBusy(ready);
    if (!ready || !league) return;
    void Promise.all([import('./fantasyLeagueParityCloud'), import('./simulation')]).then(async ([cloud, schedule]) => {
      const { weeks, persisted } = fantasyHqScheduleFacts(league);
      const week = Math.max(1, Math.min(18, Number(league.settings?.currentWeek) || 1));
      const pairings = week > weeks ? (league.seasonResult?.games || []).filter(game => game.playoffRound && game.week === week)
        : schedule.isCompleteFantasySchedule(league.members, weeks, persisted) ? persisted.filter(game => game.week === week) : schedule.buildFantasyWeekPairings(league.members, week);
      const pairing = pairings.find(game => memberId && [game.homeMemberId, game.awayMemberId].includes(memberId)) || pairings[0];
      if (!pairing) return;
      const homeMember = league.members.find(member => member.id === pairing.homeMemberId), awayMember = league.members.find(member => member.id === pairing.awayMemberId);
      if (!homeMember || !awayMember) return;
      const response = await cloud.fetchFantasyParityState(league.id, week, league.settings?.nflSeason || 2026);
      if (response.syncIssues.includes('scores') || response.syncIssues.includes('session reconnect')) throw new Error('Score read failed');
      if (active) setMatchup({ week, homeName: homeMember.userName, awayName: awayMember.userName, home: response.scores.find(score => score.memberId === homeMember.id && score.week === week), away: response.scores.find(score => score.memberId === awayMember.id && score.week === week) });
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [league, memberId, ready, retry]);
  return <section className="bk-command-matchup" aria-label="Featured Matchup" aria-busy={busy}>
    <header><h2>Featured Matchup</h2>{matchup && <span>W{matchup.week}</span>}</header>
    {busy ? <p role="status">Loading matchup…</p> : error ? <div role="alert"><p>Scores are unavailable.</p><button type="button" onClick={() => setRetry(value => value + 1)} aria-label="Retry featured matchup">Retry</button></div> : matchup ? <>
      <div className="bk-command-headtohead"><div><i aria-hidden="true">{homeInitials(matchup.awayName)}</i><strong>{matchup.awayName}</strong></div><div className="bk-command-matchup-score"><small>{matchup.home?.isFinal && matchup.away?.isFinal ? 'Final' : 'Posted points'}</small><b>{homePoints(matchup.away?.livePoints)} <span>–</span> {homePoints(matchup.home?.livePoints)}</b><small>Proj. {homePoints(homePublishedProjection(matchup.away))} – {homePoints(homePublishedProjection(matchup.home))}</small></div><div><i aria-hidden="true">{homeInitials(matchup.homeName)}</i><strong>{matchup.homeName}</strong></div></div>
    </> : <p>{!league ? 'Find a league to follow your matchup.' : !ready ? 'Matchups unlock after your fantasy draft.' : 'The next matchup has not been scheduled.'}</p>}
    <button type="button" className="bk-command-inline" onClick={onOpen}>{league ? 'Open League HQ' : 'Find a league'}<ArrowRight aria-hidden="true"/></button>
  </section>;
}

export function HomeRecentProgress({ events, unavailable, onProfile }: { events: ProgressEvent[]; unavailable: boolean; onProfile: () => void }) {
  return <section className="bk-command-progress" aria-label="Recent Progress"><header><h2><ShieldCheck aria-hidden="true"/>Recent Progress</h2><button type="button" onClick={onProfile}>View receipts<ArrowRight aria-hidden="true"/></button></header>
    {unavailable ? <p>Profile receipts are temporarily unavailable.</p> : events.length ? <ul>{events.slice(0, 3).map(event => <li key={event.id}><span>{event.eventType.replaceAll('_', ' ')}<small>{homeTimestamp(event.occurredAt)}</small></span><b>{event.xpAwarded > 0 ? '+' : ''}{event.xpAwarded} XP</b></li>)}</ul> : <p>Your verified accomplishments will appear here. Play to begin your record.</p>}
  </section>;
}
