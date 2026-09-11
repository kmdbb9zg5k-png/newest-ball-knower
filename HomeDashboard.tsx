import React, { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Bell, Brain, ChevronDown, ClipboardList, Flag, FlaskConical, Newspaper, Plus, RefreshCcw, Target, Trophy, UserPlus } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import type { ProgressProfile } from './progressionCloud';
import { formatDraftSchedule } from './draftSchedule';
import type { League, LeagueMember } from './types';
import type { TeamTheme } from './teamTheme';
import type { AppTab } from './App';
import { PartnerCard } from './PartnerCard';
import { homePartners } from './partners';
import { HomeStadiumHero } from './HomeStadiumHero';
import { HomeMatchups } from './HomeMatchups';
import { buildHomeActivity, homeFeaturedActivity, homeLeagueAction, homeLeaguePhase, homeRatingTier, type HomeActivity } from './homeDashboardState';
import './homeBroadcast.css';
import './homeLayout.css';

const FantasySettingsHub = lazy(() => import('./FantasySettingsHub').then(module => ({ default: module.FantasySettingsHub })));
const LeagueManagementModal = lazy(() => import('./LeagueManagementModal').then(module => ({ default: module.LeagueManagementModal })));

interface HomeDashboardProps {
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onSelectLeague: (league: League, tab: 'lobby' | 'draft' | 'simulation') => void;
  onNavigate: (tab: AppTab) => void;
  onOpenCheatSheet: () => void;
  onViewMemberLocker: (member: LeagueMember) => void;
  teamTheme: TeamTheme;
}

const formatActivityTime = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date) : '';
};

export const HomeDashboard: React.FC<HomeDashboardProps> = props => {
  const { currentUser } = useBallKnower();
  return <HomeSession key={currentUser?.id || 'guest'} {...props}/>;
};

