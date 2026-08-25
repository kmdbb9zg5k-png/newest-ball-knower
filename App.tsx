import React,{lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {BallKnowerProvider,useBallKnower} from './BallKnowerContext';
import {SoundtrackProvider,useSoundtrack} from './SoundtrackContext';
import {Navbar} from './Navbar';
import {HomeDashboard} from './HomeDashboard';
import {AuthModal} from './AuthModal';
import {CreateLeagueModal} from './CreateLeagueModal';
import {JoinLeagueModal} from './JoinLeagueModal';
import {CinematicIntro} from './CinematicIntro';
import {FavoriteTeamExperience} from './FavoriteTeamExperience';
import {AppErrorBoundary} from './AppErrorBoundary';
import {League} from './types';
import {TeamTheme,applyTeamCssVariables,getSavedTeamTheme,teamLogoUrl} from './teamTheme';
import {CheckCircle2} from 'lucide-react';
import {trackBallKnowerEvent} from './analytics';
import {CloudSyncProvider} from './CloudSyncProvider';
import type {SoloExperience} from './SoloFranchiseHub';
import {LaunchCenter,LaunchFooter,type LaunchPanel} from './LaunchCenter';

const SoloMode=lazy(()=>import('./SoloMode').then(module=>({default:module.SoloMode})));
const NewsHub=lazy(()=>import('./NewsHub').then(module=>({default:module.NewsHub})));
const FantasyHub=lazy(()=>import('./FantasyHub').then(module=>({default:module.FantasyHub})));
const SportsbookHub=lazy(()=>import('./SportsbookHub').then(module=>({default:module.SportsbookHub})));
const HallOfFame=lazy(()=>import('./HallOfFame').then(module=>({default:module.HallOfFame})));
const LeagueLobby=lazy(()=>import('./LeagueLobby').then(module=>({default:module.LeagueLobby})));
const DraftRoom=lazy(()=>import('./DraftRoom').then(module=>({default:module.DraftRoom})));
const MobileDraftRoom=lazy(()=>import('./MobileDraftRoom').then(module=>({default:module.MobileDraftRoom})));
const LeagueLiveDraftRoom=lazy(()=>import('./LeagueLiveDraftRoom').then(module=>({default:module.LeagueLiveDraftRoom})));
const SimulationView=lazy(()=>import('./SimulationView').then(module=>({default:module.SimulationView})));
const DatabaseVerificationModal=lazy(()=>import('./DatabaseVerificationModal').then(module=>({default:module.DatabaseVerificationModal})));
const MobileRosterBrowser=lazy(()=>import('./MobileRosterBrowser').then(module=>({default:module.MobileRosterBrowser})));
const ChallengesHub=lazy(()=>import('./ChallengesHub').then(module=>({default:module.ChallengesHub})));
const LockerHub=lazy(()=>import('./LockerHub').then(module=>({default:module.LockerHub})));

export type AppTab='home'|'solo'|'news'|'fantasy'|'sportsbook'|'legacy'|'challenges'|'locker'|'lobby'|'draft'|'simulation';

const detectMobileDraftViewport=()=>{try{return window.matchMedia('(max-width: 767px)').matches}catch{return false}};
const ScreenFallback=()=><div className="mx-auto flex min-h-[45dvh] max-w-5xl items-center justify-center px-4 text-center"><div><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--bk-team-accent)]"/><div className="mt-3 text-[10px] font-black uppercase tracking-[.22em] text-zinc-500">Loading Ball Knower</div></div></div>;

