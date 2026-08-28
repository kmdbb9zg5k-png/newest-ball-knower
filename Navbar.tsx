import React,{useEffect,useState} from 'react';
import type {AppTab} from './App';
import {useBallKnower} from './BallKnowerContext';
import {Award,Brain,ChevronDown,LogOut,Newspaper,Play,Plus,Shield,Target,Trophy,User,Users,Loader2} from 'lucide-react';
import {SoundtrackControl} from './SoundtrackControl';
import {isCloudConfigured,signOutOnline,supabase} from './supabase';

interface NavbarProps{
  currentTab:AppTab;
  setCurrentTab:(tab:AppTab)=>void;
  onOpenAuth:()=>void;
  onOpenCreateLeague:()=>void;
  onOpenJoinLeague:()=>void;
  onOpenIntro?:()=>void;
  onOpenDatabaseModal?:()=>void;
}

export const Navbar:React.FC<NavbarProps>=({currentTab,setCurrentTab,onOpenAuth,onOpenCreateLeague,onOpenJoinLeague,onOpenIntro,onOpenDatabaseModal})=>{
  const {currentUser,setCurrentUser,activeLeague,isDemoMode,exitDemoMode,leagues,setActiveLeagueId,showToast}=useBallKnower();
  const [isUserMenuOpen,setIsUserMenuOpen]=useState(false);
  const [isLeagueMenuOpen,setIsLeagueMenuOpen]=useState(false);
  const [isSigningOut,setIsSigningOut]=useState(false);

  useEffect(()=>{document.getElementById(`nav-tab-${currentTab}`)?.scrollIntoView?.({behavior:'smooth',block:'nearest',inline:'nearest'})},[currentTab]);
  useEffect(()=>{
    if(!supabase)return;let alive=true;
    const syncProfile=(authUser:any)=>{if(!alive||!authUser)return;const metadata=authUser.user_metadata||{};const isGuest=Boolean(authUser.is_anonymous);const name=metadata.full_name||metadata.name||(isGuest?'Guest GM':authUser.email?.split('@')[0])||'Ball Knower GM';setCurrentUser({id:authUser.id,name,email:authUser.email||'',avatarUrl:metadata.avatar_url||metadata.picture||undefined,createdAt:authUser.created_at||new Date().toISOString()})};
    const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{if(!alive)return;if(session?.user){syncProfile(session.user);return}if(event==='SIGNED_OUT'){setCurrentUser(null);setActiveLeagueId(null);setIsUserMenuOpen(false)}});
    return()=>{alive=false;listener.subscription.unsubscribe()};
  },[]);

  const handleSignOut=async()=>{if(isSigningOut)return;setIsSigningOut(true);try{await signOutOnline();setCurrentUser(null);setActiveLeagueId(null);setIsUserMenuOpen(false);localStorage.removeItem('ballknower_user_v1');localStorage.removeItem('ballknower_active_league_id_v1');if(isCloudConfigured){showToast('Signed out. Starting a fresh guest session...');window.setTimeout(()=>window.location.reload(),100)}else{showToast('Signed out successfully');setIsSigningOut(false)}}catch(err:any){showToast(err?.message||'Could not sign out.');setIsSigningOut(false)}};
  const tabClass=(tab:AppTab)=>`relative h-full min-w-[5.25rem] shrink-0 flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-[10px] sm:min-w-[6rem] sm:text-[11px] font-black uppercase tracking-[.1em] transition-colors ${currentTab===tab?'border-[var(--bk-team-accent)] text-[var(--bk-team-accent)]':'border-transparent text-zinc-500 hover:text-white'}`;
  const menuClass='flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wide text-zinc-300 hover:bg-white/5';

  return <header className="sticky top-0 z-40 w-full border-b border-[var(--bk-team-accent)]/15 bg-[#090c12]/90 backdrop-blur-xl">
    <div className="mx-auto flex min-h-[calc(68px+env(safe-area-inset-top))] max-w-7xl items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)] sm:px-6">
      <button onClick={()=>setCurrentTab('home')} className="shrink-0 text-left"><h1 className="font-display text-[24px] font-black leading-[.85] tracking-tighter text-white">BALL <span className="text-[var(--bk-team-accent)]">KNOWER</span></h1><span className="mt-1 block text-[7px] font-black uppercase tracking-[.2em] text-emerald-300">Public Beta</span></button>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {activeLeague&&<div className="relative min-w-0"><button title={activeLeague.name} onClick={()=>setIsLeagueMenuOpen(v=>!v)} className="flex min-h-11 min-w-[86px] max-w-[118px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#111] px-2.5 py-2 text-[10px] font-black uppercase text-zinc-300 sm:max-w-[230px]"><Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--bk-team-accent)]"/><span className="sm:hidden">{activeLeague.code}</span><span className="hidden min-w-0 truncate sm:inline">{activeLeague.name}</span><ChevronDown className="h-3 w-3 shrink-0 text-zinc-600"/></button>{isLeagueMenuOpen&&<div className="absolute right-0 z-50 mt-2 w-72 max-w-[88vw] rounded-xl border border-white/10 bg-[#111] p-2 shadow-2xl"><div className="max-h-56 space-y-1 overflow-y-auto">{leagues.map(l=><button key={l.id} onClick={()=>{setActiveLeagueId(l.id);setCurrentTab(l.liveDraft?.status==='active'?'draft':'lobby');setIsLeagueMenuOpen(false)}} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs ${l.id===activeLeague.id?'bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]':'text-zinc-300 hover:bg-white/5'}`}><span className="truncate font-black uppercase">{l.name}</span><span className="ml-3 text-[9px] text-zinc-600">{l.code}</span></button>)}</div><div className="mt-2 flex gap-1 border-t border-white/10 pt-2"><button onClick={()=>{setIsLeagueMenuOpen(false);onOpenCreateLeague()}} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/5 py-2 text-[9px] font-black uppercase"><Plus className="h-3 w-3"/>Create</button><button onClick={()=>{setIsLeagueMenuOpen(false);onOpenJoinLeague()}} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/5 py-2 text-[9px] font-black uppercase"><Users className="h-3 w-3"/>Join</button></div></div>}</div>}
        {isDemoMode&&<button onClick={exitDemoMode} className="hidden rounded-lg border border-[var(--bk-team-accent)]/30 px-2 py-1 text-[9px] font-black uppercase text-[var(--bk-team-accent)] md:block">Demo</button>}
        <SoundtrackControl/>
        {currentUser?<div className="relative shrink-0"><button onClick={()=>setIsUserMenuOpen(v=>!v)} className="rounded-full border border-[var(--bk-team-accent)]/70 p-0.5"><div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-800"><img src={currentUser.avatarUrl||'https://api.dicebear.com/7.x/avataaars/svg?seed=BallKnower'} alt={currentUser.name} className="h-full w-full object-cover" referrerPolicy="no-referrer"/></div></button>{isUserMenuOpen&&<div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-white/10 bg-[#111] p-2 shadow-2xl"><div className="border-b border-white/5 px-3 py-2"><p className="truncate text-xs font-black uppercase">{currentUser.name}</p><p className="truncate text-[9px] text-zinc-600">{currentUser.email||'Guest account'}</p></div><button onClick={()=>{setCurrentTab('locker');setIsUserMenuOpen(false)}} className={menuClass}><User className="h-3.5 w-3.5"/>Profile & Rating</button><button onClick={()=>{setCurrentTab('legacy');setIsUserMenuOpen(false)}} className={menuClass}><Award className="h-3.5 w-3.5"/>Hall of Fame</button>{onOpenDatabaseModal&&<button onClick={()=>{setIsUserMenuOpen(false);onOpenDatabaseModal()}} className={menuClass}><Shield className="h-3.5 w-3.5"/>Roster Database</button>}{onOpenIntro&&<button onClick={()=>{setIsUserMenuOpen(false);onOpenIntro()}} className={menuClass}><Play className="h-3.5 w-3.5"/>Replay Opening</button>}<button onClick={()=>{setIsUserMenuOpen(false);onOpenAuth()}} className={menuClass}><User className="h-3.5 w-3.5"/>Account</button><button disabled={isSigningOut} onClick={handleSignOut} className="mt-1 flex w-full items-center gap-2 border-t border-white/5 px-3 py-2 text-left text-[10px] font-black uppercase text-red-400">{isSigningOut?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<LogOut className="h-3.5 w-3.5"/>}{isSigningOut?'Signing out':'Sign out'}</button></div>}</div>:<button onClick={onOpenAuth} className="rounded-lg bg-[var(--bk-team-accent)] px-3 py-2 text-[10px] font-black uppercase text-black">Sign In</button>}
      </div>
    </div>

    <nav className="h-11 overflow-x-auto border-t border-white/5 bg-[#13161b] no-scrollbar [-webkit-overflow-scrolling:touch]"><div className="mx-auto flex h-full min-w-max items-stretch gap-1 px-2 sm:gap-2 sm:px-4"><button id="nav-tab-home" onClick={()=>setCurrentTab('home')} className={tabClass('home')}>Home</button><button id="nav-tab-fantasy" onClick={()=>setCurrentTab('fantasy')} className={tabClass('fantasy')}><Trophy className="h-3.5 w-3.5"/>Fantasy</button><button id="nav-tab-sportsbook" onClick={()=>setCurrentTab('sportsbook')} className={tabClass('sportsbook')}><Target className="h-3.5 w-3.5"/>Picks</button><button id="nav-tab-challenges" onClick={()=>setCurrentTab('challenges')} className={tabClass('challenges')}><Brain className="h-3.5 w-3.5"/>Trivia</button><button id="nav-tab-solo" onClick={()=>setCurrentTab('solo')} className={tabClass('solo')}><Play className="h-3.5 w-3.5"/>Solo</button><button id="nav-tab-news" onClick={()=>setCurrentTab('news')} className={tabClass('news')}><Newspaper className="h-3.5 w-3.5"/>News</button><button id="nav-tab-locker" onClick={()=>setCurrentTab('locker')} className={tabClass('locker')}><User className="h-3.5 w-3.5"/>Profile</button></div></nav>
  </header>;
};
