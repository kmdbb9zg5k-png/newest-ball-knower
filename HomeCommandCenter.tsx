import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Award, Brain, ClipboardList, ExternalLink, FlaskConical, Newspaper, Plus, RefreshCw, Target, Trophy, User, UserPlus, Users } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import type { HomeDashboardProps } from './HomeDashboard';
import type { ProgressEvent, ProgressProfile } from './progressionCloud';
import { HomeStadiumHero } from './HomeStadiumHero';
import { HomeFeaturedMatchup, HomeLeagueActivity, HomeRecentProgress } from './HomeCommandPanels';
import { homeInitials, homeLeagueAction, homeRatingTier } from './homeCommandData';
import { fantasyHqSummary } from './fantasyHqData';
import { formatDraftSchedule } from './draftSchedule';
import { homePartners } from './partners';
import { PartnerCard } from './PartnerCard';
import './homeCommandCenter.css';

export function HomeCommandCenter(props: HomeDashboardProps) {
  const { currentUser } = useBallKnower();
  return <HomeSession key={currentUser?.id || 'guest'} {...props}/>;
}

function HomeSession({ onNavigate, onOpenCheatSheet, onOpenCreateLeague, onOpenJoinLeague, onSelectLeague, teamTheme }: HomeDashboardProps) {
  const { leagues, activeLeague, currentUser, setActiveLeagueId } = useBallKnower();
  const [profile, setProfile] = useState<ProgressProfile | null>(null), [events, setEvents] = useState<ProgressEvent[]>([]);
  const [ratingLoading, setRatingLoading] = useState(true), [ratingError, setRatingError] = useState(false);
  const generation = useRef(0), picker = useRef<HTMLDetailsElement>(null);
  const loadProfile = useCallback(async () => {
    const version = ++generation.current;
    setRatingLoading(true); setRatingError(false);
    try {
      const { fetchProgressionProfile } = await import('./progressionCloud');
      const data = await fetchProgressionProfile(currentUser?.name);
      if (version !== generation.current) return;
      setProfile(data.profile); setEvents(data.events);
    } catch { if (version === generation.current) setRatingError(true); }
    finally { if (version === generation.current) setRatingLoading(false); }
  }, [currentUser?.name]);
  useEffect(() => { void loadProfile(); return () => { generation.current += 1; }; }, [loadProfile]);
  const homeLeagues = leagues.filter(league => Boolean(currentUser?.id) && (league.commissionerId === currentUser?.id || league.members.some(member => member.userId === currentUser?.id)));
  // Resolve selection against the current authorized collection, not an old account's object.
  const primaryLeague = homeLeagues.find(league => league.id === activeLeague?.id) || homeLeagues.find(league => !league.settings?.fantasySeasonComplete) || homeLeagues[0];
  const myMember = primaryLeague?.members.find(member => member.userId === currentUser?.id);
  const facts = primaryLeague ? fantasyHqSummary(primaryLeague, currentUser?.id) : null;
  const action = homeLeagueAction(primaryLeague);
  const scheduledDraft = primaryLeague ? formatDraftSchedule(primaryLeague) : null;
  const rating = profile?.bkRating, tier = homeRatingTier(rating);
  const openLeague = () => primaryLeague ? onSelectLeague(primaryLeague, action.tab) : onNavigate('fantasy');
  const mediaPartners = homePartners.filter(partner => partner.category === 'media');
  const dataPartners = homePartners.filter(partner => partner.category === 'data');

  return <div className="bk-home-dashboard bk-home-broadcast bk-home-command" data-testid="home-command-center" style={{ '--command-team': teamTheme.primary } as React.CSSProperties}>
    <HomeStadiumHero onMyLeagues={() => onNavigate('fantasy')}/>
    <section className="bk-home-primary-modes bk-command-modes" aria-label="Primary destinations">
      <Mode icon={<Trophy/>} label="Fantasy" color="gold" onClick={() => onNavigate('fantasy')}/>
      <Mode icon={<Target/>} label="Picks" color="red" onClick={() => onNavigate('sportsbook')}/>
      <Mode icon={<Brain/>} label="Trivia" color="purple" onClick={() => onNavigate('challenges')}/>
      <Mode icon={<Newspaper/>} label="News" accessible="NFL News" color="green" onClick={() => onNavigate('news')}/>
      <Mode icon={<User/>} label="Profile" color="teal" onClick={() => onNavigate('locker')}/>
    </section>

    <section className="bk-home-rating bk-command-rating" aria-label="Ball Knower Rating" aria-busy={ratingLoading}>
      {tier && profile ? <><div className="bk-command-rating-value"><h2>Ball Knower Rating</h2><strong data-testid="home-bk-rating">{rating}</strong><span>/99</span></div><div className="bk-command-tier"><strong>{tier.name}</strong><div role="progressbar" aria-label="Progress to next rating tier" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tier.percent)}><span style={{ width: `${tier.percent}%` }}/></div><small>{tier.next ? `${tier.remaining} rating points to ${tier.next}` : 'Highest rating tier'}</small></div></> : <div className="bk-command-rating-placeholder" role={ratingError ? 'alert' : 'status'}>{ratingLoading ? 'Verifying your Ball Knower Rating…' : 'Rating unavailable'}</div>}
      <button type="button" className="bk-command-silver" onClick={() => onNavigate('locker')} aria-label="View Profile">View Profile <ArrowRight aria-hidden="true"/></button>
      {ratingError && <div className="bk-command-sync-error"><span>{profile ? 'Last synced rating · refresh unavailable' : 'Your profile could not sync.'}</span><button type="button" onClick={() => void loadProfile()} aria-label="Retry rating"><RefreshCw aria-hidden="true"/></button></div>}
    </section>

    <section className="bk-home-current-league bk-command-league" aria-label="Continue your league">
      <div className="bk-command-crest" aria-hidden="true">{homeInitials(primaryLeague?.name || 'BK')}</div>
      <div className="bk-command-league-main"><h2>{primaryLeague ? 'Continue your league' : 'Start your league'}</h2>
        <details ref={picker} className="bk-home-league-picker"><summary aria-label="Choose a fantasy league">{primaryLeague?.name || 'Choose a fantasy league'}<span aria-hidden="true">⌄</span></summary><div>{homeLeagues.map(league => <button type="button" key={league.id} aria-pressed={league.id === primaryLeague?.id} onClick={() => { setActiveLeagueId(league.id); if (picker.current) picker.current.open = false; }}>{league.name}</button>)}{!homeLeagues.length && <p>No leagues yet. Create one or join with a code.</p>}</div></details>
        <p>{primaryLeague ? `${primaryLeague.members.length}/${primaryLeague.maxMembers} managers${facts?.pick ? ` · Your pick #${facts.pick}` : ' · Draft order pending'}` : 'Create, join, and compete with your friends.'}</p>
        <div className="bk-command-league-meta"><span>{facts?.phase || 'Ready when you are'}</span><small>{teamTheme.abbr === 'BK' ? 'Ball Knower theme' : `${teamTheme.name} theme`}</small></div>
        {scheduledDraft && primaryLeague?.liveDraft?.status !== 'completed' && <p className="bk-command-scheduled">Draft: {scheduledDraft}</p>}
        <button type="button" className="bk-command-league-cta" onClick={openLeague}>{action.label}<ArrowRight aria-hidden="true"/></button>
      </div>
    </section>

    <section className="bk-command-quick" aria-label="Quick Links"><h2>Quick Links</h2><div className="bk-home-quick-links">
      <Quick icon={<Plus/>} label="Create League" onClick={onOpenCreateLeague}/><Quick icon={<UserPlus/>} label="Join League" onClick={onOpenJoinLeague}/><Quick icon={<ClipboardList/>} label="Cheat Sheet" onClick={onOpenCheatSheet}/><Quick icon={<FlaskConical/>} label="Solo Mode" onClick={() => onNavigate('solo')}/>
    </div></section>
    <HomeLeagueActivity key={`${primaryLeague?.id || 'none'}:${myMember?.id || 'guest'}`} league={primaryLeague} memberId={myMember?.id} onOpen={() => primaryLeague ? onSelectLeague(primaryLeague, 'lobby') : onNavigate('fantasy')}/>

    <div className="bk-command-lower"><HomeFeaturedMatchup key={`${primaryLeague?.id || 'none'}:${myMember?.id || 'guest'}`} league={primaryLeague} memberId={myMember?.id} onOpen={() => primaryLeague ? onSelectLeague(primaryLeague, 'lobby') : onNavigate('fantasy')}/>
      <section className="bk-command-partners" aria-label="Our Partners"><h2>Partners</h2>
        {mediaPartners.map(partner => <PartnerCard key={partner.name} partner={partner} compact/>)}
        {homePartners.length > 1 && <button type="button" aria-label="View All Partners" onClick={() => onNavigate('partners')}>All partners<ArrowRight aria-hidden="true"/></button>}
      </section>
    </div>
    <div className="bk-command-data-partners">{dataPartners.map(partner => <a key={partner.name} href={partner.websiteUrl} target="_blank" rel="noopener noreferrer external">Data by {partner.name}<ExternalLink aria-hidden="true"/></a>)}</div>
    <HomeRecentProgress events={events} unavailable={ratingError || ratingLoading} onProfile={() => onNavigate('locker')}/>
    <section className="bk-home-featured bk-command-research" aria-label="Featured research"><button type="button" onClick={onOpenCheatSheet}><ClipboardList aria-hidden="true"/><span><strong>Your 2026 Fantasy Cheat Sheet</strong><small>Rankings, projections &amp; player research</small></span><ArrowRight aria-hidden="true"/></button><button type="button" onClick={() => onNavigate('legacy')}><Award aria-hidden="true"/>Explore Hall of Fame<ArrowRight aria-hidden="true"/></button></section>
  </div>;
}

function Mode({ icon, label, accessible, color, onClick }: { icon: React.ReactNode; label: string; accessible?: string; color: string; onClick: () => void }) {
  return <button type="button" data-tone={color} aria-label={accessible || label} onClick={onClick}>{icon}<span>{label}</span></button>;
}
function Quick({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick}>{icon}<span>{label}</span></button>;
}
