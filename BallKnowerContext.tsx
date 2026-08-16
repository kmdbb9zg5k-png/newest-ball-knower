import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  League,
  LeagueMember,
  Player,
  ROSTER_REQUIREMENTS,
  DEFAULT_SALARY_CAP,
  TOTAL_ROSTER_SIZE,
} from '../types';
import { calculateTeamRatings } from '../utils/evaluation';
import { simulateFullSeason } from '../utils/simulation';
import { generateAiLeagueMembers, AI_ARCHETYPES, buildRosterForArchetype } from '../utils/aiOpponents';
import { PLAYERS_DATABASE } from '../data/players';
import { countRosterGroups, getDraftPositionGroup, minimumCompletionCost, validateRosterShape } from '../utils/rosterRules';
import { isCloudConfigured, ensureOnlineSession } from '../lib/supabase';
import {
  createCloudLeague, joinCloudLeague, loadMyCloudLeagues, fetchCloudLeague,
  saveMyCloudRoster, updateCloudLeague, upsertAiCloudMembers, deleteCloudMember,
  subscribeToCloudLeague
} from '../services/leagueCloud';

interface BallKnowerContextType {
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  loginWithProvider: (provider: 'google' | 'apple' | 'email', customName?: string, customEmail?: string) => void;
  logout: () => void;
  
  leagues: League[];
  activeLeague: League | null;
  setActiveLeagueId: (id: string | null) => void;
  
  createLeague: (name: string, maxMembers: number, salaryCap?: number) => Promise<League>;
  joinLeague: (code: string) => Promise<{ success: boolean; message: string; league?: League }>;
  
  // Draft Actions
  currentRoster: Player[];
  isRosterLocked: boolean;
  addToRoster: (player: Player) => { success: boolean; message: string };
  removeFromRoster: (playerId: string) => void;
  clearRoster: () => void;
  autoDraftTemplate: (archetype?: 'balanced' | 'trench' | 'air_raid' | 'stars_scrubs') => void;
  submitRoster: () => Promise<{ success: boolean; message: string }>;
  
  // Roster stats
  totalSpent: number;
  remainingCap: number;
  rosterCounts: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
    OL: number;
    DL_EDGE: number;
    LB: number;
    CB: number;
    S: number;
    K: number;
    P: number;
    total: number;
  };
  rosterValidationErrors: string[];
  isRosterValid: boolean;

  onlineInvitesReady: boolean;
  cloudSyncError: string | null;

  // Commissioner Controls
  autoFillLeagueWithAi: (leagueId: string) => void;
  removeMemberFromLeague: (leagueId: string, memberId: string) => void;
  startSimulation: (leagueId: string) => void;
  resetLeagueSimulation: (leagueId: string) => void;
  updateSalaryCap: (leagueId: string, newCap: number) => void;
  updateLeagueSettings: (leagueId: string, settings: import('../types').LeagueSettings) => void;
  
  // Demo Mode
  isDemoMode: boolean;
  startDemoMode: () => void;
  exitDemoMode: () => void;

  // Toast / Alerts
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const STORAGE_KEYS = {
  USER: 'ballknower_user_v1',
  LEAGUES: 'ballknower_leagues_v1',
  ACTIVE_LEAGUE_ID: 'ballknower_active_league_id_v1',
};

const BallKnowerContext = createContext<BallKnowerContextType | undefined>(undefined);

// Initial demo user
const DEFAULT_USER: UserProfile = {
  id: 'user-default-1',
  name: 'Elijah Davis',
  email: 'emoneyhunny1@gmail.com',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString(),
};