function HomeSession({ onOpenCreateLeague, onOpenJoinLeague, onSelectLeague, onNavigate, onOpenCheatSheet, onViewMemberLocker, teamTheme }: HomeDashboardProps) {
  const { leagues, activeLeague, currentUser, setActiveLeagueId } = useBallKnower();
  const [profile, setProfile] = useState<ProgressProfile | null>(null);
  const [ratingLoading, setRatingLoading] = useState(true);
  const [ratingError, setRatingError] = useState('');
  const [ratingRetry, setRatingRetry] = useState(0);
  const [leagueMenuOpen, setLeagueMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [managedLeagueId, setManagedLeagueId] = useState('');
  const [activity, setActivity] = useState<HomeActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityUnavailable, setActivityUnavailable] = useState(false);
  const [activityRetry, setActivityRetry] = useState(0);
  const [activityLeagueId, setActivityLeagueId] = useState<string | null>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const leaguePickerId = useId();
  const selectedLeague = leagues.find(league => league.id === activeLeague?.id);
  const primaryLeague = selectedLeague || leagues.find(league => !league.settings?.fantasySeasonComplete) || leagues[0];
  const myMember = primaryLeague?.members.find(member => member.userId === currentUser?.id);
  const liveDraftIndex = primaryLeague?.liveDraft?.orderMemberIds.indexOf(myMember?.id || '') ?? -1;
  const savedPick = primaryLeague?.seasonResult?.draftOrder?.find(item => item.memberId === myMember?.id)?.pickNumber;
  const myPick = liveDraftIndex >= 0 ? liveDraftIndex + 1 : savedPick;
  const tier = homeRatingTier(profile?.bkRating);
  const action = primaryLeague ? homeLeagueAction(primaryLeague) : null;
  const scheduledDraft = primaryLeague && !primaryLeague.settings?.fantasySeasonStarted && primaryLeague.liveDraft?.status !== 'completed'
    ? formatDraftSchedule(primaryLeague) : null;
  const activityMatchesLeague = activityLeagueId === primaryLeague?.id;
  const checkingActivity = Boolean(primaryLeague) && (!activityMatchesLeague || activityLoading);
  const activityFailed = activityMatchesLeague && activityUnavailable;
  const currentActivity = activityMatchesLeague ? activity : [];
  const featured = !checkingActivity && !activityFailed ? homeFeaturedActivity(currentActivity, Date.now()) : undefined;
  const recent = currentActivity.filter(item => item.id !== featured?.id).slice(0, 3);
  const openPrimaryLeague = () => { if (primaryLeague && action) onSelectLeague(primaryLeague, action.tab); };
  const openActivity = () => { if (primaryLeague) onSelectLeague(primaryLeague, 'lobby'); };

  useEffect(() => {
    let live = true;
    setRatingLoading(true); setRatingError('');
    void import('./progressionCloud').then(module => module.fetchProgressionProfile(currentUser?.name))
      .then(data => { if (live) setProfile(data.profile); })
      .catch((error: unknown) => { if (live) setRatingError(error instanceof Error ? error.message : 'Could not load your rating.'); })
      .finally(() => { if (live) setRatingLoading(false); });
    return () => { live = false; };
  }, [currentUser?.name, ratingRetry]);

  useEffect(() => {
    let live = true;
    setActivityLeagueId(primaryLeague?.id || null);
    setActivity([]); setActivityUnavailable(false); setActivityLoading(Boolean(primaryLeague));
    if (primaryLeague) void import('./fantasySeasonCloud')
      .then(module => module.fetchSeasonOperations(primaryLeague.id))
      .then(operations => {
        if (live) setActivity(buildHomeActivity(operations, { leagueId: primaryLeague.id, memberId: myMember?.id,
          scheduledDraft, scheduledAt: primaryLeague.settings?.draftScheduledAt }));
      })
      .catch(() => { if (live) setActivityUnavailable(true); })
      .finally(() => { if (live) setActivityLoading(false); });
    return () => { live = false; };
  }, [primaryLeague?.id, myMember?.id, scheduledDraft, primaryLeague?.settings?.draftScheduledAt, activityRetry]);

  useEffect(() => {
    if (!leagueMenuOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setLeagueMenuOpen(false); changeButton.current?.focus(); }
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [leagueMenuOpen]);

  return <div className="bk-home-dashboard bk-home-broadcast bk-home-clean mx-auto max-w-5xl pb-5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pb-8 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
    <HomeStadiumHero onMyLeagues={() => onNavigate('fantasy')}/>
    <section aria-label="Primary destinations" className="bk-home-primary-modes">
      <ModeCard icon={<Trophy/>} label="Fantasy" onClick={() => onNavigate('fantasy')}/>
      <ModeCard icon={<Target/>} label="Picks" onClick={() => onNavigate('sportsbook')}/>
      <ModeCard icon={<Brain/>} label="Trivia" onClick={() => onNavigate('challenges')}/>
      <ModeCard icon={<FlaskConical/>} label="Solo" onClick={() => onNavigate('solo')}/>
    </section>
    <nav aria-label="Quick links" className="bk-home-shortcuts grid grid-cols-4 overflow-hidden">
      <Action label="Create" accessibleLabel="Create League" icon={<Plus/>} onClick={onOpenCreateLeague}/>
      <Action label="Join" accessibleLabel="Join League" icon={<UserPlus/>} onClick={onOpenJoinLeague}/>
      <Action label="Cheat Sheet" accessibleLabel="Cheat Sheet" icon={<ClipboardList/>} onClick={onOpenCheatSheet}/>
      <Action label="NFL News" accessibleLabel="NFL News" icon={<Newspaper/>} onClick={() => onNavigate('news')}/>
    </nav>

    <HomeMatchups leagues={leagues} currentUser={currentUser} onSelectLeague={onSelectLeague} onViewMemberLocker={onViewMemberLocker} onOpenSettings={() => setSettingsOpen(true)}/>

    {featured && <section className="bk-home-featured" aria-labelledby="home-featured-heading">
      <h3 id="home-featured-heading" className="bk-home-section-title">Featured</h3>
      <button type="button" onClick={openActivity} aria-label="Open featured league update">
        <span className="bk-home-featured-icon" aria-hidden="true"><Bell size={22}/></span>
        <span className="bk-home-featured-copy"><strong>Commissioner update</strong><small>{featured.detail}</small></span>
        <ArrowRight size={16} className="bk-home-featured-arrow" aria-hidden="true"/>
      </button>
    </section>}

    {(!primaryLeague?.settings?.fantasySeasonStarted || primaryLeague.settings?.fantasySeasonComplete) && <section className="bk-home-current-league" aria-label="Your league" style={{ background: `linear-gradient(115deg,${teamTheme.primary}32,#0b1016 72%)` }}>
      <div className="bk-home-league-top"><p><Flag size={15} aria-hidden="true"/>Continue your league</p>
        {leagues.length > 0 && <button type="button" ref={changeButton} aria-label="Change league" aria-expanded={leagueMenuOpen} aria-controls={leaguePickerId} onClick={() => setLeagueMenuOpen(value => !value)}>Change<ChevronDown size={15} aria-hidden="true"/></button>}
      </div>
      {leagueMenuOpen && <div id={leaguePickerId} className="bk-home-league-options" role="region" aria-label="Choose a league">
        {leagues.map(league => <button type="button" key={league.id} aria-pressed={league.id === primaryLeague?.id} onClick={() => { setActiveLeagueId(league.id); setLeagueMenuOpen(false); changeButton.current?.focus(); }}><span>{league.name}</span><small>{league.members.length}/{league.maxMembers} managers</small></button>)}
        <div><button type="button" onClick={() => { setLeagueMenuOpen(false); onOpenCreateLeague(); }}>Create League</button><button type="button" onClick={() => { setLeagueMenuOpen(false); onOpenJoinLeague(); }}>Join League</button></div>
      </div>}
      {primaryLeague ? <>
        <div className="bk-home-league-name"><h2>{primaryLeague.name}</h2><span>{homeLeaguePhase(primaryLeague)}</span></div>
        <p className="bk-home-league-meta">{primaryLeague.members.length}/{primaryLeague.maxMembers} managers{Number.isInteger(myPick) && Number(myPick) > 0 ? ` · Your draft position: #${myPick}` : ''}</p>
        <p className="bk-home-league-theme">{teamTheme.abbr === 'BK' ? 'Ball Knower theme' : `${teamTheme.name} theme`}</p>
        {scheduledDraft && <p className="bk-home-league-meta">Draft · {scheduledDraft}</p>}
        <button type="button" className="bk-home-league-cta" onClick={openPrimaryLeague}>{action!.label}<ArrowRight size={18} aria-hidden="true"/></button>
      </> : <div className="bk-home-league-empty"><h2>Your league starts here</h2><p>Create a league or join your friends with an invite code.</p><div><button type="button" onClick={onOpenCreateLeague}>Create League</button><button type="button" onClick={onOpenJoinLeague}>Join League</button></div></div>}
    </section>}

    <section className="bk-home-rating" aria-label="Ball Knower Rating" aria-busy={ratingLoading}>
      <div className="bk-home-rating-value"><span>BK Rating</span><strong>{profile?.bkRating ?? '—'}</strong></div>
      <div className="bk-home-rating-progress">
        {tier ? <><strong>{tier.name}</strong><div role="progressbar" aria-label="Progress to next rating tier" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(tier.percent)} aria-valuetext={tier.next ? `${tier.remaining} rating points to ${tier.next}` : 'Highest rating tier reached'}><i style={{ width: `${tier.percent}%` }}/></div><p>{tier.next ? `${tier.remaining} rating points to ${tier.next}` : 'Highest rating tier'}</p></> : <p role="status">{ratingLoading ? 'Loading your rating…' : 'Rating unavailable'}</p>}
        {ratingError && <p role="status">{profile ? 'Last synced rating' : 'Please retry.'}</p>}
      </div>
      <div className="bk-home-rating-actions"><button type="button" onClick={() => onNavigate('locker')}>View Profile<ArrowRight size={14} aria-hidden="true"/></button>{ratingError && <button type="button" aria-label="Retry rating" disabled={ratingLoading} onClick={() => setRatingRetry(value => value + 1)}><RefreshCcw size={15} aria-hidden="true"/>Retry</button>}</div>
    </section>

    <section className="bk-home-activity" aria-label="League Activity" aria-busy={checkingActivity}>
      <div className="bk-home-activity-heading"><Bell size={19} aria-hidden="true"/><div><h3>League Activity</h3><p role="status">{!primaryLeague ? 'Choose a league to see updates' : checkingActivity ? 'Checking updates…' : activityFailed ? 'Updates unavailable' : recent.length ? `${recent.length} recent update${recent.length === 1 ? '' : 's'}` : featured ? 'Latest update featured above' : 'You’re all caught up'}</p></div>
        {primaryLeague && <button type="button" aria-label="Open league activity" onClick={openActivity}><ArrowRight size={18} aria-hidden="true"/></button>}
      </div>
      {!checkingActivity && !activityFailed && recent.length > 0 && <ul>{recent.map(item => <li key={item.id}><div><strong>{item.label}</strong><p>{item.detail}</p></div>{formatActivityTime(item.occurredAt) && <time dateTime={item.occurredAt}>{formatActivityTime(item.occurredAt)}</time>}</li>)}</ul>}
      {activityFailed && <button type="button" className="bk-home-activity-retry" onClick={() => setActivityRetry(value => value + 1)}>Retry updates</button>}
    </section>

    {homePartners.length > 0 && <section aria-labelledby="home-partners-heading" className="bk-home-partners"><h3 id="home-partners-heading">Our Partners</h3><div>{homePartners.map(partner => <PartnerCard key={partner.name} partner={partner} compact/>)}</div>{homePartners.length > 1 && <button type="button" onClick={() => onNavigate('partners')}>View All Partners</button>}</section>}
    {settingsOpen && <Suspense fallback={null}><FantasySettingsHub isOpen onClose={() => setSettingsOpen(false)} onOpenLeague={league => { setSettingsOpen(false); onSelectLeague(league, 'lobby'); }} onManageLeague={league => { setSettingsOpen(false); setManagedLeagueId(league.id); }}/></Suspense>}
    {managedLeagueId && <Suspense fallback={null}><LeagueManagementModal leagueId={managedLeagueId} onClose={() => setManagedLeagueId('')}/></Suspense>}
  </div>;
}

const ModeCard = ({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) => <button type="button" onClick={onClick} className="bk-home-mode"><span aria-hidden="true">{icon}</span><span>{label}</span><span aria-hidden="true"/></button>;
const Action = ({ icon, label, accessibleLabel, onClick }: { icon: React.ReactNode; label: string; accessibleLabel: string; onClick: () => void }) => <button type="button" aria-label={accessibleLabel} onClick={onClick} className="min-w-0 overflow-hidden"><span aria-hidden="true">{icon}</span><span>{label}</span></button>;
