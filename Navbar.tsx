import {useBroadcastFocused} from './broadcastFocus';
import React,{lazy,Suspense,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {AppTab} from './App';
import {useBallKnower} from './BallKnowerContext';
import {Shirt,Award,Brain,ChevronDown,Handshake,LayoutGrid,LogOut,Newspaper,Play,Plus,Shield,Sparkles,Target,Trophy,User,Users,Loader2,X} from 'lucide-react';
import {SoundtrackControl} from './SoundtrackControl';
import {isCloudConfigured,signOutOnline,supabase} from './supabase';
import {getProfilePhotoMutationVersion,resolveProfilePhotoForAuthUser} from './profilePhoto';
import {resolveAuthDisplayName} from './profileIdentity';
import {PrimaryNavigation} from './PrimaryNavigation';
import {SECONDARY_DESTINATIONS} from './appNavigation';
import './navigationPolish.css';

const DESTINATION_ICONS={solo:Play,football:Shield,challenges:Brain,sportsbook:Target,news:Newspaper,ask:Sparkles,legacy:Award,partners:Handshake,wardrobe:Shirt};

const HomeNewsTicker=lazy(()=>import('./HomeNewsTicker').then(module=>({default:module.HomeNewsTicker})));

interface NavbarProps{
  currentTab:AppTab;
  newsEnabled?:boolean;
  setCurrentTab:(tab:AppTab)=>void;
  onOpenAuth:()=>void;
  onOpenCreateLeague:()=>void;
  onOpenJoinLeague:()=>void;
  onOpenIntro?:()=>void;
  onOpenDatabaseModal?:()=>void;
}

export const Navbar:React.FC<NavbarProps>=({currentTab,newsEnabled=currentTab==='home',setCurrentTab,onOpenAuth,onOpenCreateLeague,onOpenJoinLeague,onOpenIntro,onOpenDatabaseModal})=>{
  const {currentUser,setCurrentUser,activeLeague,isDemoMode,exitDemoMode,leagues,setActiveLeagueId,showToast}=useBallKnower();
  const [isUserMenuOpen,setIsUserMenuOpen]=useState(false);
  const [isExploreMenuOpen,setIsExploreMenuOpen]=useState(false);
  const exploreDialog=useRef<HTMLDialogElement>(null);
  const exploreTrigger=useRef<HTMLButtonElement>(null);
  const headerRef=useRef<HTMLElement>(null);
  const [isLeagueMenuOpen,setIsLeagueMenuOpen]=useState(false);
  const [isSigningOut,setIsSigningOut]=useState(false);
  const [mobileKeyboardOpen,setMobileKeyboardOpen]=useState(false);
  const [mobileNavRevision,setMobileNavRevision]=useState(0);
  const mobileViewportBaselineRef=useRef(0);
  const mobileKeyboardOpenRef=useRef(false);

  useEffect(()=>{setIsUserMenuOpen(false);setIsLeagueMenuOpen(false);exploreDialog.current?.close();},[currentTab]);
  useEffect(()=>{
    const dismiss=(event:PointerEvent)=>{if(event.target instanceof Node&&!headerRef.current?.contains(event.target)){setIsUserMenuOpen(false);setIsLeagueMenuOpen(false);}};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setIsUserMenuOpen(false);setIsLeagueMenuOpen(false);}};
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
  },[]);
  const openExplore=()=>{setIsUserMenuOpen(false);setIsLeagueMenuOpen(false);setIsExploreMenuOpen(true);if(!exploreDialog.current?.open)exploreDialog.current?.showModal();};
  const closeExplore=()=>{exploreDialog.current?.close();setIsExploreMenuOpen(false);};
  const exploreNavigate=(tab:AppTab)=>{closeExplore();setCurrentTab(tab);};
  useEffect(()=>{
    if(!supabase)return;let alive=true;let profileRequest=0;
    const syncProfile=async(authUser:any)=>{if(!alive||!authUser)return;const request=++profileRequest;const photoMutation=getProfilePhotoMutationVersion();const metadata=authUser.user_metadata||{};const name=resolveAuthDisplayName(authUser,currentUser?.id===authUser.id?currentUser.name:undefined);const photo=await resolveProfilePhotoForAuthUser(authUser);if(!alive||request!==profileRequest||photoMutation!==getProfilePhotoMutationVersion())return;const providerAvatar=metadata.avatar_url||metadata.picture||undefined;setCurrentUser({id:authUser.id,name,email:authUser.email||'',isAnonymous:Boolean(authUser.is_anonymous),avatarPath:photo.avatarPath,avatarUrl:photo.hasOverride?photo.avatarUrl:providerAvatar,createdAt:authUser.created_at||new Date().toISOString()})};
    const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{if(!alive)return;if(session?.user){void syncProfile(session.user);return}if(event==='SIGNED_OUT'){profileRequest+=1;setCurrentUser(null);setActiveLeagueId(null);setIsUserMenuOpen(false)}});
    return()=>{alive=false;listener.subscription.unsubscribe()};
  },[]);
  useEffect(()=>{
    const viewport=window.visualViewport;
    const editableFocused=()=>{const element=document.activeElement;return element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element instanceof HTMLSelectElement||Boolean(element instanceof HTMLElement&&element.isContentEditable)};
    const setKeyboardOpen=(open:boolean)=>{if(mobileKeyboardOpenRef.current===open)return;const recovered=mobileKeyboardOpenRef.current&&!open;mobileKeyboardOpenRef.current=open;setMobileKeyboardOpen(open);if(recovered)setMobileNavRevision(revision=>revision+1);};
    const sync=()=>{const height=viewport?.height||window.innerHeight;if(!mobileViewportBaselineRef.current)mobileViewportBaselineRef.current=Math.max(window.innerHeight,height);const keyboardInset=mobileViewportBaselineRef.current-height;if(editableFocused()){setKeyboardOpen(keyboardInset>120);return;}if(keyboardInset>80){setKeyboardOpen(true);return;}mobileViewportBaselineRef.current=Math.max(mobileViewportBaselineRef.current,height);setKeyboardOpen(false);};
    const recoveryTimers:number[]=[];
    const recover=()=>{sync();[80,220,450,800].forEach(delay=>recoveryTimers.push(window.setTimeout(sync,delay)));};
    const resetBaseline=()=>{mobileViewportBaselineRef.current=0;window.setTimeout(sync,80);};
    sync();document.addEventListener('focusin',sync);document.addEventListener('focusout',recover);viewport?.addEventListener('resize',sync);viewport?.addEventListener('scroll',sync);window.addEventListener('orientationchange',resetBaseline);
    return()=>{recoveryTimers.forEach(timer=>window.clearTimeout(timer));document.removeEventListener('focusin',sync);document.removeEventListener('focusout',recover);viewport?.removeEventListener('resize',sync);viewport?.removeEventListener('scroll',sync);window.removeEventListener('orientationchange',resetBaseline);};
  },[]);

  const handleSignOut=async()=>{if(isSigningOut)return;setIsSigningOut(true);try{await signOutOnline();setCurrentUser(null);setActiveLeagueId(null);setIsUserMenuOpen(false);localStorage.removeItem('ballknower_user_v1');localStorage.removeItem('ballknower_active_league_id_v1');if(isCloudConfigured){showToast('Signed out. Starting a fresh guest session...');window.setTimeout(()=>window.location.reload(),100)}else{showToast('Signed out successfully');setIsSigningOut(false)}}catch(err:any){showToast(err?.message||'Could not sign out.');setIsSigningOut(false)}};
  const menuClass='flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-zinc-200 hover:bg-white/5';
  const focused=useBroadcastFocused();
  const showNews=newsEnabled&&!focused;
  const compactFantasyChrome=currentTab==='lobby'||currentTab==='draft'||currentTab==='simulation';

  const navigation=createPortal(<><header ref={headerRef} className={`fixed inset-x-0 top-0 z-40 w-full border-b border-[var(--bk-team-accent)]/15 bg-[#090c12]/90 backdrop-blur-xl ${currentTab==='home'?'bk-home-broadcast-header':'bk-broadcast-header'}`}>
    <div className={`mx-auto flex max-w-5xl items-center justify-between gap-2 pl-[max(.75rem,env(safe-area-inset-left))] pr-[max(.75rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] ${compactFantasyChrome?'min-h-[calc(58px+env(safe-area-inset-top))]':'min-h-[calc(72px+env(safe-area-inset-top))]'}`}>
      <button onClick={()=>setCurrentTab('home')} className="bk-header-brand shrink-0 text-left" aria-label="Ball Knower home"><h1 className={`font-display font-black leading-none tracking-tighter text-white sm:text-[30px] ${compactFantasyChrome?'text-[21px] min-[390px]:text-[23px]':'text-[28px]'}`}>BALL <span className="text-[#D9B43B]">KNOWER</span></h1></button>
      <div className="bk-header-controls flex min-w-0 flex-1 items-center justify-end gap-2">
        {activeLeague&&<div className={`relative min-w-0 ${!compactFantasyChrome?'hidden md:block':''}`}><button title={activeLeague.name} aria-expanded={isLeagueMenuOpen} aria-controls="header-league-menu" onClick={()=>{setIsUserMenuOpen(false);setIsLeagueMenuOpen(v=>!v)}} className="bk-header-league-switcher flex min-h-11 min-w-[94px] max-w-[124px] items-center gap-1 rounded-xl border border-white/10 bg-[#111] px-2 py-2 text-[10px] font-black uppercase text-zinc-300 sm:max-w-[150px] lg:max-w-[230px] sm:gap-1.5 sm:px-2.5"><Trophy className="h-3.5 w-3.5 shrink-0 text-[#D9B43B]"/><span className="truncate sm:hidden">{activeLeague.code}</span><span className="hidden min-w-0 truncate sm:inline">{activeLeague.name}</span><ChevronDown className="hidden h-3 w-3 shrink-0 text-zinc-600 sm:block"/></button>{isLeagueMenuOpen&&<div id="header-league-menu" aria-label="Your leagues" className="absolute right-0 z-50 mt-2 w-72 max-w-[88vw] rounded-xl border border-white/10 bg-[#111] p-2 shadow-2xl"><div className="max-h-56 space-y-1 overflow-y-auto">{leagues.map(l=><button key={l.id} onClick={()=>{setActiveLeagueId(l.id);setCurrentTab(l.liveDraft?.status==='active'?'draft':'lobby');setIsLeagueMenuOpen(false)}} className={`flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs ${l.id===activeLeague.id?'bg-[#D9B43B]/10 text-[#E7C75A]':'text-zinc-300 hover:bg-white/5'}`}><span className="truncate font-black uppercase">{l.name}</span><span className="ml-3 text-[9px] text-zinc-600">{l.code}</span></button>)}</div><div className="mt-2 flex gap-1 border-t border-white/10 pt-2"><button onClick={()=>{setIsLeagueMenuOpen(false);onOpenCreateLeague()}} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/5 py-2 text-[9px] font-black uppercase"><Plus className="h-3 w-3"/>Create</button><button onClick={()=>{setIsLeagueMenuOpen(false);onOpenJoinLeague()}} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/5 py-2 text-[9px] font-black uppercase"><Users className="h-3 w-3"/>Join</button></div></div>}</div>}
        {isDemoMode&&<button onClick={exitDemoMode} className="hidden rounded-lg border border-[var(--bk-team-accent)]/30 px-2 py-1 text-[9px] font-black uppercase text-[var(--bk-team-accent)] md:block">Demo</button>}
        <span className={compactFantasyChrome?'hidden sm:inline':'inline'}><SoundtrackControl/></span>
        <button type="button" ref={exploreTrigger} className="bk-explore-trigger" aria-label="Explore Ball Knower" aria-haspopup="dialog" aria-expanded={isExploreMenuOpen} aria-controls="bk-explore-dialog" onClick={openExplore}><LayoutGrid aria-hidden="true"/><span>Explore</span></button>
        {currentUser?<div className="relative shrink-0"><button aria-label="Account menu" aria-expanded={isUserMenuOpen} aria-controls="header-account-menu" onClick={()=>{setIsLeagueMenuOpen(false);setIsUserMenuOpen(v=>!v)}} className="bk-header-account-trigger rounded-full border border-[#D9B43B]/70 p-0.5"><div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-800"><img src={currentUser.avatarUrl||`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}`} alt={currentUser.name} className="h-full w-full object-cover" referrerPolicy="no-referrer"/></div></button>{isUserMenuOpen&&<div id="header-account-menu" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-white/10 bg-[#111] p-2 shadow-2xl"><div className="border-b border-white/5 px-3 py-2"><p className="truncate text-xs font-black uppercase">{currentUser.name}</p><p className="truncate text-[9px] text-zinc-600">{currentUser.email||(currentUser.isAnonymous?'Guest profile · no sign-in required':'Ball Knower account')}</p></div><button onClick={()=>{setCurrentTab('locker');setIsUserMenuOpen(false)}} className={menuClass}><User className="h-3.5 w-3.5"/>Profile & Rating</button><button onClick={()=>{setIsUserMenuOpen(false);onOpenAuth()}} className={menuClass}><User className="h-3.5 w-3.5"/>{currentUser.isAnonymous?'Save Account':'Account'}</button><button disabled={isSigningOut} onClick={handleSignOut} className="mt-1 flex min-h-11 w-full items-center gap-2 border-t border-white/5 px-3 py-2 text-left text-[10px] font-black uppercase text-red-400">{isSigningOut?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<LogOut className="h-3.5 w-3.5"/>}{isSigningOut?'Signing out':currentUser.isAnonymous?'Reset Guest Session':'Sign out'}</button></div>}</div>:<button onClick={onOpenAuth} className="min-h-11 rounded-lg bg-[#D9B43B] px-3 py-2 text-xs font-black uppercase text-black">Account</button>}
      </div>
    </div>

    <nav aria-label="Desktop primary navigation" className="hidden h-11 overflow-x-auto border-t border-white/5 bg-[#101720] no-scrollbar [-webkit-overflow-scrolling:touch] md:block"><PrimaryNavigation currentTab={currentTab} onNavigate={setCurrentTab}/></nav>
    {showNews&&<Suspense fallback={<div className="bk-home-news-space" aria-hidden="true"/>}><HomeNewsTicker onOpenNews={()=>setCurrentTab('news')}/></Suspense>}
  </header>
    <nav key={mobileNavRevision} aria-label="Primary navigation" data-home-broadcast={currentTab==='home'?'true':undefined} data-keyboard-open={mobileKeyboardOpen?'true':undefined} className="bk-broadcast-nav fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#080b0f] pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_40px_rgba(0,0,0,.46)] md:hidden"><PrimaryNavigation mobile currentTab={currentTab} onNavigate={setCurrentTab}/></nav>
    <dialog ref={exploreDialog} id="bk-explore-dialog" className="bk-destination-menu" aria-labelledby="bk-explore-heading" onClose={()=>{setIsExploreMenuOpen(false);exploreTrigger.current?.focus({preventScroll:true});}} onClick={event=>{if(event.target===exploreDialog.current)closeExplore();}}>
      <div className="bk-destination-menu-header"><div><p>Your football world</p><h2 id="bk-explore-heading">Explore Ball Knower</h2></div><button type="button" aria-label="Close Explore" onClick={closeExplore}><X aria-hidden="true"/></button></div>
      <div className="bk-destination-menu-body">
        {['Play','Explore','Your game'].map(group=><section className="bk-destination-menu-group" key={group} aria-label={group}><h3>{group}</h3><div className="bk-destination-menu-grid">{SECONDARY_DESTINATIONS.filter(item=>item.group===group).map(item=>{const Icon=DESTINATION_ICONS[item.tab];return <button type="button" key={item.tab} onClick={()=>exploreNavigate(item.tab)} aria-current={currentTab===item.tab?'page':undefined}><Icon aria-hidden="true"/><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>;})}</div></section>)}
        <div className="bk-destination-menu-actions">
          <button type="button" onClick={()=>{closeExplore();onOpenCreateLeague();}}><Plus aria-hidden="true"/>Create League</button>
          <button type="button" onClick={()=>{closeExplore();onOpenJoinLeague();}}><Users aria-hidden="true"/>Join League</button>
          {onOpenDatabaseModal&&<button type="button" onClick={()=>{closeExplore();onOpenDatabaseModal();}}><Shield aria-hidden="true"/>Roster Database</button>}
          {onOpenIntro&&<button type="button" onClick={()=>{closeExplore();onOpenIntro();}}><Play aria-hidden="true"/>Replay Opening</button>}
        </div>
      </div>
    </dialog>
  </>,document.body);

  return <><div aria-hidden="true" className={`${compactFantasyChrome?'h-[calc(58px+env(safe-area-inset-top))]':'h-[calc(72px+env(safe-area-inset-top))]'} md:h-[calc(116px+env(safe-area-inset-top))]`}/>{showNews&&<div className="bk-home-news-space" aria-hidden="true"/>}{navigation}</>;
};
