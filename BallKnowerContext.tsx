import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  UserProfile,
  League,
  LeagueMember,
  Player,
  ROSTER_REQUIREMENTS,
  DEFAULT_SALARY_CAP,
  TOTAL_ROSTER_SIZE,
  DraftOrderMethod,
  LiveFantasyDraft,
  LeagueSettings,
} from './types';
import { countRosterGroups, getDraftPositionGroup, minimumCompletionCost, validateRosterShape } from './rosterRules';
import { CPU_LIVE_FANTASY_POSITION_LIMITS, getLiveFantasyDraftGroup, validateLiveFantasyRoster } from './liveFantasyRules';
import { isCloudConfigured, ensureOnlineSession, supabase } from './supabase';
import {
  createCloudLeague, joinCloudLeague, loadMyCloudLeagues, fetchCloudLeague,
  saveMyCloudRoster, updateCloudLeague, upsertAiCloudMembers, deleteCloudMember,
  subscribeToCloudLeague, joinOrCreatePublicCloudLeague, lockPublicLeagueForCpuFill,
  reopenPublicLeagueMatchmaking, startCloudLiveFantasyDraft, makeCloudLiveFantasyDraftPick,
  resumeCloudLiveFantasyDraftRecovery,
  finalizeCloudLiveFantasyDraftRosters, importOfflineFantasyDraft as importCloudOfflineFantasyDraft,
  resetCloudLeagueForNextSeason,
} from './leagueCloud';
import { trackBallKnowerEvent } from './analytics';
import { getLeagueCommissionerName, isLeagueCommissioner } from './leaguePermissions';
import { canStartScheduledDraft, formatDraftSchedule } from './draftSchedule';