export const BallKnowerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  const [leagues, setLeagues] = useState<League[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEAGUES);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    // Seed initial league for immediate test enjoyment
    const seedLeagueId = 'league-ballers-2026';
    const aiMembers = generateAiLeagueMembers(9, 0);
    const commissionerMember: LeagueMember = {
      id: `member-${DEFAULT_USER.id}`,
      userId: DEFAULT_USER.id,
      userName: DEFAULT_USER.name,
      userAvatar: DEFAULT_USER.avatarUrl,
      isCommissioner: true,
      status: 'building',
    };

    const initialLeague: League = {
      id: seedLeagueId,
      code: 'BK-77492',
      name: 'Sunday Gridiron Fantasy League',
      maxMembers: 10,
      salaryCap: DEFAULT_SALARY_CAP,
      commissionerId: DEFAULT_USER.id,
      commissionerName: DEFAULT_USER.name,
      status: 'drafting',
      members: [commissionerMember, ...aiMembers],
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    };

    return [initialLeague];
  });

  const [activeLeagueId, setActiveLeagueIdState] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_LEAGUE_ID);
      return saved || (leagues.length > 0 ? leagues[0].id : null);
    } catch {
      return leagues.length > 0 ? leagues[0].id : null;
    }
  });

  const [currentRoster, setCurrentRoster] = useState<Player[]>([]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);

  // Sync user changes to localStorage
  const setCurrentUser = (user: UserProfile | null) => {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  };

  // Sync leagues to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LEAGUES, JSON.stringify(leagues));
    } catch (e) {
      console.error('Failed to save leagues to localStorage', e);
    }
  }, [leagues]);

  // Cloud bootstrap: every browser gets a real authenticated identity (anonymous is fine)
  // and then loads only leagues that identity belongs to.
  useEffect(() => {
    if (!isCloudConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const authUser = await ensureOnlineSession();
        if (cancelled) return;
        setCurrentUserState(prev => {
          const base = prev || DEFAULT_USER;
          const synced = { ...base, id: authUser.id };
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(synced));
          return synced;
        });
        const cloudLeagues = await loadMyCloudLeagues();
        if (!cancelled) {
          setLeagues(prev => {
            const localOnly = prev.filter(l => l.id === 'demo-league-instance');
            return [...cloudLeagues, ...localOnly];
          });
          setCloudSyncError(null);
        }
      } catch (err:any) {
        console.error('Ball Knower cloud bootstrap failed', err);
        if (!cancelled) setCloudSyncError(err?.message || 'Cloud sync unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime: when someone joins, submits a roster, or commissioner changes the league,
  // every open lobby refreshes from the shared database.
  useEffect(() => {
    if (!isCloudConfigured || !activeLeagueId || activeLeagueId === 'demo-league-instance') return;
    let alive = true;
    const refresh = async () => {
      try {
        const fresh = await fetchCloudLeague(activeLeagueId);
        if (!alive || !fresh) return;
        setLeagues(prev => [fresh, ...prev.filter(l => l.id !== fresh.id)]);
        setCloudSyncError(null);
      } catch (err:any) {
        if (alive) setCloudSyncError(err?.message || 'Realtime refresh failed');
      }
    };
    refresh();
    const unsubscribe = subscribeToCloudLeague(activeLeagueId, refresh);
    return () => { alive = false; unsubscribe(); };
  }, [activeLeagueId]);

  const setActiveLeagueId = (id: string | null) => {
    setActiveLeagueIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_LEAGUE_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_LEAGUE_ID);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const loginWithProvider = (provider: 'google' | 'apple' | 'email', customName?: string, customEmail?: string) => {
    let name = customName || 'Fantasy GM';
    let email = customEmail || `gm_${Date.now()}@ballknower.com`;
    let avatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';

    if (provider === 'google') {
      name = customName || 'Alex Rivers (Google)';
      email = customEmail || 'alex.rivers@gmail.com';
      avatarUrl = 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80';
    } else if (provider === 'apple') {
      name = customName || 'Jordan Vance (Apple)';
      email = customEmail || 'jordan.vance@icloud.com';
      avatarUrl = 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=120&auto=format&fit=crop&q=80';
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      name,
      email,
      avatarUrl,
      createdAt: new Date().toISOString(),
    };

    setCurrentUser(newUser);
    showToast(`Signed in as ${name}`);
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('Signed out successfully');
  };

  // Find active league
  const activeLeague = leagues.find(l => l.id === activeLeagueId) || null;

  // Sync user's existing submitted roster from active league if present
  useEffect(() => {
    if (activeLeague && currentUser) {
      const myMember = activeLeague.members.find(m => m.userId === currentUser.id);
      if (myMember && myMember.roster && myMember.roster.length > 0) {
        setCurrentRoster(myMember.roster);
      } else {
        setCurrentRoster([]);
      }
    }
  }, [activeLeagueId, currentUser?.id]);

  // Salary calculations
  const totalSpent = currentRoster.reduce((sum, p) => sum + p.salary, 0);
  const salaryCap = activeLeague ? activeLeague.salaryCap : DEFAULT_SALARY_CAP;
  const remainingCap = salaryCap - totalSpent;

  // Position counts are centralized so LT/RT/LG/RG/FS/SS/NT all count correctly.
  const rosterCounts = countRosterGroups(currentRoster);
  const { QB: qbCount, RB: rbCount, WR: wrCount, TE: teCount, OL: olCount, DL_EDGE: dlCount, LB: lbCount, CB: cbCount, S: sCount } = rosterCounts;

  // Check if current user's roster is locked in active league
  const myActiveMember = activeLeague && currentUser ? activeLeague.members.find(m => m.userId === currentUser.id) : null;
  const isRosterLocked = Boolean(myActiveMember && myActiveMember.status === 'ready');

  // Roster validation
  const rosterValidationErrors: string[] = validateRosterShape(currentRoster);
  if (remainingCap < 0) {
    rosterValidationErrors.unshift(`Over salary cap by $${Math.abs(remainingCap)}M.`);
  }

  const completionCost = minimumCompletionCost(currentRoster, PLAYERS_DATABASE);
  if (Number.isFinite(completionCost) && completionCost > remainingCap) {
    rosterValidationErrors.unshift(
      `Cap trap: you need at least $${completionCost}M to legally finish the remaining roster spots, but only $${remainingCap}M remains.`
    );
  }

  const isRosterValid = rosterValidationErrors.length === 0 && currentRoster.length === TOTAL_ROSTER_SIZE && remainingCap >= 0;

  // Add to roster
  const addToRoster = (player: Player): { success: boolean; message: string } => {
    if (isRosterLocked) {
      return { success: false, message: 'Your roster is locked and cannot be changed.' };
    }

    if (currentRoster.some(p => p.id === player.id)) {
      return { success: false, message: `${player.name} is already on your roster.` };
    }

    if (currentRoster.length >= TOTAL_ROSTER_SIZE) {
      return { success: false, message: 'Your 20-man roster is full. Remove a player first.' };
    }

    // Check position limits using the centralized grouping rules.
    const playerGroup = getDraftPositionGroup(player);
    if (!playerGroup) {
      return { success: false, message: `${player.position} is not a draftable Ball Knower roster position.` };
    }
    if (rosterCounts[playerGroup] >= ROSTER_REQUIREMENTS[playerGroup]) {
      return { success: false, message: `You already filled ${playerGroup} (${rosterCounts[playerGroup]}/${ROSTER_REQUIREMENTS[playerGroup]}).` };
    }

    const nextSalary = totalSpent + player.salary;
    if (nextSalary > salaryCap) {
      return {
        success: false,
        message: `Adding ${player.name} ($${player.salary}M) exceeds the $${salaryCap}M salary cap by $${nextSalary - salaryCap}M.`,
      };
    }

    const candidateRoster = [...currentRoster, player];
    const capAfterPick = salaryCap - nextSalary;
    const cheapestFinish = minimumCompletionCost(candidateRoster, PLAYERS_DATABASE);
    if (Number.isFinite(cheapestFinish) && cheapestFinish > capAfterPick) {
      return {
        success: false,
        message: `${player.name} would leave only $${capAfterPick}M, but you need at least $${cheapestFinish}M to finish a legal roster.`,
      };
    }

    const updated = candidateRoster;
    setCurrentRoster(updated);
    showToast(`Added ${player.name} (${player.position}) - $${player.salary}M`);
    return { success: true, message: `Added ${player.name}` };
  };

  // Remove from roster
  const removeFromRoster = (playerId: string) => {
    if (isRosterLocked) {
      showToast('Your roster is locked and cannot be changed.');
      return;
    }
    const player = currentRoster.find(p => p.id === playerId);
    setCurrentRoster(prev => prev.filter(p => p.id !== playerId));
    if (player) {
      showToast(`Removed ${player.name}`);
    }
  };

  const clearRoster = () => {
    if (isRosterLocked) {
      showToast('Your roster is locked and cannot be cleared.');
      return;
    }
    setCurrentRoster([]);
    showToast('Roster cleared');
  };

  // Auto-draft templates for fast testing and demo
  const autoDraftTemplate = (archetype: 'balanced' | 'trench' | 'air_raid' | 'stars_scrubs' = 'balanced') => {
    if (isRosterLocked) {
      showToast('Your roster is locked and cannot be replaced.');
      return;
    }
    let target = AI_ARCHETYPES[0];
    if (archetype === 'trench') target = AI_ARCHETYPES[1];
    if (archetype === 'air_raid') target = AI_ARCHETYPES[2];
    if (archetype === 'stars_scrubs') target = AI_ARCHETYPES[6];

    const roster = buildRosterForArchetype(target);
    setCurrentRoster(roster);
    showToast(`Loaded ${target.name} template roster ($${roster.reduce((sum: number, p: Player) => sum + p.salary, 0)}M)`);
  };

  // Submit Roster to Active League
  const submitRoster = async (): Promise<{ success: boolean; message: string }> => {
    if (!isRosterValid) {
      const firstError = rosterValidationErrors[0] || 'Roster is incomplete.';
      return { success: false, message: firstError };
    }

    if (isDemoMode) {
      showToast('Demo roster ready! Simulating season...');
      return { success: true, message: 'Demo roster submitted' };
    }

    if (!activeLeague || !currentUser) {
      return { success: false, message: 'Please join or select an active league.' };
    }

    const ratings = calculateTeamRatings(currentRoster);
    try {
      if (isCloudConfigured) {
        await saveMyCloudRoster(activeLeague.id, currentRoster, ratings);
        const fresh = await fetchCloudLeague(activeLeague.id);
        if (fresh) setLeagues(prev => [fresh, ...prev.filter(l => l.id !== fresh.id)]);
      } else {
        setLeagues(prev => prev.map(lg => {
          if (lg.id !== activeLeague.id) return lg;
          return {
            ...lg,
            members: lg.members.map(m => m.userId === currentUser.id
              ? { ...m, status: 'ready' as const, roster: currentRoster, teamRatings: ratings, submittedAt: new Date().toISOString() }
              : m)
          };
        }));
      }
      showToast('Your roster has been submitted! Ready for simulation.');
      return { success: true, message: 'Roster submitted successfully!' };
    } catch (err:any) {
      const message = err?.message || 'Could not save roster online.';
      setCloudSyncError(message);
      return { success: false, message };
    }
  };

  // Create League
  const createLeague = async (name: string, maxMembers: number, customCap = DEFAULT_SALARY_CAP): Promise<League> => {
    const user = currentUser || DEFAULT_USER;
    try {
      if (isCloudConfigured) {
        const newLeague = await createCloudLeague(name, maxMembers, customCap, user);
        setLeagues(prev => [newLeague, ...prev.filter(l => l.id !== newLeague.id)]);
        setActiveLeagueId(newLeague.id);
        setCurrentRoster([]);
        setCloudSyncError(null);
        showToast(`Online league created: ${newLeague.code}`);
        return newLeague;
      }

      const randomCode = `BK-${Math.floor(10000 + Math.random() * 90000)}`;
      const leagueId = `league-${Date.now()}`;
      const commissionerMember: LeagueMember = {
        id: `member-${user.id}-${Date.now()}`, userId: user.id, userName: user.name,
        userAvatar: user.avatarUrl, isCommissioner: true, status: 'building',
      };
      const newLeague: League = {
        id: leagueId, code: randomCode, name: name.trim() || 'Ball Knower League',
        maxMembers, salaryCap: customCap, commissionerId: user.id, commissionerName: user.name,
        status: 'drafting', members: [commissionerMember], createdAt: new Date().toISOString(),
      };
      setLeagues(prev => [newLeague, ...prev]);
      setActiveLeagueId(newLeague.id);
      setCurrentRoster([]);
      showToast(`Local league created. Add Supabase env vars for cross-device invites.`);
      return newLeague;
    } catch (err:any) {
      const message = err?.message || 'Could not create online league.';
      setCloudSyncError(message);
      throw new Error(message);
    }
  };

  const joinLeague = async (code: string): Promise<{ success: boolean; message: string; league?: League }> => {
    const cleanCode = code.trim().toUpperCase();
    const user = currentUser || DEFAULT_USER;
    try {
      if (isCloudConfigured) {
        const targetLeague = await joinCloudLeague(cleanCode, user);
        setLeagues(prev => [targetLeague, ...prev.filter(l => l.id !== targetLeague.id)]);
        setActiveLeagueId(targetLeague.id);
        setCloudSyncError(null);
        showToast(`Joined "${targetLeague.name}" online!`);
        return { success: true, message: `Joined ${targetLeague.name}`, league: targetLeague };
      }

      const targetLeague = leagues.find(l => l.code.toUpperCase() === cleanCode);
      if (!targetLeague) {
        return { success: false, message: 'League code not found locally. Online multiplayer has not been configured on this deployment.' };
      }
      setActiveLeagueId(targetLeague.id);
      return { success: true, message: `Joined ${targetLeague.name}`, league: targetLeague };
    } catch (err:any) {
      const message = err?.message || 'Could not join league online.';
      setCloudSyncError(message);
      return { success: false, message };
    }
  };

  // Commissioner: Auto-fill league with AI GMs
  const autoFillLeagueWithAi = (leagueId: string) => {
    const league = leagues.find(l => l.id === leagueId);
    if (!league) return;
    const slotsNeeded = league.maxMembers - league.members.length;
    if (slotsNeeded <= 0) return;
    const aiMembers = generateAiLeagueMembers(slotsNeeded, league.members.length);
    setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, members: [...l.members, ...aiMembers] } : l));
    if (isCloudConfigured) {
      void upsertAiCloudMembers(leagueId, aiMembers).catch((err:any) => setCloudSyncError(err?.message || 'Could not sync AI members'));
    }
    showToast('Auto-filled empty slots with AI football GMs');
  };

  // Commissioner: Remove member
  const removeMemberFromLeague = (leagueId: string, memberId: string) => {
    setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, members: l.members.filter(m => m.id !== memberId) } : l));
    if (isCloudConfigured) {
      void deleteCloudMember(leagueId, memberId).catch((err:any) => setCloudSyncError(err?.message || 'Could not remove member online'));
    }
    showToast('Removed member from league');
  };

  // Commissioner: Start 16-game simulation
  const startSimulation = (leagueId: string) => {
    const league = leagues.find(l => l.id === leagueId);
    if (!league) return;

    // Strict Commissioner Check
    const isCommish = currentUser?.id === league.commissionerId || isDemoMode;
    if (!isCommish) {
      showToast(`Only Commissioner ${league.commissionerName} can launch the 16-game simulation.`);
      return;
    }

    // Check if any member has incomplete roster
    const unreadyMembers = league.members.filter(m => m.status !== 'ready' || !m.roster || m.roster.length < TOTAL_ROSTER_SIZE);
    if (unreadyMembers.length > 0) {
      showToast(`Cannot simulate: ${unreadyMembers.length} member(s) have not submitted their roster.`);
      return;
    }

    const results = simulateFullSeason(league.members, league.settings?.seasonGames || 16, league.settings?.simulationStyle || 'realistic');

    setLeagues(prev =>
      prev.map(l => l.id === leagueId ? { ...l, status: 'completed', seasonResult: results } : l)
    );
    if (isCloudConfigured) {
      void updateCloudLeague(leagueId, { status: 'completed', seasonResult: results })
        .catch((err:any) => setCloudSyncError(err?.message || 'Could not sync season result'));
    }

    showToast('League season simulation complete! Draft Order is set!');
  };

  // Commissioner: Reset Simulation
  const resetLeagueSimulation = (leagueId: string) => {
    setLeagues(prev =>
      prev.map(l => {
        if (l.id !== leagueId) return l;
        return {
          ...l,
          status: 'drafting',
          seasonResult: undefined,
          members: l.members.map(m => (m.isAi ? m : { ...m, status: 'building' })),
        };
      })
    );
    if (isCloudConfigured) {
      void updateCloudLeague(leagueId, { status: 'drafting', seasonResult: null })
        .catch((err:any) => setCloudSyncError(err?.message || 'Could not reset league online'));
    }
    showToast('League reset. Ready for new team builds and draft competition.');
  };

  // Commissioner: Update salary cap
  const updateSalaryCap = (leagueId: string, newCap: number) => {
    setLeagues(prev =>
      prev.map(l => {
        if (l.id !== leagueId) return l;
        return {
          ...l,
          salaryCap: newCap,
        };
      })
    );
    if (isCloudConfigured) {
      void updateCloudLeague(leagueId, { salaryCap: newCap })
        .catch((err:any) => setCloudSyncError(err?.message || 'Could not sync salary cap'));
    }
    showToast(`Salary cap updated to $${newCap}M`);
  };


  const updateLeagueSettings = (leagueId: string, settings: import('../types').LeagueSettings) => {
    setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, settings: { ...(l.settings || {}), ...settings } } : l));
    if (isCloudConfigured) {
      const league = leagues.find(l => l.id === leagueId);
      const merged = { ...(league?.settings || {}), ...settings };
      void updateCloudLeague(leagueId, { settings: merged })
        .catch((err:any) => setCloudSyncError(err?.message || 'Could not sync commissioner settings'));
    }
    showToast('Commissioner settings updated');
  };

  // Demo Mode
  const startDemoMode = () => {
    setIsDemoMode(true);
    // Create a virtual demo league
    const demoAiMembers = generateAiLeagueMembers(7, 0);
    const user = currentUser || DEFAULT_USER;
    const demoCommissioner: LeagueMember = {
      id: `demo-user-${user.id}`,
      userId: user.id,
      userName: `${user.name} (You)`,
      userAvatar: user.avatarUrl,
      isCommissioner: true,
      status: 'building',
    };

    const demoLeague: League = {
      id: 'demo-league-instance',
      code: 'BK-DEMO',
      name: 'Ball Knower Live Demo League',
      maxMembers: 8,
      salaryCap: DEFAULT_SALARY_CAP,
      commissionerId: user.id,
      commissionerName: user.name,
      status: 'drafting',
      members: [demoCommissioner, ...demoAiMembers],
      createdAt: new Date().toISOString(),
    };

    // Replace or insert demo league
    setLeagues(prev => [demoLeague, ...prev.filter(l => l.id !== 'demo-league-instance')]);
    setActiveLeagueId('demo-league-instance');
    setCurrentRoster([]);
    showToast('Demo Mode active! Build your roster and simulate.');
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
    const realLeague = leagues.find(l => l.id !== 'demo-league-instance');
    if (realLeague) {
      setActiveLeagueId(realLeague.id);
    }
  };

  return (
    <BallKnowerContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        loginWithProvider,
        logout,
        leagues,
        activeLeague,
        setActiveLeagueId,
        createLeague,
        joinLeague,
        onlineInvitesReady: isCloudConfigured,
        cloudSyncError,
        currentRoster,
        isRosterLocked,
        addToRoster,
        removeFromRoster,
        clearRoster,
        autoDraftTemplate,
        submitRoster,
        totalSpent,
        remainingCap,
        rosterCounts,
        rosterValidationErrors,
        isRosterValid,
        autoFillLeagueWithAi,
        removeMemberFromLeague,
        startSimulation,
        resetLeagueSimulation,
        updateSalaryCap,
        updateLeagueSettings,
        isDemoMode,
        startDemoMode,
        exitDemoMode,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </BallKnowerContext.Provider>
  );
};

export const useBallKnower = () => {
  const context = useContext(BallKnowerContext);
  if (!context) {
    throw new Error('useBallKnower must be used within a BallKnowerProvider');
  }
  return context;
};
