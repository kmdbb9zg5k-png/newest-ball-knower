import React, { useCallback, useState, useEffect, useRef } from 'react';
import { BallKnowerProvider, useBallKnower } from './BallKnowerContext';
import { SoundtrackProvider, useSoundtrack } from './SoundtrackContext';
import { Navbar } from './Navbar';
import { HomeDashboard } from './HomeDashboard';
import { OverviewModeGrid } from './OverviewModeGrid';
import { LeagueLobby } from './LeagueLobby';
import { DraftRoom } from './DraftRoom';
import { SimulationView } from './SimulationView';
import { AuthModal } from './AuthModal';
import { CreateLeagueModal } from './CreateLeagueModal';
import { JoinLeagueModal } from './JoinLeagueModal';
import { CinematicIntro } from './CinematicIntro';
import { DatabaseVerificationModal } from './DatabaseVerificationModal';
import { SoloMode } from './SoloMode';
import { HallOfFame } from './HallOfFame';
import { FavoriteTeamExperience } from './FavoriteTeamExperience';
import { NewsHub } from './NewsHub';
import { FantasyHub } from './FantasyHub';
import { SportsbookHub } from './SportsbookHub';
import { League } from './types';
import { TeamTheme, applyTeamCssVariables, getSavedTeamTheme, teamLogoUrl } from './teamTheme';
import { CheckCircle2, Play, Database } from 'lucide-react';

export type AppTab = 'home' | 'solo' | 'news' | 'fantasy' | 'sportsbook' | 'legacy' | 'lobby' | 'draft' | 'simulation';