interface BallKnowerContextType {
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  loginWithProvider: (provider: 'google' | 'apple' | 'email', customName?: string, customEmail?: string) => void;
  logout: () => void;
  leagues: League[];
  activeLeague: League | null;
  setActiveLeagueId: (id: string | null) => void;
  createLeague: (name: string, maxMembers: number, draftSchedule: { draftScheduledAt: string; draftTimezone: string }, salaryCap?: number, initialSettings?: import('./types').LeagueSettings) => Promise<League>;
  joinLeague: (code: string) => Promise<{ success: boolean; message: string; league?: League }>;
  joinPublicLeague: () => Promise<{ success: boolean; message: string; league?: League }>;
  currentRoster: Player[];
  isRosterLocked: boolean;
  addToRoster: (player: Player, playerPool?: readonly Player[]) => { success: boolean; message: string };
  removeFromRoster: (playerId: string) => void;
  clearRoster: () => void;
  autoDraftTemplate: (archetype?: 'balanced' | 'trench' | 'air_raid' | 'stars_scrubs') => void;
  submitRoster: () => Promise<{ success: boolean; message: string }>;
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
  autoFillLeagueWithAi: (leagueId: string) => Promise<boolean>;
  removeMemberFromLeague: (leagueId: string, memberId: string) => void;
  startSimulation: (leagueId: string) => Promise<boolean>;
  advanceFantasyWeek: (leagueId: string) => Promise<boolean>;
  finalizeDraftOrder: (leagueId: string, method: Exclude<DraftOrderMethod, 'game'>, orderedMemberIds: string[]) => Promise<boolean>;
  startLiveFantasyDraft: (leagueId: string) => Promise<boolean>;
  resumeLiveFantasyDraftRecovery: (leagueId: string) => Promise<boolean>;
  makeLiveFantasyDraftPick: (leagueId: string, player: Player) => Promise<boolean>;
  finalizeLiveFantasyDraftRosters: (leagueId: string) => Promise<boolean>;
  importOfflineFantasyDraftResults: (leagueId:string,picks:{memberId:string;playerId:string}[])=>Promise<boolean>;
  resetLeagueSimulation: (leagueId: string) => Promise<void>;
  updateSalaryCap: (leagueId: string, newCap: number) => void;
  updateLeagueSettings: (leagueId: string, settings: import('./types').LeagueSettings) => Promise<boolean>;
  isDemoMode: boolean;
  startDemoMode: () => void;
  exitDemoMode: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const STORAGE_KEYS = {
  USER: 'ballknower_user_v1',
  LEAGUES: 'ballknower_leagues_v1',
  ACTIVE_LEAGUE_ID: 'ballknower_active_league_id_v1',
};

// Keep the provider's startup graph lightweight. The canonical simulation module is
// dynamically imported for real simulation work; this small deterministic helper is
// only used to normalize legacy local saves before those heavy modules are requested.
const buildLightweightFantasyWeekPairings=(members:LeagueMember[],week:number)=>{
  if(members.length<2||members.length%2!==0)throw new Error('Fantasy weeks require an even number of teams.');
  const rotation=[...members];
  const round=(week-1)%(members.length-1);
  for(let index=0;index<round;index++)rotation.splice(1,0,rotation.pop()!);
  const reverse=Math.floor((week-1)/(members.length-1))%2===1;
  const games:{id:string;week:number;homeMemberId:string;awayMemberId:string}[]=[];
  for(let index=0;index<members.length/2;index++){
    const first=rotation[index];
    const second=rotation[members.length-1-index];
    const alternate=round%2===0;
    const home=(alternate!==reverse)?first:second;
    const away=home.id===first.id?second:first;
    games.push({id:`game-w${week}-${home.id}-vs-${away.id}`,week,homeMemberId:home.id,awayMemberId:away.id});
  }
  return games;
};

const calendarSafeRegularSeasonWeeks=(settings:League['settings'])=>settings?.playoffTeams===4?16:15;
const normalizeRestoredLocalLeague=(league:League):League=>{
  const settings=league.settings||{};
  const effectiveWeeks=Number(settings.regularSeasonWeeks??settings.seasonGames)||17;
  const fantasyActive=Boolean(settings.fantasySeasonStarted)||Number(settings.currentWeek||1)>1;
  if(effectiveWeeks!==17||fantasyActive)return league;
  const regularSeasonWeeks=calendarSafeRegularSeasonWeeks(settings);
  const result=league.seasonResult;
  const orderIds=[...(result?.draftOrder||[])].sort((a,b)=>a.pickNumber-b.pickNumber).map(item=>item.memberId);
  const canBuild=Boolean(result)&&league.members.length>=2&&league.members.length%2===0&&new Set(orderIds).size===league.members.length;
  if(!canBuild)return{...league,settings:{...settings,regularSeasonWeeks}};
  const fantasySchedule=Array.from({length:regularSeasonWeeks},(_,index)=>buildLightweightFantasyWeekPairings(league.members,index+1)).flat().map(game=>({...game,homeScore:0,awayScore:0,winnerId:'',loserId:'',isTie:false,keyMatchupFactor:'Scheduled fantasy matchup.'}));
  const priorGames=result?.games||[];
  const canonical=priorGames.length===fantasySchedule.length;
  const draftOrderGameGames=result?.orderMethod==='random'||result?.orderMethod==='commissioner'?result?.draftOrderGameGames:(result?.draftOrderGameGames?.length?result.draftOrderGameGames:priorGames);
  return{...league,settings:{...settings,regularSeasonWeeks},seasonResult:canonical?result:{...result!,games:fantasySchedule,draftOrderGameGames}};
};

const BallKnowerContext = createContext<BallKnowerContextType | undefined>(undefined);

const DEFAULT_USER: UserProfile = {
  id: 'user-default-1',
  name: 'Ball Knower Guest',
  email: 'guest@ballknower.local',
  avatarUrl: '',
  createdAt: new Date().toISOString(),
};

export const BallKnowerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (!saved) return DEFAULT_USER;
      const parsed = JSON.parse(saved) as UserProfile;
      return parsed?.id === DEFAULT_USER.id ? { ...DEFAULT_USER, createdAt: parsed.createdAt || DEFAULT_USER.createdAt } : parsed;
    } catch {
      return DEFAULT_USER;
    }
  });

  const [leagues, setLeagues] = useState<League[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEAGUES);
      if (saved) return (JSON.parse(saved) as League[]).map(normalizeRestoredLocalLeague);
    } catch (e) {
      console.error(e);
    }
    const seedLeagueId = 'league-ballers-2026';
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
      settings: { seasonGames: 17, regularSeasonWeeks:15, scoringFormat:'ppr', nflSeason:2026 },
      members: [commissionerMember],
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
  const activeLeagueIdRef = useRef(activeLeagueId);
  const currentUserIdRef = useRef(currentUser?.id);
  const leaguesRef = useRef(leagues);
  const rosterMutationVersionRef = useRef(0);
  const autoDraftRequestRef = useRef(0);
  activeLeagueIdRef.current = activeLeagueId;
  currentUserIdRef.current = currentUser?.id;
  leaguesRef.current = leagues;

  const invalidatePendingAutoDraft = () => {
    rosterMutationVersionRef.current += 1;
    autoDraftRequestRef.current += 1;
  };

  // Local-only convenience seed: load AI rosters after first paint, never in the
  // normal cloud production path. This is an async boundary on purpose.
  useEffect(() => {
    if (isCloudConfigured) return;
    let cancelled = false;
    const seed = leagues.find(item => item.id === 'league-ballers-2026');
    if (!seed || seed.members.length > 1) return;
    void import('./aiOpponents')
      .then(({ generateAiLeagueMembers }) => {
        if (cancelled) return;
        const aiMembers = generateAiLeagueMembers(9, 0, seed.salaryCap);
        setLeagues(prev => prev.map(item => item.id === seed.id && item.members.length === 1
          ? { ...item, members: [...item.members, ...aiMembers] }
          : item));
      })
      .catch(error => console.warn('Local seed CPU rosters could not be hydrated.', error));
    return () => { cancelled = true; };
  }, []);

  const setCurrentUser = (user: UserProfile | null) => {
    currentUserIdRef.current = user?.id;
    invalidatePendingAutoDraft();
    setCurrentUserState(user);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEYS.USER);
  };

  useEffect(() => {
    leaguesRef.current = leagues;
    try {
      localStorage.setItem(STORAGE_KEYS.LEAGUES, JSON.stringify(leagues));
    } catch (e) {
      console.error('Failed to save leagues to localStorage', e);
    }
  }, [leagues]);

  useEffect(() => {
    if (!isCloudConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const authUser = await ensureOnlineSession();
        if (cancelled) return;
        currentUserIdRef.current = authUser.id;
        invalidatePendingAutoDraft();
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
    activeLeagueIdRef.current = id;
    invalidatePendingAutoDraft();
    setActiveLeagueIdState(id);
    if (id) localStorage.setItem(STORAGE_KEYS.ACTIVE_LEAGUE_ID, id);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_LEAGUE_ID);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  useEffect(() => {
    if (!isCloudConfigured || !supabase || !currentUser?.id) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void ensureOnlineSession().then(auth => {
      if (cancelled) return;
      channel = supabase.channel(`bk-live-alerts-${auth.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'ball_knower_notifications',
          filter: `auth_user_id=eq.${auth.id}`,
        }, payload => {
          const notification = payload.new as { title?: string; body?: string; in_app_visible?: boolean };
          if(notification.in_app_visible===false)return;
          showToast([notification.title, notification.body].filter(Boolean).join(' · '));
        })
        .subscribe();
    }).catch(error => console.warn('Live league alerts could not be connected', error));
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const loginWithProvider = (provider: 'google' | 'apple' | 'email', customName?: string, customEmail?: string) => {
    const name = customName?.trim() || (provider === 'google' ? 'Google User' : provider === 'apple' ? 'Apple User' : 'Fantasy GM');
    const email = customEmail?.trim() || `${provider}@ballknower.local`;
    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      name,
      email,
      avatarUrl: '',
      createdAt: new Date().toISOString(),
    };
    setCurrentUser(newUser);
    showToast(`Signed in as ${name}`);
  };

  const logout = () => {
    setCurrentUser(null);
    showToast('Signed out successfully');
  };

  const activeLeague = leagues.find(l => l.id === activeLeagueId) || null;

  useEffect(() => {
    if (activeLeague && currentUser) {
      const myMember = activeLeague.members.find(m => m.userId === currentUser.id);
      invalidatePendingAutoDraft();
      if (myMember && myMember.roster && myMember.roster.length > 0) setCurrentRoster(myMember.roster);
      else setCurrentRoster([]);
    }
  }, [activeLeagueId, currentUser?.id]);

  const totalSpent = currentRoster.reduce((sum, p) => sum + p.salary, 0);
  const salaryCap = activeLeague ? activeLeague.salaryCap : DEFAULT_SALARY_CAP;
  const remainingCap = salaryCap - totalSpent;
  const rosterCounts = countRosterGroups(currentRoster);
  const myActiveMember = activeLeague && currentUser ? activeLeague.members.find(m => m.userId === currentUser.id) : null;
  const isRosterLocked = Boolean(myActiveMember && myActiveMember.status === 'ready');
  const rosterValidationErrors: string[] = validateRosterShape(currentRoster);
  if (remainingCap < 0) rosterValidationErrors.unshift(`Over salary cap by $${Math.abs(remainingCap)}M.`);
  const isRosterValid = rosterValidationErrors.length === 0 && currentRoster.length === TOTAL_ROSTER_SIZE && remainingCap >= 0;

  const addToRoster = (player: Player, playerPool?: readonly Player[]): { success: boolean; message: string } => {
    if (isRosterLocked) return { success: false, message: 'Your roster is locked and cannot be changed.' };
    if (currentRoster.some(p => p.id === player.id)) return { success: false, message: `${player.name} is already on your roster.` };
    if (currentRoster.length >= TOTAL_ROSTER_SIZE) return { success: false, message: 'Your 20-man roster is full. Remove a player first.' };
    const playerGroup = getDraftPositionGroup(player);
    if (!playerGroup) return { success: false, message: `${player.position} is not a draftable Ball Knower roster position.` };
    if (rosterCounts[playerGroup] >= ROSTER_REQUIREMENTS[playerGroup]) {
      return { success: false, message: `You already filled ${playerGroup} (${rosterCounts[playerGroup]}/${ROSTER_REQUIREMENTS[playerGroup]}).` };
    }
    const nextSalary = totalSpent + player.salary;
    if (nextSalary > salaryCap) {
      return { success: false, message: `Adding ${player.name} ($${player.salary}M) exceeds the $${salaryCap}M salary cap by $${nextSalary - salaryCap}M.` };
    }
    const loadedPlayerPool = playerPool?.length
      ? playerPool
      : ((globalThis as any).__BALL_KNOWER_PLAYER_POOL__ as readonly Player[] | undefined);
    if (!loadedPlayerPool?.length) {
      return { success: false, message: 'The player market is still loading. Try the pick again in a moment.' };
    }
    const candidateRoster = [...currentRoster, player];
    const capAfterPick = salaryCap - nextSalary;
    const cheapestFinish = minimumCompletionCost(candidateRoster, loadedPlayerPool as Player[]);
    if (Number.isFinite(cheapestFinish) && cheapestFinish > capAfterPick) {
      return { success: false, message: `${player.name} would leave only $${capAfterPick}M, but you need at least $${cheapestFinish}M to finish a legal roster.` };
    }
    invalidatePendingAutoDraft();
    setCurrentRoster(candidateRoster);
    showToast(`Added ${player.name} (${player.position}) - $${player.salary}M`);
    return { success: true, message: `Added ${player.name}` };
  };

  const removeFromRoster = (playerId: string) => {
    if (isRosterLocked) {
      showToast('Your roster is locked and cannot be changed.');
      return;
    }
    const player = currentRoster.find(p => p.id === playerId);
    invalidatePendingAutoDraft();
    setCurrentRoster(prev => prev.filter(p => p.id !== playerId));
    if (player) showToast(`Removed ${player.name}`);
  };

  const clearRoster = () => {
    if (isRosterLocked) {
      showToast('Your roster is locked and cannot be cleared.');
      return;
    }
    invalidatePendingAutoDraft();
    setCurrentRoster([]);
    showToast('Roster cleared');
  };

  const autoDraftTemplate = (archetype: 'balanced' | 'trench' | 'air_raid' | 'stars_scrubs' = 'balanced') => {
    if (isRosterLocked) {
      showToast('Your roster is locked and cannot be replaced.');
      return;
    }
    const requestLeagueId = activeLeagueIdRef.current;
    const requestUserId = currentUserIdRef.current;
    const requestRosterVersion = rosterMutationVersionRef.current;
    const requestId = ++autoDraftRequestRef.current;
    if (!requestLeagueId || !requestUserId) {
      showToast('Choose a league before building a smart roster template.');
      return;
    }
    showToast('Building your smart roster template…');
    void import('./aiOpponents').then(({ AI_ARCHETYPES, buildRosterForArchetype }) => {
      const latestLeague = leaguesRef.current.find(item => item.id === requestLeagueId);
      const latestMember = latestLeague?.members.find(member => member.userId === requestUserId);
      const stale = requestId !== autoDraftRequestRef.current
        || requestRosterVersion !== rosterMutationVersionRef.current
        || activeLeagueIdRef.current !== requestLeagueId
        || currentUserIdRef.current !== requestUserId
        || latestMember?.status === 'ready';
      if (stale) return;
      let target = AI_ARCHETYPES[0];
      if (archetype === 'trench') target = AI_ARCHETYPES[1];
      if (archetype === 'air_raid') target = AI_ARCHETYPES[2];
      if (archetype === 'stars_scrubs') target = AI_ARCHETYPES[6];
      const roster = buildRosterForArchetype(target);
      const stillCurrent = requestId === autoDraftRequestRef.current
        && requestRosterVersion === rosterMutationVersionRef.current
        && activeLeagueIdRef.current === requestLeagueId
        && currentUserIdRef.current === requestUserId
        && leaguesRef.current.find(item => item.id === requestLeagueId)?.members.find(member => member.userId === requestUserId)?.status !== 'ready';
      if (!stillCurrent) return;
      rosterMutationVersionRef.current += 1;
      setCurrentRoster(roster);
      showToast(`Loaded ${target.name} template roster ($${roster.reduce((sum: number, p: Player) => sum + p.salary, 0)}M)`);
    }).catch(error => {
      if (requestId !== autoDraftRequestRef.current) return;
      console.error('Smart roster template could not load', error);
      showToast('The smart roster template could not load. Try again.');
    });
  };

  const submitRoster = async (): Promise<{ success: boolean; message: string }> => {
    if (!isRosterValid) {
      const firstError = rosterValidationErrors[0] || 'Roster is incomplete.';
      return { success: false, message: firstError };
    }
    invalidatePendingAutoDraft();
    if (isDemoMode) {
      trackBallKnowerEvent('Draft Submitted', {
        player_count: currentRoster.length,
        salary_spent: Number(totalSpent.toFixed(2)),
        league_type: 'demo',
      });
      showToast('Demo roster ready! Simulating season...');
      return { success: true, message: 'Demo roster submitted' };
    }
    if (!activeLeague || !currentUser) return { success: false, message: 'Please join or select an active league.' };
    const { calculateTeamRatings } = await import('./evaluation');
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
      trackBallKnowerEvent('Draft Submitted', {
        player_count: currentRoster.length,
        salary_spent: Number(totalSpent.toFixed(2)),
        league_type: isCloudConfigured ? 'online' : 'local',
      });
      showToast('Your roster has been submitted! Ready for simulation.');
      return { success: true, message: 'Roster submitted successfully!' };
    } catch (err:any) {
      const message = err?.message || 'Could not save roster online.';
      setCloudSyncError(message);
      return { success: false, message };
    }
  };

  const createLeague = async (
    name: string,
    maxMembers: number,
    draftSchedule: { draftScheduledAt: string; draftTimezone: string },
    customCap = DEFAULT_SALARY_CAP,
    initialSettings: import('./types').LeagueSettings = {},
  ): Promise<League> => {
    const user = currentUser || DEFAULT_USER;
    try {
      if (isCloudConfigured) {
        const newLeague = await createCloudLeague(name, maxMembers, customCap, user, draftSchedule, initialSettings);
        setLeagues(prev => [newLeague, ...prev.filter(l => l.id !== newLeague.id)]);
        setActiveLeagueId(newLeague.id);
        invalidatePendingAutoDraft();
        setCurrentRoster([]);
        setCloudSyncError(null);
        trackBallKnowerEvent('League Created', { max_members: maxMembers, salary_cap: customCap, league_type: 'online' });
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
        status: 'drafting', settings: { seasonGames: 17, regularSeasonWeeks:15, scoringFormat:'ppr', nflSeason:2026, playoffTeams:6, playoffSeeding:'record_points', tradeReview:'commissioner', waiverType:'priority', freeAgentMode:'instant', waiverDays:2, waiverProcessHourUtc:9, irSlots:2, benchSlots:6, rosterSize:15, draftFormat:'live_snake', ...draftSchedule, ...initialSettings }, members: [commissionerMember], createdAt: new Date().toISOString(),
      };
      setLeagues(prev => [newLeague, ...prev]);
      setActiveLeagueId(newLeague.id);
      invalidatePendingAutoDraft();
      setCurrentRoster([]);
      trackBallKnowerEvent('League Created', { max_members: maxMembers, salary_cap: customCap, league_type: 'local' });
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
        trackBallKnowerEvent('League Joined', { member_count: targetLeague.members.length, league_type: 'online' });
        showToast(`Joined \"${targetLeague.name}\" online!`);
        return { success: true, message: `Joined ${targetLeague.name}`, league: targetLeague };
      }
      const targetLeague = leagues.find(l => l.code.toUpperCase() === cleanCode);
      if (!targetLeague) return { success: false, message: 'League code not found locally. Online multiplayer has not been configured on this deployment.' };
      setActiveLeagueId(targetLeague.id);
      trackBallKnowerEvent('League Joined', { member_count: targetLeague.members.length, league_type: 'local' });
      return { success: true, message: `Joined ${targetLeague.name}`, league: targetLeague };
    } catch (err:any) {
      const message = err?.message || 'Could not join league online.';
      setCloudSyncError(message);
      return { success: false, message };
    }
  };

  const joinPublicLeague = async (): Promise<{ success: boolean; message: string; league?: League }> => {
    const user = currentUser || DEFAULT_USER;
    if (!isCloudConfigured) return { success: false, message: 'Public leagues need the online Ball Knower service.' };
    try {
      const targetLeague = await joinOrCreatePublicCloudLeague(user, 10);
      setLeagues(prev => [targetLeague, ...prev.filter(l => l.id !== targetLeague.id)]);
      setActiveLeagueId(targetLeague.id);
      invalidatePendingAutoDraft();
      setCurrentRoster([]);
      setCloudSyncError(null);
      trackBallKnowerEvent('Public League Matched', {
        human_members: targetLeague.members.filter(member => !member.isAi).length,
        open_slots: Math.max(0, targetLeague.maxMembers - targetLeague.members.length),
        league_type: 'public_free',
      });
      showToast(`Public league ready: ${targetLeague.name}`);
      return { success: true, message: `Joined ${targetLeague.name}`, league: targetLeague };
    } catch (err:any) {
      const message = err?.message || 'Could not enter public matchmaking.';
      setCloudSyncError(message);
      return { success: false, message };
    }
  };

  const autoFillLeagueWithAi = async (leagueId: string): Promise<boolean> => {
    const league = leagues.find(l => l.id === leagueId);
    if (!league) return false;
    let slotsNeeded = league.maxMembers - league.members.length;
    if (slotsNeeded <= 0) return false;
    try {
      if (isCloudConfigured && league.settings?.leagueType === 'public_free') {
        slotsNeeded = await lockPublicLeagueForCpuFill(leagueId);
        if (slotsNeeded <= 0) {
          const fresh = await fetchCloudLeague(leagueId);
          if (fresh) setLeagues(prev => [fresh, ...prev.filter(l => l.id !== fresh.id)]);
          showToast('This public league is already full.');
          return false;
        }
      }
      const { generateAiLeagueMembers } = await import('./aiOpponents');
      const aiMembers = generateAiLeagueMembers(slotsNeeded, league.members.length, league.salaryCap);
      if (isCloudConfigured) {
        await upsertAiCloudMembers(leagueId, aiMembers);
        const fresh = await fetchCloudLeague(leagueId);
        if (fresh) setLeagues(prev => [fresh, ...prev.filter(l => l.id !== fresh.id)]);
      } else {
        setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, members: [...l.members, ...aiMembers] } : l));
      }
      setCloudSyncError(null);
      showToast(`Filled ${slotsNeeded} open spot${slotsNeeded===1?'':'s'} with CPU GMs`);
      return true;
    } catch (err:any) {
      const message = err?.message || 'Could not fill the open league spots.';
      if (isCloudConfigured && league.settings?.leagueType === 'public_free') {
        try {
          await reopenPublicLeagueMatchmaking(leagueId);
          const fresh = await fetchCloudLeague(leagueId);
          if (fresh) setLeagues(prev => [fresh, ...prev.filter(l => l.id !== fresh.id)]);
        } catch (reopenError) {
          console.warn('CPU fill failed and public matchmaking could not be reopened.', reopenError);
        }
      }
      setCloudSyncError(message);
      showToast(message);
      return false;
    }
  };

  const removeMemberFromLeague = (leagueId: string, memberId: string) => {
    setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, members: l.members.filter(m => m.id !== memberId) } : l));
    if (isCloudConfigured) void deleteCloudMember(leagueId, memberId).catch((err:any) => setCloudSyncError(err?.message || 'Could not remove member online'));
    showToast('Removed member from league');
  };

  const startSimulation = async (leagueId: string): Promise<boolean> => {
    const league = leagues.find(l => l.id === leagueId);
    if (!league) return false;
    const isCommish = isLeagueCommissioner(league, currentUser?.id, isDemoMode);
    if (!isCommish) {
      showToast(`Only Commissioner ${getLeagueCommissionerName(league)} can launch the 17-game simulation.`);
      return false;
    }
    const isFantasySeason = league.liveDraft?.status === 'completed';
    if (isFantasySeason) {
      showToast('Online fantasy matchups cannot be simulated. Scores come from weekly scoring records.');
      return false;
    }
    const unreadyMembers = league.members.filter(m => m.status !== 'ready' || !m.roster || m.roster.length < TOTAL_ROSTER_SIZE || (isFantasySeason && validateLiveFantasyRoster(m.roster).length > 0));
    if (unreadyMembers.length > 0) {
      showToast(`Cannot simulate: ${unreadyMembers.length} member(s) have not submitted their roster.`);
      return false;
    }
    const { buildFantasyWeekPairings, buildStandings, simulateFullSeason } = await import('./simulation');
    const fullResults = { ...simulateFullSeason(league.members, league.settings?.seasonGames || 17, league.settings?.simulationStyle || 'realistic') };
    const fantasyWeeks=Math.max(13,Math.min(17,Number(league.settings?.regularSeasonWeeks)||15));
    const fantasySchedule=Array.from({length:fantasyWeeks},(_,index)=>buildFantasyWeekPairings(league.members,index+1)).flat().map(game=>({...game,homeScore:0,awayScore:0,winnerId:'',loserId:'',isTie:false,keyMatchupFactor:'Scheduled fantasy matchup.'}));
    const settings = isFantasySeason
      ? {...(league.settings || {}), currentWeek:1, fantasySeasonStarted:true, fantasySeasonComplete:false}
      : {...(league.settings||{}),regularSeasonWeeks:fantasyWeeks as LeagueSettings['regularSeasonWeeks']};
    const results = isFantasySeason
      ? {...fullResults, games:fullResults.games.filter(game => game.week === 1), standings:buildStandings(league.members, fullResults.games.filter(game => game.week === 1)), draftOrder:[], winnerAnalysis:{winnerId:'',winnerName:'',summary:'The fantasy season is underway.',keyFactors:[]}}
      : {...fullResults, games:fantasySchedule, draftOrderGameGames:fullResults.games, orderMethod:'game' as const};
    const nextStatus = isFantasySeason ? 'simulating' as const : 'completed' as const;
    if (isCloudConfigured) {
      try {
        await updateCloudLeague(leagueId, { status: nextStatus, seasonResult: results, settings });
        setCloudSyncError(null);
      } catch (err:any) {
        const message=err?.message || 'Could not sync season result';
        setCloudSyncError(message); showToast(message); return false;
      }
    }
    setLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, status: nextStatus, settings, seasonResult: results } : l));
    trackBallKnowerEvent(isFantasySeason ? 'League Fantasy Season Started' : 'League Season Completed', {
      member_count: league.members.length,
      regular_season_games: league.settings?.seasonGames || 17,
      simulation_style: league.settings?.simulationStyle || 'realistic',
    });
    showToast(isFantasySeason ? 'Week 1 is final. The fantasy season is underway!' : 'League season simulation complete! Draft Order is set!');
    return true;
  };

  const advanceFantasyWeek = async (leagueId:string):Promise<boolean> => {
    const league = leagues.find(item => item.id === leagueId);
    if (!league) return false;
    if (league.liveDraft?.status === 'completed') {
      showToast('Online fantasy matchups cannot be simulated or manually advanced.');
      return false;
    }
    if (!league.seasonResult) return false;
    if (!isLeagueCommissioner(league,currentUser?.id,isDemoMode)) {
      showToast(`Only Commissioner ${getLeagueCommissionerName(league)} can advance the season.`);
      return false;
    }
    const { buildStandings, simulateFantasyPlayoffs, simulateFantasyWeek } = await import('./simulation');
    const regularWeeks = league.settings?.seasonGames || 17;
    const currentWeek = Math.max(1,Number(league.settings?.currentWeek)||1);
    let status:League['status']='simulating';
    let settings = {...(league.settings||{})};
    let result = {...league.seasonResult};
    if (currentWeek < regularWeeks) {
      const nextWeek=currentWeek+1;
      const nextGames=simulateFantasyWeek(league.members,nextWeek,league.settings?.simulationStyle||'realistic');
      const played=[...result.games.filter(game=>!game.playoffRound&&game.week<nextWeek),...nextGames];
      result={...result,standings:buildStandings(league.members,played)};
      settings={...settings,currentWeek:nextWeek};
      showToast(`Week ${nextWeek} is final.`);
    } else {
      if (settings.fantasySeasonComplete) return false;
      const regularGames=result.games.filter(game=>!game.playoffRound&&game.week<=regularWeeks);
      const standings=buildStandings(league.members,regularGames);
      const playoffs=simulateFantasyPlayoffs(league.members,standings,league.settings?.playoffTeams||6,regularWeeks+1,league.settings?.simulationStyle||'realistic');
      const champion=league.members.find(member=>member.id===playoffs.championMemberId);
      result={...result,completedAt:new Date().toISOString(),standings,games:[...regularGames,...playoffs.games],playoffGames:playoffs.games,championMemberId:playoffs.championMemberId,winnerAnalysis:{winnerId:playoffs.championMemberId,winnerName:champion?.userName||'Champion',summary:`${champion?.userName||'The champion'} won the fantasy playoffs.`,keyFactors:['Qualified through the regular season.','Won the championship matchup.']}};
      settings={...settings,fantasySeasonComplete:true};
      status='completed';
      trackBallKnowerEvent('League Fantasy Season Completed',{member_count:league.members.length,regular_season_games:regularWeeks});
      showToast(`${champion?.userName||'The champion'} won the league championship!`);
    }
    if (isCloudConfigured) {
      try { await updateCloudLeague(leagueId,{status,settings,seasonResult:result}); setCloudSyncError(null); }
      catch(err:any){const message=err?.message||'Could not advance the fantasy season.';setCloudSyncError(message);showToast(message);return false;}
    }
    setLeagues(prev=>prev.map(item=>item.id===leagueId?{...item,status,settings,seasonResult:result}:item));
    return true;
  };

  const finalizeDraftOrder = async (
    leagueId: string,
    method: Exclude<DraftOrderMethod, 'game'>,
    orderedMemberIds: string[],
  ): Promise<boolean> => {
    const league = leagues.find(l => l.id === leagueId);
    if (!league) return false;
    if (!isLeagueCommissioner(league, currentUser?.id, isDemoMode)) {
      showToast(`Only Commissioner ${getLeagueCommissionerName(league)} can finalize the draft order.`);
      return false;
    }
    if (league.members.length < 2 || league.members.length % 2 !== 0) {
      showToast('Fantasy schedules require an even league with at least two teams.');
      return false;
    }
    const uniqueIds = [...new Set(orderedMemberIds)];
    const memberIds = new Set(league.members.map(member => member.id));
    if (uniqueIds.length !== league.members.length || uniqueIds.some(id => !memberIds.has(id))) {
      showToast('Every league member must have exactly one draft slot.');
      return false;
    }
    const orderedMembers = uniqueIds.map(id => league.members.find(member => member.id === id)!);
    const label = method === 'random' ? 'Random Draw' : 'Commissioner Assignment';
    const draftOrder = orderedMembers.map((member, index) => ({
      pickNumber: index + 1, memberId: member.id, memberName: member.userName, memberAvatar: member.userAvatar,
      isAi: member.isAi, record: label.toUpperCase(), pointDiff: 0, teamRating: member.teamRatings?.overall || 0,
      badge: method === 'random' ? 'RANDOM DRAW' : 'COMMISSIONER PICK',
    }));
    const standings = orderedMembers.map((member, index) => ({
      rank: index + 1, memberId: member.id, memberName: member.userName, memberAvatar: member.userAvatar,
      isAi: member.isAi, wins: 0, losses: 0, ties: 0, winPercentage: 0, pointsFor: 0, pointsAgainst: 0,
      pointDifferential: 0, teamRating: member.teamRatings?.overall || 0, streak: '-',
    }));
    const { buildFantasyWeekPairings } = await import('./simulation');
    const fantasyWeeks=Math.max(13,Math.min(17,Number(league.settings?.regularSeasonWeeks)||calendarSafeRegularSeasonWeeks(league.settings)));
    const fantasySchedule=Array.from({length:fantasyWeeks},(_,index)=>buildFantasyWeekPairings(league.members,index+1)).flat().map(game=>({...game,homeScore:0,awayScore:0,winnerId:'',loserId:'',isTie:false,keyMatchupFactor:'Scheduled fantasy matchup.'}));
    const result = {
      completedAt: new Date().toISOString(), orderMethod: method, standings, games: fantasySchedule, draftOrder,
      winnerAnalysis: {
        winnerId: orderedMembers[0].id,
        winnerName: orderedMembers[0].userName,
        summary: method === 'random' ? 'The league draft order was decided by a random Ball Knower draw.' : 'The commissioner assigned and locked every league draft slot.',
        keyFactors: [
          method === 'random' ? 'Every manager had one equal chance in the draw.' : 'Every manager was assigned exactly one slot.',
          'The finalized order is saved with the league.',
          'Share this order with the league before the fantasy draft.',
        ],
      },
      teamReports: {},
    };
    const settings = { ...(league.settings || {}), regularSeasonWeeks:fantasyWeeks as LeagueSettings['regularSeasonWeeks'], draftOrderMethod: method };
    if (isCloudConfigured) {
      try {
        await updateCloudLeague(leagueId, { status: 'completed', seasonResult: result, settings });
        setCloudSyncError(null);
      } catch (err:any) {
        const message = err?.message || 'Could not save the draft order.';
        setCloudSyncError(message); showToast(message); return false;
      }
    }
    setLeagues(prev => prev.map(item => item.id === leagueId ? { ...item, status: 'completed', settings, seasonResult: result } : item));
    trackBallKnowerEvent('Draft Order Finalized', { member_count: orderedMembers.length, order_method: method });
    showToast(`${label} draft order finalized.`);
    return true;
  };

  const startLiveFantasyDraft = async (leagueId:string):Promise<boolean> => {
    const league=leagues.find(item=>item.id===leagueId);
    if(!league?.seasonResult?.draftOrder?.length){showToast('Lock the official draft order first.');return false;}
    if(!canStartScheduledDraft(league)){showToast(`Draft is scheduled for ${formatDraftSchedule(league)}.`);return false;}
    if(league.liveDraft?.status==='completed'){showToast('This fantasy draft is already complete. Your league is ready for the season.');return false;}
    if(!isCloudConfigured&&!league.liveDraft&&!isLeagueCommissioner(league,currentUser?.id,isDemoMode)){
      showToast(`Waiting for ${getLeagueCommissionerName(league)} to start the NFL player draft.`);return false;
    }
    try{
      let draft:LiveFantasyDraft;
      if(isCloudConfigured) draft=await startCloudLiveFantasyDraft(leagueId);
      else{
        const now=new Date().toISOString();
        draft={leagueId,status:'active',orderMemberIds:league.seasonResult.draftOrder.map(pick=>pick.memberId),rounds:league.settings?.rosterSize||15,pickIndex:0,picks:[],startedAt:now,pickSeconds:60,pickStartedAt:now,pickDeadlineAt:new Date(Date.now()+60000).toISOString(),updatedAt:now};
      }
      setLeagues(prev=>prev.map(item=>item.id===leagueId?{...item,liveDraft:draft}:item));
      showToast(draft.pickIndex>0?'Fantasy draft reopened.':'Fantasy draft started. Pick #1 is on the clock.');
      return true;
    }catch(err:any){const message=err?.message||'The fantasy draft could not start.';setCloudSyncError(message);showToast(message);return false;}
  };

  const makeLiveFantasyDraftPick = async (leagueId:string,player:Player):Promise<boolean> => {
    const group=getLiveFantasyDraftGroup(player);
    if(!group){showToast('That player does not fit a draftable roster position.');return false;}
    try{
      let draft:LiveFantasyDraft;
      if(isCloudConfigured){
        const league=leagues.find(item=>item.id===leagueId);const current=league?.liveDraft;
        if(!league||!current||current.status!=='active')throw new Error('The fantasy draft is not active.');
        draft=await makeCloudLiveFantasyDraftPick(leagueId,player.id,group);
      }else{
        const league=leagues.find(item=>item.id===leagueId);const current=league?.liveDraft;
        if(!league||!current||current.status!=='active')throw new Error('The fantasy draft is not active.');
        const teamCount=current.orderMemberIds.length;const roundIndex=Math.floor(current.pickIndex/teamCount);const slot=current.pickIndex%teamCount;const orderIndex=roundIndex%2===0?slot:teamCount-1-slot;const memberId=current.orderMemberIds[orderIndex];const member=league.members.find(item=>item.id===memberId);
        if(!member)throw new Error('The manager on the clock is unavailable.');
        if(member.isAi&&!isLeagueCommissioner(league,currentUser?.id,isDemoMode))throw new Error(`Waiting for ${getLeagueCommissionerName(league)} to complete the CPU pick.`);
        if(!member.isAi&&member.userId!==currentUser?.id)throw new Error(`${member.userName} is on the clock.`);
        if(current.picks.some(pick=>pick.playerId===player.id))throw new Error('That player was already drafted.');
        const groupCount=current.picks.filter(pick=>pick.memberId===memberId&&pick.group===group).length;
        if(member.isAi&&groupCount>=CPU_LIVE_FANTASY_POSITION_LIMITS[group])throw new Error(`${member.userName} reached the ${group} CPU roster limit.`);
        const nextIndex=current.pickIndex+1;const now=new Date().toISOString();
        draft={...current,status:nextIndex>=teamCount*current.rounds?'completed':'active',pickIndex:nextIndex,picks:[...current.picks,{overall:nextIndex,round:roundIndex+1,memberId,playerId:player.id,group,pickedAt:now}],completedAt:nextIndex>=teamCount*current.rounds?now:undefined,updatedAt:now};
      }
      if(draft.status==='completed'){
        let rostersFinalized=true;
        if(isCloudConfigured){
          const fresh=await fetchCloudLeague(leagueId);
          if(!fresh)throw new Error('The draft completed, but the finalized league rosters could not be loaded.');
          rostersFinalized=fresh.status==='drafting'&&fresh.members.every(member=>member.status==='ready'&&(member.roster?.length||0)===draft.rounds);
          setLeagues(prev=>[fresh,...prev.filter(item=>item.id!==fresh.id)]);
        }else{
          const { applyLiveDraftRosterAssignments } = await import('./liveDraftRosters');
          setLeagues(prev=>prev.map(item=>item.id===leagueId?applyLiveDraftRosterAssignments(item,draft,draft.completedAt):item));
        }
        showToast(rostersFinalized?'Fantasy draft complete. All rosters are saved and the season is ready.':'Fantasy draft complete. Waiting for the commissioner to finalize league rosters.');
      }else setLeagues(prev=>prev.map(item=>item.id===leagueId?{...item,liveDraft:draft}:item));
      return true;
    }catch(err:any){const message=err?.message||'That pick could not be saved.';setCloudSyncError(message);showToast(message);return false;}
  };

  const resumeLiveFantasyDraftRecovery = async (leagueId:string):Promise<boolean> => {
    const league=leagues.find(item=>item.id===leagueId);const current=league?.liveDraft;
    if(!league||!current||current.status!=='active')return false;
    if(!isCloudConfigured||current.recoveryEnabled!==false)return true;
    try{
      const draft=await resumeCloudLiveFantasyDraftRecovery(leagueId);
      setLeagues(prev=>prev.map(item=>item.id===leagueId?{...item,liveDraft:draft}:item));
      showToast('Draft clock restored. Automatic recovery is active.');return true;
    }catch(err:any){const message=err?.message||'The fantasy draft could not be recovered safely.';setCloudSyncError(message);showToast(message);return false;}
  };

  const finalizeLiveFantasyDraftRosters = async (leagueId:string):Promise<boolean> => {
    const league=leagues.find(item=>item.id===leagueId);const draft=league?.liveDraft;
    if(!league||!draft||draft.status!=='completed')return false;
    try{
      const { applyLiveDraftRosterAssignments, buildLiveDraftRosterAssignments } = await import('./liveDraftRosters');
      const assignments=buildLiveDraftRosterAssignments(league,draft);
      if(isCloudConfigured){
        await finalizeCloudLiveFantasyDraftRosters(leagueId,assignments);
        const fresh=await fetchCloudLeague(leagueId);if(!fresh)throw new Error('The finalized league rosters could not be loaded.');
        setLeagues(prev=>[fresh,...prev.filter(item=>item.id!==fresh.id)]);
      }else setLeagues(prev=>prev.map(item=>item.id===leagueId?applyLiveDraftRosterAssignments(item,draft,draft.completedAt):item));
      showToast(`All ${league.members.length} fantasy rosters are saved. The commissioner can start the season.`);return true;
    }catch(err:any){const message=err?.message||'The completed fantasy rosters could not be finalized.';setCloudSyncError(message);showToast(message);return false;}
  };

  const importOfflineFantasyDraftResults = async (leagueId:string,picks:{memberId:string;playerId:string}[]):Promise<boolean> => {
    const league=leagues.find(item=>item.id===leagueId);
    try{
      if(!league||league.settings?.draftFormat!=='offline')throw new Error('League is not configured for Offline Results.');
      if(league.liveDraft?.status==='completed'||league.settings?.fantasySeasonStarted||league.settings?.fantasySeasonComplete)throw new Error('Offline draft results can only be imported before the draft is finalized.');
      if(!isLeagueCommissioner(league,currentUser?.id,isDemoMode))throw new Error('Commissioner authorization required.');
      const rosterSize=Math.max(15,Math.min(20,Number(league.settings?.rosterSize)||15));
      if(picks.length!==league.members.length*rosterSize)throw new Error(`Offline draft requires exactly ${league.members.length*rosterSize} picks.`);
      if(new Set(picks.map(pick=>pick.playerId)).size!==picks.length)throw new Error('A player appears more than once.');
      const [{ PLAYERS_DATABASE }, { applyLiveDraftRosterAssignments }] = await Promise.all([import('./players'),import('./liveDraftRosters')]);
      const playerById=new Map(PLAYERS_DATABASE.map(player=>[player.id,player]));const now=new Date().toISOString();
      const draftPicks=picks.map((pick,index)=>{
        const member=league.members.find(item=>item.id===pick.memberId);const player=playerById.get(pick.playerId);const group=player&&getLiveFantasyDraftGroup(player);
        if(!member)throw new Error('Offline results contain an unknown member.');
        if(!player||!group)throw new Error(`Invalid fantasy player ${pick.playerId}.`);
        return{overall:index+1,round:Math.ceil((index+1)/league.members.length),memberId:member.id,playerId:player.id,group,pickedAt:now,source:'manual' as const};
      });
      for(const member of league.members){
        const memberPicks=draftPicks.filter(pick=>pick.memberId===member.id);
        if(memberPicks.length!==rosterSize)throw new Error(`Every manager needs ${rosterSize} picks.`);
        if(member.isAi){const counts=memberPicks.reduce<Record<string,number>>((sum,pick)=>({...sum,[pick.group]:(sum[pick.group]||0)+1}),{});for(const [group,minimum] of Object.entries({QB:1,RB:2,WR:2,TE:1,K:1,DST:1}))if((counts[group]||0)<minimum||(counts[group]||0)>CPU_LIVE_FANTASY_POSITION_LIMITS[group as keyof typeof CPU_LIVE_FANTASY_POSITION_LIMITS])throw new Error('CPU offline results must retain realistic roster construction.');}
      }
      if(isCloudConfigured){
        await importCloudOfflineFantasyDraft(leagueId,picks);const fresh=await fetchCloudLeague(leagueId);if(!fresh)throw new Error('The finalized offline rosters could not be loaded.');setLeagues(prev=>[fresh,...prev.filter(item=>item.id!==fresh.id)]);
      }else{
        const orderMemberIds=[...(league.seasonResult?.draftOrder||[])].sort((a,b)=>a.pickNumber-b.pickNumber).map(item=>item.memberId);
        if(orderMemberIds.length!==league.members.length)throw new Error('Locked draft order is incomplete.');
        const draft:LiveFantasyDraft={leagueId,status:'completed',orderMemberIds,rounds:rosterSize,pickIndex:draftPicks.length,picks:draftPicks,startedAt:now,pickSeconds:60,completedAt:now,updatedAt:now};
        setLeagues(prev=>prev.map(item=>item.id===leagueId?applyLiveDraftRosterAssignments(item,draft,now):item));
      }
      showToast('Offline draft imported. All fantasy rosters are saved.');return true;
    }catch(err:any){const message=err?.message||'Offline draft results could not be imported.';setCloudSyncError(message);showToast(message);return false;}
  };

  const resetLeagueSimulation = async (leagueId: string) => {
    if (isCloudConfigured) {
      await resetCloudLeagueForNextSeason(leagueId);const fresh=await fetchCloudLeague(leagueId);
      if(fresh)setLeagues(prev=>[fresh,...prev.filter(item=>item.id!==fresh.id)]);
      showToast('New season ready. Rosters, draft state, lineups, scores, FAAB and IR were reset.');return;
    }
    setLeagues(prev => prev.map(l => {
      if (l.id !== leagueId) return l;
      return {...l,status:'drafting',seasonResult:undefined,liveDraft:undefined,rostersLocked:false,draftCountdownStartedAt:undefined,settings:{...l.settings,fantasySeasonStarted:false,fantasySeasonComplete:false,currentWeek:1},members:l.members.map(m=>({...m,status:'building',roster:undefined,teamRatings:undefined,submittedAt:undefined,liveDraftReady:false,faabBalance:100,irPlayerIds:[]}))};
    }));
    showToast('League reset. Ready for new team builds and draft competition.');
  };

  const updateSalaryCap = (leagueId: string, newCap: number) => {
    if (!Number.isFinite(newCap) || newCap <= 0) {showToast('Enter a valid salary cap greater than zero.');return;}
    setLeagues(prev => prev.map(l => l.id === leagueId ? {...l,salaryCap:newCap} : l));
    if (isCloudConfigured) void updateCloudLeague(leagueId, { salaryCap: newCap }).catch((err:any) => setCloudSyncError(err?.message || 'Could not sync salary cap'));
    showToast(`Salary cap updated to $${newCap}M`);
  };

  const updateLeagueSettings = async (leagueId: string, settings: import('./types').LeagueSettings):Promise<boolean> => {
    const league=leagues.find(item=>item.id===leagueId);const merged={...(league?.settings||{}),...settings};
    try{
      if(isCloudConfigured)await updateCloudLeague(leagueId,{settings:merged});
      setLeagues(prev=>prev.map(item=>item.id===leagueId?{...item,settings:{...(item.settings||{}),...settings}}:item));
      showToast('Commissioner settings updated');return true;
    }catch(err:any){const message=err?.message||'Could not sync commissioner settings';setCloudSyncError(message);showToast(message);return false;}
  };

  const startDemoMode = () => {
    setIsDemoMode(true);showToast('Preparing Demo Mode…');
    void import('./aiOpponents').then(({ generateAiLeagueMembers }) => {
      const demoAiMembers = generateAiLeagueMembers(7, 0);const user = currentUser || DEFAULT_USER;
      const demoCommissioner: LeagueMember = {id:`demo-user-${user.id}`,userId:user.id,userName:`${user.name} (You)`,userAvatar:user.avatarUrl,isCommissioner:true,status:'building'};
      const demoLeague: League = {id:'demo-league-instance',code:'BK-DEMO',name:'Ball Knower Live Demo League',maxMembers:8,salaryCap:DEFAULT_SALARY_CAP,commissionerId:user.id,commissionerName:user.name,status:'drafting',settings:{seasonGames:17,scoringFormat:'ppr',nflSeason:2026},members:[demoCommissioner,...demoAiMembers],createdAt:new Date().toISOString()};
      setLeagues(prev => [demoLeague, ...prev.filter(l => l.id !== 'demo-league-instance')]);setActiveLeagueId('demo-league-instance');invalidatePendingAutoDraft();setCurrentRoster([]);showToast('Demo Mode active! Build your roster and simulate.');
    }).catch(error => {console.error('Demo Mode data could not load', error);setIsDemoMode(false);showToast('Demo Mode could not load. Try again.');});
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);const realLeague = leagues.find(l => l.id !== 'demo-league-instance');if (realLeague) setActiveLeagueId(realLeague.id);
  };

  return (
    <BallKnowerContext.Provider value={{
      currentUser,setCurrentUser,loginWithProvider,logout,leagues,activeLeague,setActiveLeagueId,createLeague,joinLeague,joinPublicLeague,
      onlineInvitesReady:isCloudConfigured,cloudSyncError,currentRoster,isRosterLocked,addToRoster,removeFromRoster,clearRoster,autoDraftTemplate,submitRoster,
      totalSpent,remainingCap,rosterCounts,rosterValidationErrors,isRosterValid,autoFillLeagueWithAi,removeMemberFromLeague,startSimulation,advanceFantasyWeek,
      finalizeDraftOrder,startLiveFantasyDraft,resumeLiveFantasyDraftRecovery,makeLiveFantasyDraftPick,finalizeLiveFantasyDraftRosters,importOfflineFantasyDraftResults,
      resetLeagueSimulation,updateSalaryCap,updateLeagueSettings,isDemoMode,startDemoMode,exitDemoMode,toastMessage,showToast,
    }}>
      {children}
    </BallKnowerContext.Provider>
  );
};

export const useBallKnower = () => {
  const context = useContext(BallKnowerContext);
  if (!context) throw new Error('useBallKnower must be used within a BallKnowerProvider');
  return context;
};