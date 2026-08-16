import React, { useState, useEffect } from 'react';
import { BallKnowerProvider, useBallKnower } from './BallKnowerContext';

import { Navbar } from './Navbar';
import { HomeDashboard } from './HomeDashboard';
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
import { League } from './types';
import { CheckCircle2, AlertCircle, Play, Database } from 'lucide-react';

function BallKnowerApp() {
  const { activeLeague, setActiveLeagueId, toastMessage, joinLeague } = useBallKnower();
 

  const [currentTab, setCurrentTab] = useState<'home' | 'solo' | 'legacy' | 'lobby' | 'draft' | 'simulation'>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isJoinLeagueOpen, setIsJoinLeagueOpen] = useState(false);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState(false);
  // Auto-play intro video every time a user opens the app
  const [isIntroOpen, setIsIntroOpen] = useState(true);

 

  // Check URL params for direct join links like ?join=BK-77492
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join');
      if (joinCode) {
        joinLeague(joinCode).then(res => {
          if (res.success && res.league) setCurrentTab('lobby');
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSelectLeague = (league: League, tab: 'lobby' | 'draft' | 'simulation') => {
    setActiveLeagueId(league.id);
    setCurrentTab(tab);
  };

  const handleLeagueCreated = (league: League) => {
    setActiveLeagueId(league.id);
    setCurrentTab('lobby');
  };

  const handleLeagueJoined = (league: League) => {
    setActiveLeagueId(league.id);
    setCurrentTab('lobby');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans antialiased selection:bg-[#D4AF37]/30 selection:text-[#D4AF37] flex flex-col justify-between">
      {/* Sticky Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenCreateLeague={() => setIsCreateLeagueOpen(true)}
        onOpenJoinLeague={() => setIsJoinLeagueOpen(true)}
        onOpenIntro={() => setIsIntroOpen(true)}
        onOpenDatabaseModal={() => setIsDatabaseModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="w-full flex-1">
        {currentTab === 'home' && (
          <HomeDashboard
            onOpenCreateLeague={() => setIsCreateLeagueOpen(true)}
            onOpenJoinLeague={() => setIsJoinLeagueOpen(true)}
            onSelectLeague={handleSelectLeague}
          />
        )}

        {currentTab === 'solo' && <SoloMode />}

        {currentTab === 'legacy' && <HallOfFame />}

        {currentTab === 'lobby' && activeLeague && (
          <LeagueLobby
            league={activeLeague}
            onGoToDraft={() => setCurrentTab('draft')}
            onGoToSimulation={() => setCurrentTab('simulation')}
          />
        )}

        {currentTab === 'draft' && (
          <DraftRoom
            onBackToLobby={() => setCurrentTab(activeLeague ? 'lobby' : 'home')}
            onSubmitSuccess={() => setCurrentTab(activeLeague ? 'lobby' : 'home')}
          />
        )}

        {currentTab === 'simulation' && activeLeague && (
          <SimulationView
            league={activeLeague}
            onBackToLobby={() => setCurrentTab('lobby')}
          />
        )}
      </main>

      {/* Bold Typography Theme Footer */}
      <footer className="border-t border-white/5 bg-[#080808] px-6 sm:px-8 py-4 text-[10px] uppercase font-bold tracking-widest text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[#D4AF37]">PROVE YOU KNOW BALL.</span>
          <span>© 2026 BALL KNOWER NFL CAP ENGINE</span>
          <button
            onClick={() => setIsIntroOpen(true)}
            className="flex items-center gap-1 text-[#D4AF37] hover:text-white transition-colors cursor-pointer border-b border-[#D4AF37]/30"
          >
            <Play className="h-2.5 w-2.5 fill-[#D4AF37]" />
            <span>Replay Intro Video</span>
          </button>
          <button
            onClick={() => setIsDatabaseModalOpen(true)}
            className="flex items-center gap-1 text-[#00FF00] hover:text-white transition-colors cursor-pointer border-b border-[#00FF00]/30"
          >
            <Database className="h-2.5 w-2.5 text-[#00FF00]" />
            <span>32/32 Rosters Verified (2026 Season)</span>
          </button>
        </div>
        <div className="flex items-center gap-4 text-zinc-600 font-mono-numbers">
          <span>NFL SEASON: <span className="text-[#D4AF37]">2026</span></span>
          <span>STATUS: <span className="text-[#00FF00]">ACTIVE</span></span>
          <span>17-GAME SOLO + LEAGUE SIM</span>
          <span>V1.0 GAME BUILD</span>
        </div>
      </footer>

      {/* Intro Video Overlay (Plays automatically when user opens the app) */}
      <CinematicIntro
        isOpen={isIntroOpen}
        onClose={() => setIsIntroOpen(false)}
      />

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <CreateLeagueModal
        isOpen={isCreateLeagueOpen}
        onClose={() => setIsCreateLeagueOpen(false)}
        onLeagueCreated={handleLeagueCreated}
      />

      <JoinLeagueModal
        isOpen={isJoinLeagueOpen}
        onClose={() => setIsJoinLeagueOpen(false)}
        onLeagueJoined={handleLeagueJoined}
      />

      <DatabaseVerificationModal
        isOpen={isDatabaseModalOpen}
        onClose={() => setIsDatabaseModalOpen(false)}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-md border border-[#D4AF37]/50 bg-[#121212] px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="h-4 w-4 text-[#D4AF37] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    
      <BallKnowerProvider>
        <BallKnowerApp />
      </BallKnowerProvider>
   
  );
}
