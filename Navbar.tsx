import React, { useEffect, useState } from 'react';
import type { AppTab } from './App';
import { useBallKnower } from './BallKnowerContext';
import { Trophy, Shield, User, LogOut, ChevronDown, Sparkles, Plus, Users, Award, Play, Newspaper, DollarSign, Loader2, Brain } from 'lucide-react';
import { SoundtrackControl } from './SoundtrackControl';
import { isCloudConfigured, signOutOnline, supabase } from './supabase';

interface NavbarProps {
  currentTab: AppTab;
  setCurrentTab: (tab: AppTab) => void;
  onOpenAuth: () => void;
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onOpenIntro?: () => void;
  onOpenDatabaseModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenAuth,
  onOpenCreateLeague,
  onOpenJoinLeague,
  onOpenIntro,
  onOpenDatabaseModal,
}) => {
  const {
    currentUser,
    setCurrentUser,
    activeLeague,
    isDemoMode,
    exitDemoMode,
    leagues,
    setActiveLeagueId,
    showToast,
  } = useBallKnower();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLeagueMenuOpen, setIsLeagueMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const el = document.getElementById(`nav-tab-${currentTab}`);
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [currentTab]);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    const syncProfile = (authUser: any) => {
      if (!alive || !authUser) return;
      const metadata = authUser.user_metadata || {};
      const isGuest = Boolean(authUser.is_anonymous);
      const name = metadata.full_name || metadata.name || (isGuest ? 'Guest GM' : authUser.email?.split('@')[0]) || 'Ball Knower GM';
      const avatarUrl = metadata.avatar_url || metadata.picture || undefined;
      setCurrentUser({
        id: authUser.id,
        name,
        email: authUser.email || '',
        avatarUrl,
        createdAt: authUser.created_at || new Date().toISOString(),
      });
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (session?.user) {
        syncProfile(session.user);
        return;
      }
      // INITIAL_SESSION may legitimately be null while the provider is still
      // bootstrapping a guest session. Only clear visible account/league state
      // for an actual sign-out event so persisted league navigation survives startup.
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setActiveLeagueId(null);
        setIsUserMenuOpen(false);
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOutOnline();
      setCurrentUser(null);
      setActiveLeagueId(null);
      setIsUserMenuOpen(false);
      localStorage.removeItem('ballknower_user_v1');
      localStorage.removeItem('ballknower_active_league_id_v1');

      if (isCloudConfigured) {
        showToast('Signed out. Starting a fresh guest session...');
        window.setTimeout(() => window.location.reload(), 100);
      } else {
        showToast('Signed out successfully');
        setIsSigningOut(false);
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not sign out.');
      setIsSigningOut(false);
    }
  };

  const tabClass = (tab: AppTab) => `relative h-full shrink-0 flex items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 text-[11px] sm:text-xs font-black uppercase tracking-[.13em] transition-colors ${
    currentTab === tab ? 'border-[var(--bk-team-accent)] text-[var(--bk-team-accent)]' : 'border-transparent text-zinc-500 hover:text-white'
  }`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--bk-team-accent)]/20 bg-[#090c12]/85 shadow-2xl shadow-black/20 backdrop-blur-xl supports-[backdrop-filter]:bg-[#090c12]/72">
      <div className="mx-auto flex h-20 pt-[env(safe-area-inset-top)] max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
        <button id="nav-logo-btn" onClick={() => setCurrentTab('home')} className="shrink-0 text-left focus:outline-none">
          <h1 className="font-display text-[28px] font-black leading-[.85] tracking-tighter text-white sm:text-3xl">
            BALL <span className="block text-[var(--bk-team-accent)] sm:inline">KNOWER</span>
          </h1>
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-4">
          {activeLeague && (
            <div className="relative min-w-0">
              <button
                id="league-dropdown-btn"
                onClick={() => setIsLeagueMenuOpen(v => !v)}
                className="flex max-w-[180px] items-center gap-2 rounded-md border border-white/10 bg-[#1A1A1A] px-3 py-2 text-xs font-black uppercase tracking-wider text-zinc-200 hover:border-[var(--bk-team-accent)]/50 sm:max-w-[260px]"
              >
                <Trophy className="h-4 w-4 shrink-0 text-[var(--bk-team-accent)]" />
                <span className="truncate">{activeLeague.name}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              </button>

              {isLeagueMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-72 max-w-[88vw] rounded-md border border-white/10 bg-[#121212] p-2 shadow-2xl">
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">Your Leagues</div>
                  <div className="my-1 max-h-56 space-y-1 overflow-y-auto">
                    {leagues.map(l => (
                      <button
                        key={l.id}
                        onClick={() => {
                          setActiveLeagueId(l.id);
                          setCurrentTab(l.status === 'completed' ? 'simulation' : 'lobby');
                          setIsLeagueMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-sm px-2.5 py-2 text-left text-xs ${l.id === activeLeague.id ? 'border border-[var(--bk-team-accent)]/30 bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]' : 'text-zinc-300 hover:bg-[#1A1A1A]'}`}
                      >
                        <span className="truncate font-black uppercase">{l.name}</span>
                        <span className="ml-3 font-mono text-[10px] text-zinc-500">{l.code}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-1 border-t border-white/10 pt-2">
                    <button onClick={() => { setIsLeagueMenuOpen(false); onOpenCreateLeague(); }} className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-white/5 bg-[#1A1A1A] py-2 text-[10px] font-black uppercase tracking-wider"><Plus className="h-3 w-3 text-[var(--bk-team-accent)]" /> Create</button>
                    <button onClick={() => { setIsLeagueMenuOpen(false); onOpenJoinLeague(); }} className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-white/5 bg-[#1A1A1A] py-2 text-[10px] font-black uppercase tracking-wider"><Users className="h-3 w-3 text-[var(--bk-team-accent)]" /> Join</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isDemoMode && (
            <button onClick={exitDemoMode} className="hidden items-center gap-1 rounded-sm border border-[var(--bk-team-accent)]/30 bg-[var(--bk-team-accent)]/10 px-2 py-1 text-[10px] font-black uppercase text-[var(--bk-team-accent)] md:flex">
              <Sparkles className="h-3 w-3" /> Demo
            </button>
          )}

          <SoundtrackControl />

          {currentUser ? (
            <div className="relative shrink-0">
              <button id="user-profile-btn" onClick={() => setIsUserMenuOpen(v => !v)} className="rounded-full border-2 border-[var(--bk-team-accent)] p-0.5 hover:ring-2 hover:ring-[var(--bk-team-accent)]/40">
                <div className="h-9 w-9 overflow-hidden rounded-full bg-zinc-800">
                  <img src={currentUser.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=BallKnower'} alt={currentUser.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </div>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-60 rounded-md border border-white/10 bg-[#121212] p-2 shadow-2xl">
                  <div className="border-b border-white/5 px-3 py-2">
                    <p className="truncate text-xs font-black uppercase text-white">{currentUser.name}</p>
                    <p className="truncate font-mono text-[10px] text-zinc-500">{currentUser.email || 'Guest account'}</p>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { setCurrentTab('home'); setIsUserMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-[#1A1A1A]"><Trophy className="h-3.5 w-3.5 text-[var(--bk-team-accent)]" /> Dashboard</button>
                    <button onClick={() => { setCurrentTab('legacy'); setIsUserMenuOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-[#1A1A1A]"><Award className="h-3.5 w-3.5 text-[var(--bk-team-accent)]" /> Hall of Fame</button>
                    {onOpenDatabaseModal && <button onClick={() => { setIsUserMenuOpen(false); onOpenDatabaseModal(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-[#1A1A1A]"><Shield className="h-3.5 w-3.5 text-emerald-400" /> 32/32 Rosters</button>}
                    <button onClick={() => { setIsUserMenuOpen(false); onOpenAuth(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-[#1A1A1A]"><User className="h-3.5 w-3.5 text-[var(--bk-team-accent)]" /> Account</button>
                  </div>
                  <div className="border-t border-white/5 pt-1">
                    <button disabled={isSigningOut} onClick={handleSignOut} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 disabled:opacity-60">
                      {isSigningOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                      {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button id="sign-in-btn" onClick={onOpenAuth} className="shrink-0 rounded-sm bg-[var(--bk-team-accent)] px-3 py-2 text-[11px] font-black uppercase tracking-wider text-black hover:bg-amber-300">Sign In</button>
          )}
        </div>
      </div>

      <nav className="h-12 overflow-x-auto border-t border-white/5 bg-[#181818] no-scrollbar [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto flex h-full min-w-max items-stretch gap-5 px-4 sm:gap-7 sm:px-8">
          <button id="nav-tab-home" onClick={() => setCurrentTab('home')} className={tabClass('home')}>Overview</button>
          <button id="nav-tab-solo" onClick={() => setCurrentTab('solo')} className={tabClass('solo')}><Play className="h-3.5 w-3.5" /> Solo</button>
          <button id="nav-tab-news" onClick={() => setCurrentTab('news')} className={tabClass('news')}><Newspaper className="h-3.5 w-3.5" /> News <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.9)]" /></button>
          <button id="nav-tab-fantasy" onClick={() => setCurrentTab('fantasy')} className={tabClass('fantasy')}>Fantasy <span className="rounded bg-[var(--bk-team-accent)] px-1 py-0.5 text-[8px] font-black text-black">NEW</span></button>
          <button id="nav-tab-trivia" onClick={() => setCurrentTab('challenges')} className={tabClass('challenges')}><Brain className="h-3.5 w-3.5" /> Trivia</button>
          <button id="nav-tab-sportsbook" onClick={() => setCurrentTab('sportsbook')} className={tabClass('sportsbook')}><DollarSign className="h-3.5 w-3.5" /> Sportsbook</button>
          <button id="nav-tab-legacy" onClick={() => setCurrentTab('legacy')} className={tabClass('legacy')}><Trophy className="h-3.5 w-3.5" /> Hall of Fame</button>

          {onOpenIntro && <button id="nav-play-intro-btn" onClick={onOpenIntro} className="my-2 flex shrink-0 items-center gap-1.5 rounded-sm border border-[var(--bk-team-accent)]/40 bg-[var(--bk-team-accent)]/10 px-3 text-[10px] font-black uppercase tracking-widest text-[var(--bk-team-accent)] hover:bg-[var(--bk-team-accent)]/20"><Play className="h-3 w-3 fill-[var(--bk-team-accent)]" /> Intro Video</button>}
        </div>
      </nav>
    </header>
  );
};