function BallKnowerApp() {
  const { activeLeague, leagues, setActiveLeagueId, toastMessage, joinLeague } = useBallKnower();
  const { setIntroActive } = useSoundtrack();
  const setIntroActiveRef = useRef(setIntroActive);
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isJoinLeagueOpen, setIsJoinLeagueOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState(true);
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

  const openIntro = () => { setIntroActive(true); setIsIntroOpen(true); };
  const closeIntro = useCallback(() => {
    setIsIntroOpen(false);
    if (!showFavoriteTeam) setIntroActiveRef.current(false);
  }, [showFavoriteTeam]);
  const finishFavoriteTeamSetup = (team: TeamTheme) => {
    setFavoriteTheme(team);
    applyTeamCssVariables(team);
    setShowFavoriteTeam(false);
    setIntroActive(false);
  };
  const handleSelectLeague = (league: League, tab: 'lobby' | 'draft' | 'simulation') => { setActiveLeagueId(league.id); setCurrentTab(tab); };
  const handleLeagueCreated = (league: League) => { setActiveLeagueId(league.id); setCurrentTab('lobby'); };
  const handleLeagueJoined = (league: League) => { setActiveLeagueId(league.id); setCurrentTab('lobby'); };

  return (
    <div data-tab={currentTab} className="bk-app-shell relative min-h-[100dvh] text-white font-sans antialiased selection:bg-[var(--bk-team-accent)]/30 selection:text-[var(--bk-team-accent)] flex flex-col justify-between overflow-x-hidden">
      <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -right-[22vw] top-[15vh] h-[72vw] w-[72vw] max-h-[900px] max-w-[900px] opacity-[.035] sm:opacity-[.045]" style={{filter:`drop-shadow(0 0 70px ${favoriteTheme.secondary}55)`}}>
          <img src={teamLogoUrl(favoriteTheme.abbr)} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="absolute inset-y-0 right-0 w-[46vw] opacity-25" style={{background:`radial-gradient(circle at 100% 38%,${favoriteTheme.primary}55,transparent 64%)`}} />
        <div className="absolute inset-x-0 top-0 h-px" style={{background:`linear-gradient(90deg,transparent,${favoriteTheme.secondary}88,transparent)`}} />
      </div>

      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} onOpenAuth={() => setIsAuthOpen(true)} onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} onOpenJoinLeague={() => setIsJoinLeagueOpen(true)} onOpenIntro={openIntro} onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)} />
      <main className="relative z-[3] w-full flex-1 pb-[env(safe-area-inset-bottom)]">
        {currentTab === 'home' && <>
          <OverviewModeGrid
            onNavigate={setCurrentTab}
            onOpenCreateLeague={() => setIsCreateLeagueOpen(true)}
            onOpenJoinLeague={() => setIsJoinLeagueOpen(true)}
            activeLeagueCount={leagues.length}
          />
          <HomeDashboard onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} onOpenJoinLeague={() => setIsJoinLeagueOpen(true)} onSelectLeague={handleSelectLeague} />
        </>}
        {currentTab === 'solo' && <SoloMode />}
        {currentTab === 'news' && <NewsHub />}
        {currentTab === 'fantasy' && <FantasyHub onOpenCreateLeague={() => setIsCreateLeagueOpen(true)} onOpenJoinLeague={() => setIsJoinLeagueOpen(true)} onSelectLeague={handleSelectLeague} />}
        {currentTab === 'sportsbook' && <SportsbookHub />}
        {currentTab === 'legacy' && <HallOfFame />}
        {currentTab === 'lobby' && activeLeague && <LeagueLobby league={activeLeague} onGoToDraft={() => setCurrentTab('draft')} onGoToSimulation={() => setCurrentTab('simulation')} />}
        {currentTab === 'draft' && <DraftRoom onBackToLobby={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} onSubmitSuccess={() => setCurrentTab(activeLeague ? 'lobby' : 'home')} />}
        {currentTab === 'simulation' && activeLeague && <SimulationView league={activeLeague} onBackToLobby={() => setCurrentTab('lobby')} />}
      </main>
      <footer className="relative z-[3] border-t border-white/5 bg-[#080808] px-6 sm:px-8 py-4 text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3"><span className="text-[var(--bk-team-accent)]">PROVE YOU KNOW BALL.</span><span>© 2026 BALL KNOWER NFL CAP ENGINE</span><button onClick={openIntro} className="flex items-center gap-1 text-[var(--bk-team-accent)] hover:text-white transition-colors cursor-pointer border-b border-[var(--bk-team-accent)]/30"><Play className="h-2.5 w-2.5 fill-[var(--bk-team-accent)]" /><span>Replay Intro Video</span></button><button onClick={() => setIsDatabaseModalOpen(true)} className="flex items-center gap-1 text-[#00FF00] hover:text-white transition-colors cursor-pointer border-b border-[#00FF00]/30"><Database className="h-2.5 w-2.5 text-[#00FF00]" /><span>32/32 Rosters Verified (2026 Season)</span></button></div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-zinc-600 font-mono-numbers"><span>NFL SEASON: <span className="text-[var(--bk-team-accent)]">2026</span></span><span>STATUS: <span className="text-[#00FF00]">ACTIVE</span></span><span>17-GAME SOLO + LEAGUE SIM</span><span>V1.0 GAME BUILD</span></div>
      </footer>
      <CinematicIntro isOpen={isIntroOpen} onClose={closeIntro} />
      {showFavoriteTeam && !isIntroOpen && <FavoriteTeamExperience onDone={finishFavoriteTeamSetup} />}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CreateLeagueModal isOpen={isCreateLeagueOpen} onClose={() => setIsCreateLeagueOpen(false)} onLeagueCreated={handleLeagueCreated} />
      <JoinLeagueModal isOpen={isJoinLeagueOpen} onClose={() => setIsJoinLeagueOpen(false)} onLeagueJoined={handleLeagueJoined} />
      <DatabaseVerificationModal isOpen={isDatabaseModalOpen} onClose={() => setIsDatabaseModalOpen(false)} />
      {toastMessage && <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center gap-2.5 rounded-md border border-[var(--bk-team-accent)]/50 bg-[#121212] px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md"><CheckCircle2 className="h-4 w-4 text-[var(--bk-team-accent)] shrink-0" /><span>{toastMessage}</span></div>}
    </div>
  );
}

export default function App() { return <SoundtrackProvider><BallKnowerProvider><BallKnowerApp /></SoundtrackProvider>; }