function BallKnowerApp(){
  const {activeLeague,setActiveLeagueId,toastMessage,joinLeague}=useBallKnower();
  const {setIntroActive}=useSoundtrack();
  const setIntroActiveRef=useRef(setIntroActive);
  const [currentTab,setCurrentTab]=useState<AppTab>('home');
  const [fantasyView,setFantasyView]=useState<'leagues'|'cheatsheet'>('leagues');
  const [soloExperience,setSoloExperience]=useState<SoloExperience>('hub');
  const [isAuthOpen,setIsAuthOpen]=useState(false);
  const [isCreateLeagueOpen,setIsCreateLeagueOpen]=useState(false);
  const [isJoinLeagueOpen,setIsJoinLeagueOpen]=useState(false);
  const [isDatabaseModalOpen,setIsDatabaseModalOpen]=useState(false);
  const [launchPanel,setLaunchPanel]=useState<LaunchPanel|null>(null);
  const [isIntroOpen,setIsIntroOpen]=useState(true);
  const [isMobileDraftViewport,setIsMobileDraftViewport]=useState(detectMobileDraftViewport);
  const [favoriteTheme,setFavoriteTheme]=useState<TeamTheme>(()=>getSavedTeamTheme());
  const [showFavoriteTeam,setShowFavoriteTeam]=useState(()=>{try{const params=new URLSearchParams(window.location.search);return params.get('teamsetup')==='1'||!localStorage.getItem('ball-knower-team-setup-v2')}catch{return false}});
  const isDraftOrderGame=Boolean(activeLeague&&activeLeague.settings?.draftOrderMethod==='game'&&!activeLeague.seasonResult?.draftOrder?.length&&!activeLeague.liveDraft);

  useEffect(()=>{setIntroActiveRef.current=setIntroActive},[setIntroActive]);
  useEffect(()=>{setIntroActiveRef.current(true);try{const savedTheme=getSavedTeamTheme();setFavoriteTheme(savedTheme);applyTeamCssVariables(savedTheme);const params=new URLSearchParams(window.location.search);const joinCode=params.get('join');if(joinCode)joinLeague(joinCode).then(res=>{if(res.success&&res.league)setCurrentTab('lobby')})}catch(e){console.error(e)}},[]);
  useEffect(()=>{let media:MediaQueryList|null=null;try{media=window.matchMedia('(max-width: 767px)');const sync=()=>setIsMobileDraftViewport(media?.matches??false);sync();media.addEventListener?.('change',sync);return()=>media?.removeEventListener?.('change',sync)}catch{return undefined}},[]);
  useEffect(()=>{trackBallKnowerEvent('Mode Opened',{mode:currentTab,active_league:Boolean(activeLeague)})},[currentTab]);

  const openIntro=()=>{setIntroActive(true);setIsIntroOpen(true)};
  const closeIntro=useCallback(()=>{setIsIntroOpen(false);if(!showFavoriteTeam)setIntroActiveRef.current(false)},[showFavoriteTeam]);
  const finishFavoriteTeamSetup=(team:TeamTheme)=>{trackBallKnowerEvent('Favorite Team Selected',{team:team.abbr});setFavoriteTheme(team);applyTeamCssVariables(team);setShowFavoriteTeam(false);setIntroActive(false)};
  const handleSelectLeague=(league:League,tab:'lobby'|'draft'|'simulation')=>{setActiveLeagueId(league.id);setCurrentTab(tab)};
  const handleLeagueCreated=(league:League)=>{setActiveLeagueId(league.id);setCurrentTab('lobby')};
  const handleLeagueJoined=(league:League)=>{setActiveLeagueId(league.id);setCurrentTab('lobby')};
  const navigateToTab=useCallback((tab:AppTab)=>{if(tab==='fantasy')setFantasyView('leagues');if(tab==='solo')setSoloExperience('hub');setCurrentTab(tab)},[]);
  const openCheatSheet=useCallback(()=>{setFantasyView('cheatsheet');setCurrentTab('fantasy')},[]);

  return <div data-tab={currentTab} className="bk-app-shell relative min-h-[100dvh] overflow-x-hidden text-white font-sans antialiased selection:bg-[var(--bk-team-accent)]/30 selection:text-[var(--bk-team-accent)]">
    <div className="bk-cinematic-image" aria-hidden="true"/>
    <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden" aria-hidden="true"><div className="absolute -right-[22vw] top-[15vh] h-[72vw] w-[72vw] max-h-[900px] max-w-[900px] opacity-[.035] sm:opacity-[.045]" style={{filter:`drop-shadow(0 0 70px ${favoriteTheme.secondary}55)`}}><img src={teamLogoUrl(favoriteTheme.abbr)} alt="" className="h-full w-full object-contain"/></div><div className="absolute inset-y-0 right-0 w-[46vw] opacity-25" style={{background:`radial-gradient(circle at 100% 38%,${favoriteTheme.primary}55,transparent 64%)`}}/><div className="absolute inset-x-0 top-0 h-px" style={{background:`linear-gradient(90deg,transparent,${favoriteTheme.secondary}88,transparent)`}}/></div>

    <Navbar currentTab={currentTab} setCurrentTab={navigateToTab} onOpenAuth={()=>setIsAuthOpen(true)} onOpenCreateLeague={()=>setIsCreateLeagueOpen(true)} onOpenJoinLeague={()=>setIsJoinLeagueOpen(true)} onOpenIntro={openIntro} onOpenDatabaseModal={()=>setIsDatabaseModalOpen(true)}/>
    <main className="relative z-[3] w-full pb-[env(safe-area-inset-bottom)]">
      {currentTab==='home'&&<HomeDashboard onNavigate={navigateToTab} onOpenCheatSheet={openCheatSheet} onOpenCreateLeague={()=>setIsCreateLeagueOpen(true)} onOpenJoinLeague={()=>setIsJoinLeagueOpen(true)} onSelectLeague={handleSelectLeague}/>} 
      <Suspense fallback={<ScreenFallback/>}>
        {currentTab==='solo'&&<SoloMode initialExperience={soloExperience}/>} 
        {currentTab==='news'&&<NewsHub/>}
        {currentTab==='fantasy'&&<FantasyHub view={fantasyView} onViewChange={setFantasyView} onOpenCreateLeague={()=>setIsCreateLeagueOpen(true)} onOpenJoinLeague={()=>setIsJoinLeagueOpen(true)} onSelectLeague={handleSelectLeague}/>} 
        {currentTab==='sportsbook'&&<SportsbookHub/>}
        {currentTab==='legacy'&&<HallOfFame/>}
        {currentTab==='challenges'&&<ChallengesHub/>}
        {currentTab==='locker'&&<LockerHub/>}
        {currentTab==='lobby'&&activeLeague&&<LeagueLobby league={activeLeague} onGoToDraft={()=>setCurrentTab('draft')} onGoToSimulation={()=>setCurrentTab('simulation')}/>} 
        {currentTab==='draft'&&(activeLeague?(isDraftOrderGame?(isMobileDraftViewport?<MobileDraftRoom onBackToLobby={()=>setCurrentTab('lobby')} onSubmitSuccess={()=>setCurrentTab('simulation')}/>:<DraftRoom onBackToLobby={()=>setCurrentTab('lobby')} onSubmitSuccess={()=>setCurrentTab('simulation')}/>):<LeagueLiveDraftRoom onBackToLobby={()=>setCurrentTab('lobby')}/>):<div className="mx-auto flex min-h-[60dvh] max-w-xl items-center justify-center px-4 text-center"><div className="rounded-2xl border border-white/10 bg-[#0d1015] p-6"><h2 className="text-2xl font-black uppercase">Choose A Fantasy League First</h2><p className="mt-2 text-sm text-zinc-500">League drafts live inside League HQ. Select a league before opening its draft room.</p><button onClick={()=>setCurrentTab('fantasy')} className="mt-5 min-h-12 w-full rounded-xl bg-[var(--bk-team-accent)] px-5 text-xs font-black uppercase text-[var(--bk-on-accent)]">Go To Fantasy</button></div></div>)}
        {currentTab==='simulation'&&activeLeague&&<SimulationView league={activeLeague} onBackToLobby={()=>setCurrentTab('lobby')} onOpenDraft={()=>setCurrentTab('draft')}/>} 
      </Suspense>
    </main>

    <LaunchFooter onOpen={setLaunchPanel}/>

    <CinematicIntro isOpen={isIntroOpen} onClose={closeIntro}/>
    {showFavoriteTeam&&!isIntroOpen&&<FavoriteTeamExperience onDone={finishFavoriteTeamSetup}/>} 
    <AuthModal isOpen={isAuthOpen} onClose={()=>setIsAuthOpen(false)} onOpenLegal={panel=>{setIsAuthOpen(false);setLaunchPanel(panel)}}/>
    <CreateLeagueModal isOpen={isCreateLeagueOpen} onClose={()=>setIsCreateLeagueOpen(false)} onLeagueCreated={handleLeagueCreated}/>
    <JoinLeagueModal isOpen={isJoinLeagueOpen} onClose={()=>setIsJoinLeagueOpen(false)} onLeagueJoined={handleLeagueJoined}/>
    {isDatabaseModalOpen&&<Suspense fallback={null}>{isMobileDraftViewport?<MobileRosterBrowser isOpen={isDatabaseModalOpen} onClose={()=>setIsDatabaseModalOpen(false)}/>:<DatabaseVerificationModal isOpen={isDatabaseModalOpen} onClose={()=>setIsDatabaseModalOpen(false)}/>}</Suspense>}
    {toastMessage&&<div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 right-4 z-50 flex items-center gap-2.5 rounded-xl border border-[var(--bk-team-accent)]/50 bg-[#121212] px-4 py-3 text-xs font-bold text-white shadow-2xl backdrop-blur-md sm:left-auto sm:right-6"><CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--bk-team-accent)]"/><span>{toastMessage}</span></div>}
    <LaunchCenter panel={launchPanel} onClose={()=>setLaunchPanel(null)}/>
  </div>;
}

export default function App(){return <AppErrorBoundary><CloudSyncProvider><SoundtrackProvider><BallKnowerProvider><BallKnowerApp/></BallKnowerProvider></SoundtrackProvider></CloudSyncProvider></AppErrorBoundary>}
