import React, { lazy, Suspense, useCallback, useState, useEffect, useRef } from 'react';
import { BallKnowerProvider, useBallKnower } from './BallKnowerContext';
import { SoundtrackProvider, useSoundtrack } from './SoundtrackContext';
import { Navbar } from './Navbar';
import { HomeDashboard } from './HomeDashboard';
import { OverviewModeGrid } from './OverviewModeGrid';
import { AuthModal } from './AuthModal';
import { CreateLeagueModal } from './CreateLeagueModal';
import { JoinLeagueModal } from './JoinLeagueModal';
import { CinematicIntro } from './CinematicIntro';
import { FavoriteTeamExperience } from './FavoriteTeamExperience';
import { AppErrorBoundary } from './AppErrorBoundary';
import { League } from './types';
import { TeamTheme, applyTeamCssVariables, getSavedTeamTheme, teamLogoUrl } from './teamTheme';
import { Brain, CheckCircle2, Database, Play, Trophy, UserRound } from 'lucide-react';
import { trackBallKnowerEvent } from './analytics';
import { CloudSyncProvider } from './CloudSyncProvider';
import type { SoloExperience } from './SoloFranchiseHub';

const SoloMode = lazy(() => import('./SoloMode').then(module => ({ default: module.SoloMode })));
const NewsHub = lazy(() => import('./NewsHub').then(module => ({ default: module.NewsHub })));
const FantasyHub = lazy(() => import('./FantasyHub').then(module => ({ default: module.FantasyHub })));
const SportsbookHub = lazy(() => import('./SportsbookHub').then(module => ({ default: module.SportsbookHub })));
const HallOfFame = lazy(() => import('./HallOfFame').then(module => ({ default: module.HallOfFame })));
const LeagueLobby = lazy(() => import('./LeagueLobby').then(module => ({ default: module.LeagueLobby })));
const DraftRoom = lazy(() => import('./DraftRoom').then(module => ({ default: module.DraftRoom })));
const MobileDraftRoom = lazy(() => import('./MobileDraftRoom').then(module => ({ default: module.MobileDraftRoom })));
const LeagueLiveDraftRoom = lazy(() => import('./LeagueLiveDraftRoom').then(module => ({ default: module.LeagueLiveDraftRoom })));
const SimulationView = lazy(() => import('./SimulationView').then(module => ({ default: module.SimulationView })));
const DatabaseVerificationModal = lazy(() => import('./DatabaseVerificationModal').then(module => ({ default: module.DatabaseVerificationModal })));
const MobileRosterBrowser = lazy(() => import('./MobileRosterBrowser').then(module => ({ default: module.MobileRosterBrowser })));
const ChallengesHub = lazy(() => import('./ChallengesHub').then(module => ({ default: module.ChallengesHub })));
const LockerHub = lazy(() => import('./LockerHub').then(module => ({ default: module.LockerHub })));

export type AppTab = 'home' | 'solo' | 'news' | 'fantasy' | 'sportsbook' | 'legacy' | 'challenges' | 'locker' | 'lobby' | 'draft' | 'simulation';

const detectMobileDraftViewport = () => {
  try { return window.matchMedia('(max-width: 767px)').matches; } catch { return false; }
};

const ScreenFallback = () => (
  <div className="mx-auto flex min-h-[45dvh] max-w-5xl items-center justify-center px-4 text-center">
    <div>
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--bk-team-accent)]" />
      <div className="mt-3 text-[10px] font-black uppercase tracking-[.22em] text-zinc-500">Loading Ball Knower</div>
    </div>
  </div>
);

function BallKnowerApp() {
  const { activeLeague, leagues, setActiveLeagueId, toastMessage, joinLeague } = useBallKnower();
  const { setIntroActive } = useSoundtrack();
  const setIntroActiveRef = useRef(setIntroActive);
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  const [fantasyView, setFantasyView] = useState<'leagues'|'cheatsheet'>('leagues');
  const [soloExperience, setSoloExperience] = useState<SoloExperience>('hub');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isJoinLeagueOpen, setIsJoinLeagueOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState(true);
  const [isMobileDraftViewport, setIsMobileDraftViewport] = useState(detectMobileDraftViewport);
  const [favoriteTheme, setFavoriteTheme] = useState<TeamTheme>(() => getSavedTeamTheme());
  const [showFavoriteTeam, setShowFavoriteTeam] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('teamsetup') === '1' || !localStorage.getItem('ball-knower-team-setup-v2');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setIntroActiveRef.current = setIntroActive;
  }, [setIntroActive]);

  useEffect(() => {
    setIntroActiveRef.current(true);
    try {
      const savedTheme = getSavedTeamTheme();
      setFavoriteTheme(savedTheme);
      applyTeamCssVariables(savedTheme);
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join');
      if (joinCode) joinLeague(joinCode).then(res => { if (res.success && res.league) setCurrentTab('lobby'); });
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    let media: MediaQueryList | null = null;
    try {
      media = window.matchMedia('(max-width: 767px)');
      const sync = () => setIsMobileDraftViewport(media?.matches ?? false);
      sync();
      media.addEventListener?.('change', sync);
      return () => media?.removeEventListener?.('change', sync);
    } catch {
      return undefined;
    }
  }, []);

  useEffect(() => {
    trackBallKnowerEvent('Mode Opened', {
      mode: currentTab,
      active_league: Boolean(activeLeague),
    });
  }, [currentTab]);

  const openIntro = () => { setIntroActive(true); setIsIntroOpen(true); };
  const closeIntro = useCallback(() => {
    setIsIntroOpen(false);
    if (!showFavoriteTeam) setIntroActiveRef.current(false);
  }, [showFavoriteTeam]);
  const finishFavoriteTeamSetup = (team: TeamTheme) => {
    trackBallKnowerEvent('Favorite Team Selected', { team: team.abbr });
    setFavoriteTheme(team);
    applyTeamCssVariables(team);
    setShowFavoriteTeam(false);
    setIntroActive(false);
  };
  const handleSelectLeague = (league: League, tab: 'lobby' | 'draft' | 'simulation') => { setActiveLeagueId(league.id); setCurrentTab(tab); };
  const handleLeagueCreated = (league: League) => { setActiveLeagueId(league.id); setCurrentTab('lobby'); };
  const handleLeagueJoined = (league: League) => { setActiveLeagueId(league.id); setCurrentTab('lobby'); };
  const navigateToTab = useCallback((tab: AppTab) => {
    if (tab === 'fantasy') setFantasyView('leagues');
    if (tab === 'solo') setSoloExperience('hub');
    setCurrentTab(tab);
  }, []);
  const openSoloExperience = useCallback((experience: Exclude<SoloExperience, 'hub'>) => {
    setSoloExperience(experience);
    setCurrentTab('solo');
  }, []);

  return (
    <div data-tab={currentTab} className="bk-app-shell relative min-h-[100dvh] text-white font-sans antialiased selection:bg-[var(--bk-team-accent)]/30 selection:text-[var(--bk-team-accent)] flex flex-col justify-between overflow-x-hidden">
      <div className="bk-cinematic-image" aria-hidden="true" />
      <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -right-[22vw] top-[15vh] h-[72vw] w-[72vw] max-h-[900px] max-w-[900px] opacity-[.035] sm:opacity-[.045]" style={{filter:`drop-shadow(0 0 70px ${favoriteTheme.secondary}55)`}}>
          <img src={teamLogoUrl(favoriteTheme.abbr)} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="absolute inset-y-0 right-0 w-[46vw] opacity-25" style={{background:`radial-gradient(circle at 100% 38%,${favoriteTheme.primary}55,transparent 64%)`}} />
        <div className="absolute inset-x-0 top-0 h-px" style={{background:`linear-gradient(90deg,transparent,${favoriteTheme.secondary}88,transparent)`}} />
      </div>

      <Navbar currentTab={currentTab} setCurrentTab={navigateToTab} onOpenAuth={() => setIsAuthOpen(true)} onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} onOpenJoinLeague={() => setIsJoinLeagueOpen(true)} onOpenIntro={openIntro} onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)} />
      <main className="relative z-[3] w-full flex-1 pb-[env(safe-area-inset-bottom)]">
        {currentTab === 'home' && <>
          <HubLauncher onNavigate={navigateToTab} />
          <OverviewModeGrid
            onNavigate={navigateToTab}
            onOpenSoloExperience={openSoloExperience}
            onOpenCreateLeague={() => setIsCreateLeagueOpen(true)}
            onOpenJoinLeague={() => setIsJoinLeagueOpen(true)}
            activeLeagueCount={leagues.length}
          />
          <HomeDashboard onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} onOpenJoinLeague={() => setIsJoinLeagueOpen(true)} onSelectLeague={handleSelectLeague} />
        </>}
        <Suspense fallback={<ScreenFallback />}>
          {currentTab === 'solo' && <SoloMode initialExperience={soloExperience} />}
          {currentTab === 'news' && <NewsHub />}
          {currentTab === 'fantasy' && <FantasyHub view={fantasyView} onViewChange={setFantasyView} onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} onOpenJoinLeague={() => setIsJoinLeagueOpen(true)} onSelectLeague={handleSelectLeague} />}
          {currentTab === 'sportsbook' && <SportsbookHub />}
          {currentTab === 'legacy' && <HallOfFame />}
          {currentTab === 'challenges' && <ChallengesHub />}
          {currentTab === 'locker' && <LockerHub />}
          {currentTab === 'lobby' && activeLeague && <LeagueLobby league={activeLeague} onGoToDraft={() => setCurrentTab('draft')} onGoToSimulation={() => setCurrentTab('simulation')} />}
          {currentTab === 'draft' && (activeLeague?.liveDraft
            ? <LeagueLiveDraftRoom onBackToLobby={() => setCurrentTab('lobby')} />
            : isMobileDraftViewport
              ? <MobileDraftRoom onBackToLobby={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} onSubmitSuccess={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} />
              : <DraftRoom onBackToLobby={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} onSubmitSuccess={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} />)}
          {currentTab === 'simulation' && activeLeague && <SimulationView league={activeLeague} onBackToLobby={() => setCurrentTab('lobby')} onOpenDraft={() => setCurrentTab('draft')} />}
        </Suspense>
      </main>
      <footer className="relative z-[3] border-t border-white/10 bg-[#080808] px-4 py-5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3"><span className="text-[var(--bk-team-accent)]">PROVE YOU KNOW BALL.</span><span>© 2026 BALL KNOWER</span><a href="mailto:BallKnowerOfficial@gmail.com?subject=Ball%20Knower%20Business%20Inquiry" className="rounded-full border border-[var(--bk-team-accent)]/30 bg-[var(--bk-team-accent)]/10 px-3 py-2 normal-case tracking-normal text-[var(--bk-team-accent)]">Business & Support: BallKnowerOfficial@gmail.com</a><button onClick={openIntro} className="flex items-center gap-1 text-[var(--bk-team-accent)] hover:text-white transition-colors cursor-pointer border-b border-[var(--bk-team-accent)]/30"><Play className="h-2.5 w-2.5 fill-[var(--bk-team-accent)]" /><span>Replay Intro</span></button><button onClick={() => setIsDatabaseModalOpen(true)} className="flex items-center gap-1 text-[#00FF00] hover:text-white transition-colors cursor-pointer border-b border-[#00FF00]/30"><Database className="h-2.5 w-2.5 text-[#00FF00]" /><span>32/32 Rosters Verified</span></button></div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-zinc-600 font-mono-numbers"><span>NFL SEASON: <span className="text-[var(--bk-team-accent)]">2026</span></span><span>STATUS: <span className="text-[#00FF00]">ACTIVE</span></span><span>17-GAME SOLO + LEAGUE SIM</span><span>V1.0 GAME BUILD</span></div>
        </div>
      </footer>
      <CinematicIntro isOpen={isIntroOpen} onClose={closeIntro} />
      {showFavoriteTeam && !isIntroOpen && <FavoriteTeamExperience onDone={finishFavoriteTeamSetup} />}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CreateLeagueModal isOpen={isCreateLeagueOpen} onClose={() => setIsCreateLeagueOpen(false)} onLeagueCreated={handleLeagueCreated} />
      <JoinLeagueModal isOpen={isJoinLeagueOpen} onClose={() => setIsJoinLeagueOpen(false)} onLeagueJoined={handleLeagueJoined} />
      {isDatabaseModalOpen && (
        <Suspense fallback={null}>
          {isMobileDraftViewport ? <MobileRosterBrowser isOpen={isDatabaseModalOpen} onClose={() => setIsDatabaseModalOpen(false)} /> : <DatabaseVerificationModal isOpen={isDatabaseModalOpen} onClose={() => setIsDatabaseModalOpen(false)} />}
        </Suspense>
      )}
      {toastMessage && <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center gap-2.5 rounded-md border border-[var(--bk-team-accent)]/50 bg-[#121212] px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md"><CheckCircle2 className="h-4 w-4 text-[var(--bk-team-accent)] shrink-0" /><span>{toastMessage}</span></div>}
    </div>
  );
}

const HubLauncher=({onNavigate}:{onNavigate:(tab:AppTab)=>void})=><section className="mx-auto max-w-7xl px-3 pt-4 sm:px-6"><div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#0b0e12]/90 p-2 sm:grid-cols-5"><HubButton label="Home" sub="Everything" icon={<Trophy className="h-4 w-4"/>} onClick={()=>onNavigate('home')}/><HubButton label="Solo" sub="Franchise" icon={<Play className="h-4 w-4"/>} onClick={()=>onNavigate('solo')}/><HubButton label="Fantasy" sub="Cheat sheet + leagues" icon={<Trophy className="h-4 w-4"/>} onClick={()=>onNavigate('fantasy')}/><HubButton label="Trivia" sub="Questions + Gauntlet" icon={<Brain className="h-4 w-4"/>} onClick={()=>onNavigate('challenges')}/><HubButton label="Profile" sub="Rating + Locker" icon={<UserRound className="h-4 w-4"/>} onClick={()=>onNavigate('locker')}/></div></section>;
const HubButton=({label,sub,icon,onClick}:{label:string;sub:string;icon:React.ReactNode;onClick:()=>void})=><button onClick={onClick} className="min-h-16 rounded-xl border border-white/5 bg-white/[.025] px-3 text-left hover:border-[var(--bk-team-accent)]/30 hover:bg-[var(--bk-team-accent)]/5"><div className="flex items-center gap-2 text-[var(--bk-team-accent)]">{icon}<span className="text-[10px] font-black uppercase tracking-wider text-white">{label}</span></div><div className="mt-1 text-[9px] font-bold uppercase text-zinc-600">{sub}</div></button>;

export default function App() {
  return (
    <AppErrorBoundary>
      <CloudSyncProvider>
        <SoundtrackProvider>
          <BallKnowerProvider>
            <BallKnowerApp />
          </BallKnowerProvider>
        </SoundtrackProvider>
      </CloudSyncProvider>
    </AppErrorBoundary>
  );
}
