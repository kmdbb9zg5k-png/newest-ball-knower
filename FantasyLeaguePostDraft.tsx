import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUp,
  ArrowRightLeft,
  Bandage,
  Bell,
  Check,
  ChevronRight,
  ChevronDown,
  Clock3,
  Gavel,
  Medal,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Star,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { League, LeagueMember, Player, SimulationGame } from "./types";
import { PLAYERS_DATABASE } from "./players";
import { playerPortraitFallbackUrl, playerPortraitUrl } from "./playerPortraits";
import { useBallKnower } from "./BallKnowerContext";
import { FantasyAdvancedLeagueSettings } from "./FantasyAdvancedLeagueSettings";
import { FantasyLeagueCommunications } from "./FantasyLeagueCommunications";
import { isCloudConfigured } from "./supabase";
import {
  fetchSeasonOperations,
  cancelWaiverClaim,
  getLeagueFreeAgents,
  LeagueInjury,
  LeagueMessage,
  LeagueTransaction,
  postLeagueMessage,
  proposeTrade,
  voteOnFantasyTrade,
  resolveTrade,
  TradeOffer,
  WaiverClaim,
} from "./fantasySeasonCloud";
import {
  ArchivedSeason,
  buildLeagueRecords,
  fetchFantasyParityState,
  finalizeFantasySeasonFromScores,
  LINEUP_SLOTS,
  MemberFantasyMeta,
  NflWeekGame,
  PlayerScoreDetail,
  saveMyWeeklyLineup,
  setMyIrPlayer,
  subscribeToFantasyParity,
  submitFaabClaim,
  validateWeeklyLineup,
  WeeklyLineup,
  WeeklyPlayerProjection,
  WeeklyScore,
} from "./fantasyLeagueParityCloud";
import { counterTradeV2 } from "./fantasyTradeV2Cloud";
import { FantasyRanking, loadFantasyRankings } from "./fantasyRankingsCloud";
import { FantasyPlayerDetail } from "./FantasyPlayerDetail";
import { ModalPortal } from "./ModalPortal";
import { resolveWeeklyProjection } from "./fantasyLineup";
import {
  buildFantasyPowerRankings,
  fantasyAvailability,
  fantasyPlayerAction,
  lineupChangeCount,
} from "./fantasyUiSystem";
import {
  buildFantasyWeekPairings,
  buildScoredFantasyGames,
  buildScoredFantasyPlayoffs,
  buildStandings,
  isCompleteFantasySchedule,
  seedFantasyStandings,
} from "./simulation";
import { resolveMyLeagueMember } from "./leagueMemberDisplay";

type Tab = "team" | "matchup" | "players" | "league";
type LeagueView = "standings" | "playoffs" | "power" | "trades" | "activity" | "settings";
type PlayerPoolView = "freeAgents" | "waivers" | "ir";
type PlayerSort = "weekly" | "season" | "rank";
type ActivityView = "trades" | "moves" | "messages";
type IntelView = "awards" | "allbk";

type Props = {
  league: League;
  onGoToSimulation: () => void;
};

const STANDARD_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DST"]);
const normalizeName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");
const compareCodeUnits = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const displayManagerName = (member?: LeagueMember) => {
  if (!member) return "Team";
  if (!member.isAi) return member.userName;
  const clean = member.userName.replace(/\s+CPU(?:\s+\d+)?$/i, "").trim();
  return clean || "CPU Team";
};
const rosterCount = (member?: LeagueMember) => member?.roster?.length || 0;

const buildFantasyLineup = (
  roster: Player[],
  comparePlayers: (a: Player, b: Player) => number,
) => {
  const chosen = new Set<string>();
  const starters: Record<string, string> = {};
  for (const slot of LINEUP_SLOTS) {
    const candidate = [...roster]
      .filter((player) => !chosen.has(player.id) && slot.accept(player))
      .sort(comparePlayers)[0];
    if (candidate) {
      starters[slot.id] = candidate.id;
      chosen.add(candidate.id);
    }
  }
  return starters;
};

export const FantasyLeaguePostDraft: React.FC<Props> = ({
  league,
  onGoToSimulation,
}) => {
  const { currentUser, showToast, updateLeagueSettings } = useBallKnower();
  const me = resolveMyLeagueMember(league, currentUser);
  const roster = me?.roster || [];
  const settings = (league.settings || {}) as any;
  const fantasyRosterSize = Math.max(
    15,
    Math.min(20, Number(settings.rosterSize || league.liveDraft?.rounds) || 15),
  );
  const isCommissioner = currentUser?.id === league.commissionerId;
  const playoffWeeks = settings.playoffTeams === 4 ? 2 : 3;
  const persistedRegularSeasonWeeks = Math.max(
    0,
    ...(league.seasonResult?.games || [])
      .filter((game) => !game.playoffRound)
      .map((game) => Number(game.week) || 0),
  );
  const maxWeek =
    persistedRegularSeasonWeeks ||
    Math.min(
      Math.max(
        13,
        Math.min(
          17,
          Number(settings.regularSeasonWeeks ?? settings.seasonGames) || 17,
        ),
      ),
      18 - playoffWeeks,
    );
  const maxSelectableWeek = maxWeek + playoffWeeks;
  const storedWeekKey = `ball-knower:matchup-week:${league.id}`;
  const storedMatchupKey = `ball-knower:matchup-id:${league.id}`;

  const [tab, setTab] = useState<Tab>("team");
  const [leagueView, setLeagueView] = useState<LeagueView>("standings");
  const [activityView, setActivityView] = useState<ActivityView>("trades");
  const [intelView, setIntelView] = useState<IntelView>("allbk");
  const [week, setWeek] = useState(() => {
    const saved = Number(window.sessionStorage.getItem(storedWeekKey));
    return Math.min(maxSelectableWeek, Math.max(1, saved || Number(settings.currentWeek) || 1));
  });
  const [viewedMatchupId, setViewedMatchupId] = useState(
    () => window.sessionStorage.getItem(storedMatchupKey) || "",
  );
  const [showAllMatchups, setShowAllMatchups] = useState(false);
  const [lineups, setLineups] = useState<WeeklyLineup[]>([]);
  const [scores, setScores] = useState<WeeklyScore[]>([]);
  const [memberMeta, setMemberMeta] = useState<MemberFantasyMeta[]>([]);
  const [memberMetaLoaded, setMemberMetaLoaded] = useState(false);
  const [archives, setArchives] = useState<ArchivedSeason[]>([]);
  const [nflGames, setNflGames] = useState<NflWeekGame[]>([]);
  const [seasonGames, setSeasonGames] = useState<NflWeekGame[]>([]);
  const [weeklyProjections, setWeeklyProjections] = useState<WeeklyPlayerProjection[]>([]);
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [claims, setClaims] = useState<WaiverClaim[]>([]);
  const [injuries, setInjuries] = useState<LeagueInjury[]>([]);
  const [messages, setMessages] = useState<LeagueMessage[]>([]);
  const [transactions, setTransactions] = useState<LeagueTransaction[]>([]);
  const [rankings, setRankings] = useState<FantasyRanking[]>([]);
  const [rankingsBusy, setRankingsBusy] = useState(true);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const [starters, setStarters] = useState<Record<string, string>>({});
  const [swapSlot, setSwapSlot] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [detailOwnerName, setDetailOwnerName] = useState<string | undefined>();
  const [detailOwnerId, setDetailOwnerId] = useState<string | undefined>();

  useEffect(() => {
    if (!showAllMatchups) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAllMatchups(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showAllMatchups]);

  const [freeAgentQuery, setFreeAgentQuery] = useState("");
  const [playerPoolView, setPlayerPoolView] = useState<PlayerPoolView>(() =>
    settings.freeAgentMode === "continuous" ? "waivers" : "freeAgents",
  );
  const [playerPosition, setPlayerPosition] = useState("ALL");
  const [playerSort, setPlayerSort] = useState<PlayerSort>("weekly");
  const [faabPlayer, setFaabPlayer] = useState("");
  const [faabBid, setFaabBid] = useState(1);
  const [dropPlayer, setDropPlayer] = useState("");
  const [dropPickerOpen, setDropPickerOpen] = useState(false);
  const [claimGroupId, setClaimGroupId] = useState("");

  const [tradeTarget, setTradeTarget] = useState("");
  const [tradeGive, setTradeGive] = useState<string[]>([]);
  const [tradeGet, setTradeGet] = useState<string[]>([]);
  const [tradeDrops, setTradeDrops] = useState<string[]>([]);
  const [counterTradeId, setCounterTradeId] = useState("");
  const [counterGive, setCounterGive] = useState<string[]>([]);
  const [counterGet, setCounterGet] = useState<string[]>([]);
  const [counterDrops, setCounterDrops] = useState<string[]>([]);
  const [acceptDrops, setAcceptDrops] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const tradeBuilderRef = useRef<HTMLDivElement>(null);
  const seasonFinalizeRef = useRef("");
  const parityRequestRef = useRef(0);
  const parityViewCacheRef = useRef(new Map<string, any>());

  const rankingsByName = useMemo(() => {
    const map = new Map<string, FantasyRanking>();
    rankings.forEach((ranking) =>
      map.set(normalizeName(ranking.player_name), ranking),
    );
    return map;
  }, [rankings]);

  const rankingsByPlayerKey = useMemo(() => {
    const map = new Map<string, FantasyRanking>();
    rankings.forEach((ranking) => map.set(ranking.player_key, ranking));
    return map;
  }, [rankings]);

  const rankingFor = (player?: Player) =>
    player
      ? rankingsByPlayerKey.get(player.id) || rankingsByName.get(normalizeName(player.name))
      : undefined;
  const projectedPointsFor = (player: Player): number | null => {
    const ranking = rankingFor(player);
    if (!ranking) return null;
    const value = Number(ranking.projected_points_2026);
    return Number.isFinite(value) ? value : null;
  };
  const comparePlayers = (a: Player, b: Player) => {
    const aProjection = projectedPointsFor(a);
    const bProjection = projectedPointsFor(b);
    if (
      aProjection !== null &&
      bProjection !== null &&
      aProjection !== bProjection
    )
      return bProjection - aProjection;
    if (aProjection !== null && bProjection === null) return -1;
    if (aProjection === null && bProjection !== null) return 1;
    const position = compareCodeUnits(a.position, b.position);
    if (position) return position;
    const name = compareCodeUnits(a.name, b.name);
    return name || compareCodeUnits(a.id, b.id);
  };
  const compareLowestKnownValue = (a: Player, b: Player) => {
    const aProjection = projectedPointsFor(a);
    const bProjection = projectedPointsFor(b);
    if (
      aProjection !== null &&
      bProjection !== null &&
      aProjection !== bProjection
    )
      return aProjection - bProjection;
    if (aProjection !== null && bProjection === null) return -1;
    if (aProjection === null && bProjection !== null) return 1;
    const position = compareCodeUnits(a.position, b.position);
    if (position) return position;
    return compareCodeUnits(a.name, b.name) || compareCodeUnits(a.id, b.id);
  };
  const valueLabel = (player: Player) => {
    const ranking = rankingFor(player);
    if (ranking)
      return `#${ranking.overall_rank} overall · #${ranking.position_rank} ${ranking.position} · ${Number(ranking.projected_points_2026).toFixed(1)} proj`;
    if (rankingsBusy)
      return `${player.team} · ${player.position} · loading 2026 projection…`;
    if (rankingsError)
      return `${player.team} · ${player.position} · projection unavailable`;
    return `${player.team} · ${player.position} · no published 2026 projection`;
  };

  const refresh = async () => {
    const requestId = ++parityRequestRef.current;
    setError("");
    setMemberMetaLoaded(false);
    const [parityResult, opsResult] = await Promise.allSettled([
        fetchFantasyParityState(
          league.id,
          week,
          Number(settings.nflSeason) || 2026,
        ),
        fetchSeasonOperations(league.id),
    ]);
    if (requestId !== parityRequestRef.current) return;
    if (parityResult.status === "fulfilled") {
      const parity = parityResult.value;
      setLineups([...parity.lineups]);
      setScores([...parity.scores]);
      setMemberMeta([...parity.members]);
      setMemberMetaLoaded(true);
      setArchives([...parity.archives]);
      setNflGames([...parity.games]);
      setSeasonGames([...parity.seasonGames]);
      setWeeklyProjections([...parity.projections]);
      parityViewCacheRef.current.set(`${league.id}:${week}`, parity);
    } else {
      setError(parityResult.reason?.message || "Could not sync this matchup. Showing the last good data when available.");
    }
    if (opsResult.status === "fulfilled") {
      const ops = opsResult.value;
      setTrades([...ops.trades]);
      setClaims([...ops.claims]);
      setInjuries([...ops.injuries]);
      setMessages([...ops.messages]);
      setTransactions([...ops.transactions]);
    } else if (parityResult.status === "fulfilled") {
      setError("League activity could not sync. Matchup data is still available.");
    }
  };

  useEffect(() => {
    const cached = parityViewCacheRef.current.get(`${league.id}:${week}`);
    if (cached) {
      setLineups([...cached.lineups]);
      setScores([...cached.scores]);
      setNflGames([...cached.games]);
      setSeasonGames([...cached.seasonGames]);
      setWeeklyProjections([...cached.projections]);
    } else {
      setLineups([]);
      setNflGames([]);
      setWeeklyProjections([]);
    }
    void refresh();
  }, [league.id, week]);
  useEffect(() => {
    const saved = Number(window.sessionStorage.getItem(storedWeekKey));
    setWeek(Math.min(maxSelectableWeek, Math.max(1, saved || Number(settings.currentWeek) || 1)));
  }, [league.id, maxSelectableWeek]);
  useEffect(() => {
    window.sessionStorage.setItem(storedWeekKey, String(week));
  }, [storedWeekKey, week]);
  useEffect(() => {
    if (viewedMatchupId) window.sessionStorage.setItem(storedMatchupKey, viewedMatchupId);
  }, [storedMatchupKey, viewedMatchupId]);
  useEffect(
    () =>
      subscribeToFantasyParity(league.id, () => {
        void refresh();
      }),
    [league.id, week],
  );
  useEffect(() => {
    let active = true;
    setRankingsBusy(true);
    setRankingsError(null);
    void loadFantasyRankings()
      .then((data) => {
        if (!active) return;
        setRankings(data);
        setRankingsError(
          data.length
            ? null
            : "No 2026 fantasy projections are published right now.",
        );
      })
      .catch((err: any) => {
        if (!active) return;
        setRankings([]);
        setRankingsError(
          err?.message || "2026 fantasy projections could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setRankingsBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const myLineup = lineups.find((item) => item.memberId === me?.id);
  const lockedPlayerIds = new Set(myLineup?.lockedPlayerIds || []);
  const rosterSignature = roster
    .map((player) => player.id)
    .sort()
    .join("|");
  useEffect(() => {
    setStarters(
      myLineup?.starters && Object.keys(myLineup.starters).length
        ? { ...myLineup.starters }
        : buildFantasyLineup(roster, comparePlayers),
    );
  }, [
    league.id,
    week,
    myLineup?.id,
    myLineup?.updatedAt,
    rosterSignature,
    rankingsByName,
  ]);

  const myMeta = memberMeta.find((item) => item.memberId === me?.id);
  const irIds = myMeta?.irPlayerIds || [];
  const activeRosterCount = roster.filter(
    (player) => !irIds.includes(player.id),
  ).length;
  const lineupErrors = validateWeeklyLineup(roster, starters);
  const lineupChanges = lineupChangeCount(myLineup?.starters, starters);
  const lineupDirty = lineupChanges > 0;
  const starterIds = new Set(Object.values(starters).filter(Boolean));
  const bench = roster.filter(
    (player) => !starterIds.has(player.id) && !irIds.includes(player.id),
  );
  const waiverType = settings.waiverType || "priority";
  const scoringLocked =
    Boolean(settings.fantasySeasonStarted) ||
    Number(settings.currentWeek || 1) > 1;
  const regularSeasonSchedule = useMemo(() => {
    const persisted = (league.seasonResult?.games || [])
      .filter((game) => !game.playoffRound)
      .map((game) => ({
        id: game.id,
        week: game.week,
        homeMemberId: game.homeMemberId,
        awayMemberId: game.awayMemberId,
      }));
    return isCompleteFantasySchedule(league.members, maxWeek, persisted)
      ? persisted
      : Array.from({ length: maxWeek }, (_, index) =>
          buildFantasyWeekPairings(league.members, index + 1),
        ).flat();
  }, [league.members, league.seasonResult?.games, maxWeek]);
  const scoredGames = useMemo(
    () =>
      buildScoredFantasyGames(
        league.members,
        maxWeek,
        scores,
        regularSeasonSchedule,
      ),
    [league.members, maxWeek, scores, regularSeasonSchedule],
  );
  const effectiveSeeding =
    settings.playoffSeeding === "division_winners" && !settings.divisionsEnabled
      ? "record_points"
      : settings.playoffSeeding || "record_points";
  const visibleStandings = useMemo(
    () =>
      seedFantasyStandings(
        buildStandings(league.members, scoredGames),
        scoredGames,
        effectiveSeeding,
        league.seasonResult?.draftOrder?.map((item) => item.memberId) ||
          league.members.map((item) => item.id),
        settings.divisionCount || 2,
      ),
    [
      league.members,
      league.seasonResult?.draftOrder,
      scoredGames,
      effectiveSeeding,
      settings.divisionCount,
    ],
  );
  const expectedRegularGames = (maxWeek * league.members.length) / 2;
  const regularSeasonComplete = scoredGames.length === expectedRegularGames;
  const playoffTeamCount = (
    settings.playoffTeams === 4 || settings.playoffTeams === 8
      ? settings.playoffTeams
      : 6
  ) as 4 | 6 | 8;
  const postseason = useMemo(
    () =>
      regularSeasonComplete
        ? buildScoredFantasyPlayoffs(
            visibleStandings,
            scores,
            playoffTeamCount,
            maxWeek,
          )
        : {
            seeds: [],
            matchups: [],
            games: [],
            nextWeek: maxWeek + 1,
            complete: false,
          },
    [
      regularSeasonComplete,
      visibleStandings,
      scores,
      playoffTeamCount,
      maxWeek,
    ],
  );
  const champion = postseason.championMemberId
    ? league.members.find((member) => member.id === postseason.championMemberId)
    : undefined;
  const visibleLeague = useMemo(
    () =>
      scoredGames.length
        ? {
            ...league,
            seasonResult: {
              completedAt: postseason.complete ? new Date().toISOString() : "",
              standings: visibleStandings,
              games: [...scoredGames, ...postseason.games],
              draftOrder: [],
              championMemberId: postseason.championMemberId,
              playoffGames: postseason.games,
              winnerAnalysis: {
                winnerId: postseason.championMemberId || "",
                winnerName: champion?.userName || "",
                summary: champion
                  ? `${displayManagerName(champion)} won the fantasy playoffs.`
                  : "",
                keyFactors: champion
                  ? [
                      "Qualified through the regular season.",
                      "Won the championship matchup.",
                    ]
                  : [],
              },
              teamReports: {},
            },
          }
        : { ...league, seasonResult: undefined },
    [league, scoredGames, visibleStandings, postseason, champion],
  );
  useEffect(() => {
    const result = visibleLeague.seasonResult;
    if (
      !postseason.complete ||
      !result?.championMemberId ||
      league.seasonResult?.championMemberId === result.championMemberId
    )
      return;
    const key = `${league.id}:${result.championMemberId}`;
    if (seasonFinalizeRef.current === key) return;
    seasonFinalizeRef.current = key;
    void finalizeFantasySeasonFromScores(league.id, result)
      .then(() =>
        showToast(
          `${champion?.userName || "The playoff winner"} is the Ball Knower champion.`,
        ),
      )
      .catch((err: any) => {
        seasonFinalizeRef.current = "";
        setError(
          err?.message || "The championship result could not be finalized.",
        );
      });
  }, [
    league.id,
    league.seasonResult?.championMemberId,
    visibleLeague.seasonResult,
    postseason.complete,
    champion?.userName,
    showToast,
  ]);
  const records = useMemo(
    () => buildLeagueRecords(visibleLeague, archives),
    [visibleLeague, archives],
  );

  const freeAgents = useMemo(
    () =>
      getLeagueFreeAgents(league, PLAYERS_DATABASE)
        .filter((player) => STANDARD_POSITIONS.has(player.position))
        .sort(comparePlayers),
    [league.members, rankingsByName],
  );
  const selectedTeam = league.members.find(
    (member) => member.id === selectedTeamId,
  );
  const tradePartner = league.members.find(
    (member) => member.id === tradeTarget,
  );
  const selectedCounter = trades.find((trade) => trade.id === counterTradeId);
  const counterPartner = league.members.find(
    (member) => member.id === selectedCounter?.proposerMemberId,
  );
  const receivedTrades = trades.filter(
    (trade) => trade.status === "pending" && trade.recipientMemberId === me?.id,
  );
  const sentTrades = trades.filter(
    (trade) => trade.status === "pending" && trade.proposerMemberId === me?.id,
  );
  const reviewTrades = trades.filter(
    (trade) => trade.status === "accepted_pending_review",
  );
  const myInjuries = injuries.filter((injury) => injury.memberId === me?.id);
  const myPendingClaims = claims
    .filter((claim) => claim.memberId === me?.id && claim.status === "pending")
    .sort(
      (a, b) =>
        a.claimOrder - b.claimOrder || a.createdAt.localeCompare(b.createdAt),
    );

  const requiredTradeDrops = Math.max(
    0,
    activeRosterCount -
      tradeGive.filter((id) => !irIds.includes(id)).length +
      tradeGet.length -
      fantasyRosterSize,
  );
  const requiredCounterDrops = Math.max(
    0,
    activeRosterCount -
      counterGive.filter((id) => !irIds.includes(id)).length +
      counterGet.length -
      fantasyRosterSize,
  );
  useEffect(
    () =>
      setTradeDrops((prev) =>
        prev
          .filter((id) => !tradeGive.includes(id))
          .slice(0, requiredTradeDrops),
      ),
    [tradeGive.join("|"), requiredTradeDrops],
  );
  useEffect(
    () =>
      setCounterDrops((prev) =>
        prev
          .filter((id) => !counterGive.includes(id))
          .slice(0, requiredCounterDrops),
      ),
    [counterGive.join("|"), requiredCounterDrops],
  );

  const run = async (fn: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (success) showToast(success);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || "League operation failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveLineup = () =>
    run(async () => {
      if (!me) throw new Error("League membership not found.");
      if (lineupErrors.length) throw new Error(lineupErrors[0]);
      await saveMyWeeklyLineup(
        league.id,
        week,
        starters,
        [...bench].sort(comparePlayers).map((player) => player.id),
      );
    }, `Week ${week} lineup saved.`);

  const submitClaim = () =>
    run(async () => {
      if (!me || !faabPlayer) throw new Error("Choose a free agent.");
      if (!memberMetaLoaded)
        throw new Error("Roster metadata is still loading.");
      if (activeRosterCount >= fantasyRosterSize && !dropPlayer)
        throw new Error("Choose a player to drop.");
      const groupClaims = claimGroupId
        ? myPendingClaims.filter((claim) => claim.claimGroupId === claimGroupId)
        : [];
      const claimOrder = groupClaims.length
        ? Math.max(...groupClaims.map((claim) => claim.claimOrder)) + 1
        : 1;
      const result = await submitFaabClaim(
        league.id,
        me.id,
        faabPlayer,
        waiverType === "faab" ? faabBid : 0,
        dropPlayer || undefined,
        claimOrder,
        claimGroupId || undefined,
      );
      showToast(result.message);
      setFaabPlayer("");
      setDropPlayer("");
      setClaimGroupId("");
    });

  const sendTrade = () =>
    run(async () => {
      if (!me || !tradeTarget || !tradeGive.length || !tradeGet.length)
        throw new Error("Choose players from both teams.");
      if (!memberMetaLoaded) throw new Error("Roster metadata is still loading.");
      if (tradeGive.length > 3 || tradeGet.length > 3)
        throw new Error(
          "Trade packages are limited to three players per side.",
        );
      if (tradeDrops.length !== requiredTradeDrops)
        throw new Error(
          `Choose ${requiredTradeDrops} roster cut${requiredTradeDrops === 1 ? "" : "s"} first.`,
        );
      const result = await proposeTrade(
        league,
        me.id,
        tradeTarget,
        tradeGive,
        tradeGet,
        tradeDrops,
        "",
      );
      showToast(
        result.reason ||
          (result.status === "accepted"
            ? "CPU accepted the trade."
            : result.status === "rejected"
              ? "CPU declined the trade."
              : "Trade offer sent."),
      );
      setTradeGive([]);
      setTradeGet([]);
      setTradeDrops([]);
    });

  const startTrade = (memberId: string, playerId?: string) => {
    setTradeTarget(memberId);
    setTradeGive([]);
    setTradeGet(playerId ? [playerId] : []);
    setTradeDrops([]);
    setSelectedTeamId("");
    setActivityView("trades");
    setLeagueView("trades");
    setTab("league");
    window.setTimeout(
      () =>
        tradeBuilderRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      80,
    );
  };

  const openPlayerDetail = (player: Player, owner?: LeagueMember) => {
    setDetailPlayer(player);
    setDetailOwnerName(owner ? displayManagerName(owner) : undefined);
    setDetailOwnerId(owner?.id);
  };

  const openCounter = (trade: TradeOffer) => {
    setCounterTradeId(trade.id);
    setCounterGive([...trade.requestedPlayerIds]);
    setCounterGet([...trade.offeredPlayerIds]);
    setCounterDrops([]);
  };

  const sendCounter = () =>
    run(async () => {
      if (!selectedCounter || !counterGive.length || !counterGet.length)
        throw new Error("Choose players from both teams.");
      if (!memberMetaLoaded) throw new Error("Roster metadata is still loading.");
      if (counterDrops.length !== requiredCounterDrops)
        throw new Error(
          `Choose ${requiredCounterDrops} roster cut${requiredCounterDrops === 1 ? "" : "s"} first.`,
        );
      await counterTradeV2(
        selectedCounter.id,
        counterGive,
        counterGet,
        counterDrops,
      );
      setCounterTradeId("");
      setCounterGive([]);
      setCounterGet([]);
      setCounterDrops([]);
    }, "Counter offer sent.");

  const actOnTrade = (
    trade: TradeOffer,
    action: "accepted" | "rejected" | "cancelled" | "approved" | "vetoed",
  ) =>
    run(async () => {
      if (!memberMetaLoaded && action === "accepted") throw new Error("Roster metadata is still loading.");
      const drops = action === "accepted" ? acceptDrops[trade.id] || [] : [];
      const result = await resolveTrade(trade.id, action, drops);
      showToast(result.reason || `Trade ${result.status}.`);
      if (action === "accepted")
        setAcceptDrops((prev) => ({ ...prev, [trade.id]: [] }));
    });

  const sendMessage = () =>
    run(async () => {
      await postLeagueMessage(
        league.id,
        currentUser?.name || me?.userName || "Ball Knower",
        message,
        isCommissioner && message.startsWith("!") ? "announcement" : "chat",
      );
      setMessage("");
    }, "Message sent.");

  const allScoredGames = [...scoredGames, ...postseason.games];
  const allScheduledMatchups = [
    ...regularSeasonSchedule,
    ...postseason.matchups,
  ];
  const weekMatchups = useMemo(
    () => allScheduledMatchups.filter((game) => game.week === week),
    [allScheduledMatchups, week],
  );
  useEffect(() => {
    const myGame = weekMatchups.find(
      (game) => game.homeMemberId === me?.id || game.awayMemberId === me?.id,
    );
    setViewedMatchupId((current) =>
      weekMatchups.some((game) => game.id === current)
        ? current
        : myGame?.id || weekMatchups[0]?.id || "",
    );
  }, [week, weekMatchups, me?.id]);
  const viewedMatchup =
    weekMatchups.find((game) => game.id === viewedMatchupId) || weekMatchups[0];
  const viewedHome = league.members.find(
    (member) => member.id === viewedMatchup?.homeMemberId,
  );
  const viewedAway = league.members.find(
    (member) => member.id === viewedMatchup?.awayMemberId,
  );
  const weeklyProjectionFor = (player: Player): number | null => {
    const format = settings.scoringFormat === "standard"
      ? "standard"
      : settings.scoringFormat === "half_ppr"
        ? "half_ppr"
        : "ppr";
    const verifiedTeamGames = seasonGames.filter(
      (game) => game.homeTeam === player.team || game.awayTeam === player.team,
    );
    return resolveWeeklyProjection(
      player.id,
      weeklyProjections,
      format,
      Object.keys(settings.customScoring || {}).length > 0,
      projectedPointsFor(player),
      verifiedTeamGames.length,
      verifiedTeamGames.some((game) => game.week === week),
    );
  };
  const isVerifiedBye = (team: string) => {
    const teamGames = seasonGames.filter(
      (game) => game.homeTeam === team || game.awayTeam === team,
    );
    return teamGames.length === 17 && !teamGames.some((game) => game.week === week);
  };
  const compareWeeklyLineupPlayers = (a: Player, b: Player) => {
    const aProjection = weeklyProjectionFor(a);
    const bProjection = weeklyProjectionFor(b);
    if (aProjection !== null && bProjection !== null && aProjection !== bProjection)
      return bProjection - aProjection;
    if (aProjection !== null) return -1;
    if (bProjection !== null) return 1;
    return comparePlayers(a, b);
  };
  const matchupScoreFor = (member?: LeagueMember): WeeklyScore | undefined => {
    if (!member) return undefined;
    const authoritative = scores.find(
      (score) => score.week === week && score.memberId === member.id,
    );
    if (authoritative?.players.length) return authoritative;
    const saved = lineups.find((lineup) => lineup.memberId === member.id);
    const starters = saved?.starters && Object.keys(saved.starters).length
      ? saved.starters
      : buildFantasyLineup(member.roster || [], compareWeeklyLineupPlayers);
    const players = LINEUP_SLOTS.flatMap((slot): PlayerScoreDetail[] => {
      const player = (member.roster || []).find((item) => item.id === starters[slot.id]);
      if (!player) return [];
      const game = nflGames.find(
        (item) => item.homeTeam === player.team || item.awayTeam === player.team,
      );
      const opponent = game
        ? game.homeTeam === player.team
          ? game.awayTeam
          : game.homeTeam
        : undefined;
      const weeklyProjection = weeklyProjectionFor(player);
      return [{
        slot: slot.id,
        playerId: player.id,
        playerName: player.name,
        team: player.team,
        position: player.position,
        opponent,
        isHome: game ? game.homeTeam === player.team : undefined,
        isBye: !game && isVerifiedBye(player.team),
        points: 0,
        projectedPoints: weeklyProjection || 0,
        projectionAvailable: weeklyProjection !== null,
        status: game?.gameStatus || (isVerifiedBye(player.team) ? "Bye" : "Opponent unavailable"),
        kickoffAt: game?.kickoffAt,
        isLive: false,
        isFinal: false,
        locked: Boolean(saved?.lockedPlayerIds.includes(player.id)),
      }];
    });
    const hasProjectedTotal = players.length > 0 && players.every(
      (player) => player.projectionAvailable !== false,
    );
    return {
      leagueId: league.id,
      memberId: member.id,
      week,
      livePoints: 0,
      projectedPoints: players.reduce((total, player) => total + player.projectedPoints, 0),
      hasProjectedTotal,
      source: "deterministic_projection",
      isFinal: false,
      scoreRevision: 1,
      players,
      updatedAt: saved?.updatedAt || new Date(0).toISOString(),
    };
  };
  const viewedHomeScore = matchupScoreFor(viewedHome);
  const viewedAwayScore = matchupScoreFor(viewedAway);
  const viewedScoreStatus =
    viewedHomeScore && viewedAwayScore
      ? viewedHomeScore.isFinal && viewedAwayScore.isFinal
        ? "Final"
        : [...viewedHomeScore.players, ...viewedAwayScore.players].some(
              (player) => player.isLive,
            )
          ? "Live"
          : "Scheduled"
      : "Scheduled";
  const nextKickoff = nflGames
    .filter((game) => !game.isFinal)
    .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt))[0];
  const playerAvailability = fantasyAvailability(settings.freeAgentMode);
  const visibleFreeAgents = useMemo(() => {
    const query = freeAgentQuery.trim().toLowerCase();
    return freeAgents
      .filter((player) => playerPosition === "ALL" || player.position === playerPosition)
      .filter(
        (player) =>
          !query ||
          `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        if (playerSort === "weekly") {
          const aWeekly = weeklyProjectionFor(a);
          const bWeekly = weeklyProjectionFor(b);
          if (aWeekly !== null && bWeekly !== null && aWeekly !== bWeekly) return bWeekly - aWeekly;
          if (aWeekly !== null) return -1;
          if (bWeekly !== null) return 1;
        }
        if (playerSort === "rank") {
          const aRank = rankingFor(a)?.overall_rank ?? Number.MAX_SAFE_INTEGER;
          const bRank = rankingFor(b)?.overall_rank ?? Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) return aRank - bRank;
        }
        return comparePlayers(a, b);
      })
      .slice(0, 50);
  }, [freeAgents, freeAgentQuery, playerPosition, playerSort, weeklyProjections, nflGames, seasonGames, week, rankingsByName]);
  const weeklyContextFor = (player?: Player) => {
    if (!player) return undefined;
    const game = nflGames.find(
      (item) => item.homeTeam === player.team || item.awayTeam === player.team,
    );
    const verifiedBye = !game && isVerifiedBye(player.team);
    const opponent = game
      ? game.homeTeam === player.team
        ? game.awayTeam
        : game.homeTeam
      : "";
    const opponentText = verifiedBye
      ? "Bye"
      : opponent
        ? `${game?.homeTeam === player.team ? "vs" : "@"} ${opponent}`
        : "Opponent unavailable";
    const injury = injuries.find((item) => item.memberId === me?.id && item.playerId === player.id);
    return {
      opponentText,
      kickoffText: game ? formatKickoff(game.kickoffAt) : verifiedBye ? "No game" : "Kickoff unavailable",
      projection: weeklyProjectionFor(player),
      status: injury?.status || (verifiedBye ? "Bye" : game?.gameStatus || "Scheduled"),
    };
  };
  const seasonHasGames = scoredGames.length > 0;
  const mySchedule = useMemo(
    () =>
      allScheduledMatchups
        .map((game) => {
          if (game.homeMemberId !== me?.id && game.awayMemberId !== me?.id)
            return null;
          const opponentId =
            game.homeMemberId === me?.id
              ? game.awayMemberId
              : game.homeMemberId;
          const result = allScoredGames.find(
            (played) =>
              played.week === game.week &&
              played.homeMemberId === game.homeMemberId &&
              played.awayMemberId === game.awayMemberId,
          );
          const hasLiveScore = scores.some(
            (score) =>
              score.week === game.week &&
              (score.memberId === game.homeMemberId ||
                score.memberId === game.awayMemberId) &&
              score.players.some((player) => player.isLive),
          );
          return {
            game,
            opponent: league.members.find((member) => member.id === opponentId),
            result,
            hasLiveScore,
          };
        })
        .filter(Boolean) as {
        game: (typeof regularSeasonSchedule)[number];
        opponent?: LeagueMember;
        result?: SimulationGame;
        hasLiveScore: boolean;
      }[],
    [allScheduledMatchups, allScoredGames, scores, league.members, me?.id],
  );

  const findPlayer = (id: string) =>
    league.members
      .flatMap((member) => member.roster || [])
      .find((player) => player.id === id) ||
    PLAYERS_DATABASE.find((player) => player.id === id);
  const swapDefinition = LINEUP_SLOTS.find((slot) => slot.id === swapSlot);
  const currentSwapPlayer = roster.find(
    (player) => player.id === starters[swapSlot],
  );
  const otherStarterIds = new Set(
    Object.entries(starters)
      .filter(([slot]) => slot !== swapSlot)
      .map(([, id]) => id)
      .filter(Boolean),
  );
  const swapOptions = swapDefinition
    ? roster
        .filter(
          (player) =>
            swapDefinition.accept(player) &&
            !otherStarterIds.has(player.id) &&
            !irIds.includes(player.id),
        )
        .sort(comparePlayers)
    : [];
  const optimizeLineup = () => {
    const chosen = new Set<string>();
    const next: Record<string, string> = {};
    LINEUP_SLOTS.forEach((slot) => {
      const currentId = starters[slot.id];
      if (currentId && lockedPlayerIds.has(currentId)) {
        next[slot.id] = currentId;
        chosen.add(currentId);
      }
    });
    LINEUP_SLOTS.forEach((slot) => {
      if (next[slot.id]) return;
      const candidate = roster
        .filter((player) => !chosen.has(player.id) && !irIds.includes(player.id) && slot.accept(player))
        .sort(compareWeeklyLineupPlayers)[0];
      if (!candidate) return;
      next[slot.id] = candidate.id;
      chosen.add(candidate.id);
    });
    setStarters(next);
  };
  const startBenchPlayer = (player: Player) => {
    const eligible = LINEUP_SLOTS
      .filter((slot) => slot.accept(player))
      .filter((slot) => !lockedPlayerIds.has(starters[slot.id]))
      .sort((a, b) => {
        const aPlayer = roster.find((item) => item.id === starters[a.id]);
        const bPlayer = roster.find((item) => item.id === starters[b.id]);
        const aProjection = aPlayer ? weeklyProjectionFor(aPlayer) : -1;
        const bProjection = bPlayer ? weeklyProjectionFor(bPlayer) : -1;
        return Number(aProjection ?? -1) - Number(bProjection ?? -1);
      });
    const slot = eligible[0];
    if (!slot) {
      showToast("No eligible unlocked starter slot is available.");
      return;
    }
    setStarters((current) => ({ ...current, [slot.id]: player.id }));
  };

  const weeklyAwards = useMemo(() => {
    const games = scoredGames;
    const weeks = [
      ...new Set<number>(games.map((game) => Number(game.week))),
    ].sort((a, b) => a - b);
    return weeks
      .map((awardWeek) => {
        const entries = games
          .filter((game) => game.week === awardWeek)
          .flatMap((game) => [
            {
              memberId: game.homeMemberId,
              points: Number(game.homeScore) || 0,
            },
            {
              memberId: game.awayMemberId,
              points: Number(game.awayScore) || 0,
            },
          ])
          .sort((a, b) => b.points - a.points);
        const best = entries[0];
        const member = league.members.find(
          (item) => item.id === best?.memberId,
        );
        return best ? { week: awardWeek, points: best.points, member } : null;
      })
      .filter(Boolean) as {
      week: number;
      points: number;
      member?: LeagueMember;
    }[];
  }, [scoredGames, league.members]);

  const allBkTeam = useMemo(() => {
    const pool = league.members.flatMap((member) =>
      (member.roster || [])
        .filter((player) => STANDARD_POSITIONS.has(player.position))
        .flatMap((player) => {
          const projection = projectedPointsFor(player);
          return projection === null
            ? []
            : [{ member, player, score: projection }];
        }),
    );
    const used = new Set<string>();
    const take = (
      label: string,
      test: (player: Player) => boolean,
      count = 1,
    ) =>
      pool
        .filter((item) => test(item.player) && !used.has(item.player.id))
        .sort(
          (a, b) =>
            b.score - a.score || a.player.name.localeCompare(b.player.name),
        )
        .slice(0, count)
        .map((item) => {
          used.add(item.player.id);
          return { label, ...item };
        });
    return [
      ...take("QB", (player) => player.position === "QB"),
      ...take("RB", (player) => player.position === "RB", 2),
      ...take("WR", (player) => player.position === "WR", 2),
      ...take("TE", (player) => player.position === "TE"),
      ...take("FLEX", (player) => ["RB", "WR", "TE"].includes(player.position)),
      ...take("K", (player) => player.position === "K"),
      ...take("D/ST", (player) => player.position === "DST"),
    ];
  }, [league.members, rankingsByName]);
  const allBkHasDst = allBkTeam.some((item) => item.label === "D/ST");

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "team", label: "My Team", icon: <Users className="h-4 w-4" /> },
    { id: "matchup", label: "Matchup", icon: <Clock3 className="h-4 w-4" /> },
    { id: "players", label: "Add Players", icon: <Zap className="h-4 w-4" /> },
    { id: "league", label: "League", icon: <Trophy className="h-4 w-4" /> },
  ];

  const leagueNavItems: { id: LeagueView; label: string }[] = [
    { id: "standings", label: "Standings" },
    { id: "playoffs", label: "Playoffs" },
    { id: "power", label: "Power" },
    { id: "trades", label: "Trades" },
    { id: "activity", label: "Activity" },
    { id: "settings", label: "Settings" },
  ];

  const powerInputsFor = (standings: typeof visibleStandings) => standings.map((standing) => {
    const member = league.members.find((item) => item.id === standing.memberId)!;
    return {
      memberId: member.id,
      memberName: displayManagerName(member),
      wins: standing.wins,
      losses: standing.losses,
      ties: standing.ties,
      pointsFor: standing.pointsFor,
      pointsAgainst: standing.pointsAgainst,
      rosterProjection: (member.roster || []).reduce(
        (sum, player) => sum + (projectedPointsFor(player) || 0),
        0,
      ),
      injuryCount: injuries.filter((item) => item.memberId === member.id).length,
    };
  });
  const powerRankings = buildFantasyPowerRankings(powerInputsFor(visibleStandings));
  const latestScoredWeek = Math.max(0, ...scoredGames.map((game) => Number(game.week) || 0));
  const previousPowerRanks = new Map(
    (latestScoredWeek > 1
      ? buildFantasyPowerRankings(
          powerInputsFor(
            buildStandings(
              league.members,
              scoredGames.filter((game) => Number(game.week) < latestScoredWeek),
            ),
          ),
        )
      : []
    ).map((row) => [row.memberId, row.rank]),
  );
  const detailOwnership = detailOwnerId
    ? detailOwnerId === me?.id
      ? "mine"
      : "opponent"
    : playerAvailability;
  const detailPrimaryAction = detailPlayer
    ? fantasyPlayerAction(detailOwnership, detailPlayer.name)
    : undefined;
  const handleDetailPrimaryAction = () => {
    if (!detailPlayer || !detailPrimaryAction) return;
    if (detailPrimaryAction.kind === "trade" && detailOwnerId) {
      startTrade(detailOwnerId, detailPlayer.id);
    } else if (detailPrimaryAction.kind === "manage") {
      setTab("team");
    } else {
      setFaabPlayer(detailPlayer.id);
      setPlayerPoolView(playerAvailability === "waiver" ? "waivers" : "freeAgents");
      setTab("players");
    }
    setDetailPlayer(null);
  };

  return (
    <section className="bk-fantasy-shell space-y-2 text-white" data-fantasy-screen={tab}>
      <header className="bk-fantasy-hero hidden p-4 sm:block sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[.2em] text-[var(--bk-team-accent)]">
              Week {week} · Fantasy League
            </div>
            <h1 className="mt-1 truncate text-xl font-black uppercase sm:text-3xl">
              {league.name}
            </h1>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-500">
              <span>{league.members.length} teams</span>
              <span>•</span>
              <span>{settings.seasonGames || 17} games</span>
              <span>•</span>
              <span>
                {settings.scoringFormat === "half_ppr"
                  ? "Half PPR"
                  : settings.scoringFormat === "standard"
                    ? "Standard"
                    : "Full PPR"}
              </span>
            </div>
          </div>
          <button
            aria-label="Refresh league"
            onClick={() => void refresh()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="bk-fantasy-sticky-nav -mx-2 sm:-mx-1">
        <div aria-label="Fantasy league sections" className="bk-fantasy-subnav grid grid-cols-4 overflow-visible">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`relative flex min-h-10 min-w-0 items-center justify-center gap-1 px-1 text-[9px] font-black uppercase min-[390px]:text-[10px] ${tab === item.id ? "text-[var(--bk-team-accent)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-[var(--bk-team-accent)]" : "text-zinc-500"}`}
            >
              <span className="hidden sm:inline">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "league" && receivedTrades.length > 0 && <span aria-label={`${receivedTrades.length} trade offers`} className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] text-white">{receivedTrades.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {tab === "team" && (
        <div className="space-y-2">
          <div className="flex min-h-14 items-center justify-between gap-2 px-1 py-2">
            <div className="min-w-0">
              <h2 className="text-base font-black uppercase leading-tight">My Team</h2>
              <div className={`mt-0.5 flex items-center gap-1 text-[9px] font-black ${lineupErrors.length ? "text-amber-300" : "text-emerald-400"}`}>
                {!lineupErrors.length && <Check className="h-3 w-3" />}
                Week {week} · {lineupErrors.length ? "Lineup Invalid" : "Lineup Valid"}
              </div>
              {lineupErrors.length > 0 && <div className="mt-0.5 max-w-48 truncate text-[8px] font-bold text-amber-200">{lineupErrors[0]}</div>}
            </div>
            <button type="button" onClick={optimizeLineup} disabled={!roster.length} className="bk-fantasy-compact-button shrink-0 px-1 text-[9px] font-black uppercase text-[var(--bk-team-accent)] disabled:opacity-40">
              <Zap className="mr-1 inline h-3.5 w-3.5" />Optimize Lineup
            </button>
          </div>
          {!roster.length ? (
            <Empty text="Your roster appears here after the draft." />
          ) : (
            <>
              <RosterSection title="Starters">
                {LINEUP_SLOTS.map((slot) => {
                  const player = roster.find(
                    (item) => item.id === starters[slot.id],
                  );
                  return (
                    <LineupRow
                      key={slot.id}
                      label={slot.label}
                      player={player}
                      valueLabel={valueLabel}
                      weekContext={weeklyContextFor(player)}
                      locked={Boolean(player && lockedPlayerIds.has(player.id))}
                      onSwap={() => setSwapSlot(slot.id)}
                      onOpen={() => player && openPlayerDetail(player, me)}
                    />
                  );
                })}
              </RosterSection>
              <RosterSection title={`Bench · ${bench.length}`}>
                {[...bench].sort(comparePlayers).map((player) => (
                  <PlayerRow
                    key={player.id}
                    label="BN"
                    player={player}
                    valueLabel={valueLabel}
                    weekContext={weeklyContextFor(player)}
                    onOpen={() => openPlayerDetail(player, me)}
                    onAction={() => startBenchPlayer(player)}
                  />
                ))}
              </RosterSection>
              {lineupDirty && (
                <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-[var(--bk-team-accent)]/30 bg-[#050608]/96 p-2 shadow-[0_-12px_30px_rgba(0,0,0,.55)] backdrop-blur-xl md:sticky md:inset-x-auto md:bottom-4 md:mx-0 md:rounded-xl md:border">
                  <button
                    onClick={saveLineup}
                    disabled={busy || lineupErrors.length > 0}
                    className="bk-fantasy-action min-h-12 w-full disabled:opacity-35"
                  >
                    <Save className="mr-2 inline h-4 w-4" />
                    Save Changes ({lineupChanges})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "matchup" && (
        <div className="space-y-2">
          <div className="px-1 pt-2 sm:rounded-lg sm:border sm:border-white/10 sm:bg-[#0b0d11] sm:p-4">
            <div className="text-[9px] font-black uppercase tracking-[.18em] text-[var(--bk-team-accent)]">Head to head</div>
            <h2 className="mt-0.5 text-base font-black uppercase sm:text-xl">
              {week > maxWeek ? "Playoff" : "Week"} {week} Matchup
            </h2>
            <p className="mt-0.5 truncate text-[9px] text-zinc-500 sm:text-[10px]">
              {week > maxWeek
                ? "Winners advance after both official scores are final."
                : nextKickoff
                  ? `${nextKickoff.awayTeam} @ ${nextKickoff.homeTeam} · ${formatKickoff(nextKickoff.kickoffAt)}`
                  : "Every NFL game is final."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex min-h-9 items-center overflow-hidden rounded-full border border-white/15 bg-[#101318]">
              <button
                type="button"
                aria-label="Previous fantasy week"
                disabled={week <= 1}
                onClick={() => setWeek(current => Math.max(1, current - 1))}
                className="grid h-9 w-9 place-items-center text-lg text-zinc-300 disabled:text-zinc-700"
              >
                ‹
              </button>
              <select
                aria-label="Fantasy week"
                value={week}
                onChange={(event) => setWeek(Number(event.target.value))}
                className="h-9 min-w-20 border-x border-white/10 bg-transparent px-2 text-center text-[10px] font-black"
              >
                {Array.from({ length: maxSelectableWeek }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value > maxWeek ? `Playoff ${value}` : `Week ${value}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Next fantasy week"
                disabled={week >= maxSelectableWeek}
                onClick={() => setWeek(current => Math.min(maxSelectableWeek, current + 1))}
                className="grid h-9 w-9 place-items-center text-lg text-zinc-300 disabled:text-zinc-700"
              >
                ›
              </button>
            </div>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={showAllMatchups}
              onClick={() => setShowAllMatchups(true)}
              className="bk-fantasy-compact-button rounded-full border border-white/15 bg-[#101318] px-3 text-[9px] font-black uppercase text-zinc-200"
            >
              All Matchups
            </button>
          </div>
          {showAllMatchups && (
            <ModalPortal>
              <div
                className="flex h-full w-full justify-center overflow-y-auto bg-[#080b0f]/95 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-xl"
                onClick={() => setShowAllMatchups(false)}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="all-matchups-title"
                  className="w-full max-w-xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="sticky top-0 z-20 -mx-1 flex items-center justify-between gap-3 bg-[#080b0f]/95 px-1 pb-4 backdrop-blur-xl">
                    <div className="min-w-12" />
                    <div className="min-w-0 text-center">
                      <h2 id="all-matchups-title" className="text-lg font-black uppercase text-white">
                        All Matchups
                      </h2>
                      <p className="truncate text-xs font-bold text-zinc-500">{league.name}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close all matchups"
                      onClick={() => setShowAllMatchups(false)}
                      className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-[#11151b] text-white"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </header>

                  <div className="mb-5 flex min-h-12 w-fit items-center overflow-hidden rounded-full border border-white/15 bg-[#101318]">
                    <button
                      type="button"
                      aria-label="Previous fantasy week"
                      disabled={week <= 1}
                      onClick={() => setWeek(current => Math.max(1, current - 1))}
                      className="grid h-12 w-12 place-items-center text-2xl text-zinc-300 disabled:text-zinc-700"
                    >
                      ‹
                    </button>
                    <select
                      aria-label="All matchups fantasy week"
                      value={week}
                      onChange={(event) => setWeek(Number(event.target.value))}
                      className="h-12 min-w-28 border-x border-white/10 bg-transparent px-3 text-center text-sm font-black text-white"
                    >
                      {Array.from({ length: maxSelectableWeek }, (_, index) => index + 1).map((value) => (
                        <option key={value} value={value}>
                          {value > maxWeek ? `Playoff ${value}` : `Week ${value}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Next fantasy week"
                      disabled={week >= maxSelectableWeek}
                      onClick={() => setWeek(current => Math.min(maxSelectableWeek, current + 1))}
                      className="grid h-12 w-12 place-items-center text-2xl text-zinc-300 disabled:text-zinc-700"
                    >
                      ›
                    </button>
                  </div>

                  <div className="space-y-3">
                    {weekMatchups.map((game) => {
                      const home = league.members.find((member) => member.id === game.homeMemberId);
                      const away = league.members.find((member) => member.id === game.awayMemberId);
                      const homeScore = matchupScoreFor(home);
                      const awayScore = matchupScoreFor(away);
                      const isFinal = Boolean(homeScore?.isFinal && awayScore?.isFinal);
                      const isLive = Boolean(
                        homeScore?.players.some((player) => player.isLive) ||
                        awayScore?.players.some((player) => player.isLive),
                      );
                      const status = isFinal ? "Final" : isLive ? "Live" : "Scheduled";
                      const homeTotal = matchupTotal(homeScore, status);
                      const awayTotal = matchupTotal(awayScore, status);
                      const homeRecord = visibleStandings.find((row) => row.memberId === home?.id);
                      const awayRecord = visibleStandings.find((row) => row.memberId === away?.id);
                      const selected = viewedMatchup?.id === game.id;
                      const mine = game.homeMemberId === me?.id || game.awayMemberId === me?.id;
                      const matchupRow = (
                        member: LeagueMember | undefined,
                        total: { value: string; label: string },
                        record: (typeof visibleStandings)[number] | undefined,
                      ) => {
                        const name = displayManagerName(member);
                        return (
                          <div className="flex items-center gap-3">
                            <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#D4AF37]/30 bg-[#171b22] text-xs font-black text-[#D4AF37]">
                              {name.slice(0, 2).toUpperCase()}
                              {member?.userAvatar && (
                                <img
                                  src={member.userAvatar}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                                />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-black text-white">{name}</div>
                              <div className="mt-0.5 text-[11px] font-bold text-zinc-500">
                                {record ? `${record.wins}-${record.losses}-${record.ties}` : "0-0-0"}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`text-base font-black ${isLive ? "text-amber-300" : "text-zinc-200"}`}>
                                {total.value}
                              </div>
                              <div className="text-[9px] font-black uppercase text-zinc-600">{total.label}</div>
                            </div>
                          </div>
                        );
                      };

                      return (
                        <button
                          key={game.id}
                          type="button"
                          aria-current={selected ? "true" : undefined}
                          onClick={() => {
                            setViewedMatchupId(game.id);
                            setShowAllMatchups(false);
                          }}
                          className={`w-full rounded-2xl border p-4 text-left transition active:scale-[.99] ${selected ? "border-[#D4AF37]/60 bg-[#D4AF37]/10" : "border-white/10 bg-[#151922]"}`}
                        >
                          <div className="mb-3 flex items-center justify-between text-[9px] font-black uppercase tracking-wider">
                            <span className={mine ? "text-[#D4AF37]" : "text-zinc-600"}>
                              {mine ? "Your Matchup" : "League Matchup"}
                            </span>
                            <span className={isLive ? "text-amber-300" : "text-zinc-500"}>{status}</span>
                          </div>
                          <div className="space-y-3">
                            {matchupRow(away, awayTotal, awayRecord)}
                            <div className="h-px bg-white/5" />
                            {matchupRow(home, homeTotal, homeRecord)}
                          </div>
                        </button>
                      );
                    })}
                    {!weekMatchups.length && (
                      <Empty text={week > maxWeek ? "This playoff matchup is not set yet." : "No matchups are available for this week."} />
                    )}
                  </div>
                </section>
              </div>
            </ModalPortal>
          )}
          {viewedMatchup ? (
            <div className="space-y-3">
              <HeadToHeadMatchup
                away={viewedAway}
                home={viewedHome}
                awayScore={viewedAwayScore}
                homeScore={viewedHomeScore}
                status={viewedScoreStatus}
                injuries={injuries}
                onOpenAway={(playerId) => {
                  const player = findPlayer(playerId);
                  if (player) openPlayerDetail(player, viewedAway);
                }}
                onOpenHome={(playerId) => {
                  const player = findPlayer(playerId);
                  if (player) openPlayerDetail(player, viewedHome);
                }}
              />
              {(viewedHomeScore?.lastCorrectionAt || viewedAwayScore?.lastCorrectionAt) && (
                <div className="rounded-lg border border-sky-400/20 bg-sky-400/[.06] p-2 text-center text-[9px] font-black uppercase text-sky-300">
                  Official stat correction applied automatically
                </div>
              )}
            </div>
          ) : (
            <Empty
              text={
                week > maxWeek && !regularSeasonComplete
                  ? `Playoff seeding locks after every Week ${maxWeek} score is final.`
                  : week > postseason.nextWeek
                    ? "This matchup appears after the prior playoff round is final."
                    : "This week does not have a matchup."
              }
            />
          )}
          <Panel
            title="Full Season Schedule"
            sub="Regular season and playoffs—tap any week to open it"
            icon={<Clock3 className="h-5 w-5 text-[#D4AF37]" />}
          >
            <div className="divide-y divide-white/5">
              {mySchedule.map(
                ({
                  game,
                  opponent: scheduledOpponent,
                  result,
                  hasLiveScore,
                }) => {
                  const won = result && result.winnerId === me?.id;
                  const tied = Boolean(result?.isTie);
                  const venue = game.homeMemberId === me?.id ? "vs" : "@";
                  return (
                    <button
                      key={game.id}
                      onClick={() => setWeek(game.week)}
                      className={`flex min-h-12 w-full items-center justify-between gap-3 px-1 text-left ${week === game.week ? "text-[#D4AF37]" : "text-white"}`}
                    >
                      <span className="w-20 text-[9px] font-black uppercase">
                        {game.week > maxWeek ? "Playoffs" : "Week"} {game.week}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-black">
                        {venue} {displayManagerName(scheduledOpponent)}
                      </span>
                      <span
                        className={`shrink-0 text-[9px] font-black uppercase ${!result ? (hasLiveScore ? "text-amber-300" : "text-zinc-600") : tied ? "text-zinc-300" : won ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {result
                          ? tied
                            ? "Tie"
                            : won
                              ? "Win"
                              : "Loss"
                          : hasLiveScore
                            ? "Live"
                            : "Scheduled"}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </Panel>
        </div>
      )}

      {tab === "players" && (
        <div className="space-y-2">
          <div className="px-1 pt-2">
            <div className="text-[9px] font-black uppercase tracking-[.18em] text-[var(--bk-team-accent)]">Roster market</div>
            <h2 className="mt-0.5 text-base font-black uppercase">Add Players</h2>
          </div>
          {rankingsBusy && (
            <DataNotice text="Loading the 2026 fantasy projection board. Player actions stay available." />
          )}
          {rankingsError && (
            <DataNotice
              warning
              text="2026 fantasy projections are temporarily unavailable. Player actions still work; unranked lists use position and name only."
            />
          )}
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-[#0d1015] p-1">
            {([['freeAgents','Free Agents'],['waivers','Waivers'],['ir','IR']] as const).map(([value,label]) => (
              <button key={value} type="button" onClick={() => setPlayerPoolView(value)} className={`bk-fantasy-compact-button px-1 text-[9px] font-black uppercase ${playerPoolView === value ? "bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]" : "text-zinc-400"}`}>{label}</button>
            ))}
          </div>
          {playerPoolView !== "ir" && <Panel
            title={playerPoolView === "waivers" ? "Waiver Wire" : "Free Agents"}
            sub={
              waiverType === "faab"
                ? `$${myMeta?.faabBalance ?? 100} FAAB remaining`
                : playerAvailability === "waiver"
                  ? `Claims process daily at ${String(Number(settings.waiverProcessHourUtc ?? 9)).padStart(2, "0")}:00 UTC`
                  : "Available for an immediate add"
            }
            icon={<Search className="h-5 w-5 text-[#D4AF37]" />}
          >
            <input
              value={freeAgentQuery}
              onChange={(event) => setFreeAgentQuery(event.target.value)}
              placeholder="Search name, team or position…"
              className="min-h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-xs outline-none focus:border-[#D4AF37]/50"
            />
            <div className="grid grid-cols-7 gap-1">
              {["ALL","QB","RB","WR","TE","K","DST"].map((position) => <button key={position} type="button" title={position === "DST" ? "DEF/DST" : position} onClick={() => setPlayerPosition(position)} className={`bk-fantasy-compact-button min-w-0 px-0.5 text-[8px] font-black ${playerPosition === position ? "bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]" : "border border-white/10 text-zinc-400"}`}>{position === "DST" ? "DEF" : position === "ALL" ? "All" : position}</button>)}
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-3 text-[9px] font-black uppercase text-zinc-500">
              Sort
              <select aria-label="Sort available players" value={playerSort} onChange={(event) => setPlayerSort(event.target.value as PlayerSort)} className="min-h-11 bg-transparent text-right text-[10px] font-black text-white">
                <option value="weekly">Weekly projection</option>
                <option value="season">Season projection</option>
                <option value="rank">Overall rank</option>
              </select>
            </label>
            {((playerPoolView === "waivers") === (playerAvailability === "waiver")) ? <div className="max-h-[52dvh] overflow-y-auto rounded-lg border border-white/10">
              {visibleFreeAgents.map((player) => {
                const action = fantasyPlayerAction(playerAvailability, player.name);
                const context = weeklyContextFor(player);
                const ranking = rankingFor(player);
                return (
                <div
                  key={player.id}
                  className={`bk-fantasy-row bk-fantasy-player-row grid w-full grid-cols-[36px_minmax(0,1fr)_42px_48px] items-center gap-2 px-2 py-1.5 text-left ${faabPlayer === player.id ? "bg-[var(--bk-team-accent)]/[.08] ring-1 ring-inset ring-[var(--bk-team-accent)]/35" : ""}`}
                >
                  <Portrait player={player}/>
                  <button onClick={() => openPlayerDetail(player)} className="bk-fantasy-compact-button min-w-0 text-left">
                    <div className="truncate text-[11px] font-black">
                      {player.name}
                    </div>
                    <div className="truncate text-[8px] text-zinc-500">
                      {player.team} · {player.position} · {context?.opponentText || "Opponent TBD"}
                    </div>
                    <div className="truncate text-[7px] font-bold text-zinc-600">
                      {context?.kickoffText || "Kickoff TBD"}{ranking ? ` · #${ranking.position_rank} ${ranking.position}` : ""}
                    </div>
                  </button>
                  <div className="text-right"><div className="text-xs font-black">{context?.projection === null || context?.projection === undefined ? "—" : context.projection.toFixed(1)}</div><div className="text-[7px] font-black uppercase text-zinc-600">Proj</div></div>
                  <button onClick={() => setFaabPlayer(player.id)} className={`bk-fantasy-compact-button shrink-0 border px-2 text-[8px] font-black uppercase ${faabPlayer === player.id ? "border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]" : "border-emerald-400/50 bg-emerald-400/[.05] text-emerald-400"}`}>
                    {faabPlayer === player.id ? "Added" : action.label}
                  </button>
                </div>
              )})}
            </div> : <DataNotice text={playerPoolView === "waivers" ? "This league currently uses immediate free-agent adds. Players move here only when league rules require waivers." : "This league uses continuous waivers, so every available player must be claimed from the Waivers tab."} />}
            {faabPlayer && (
              <div className="space-y-2 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-3">
                {waiverType === "faab" && (
                  <input
                    aria-label="FAAB bid"
                    type="number"
                    min={0}
                    max={myMeta?.faabBalance ?? 100}
                    value={faabBid}
                    onChange={(event) => setFaabBid(Number(event.target.value))}
                    className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"
                    placeholder="FAAB bid"
                  />
                )}
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={dropPickerOpen}
                  onClick={() => setDropPickerOpen(true)}
                  className="flex min-h-11 w-full items-center justify-between rounded-lg bg-black/40 px-3 text-left text-xs"
                >
                  <span className={dropPlayer ? "text-white" : "text-zinc-500"}>{dropPlayer ? `${roster.find(player => player.id === dropPlayer)?.name || "Selected player"} · ${roster.find(player => player.id === dropPlayer)?.position || ""}` : activeRosterCount >= fantasyRosterSize ? "Choose player to drop" : "No drop needed"}</span>
                  <ChevronDown className="h-4 w-4 text-zinc-500"/>
                </button>
                {myPendingClaims.length > 0 && (
                  <select
                    aria-label="Conditional claim"
                    value={claimGroupId}
                    onChange={(event) => setClaimGroupId(event.target.value)}
                    className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"
                  >
                    <option value="">Independent move</option>
                    {myPendingClaims
                      .filter(
                        (claim, index, list) =>
                          list.findIndex(
                            (item) => item.claimGroupId === claim.claimGroupId,
                          ) === index,
                      )
                      .map((claim) => (
                        <option
                          key={claim.claimGroupId}
                          value={claim.claimGroupId}
                        >
                          Backup if{" "}
                          {PLAYERS_DATABASE.find(
                            (player) => player.id === claim.playerId,
                          )?.name || "earlier claim"}{" "}
                          fails
                        </option>
                      ))}
                  </select>
                )}
                <button
                  disabled={
                    busy || !memberMetaLoaded || (activeRosterCount >= fantasyRosterSize && !dropPlayer)
                  }
                  onClick={submitClaim}
                  className="bk-fantasy-action min-h-11 w-full disabled:opacity-30"
                >
                  {playerAvailability === "waiver" ? "Submit Claim" : "Add Player"}
                </button>
              </div>
            )}
            {myPendingClaims.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase text-zinc-500">
                  Your Pending Claims
                </div>
                {myPendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-black/25 px-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black">
                        #{claim.claimOrder} ·{" "}
                        {PLAYERS_DATABASE.find(
                          (player) => player.id === claim.playerId,
                        )?.name || claim.playerId}
                      </div>
                      <div className="text-[9px] text-zinc-500">
                        {waiverType === "faab"
                          ? `$${claim.faabBid} FAAB · `
                          : ""}
                        {new Date(claim.processAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      aria-label="Cancel waiver claim"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => cancelWaiverClaim(claim.id),
                          "Claim cancelled.",
                        )
                      }
                      className="min-h-10 rounded-lg border border-red-500/20 px-3 text-[9px] font-black uppercase text-red-300"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>}
          {playerPoolView === "ir" && <Panel
            title="Injured Reserve"
            sub={`${irIds.length}/${Number(settings.irSlots ?? 2)} slots used`}
            icon={<Bandage className="h-5 w-5 text-red-400" />}
          >
            {myInjuries.length ? (
              myInjuries.map((injury) => {
                const onIr = irIds.includes(injury.playerId);
                return (
                  <Action
                    key={injury.id}
                    text={`${injury.playerName} · ${injury.status}`}
                    label={onIr ? "Activate" : "Move to IR"}
                    onClick={() =>
                      run(() =>
                        setMyIrPlayer(league.id, injury.playerId, !onIr),
                      )
                    }
                  />
                );
              })
            ) : (
              <Empty text="No IR-eligible injuries." />
            )}
          </Panel>}
        </div>
      )}

      {tab === "league" && (
        <div className="space-y-3">
          <div aria-label="League tools" className="bk-fantasy-subnav bk-fantasy-subnav-scroll">
            {leagueNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setLeagueView(item.id);
                  if (item.id === "trades") setActivityView("trades");
                  if (item.id === "activity" && activityView === "trades") setActivityView("moves");
                }}
                className={`relative min-h-9 shrink-0 px-3 text-[9px] font-black uppercase ${leagueView === item.id ? "text-[var(--bk-team-accent)] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[var(--bk-team-accent)]" : "text-zinc-500"}`}
              >
                {item.label}
                {item.id === "trades" && receivedTrades.length > 0 ? ` (${receivedTrades.length})` : ""}
              </button>
            ))}
          </div>
          {leagueView === "standings" && seasonHasGames && (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Record
                label="Highest Score"
                value={
                  records.highGame
                    ? `${records.highGame.name} · ${records.highGame.score}`
                    : "—"
                }
              />
              <Record
                label="Biggest Win"
                value={
                  records.biggestBlowout
                    ? `${records.biggestBlowout.name} · +${records.biggestBlowout.margin}`
                    : "—"
                }
              />
              <Record
                label="Best Season"
                value={
                  records.bestSeason
                    ? `${records.bestSeason.name} · ${records.bestSeason.wins}-${records.bestSeason.losses}`
                    : "—"
                }
              />
              <Record
                label="Most Titles"
                value={
                  records.dynasty
                    ? `${records.dynasty.name} · ${records.dynasty.titles}`
                    : "—"
                }
              />
            </div>
          )}
          {leagueView === "playoffs" && <Panel
            title={
              champion
                ? `${displayManagerName(champion)} Is League Champion`
                : "Fantasy Playoffs"
            }
            sub={
              regularSeasonComplete
                ? `${postseason.seeds.length}-team field · higher seed advances only on an exact scoring tie`
                : "Seeds lock after all regular-season scores are final"
            }
            icon={<Trophy className="h-5 w-5 text-[#D4AF37]" />}
          >
            {regularSeasonComplete ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {postseason.seeds.map((seed, index) => (
                    <div
                      key={seed.memberId}
                      className="rounded-xl bg-black/25 p-3"
                    >
                      <div className="text-[8px] font-black uppercase text-[#D4AF37]">
                        Seed #{index + 1}
                      </div>
                      <div className="mt-1 truncate text-xs font-black">
                        {displayManagerName(
                          league.members.find(
                            (member) => member.id === seed.memberId,
                          ),
                        )}
                      </div>
                      <div className="mt-1 text-[9px] text-zinc-600">
                        {seed.wins}-{seed.losses}
                        {seed.ties ? `-${seed.ties}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
                {postseason.matchups.map((matchup) => {
                  const result = postseason.games.find(
                    (game) => game.id === matchup.id,
                  );
                  return (
                    <div
                      key={matchup.id}
                      className="rounded-xl border border-white/10 bg-black/25 p-3"
                    >
                      <div className="text-[8px] font-black uppercase tracking-wider text-zinc-600">
                        {matchup.playoffRound} · Week {matchup.week}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs font-black">
                        <span
                          className={
                            result?.winnerId === matchup.homeMemberId
                              ? "text-emerald-300"
                              : ""
                          }
                        >
                          {displayManagerName(
                            league.members.find(
                              (member) => member.id === matchup.homeMemberId,
                            ),
                          )}{" "}
                          {result ? result.homeScore : ""}
                        </span>
                        <span className="text-zinc-700">VS</span>
                        <span
                          className={`text-right ${result?.winnerId === matchup.awayMemberId ? "text-emerald-300" : ""}`}
                        >
                          {displayManagerName(
                            league.members.find(
                              (member) => member.id === matchup.awayMemberId,
                            ),
                          )}{" "}
                          {result ? result.awayScore : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {!postseason.complete && (
                  <DataNotice
                    text={`Waiting for official Week ${postseason.nextWeek} playoff scores.`}
                  />
                )}
              </div>
            ) : (
              <Empty text="The playoff bracket appears when the regular season is complete." />
            )}
          </Panel>}
          {leagueView === "standings" && <Panel
            title="League Standings"
            sub="Record, points, streak and playoff position—tap any team for its roster"
            icon={<Users className="h-5 w-5 text-[#D4AF37]" />}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_50px_42px_42px_34px] gap-1 border-b border-white/10 px-1 pb-2 text-right text-[7px] font-black uppercase tracking-wide text-zinc-600">
              <span className="text-left">Team</span><span>Record</span><span>PF</span><span>PA</span><span>Strk</span>
            </div>
            {visibleStandings.map((standing) => {
              const member = league.members.find(
                (item) => item.id === standing.memberId,
              )!;
              return (
                <button
                  key={member.id}
                  onClick={() => setSelectedTeamId(member.id)}
                  className="bk-fantasy-row grid min-h-12 w-full grid-cols-[minmax(0,1fr)_50px_42px_42px_34px] items-center gap-1 px-1 py-1.5 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-[9px] font-black text-[var(--bk-team-accent)]">#{standing.rank}</span>
                      <span className="truncate text-[11px] font-black sm:text-sm">
                        {displayManagerName(member)}
                      </span>
                      {member.isAi && <CpuBadge />}
                      {member.id === me?.id && (
                        <span className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[8px] font-black uppercase text-[#D4AF37]">
                          You
                        </span>
                      )}
                    </div>
                    <div className="ml-7 text-[9px] text-zinc-500">
                      {standing.rank <= playoffTeamCount ? `Playoff seed ${standing.rank}` : `${rosterCount(member)} players`}
                    </div>
                  </div>
                  <span className="text-right text-[9px] font-black">{standing.wins}-{standing.losses}{standing.ties ? `-${standing.ties}` : ""}</span>
                  <span className="text-right text-[9px] font-bold text-zinc-400">{standing.pointsFor.toFixed(0)}</span>
                  <span className="text-right text-[9px] font-bold text-zinc-500">{standing.pointsAgainst.toFixed(0)}</span>
                  <span className={`text-right text-[9px] font-black ${standing.streak.startsWith("W") ? "text-emerald-300" : "text-red-300"}`}>{standing.streak}</span>
                </button>
              );
            })}
          </Panel>}
          {leagueView === "settings" && <Panel
            title="League Rules"
            sub={
              isCommissioner
                ? "Tap settings to edit core fantasy rules"
                : "League settings"
            }
            icon={<Settings className="h-5 w-5 text-[#D4AF37]" />}
          >
            <button
              onClick={() => setSettingsOpen((open) => !open)}
              className="flex min-h-11 w-full items-center justify-between rounded-xl bg-black/25 px-3 text-xs font-black uppercase"
            >
              <span>{settingsOpen ? "Hide Settings" : "Open Settings"}</span>
              <ChevronRight
                className={`h-4 w-4 transition ${settingsOpen ? "rotate-90" : ""}`}
              />
            </button>
            {settingsOpen && (
              <div className="space-y-2 pt-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Rule
                    label="Scoring"
                    value={settings.scoringFormat || "ppr"}
                    disabled={!isCommissioner || scoringLocked}
                    options={[
                      ["ppr", "Full PPR"],
                      ["half_ppr", "Half PPR"],
                      ["standard", "Standard"],
                    ]}
                    onChange={(value) =>
                      updateLeagueSettings(league.id, {
                        scoringFormat: value,
                      } as any)
                    }
                  />
                  <Rule
                    label="Waivers"
                    value={waiverType}
                    disabled={!isCommissioner}
                    options={[
                      ["priority", "Rolling Priority"],
                      ["faab", "FAAB"],
                    ]}
                    onChange={(value) =>
                      updateLeagueSettings(league.id, {
                        waiverType: value,
                      } as any)
                    }
                  />
                  <Rule
                    label="Free Agents"
                    value={settings.freeAgentMode || "instant"}
                    disabled={!isCommissioner}
                    options={[
                      ["instant", "Instant Adds"],
                      ["continuous", "Continuous Waivers"],
                    ]}
                    onChange={(value) =>
                      updateLeagueSettings(league.id, {
                        freeAgentMode: value,
                      } as any)
                    }
                  />
                </div>
                <FantasyAdvancedLeagueSettings
                  league={league}
                  disabled={!isCommissioner}
                />
              </div>
            )}
          </Panel>}
        </div>
      )}

      {tab === "league" && (leagueView === "trades" || leagueView === "activity") && (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#101318] p-1">
            {(["trades", "moves", "messages"] as ActivityView[]).map((view) => (
              <button
                key={view}
                onClick={() => setActivityView(view)}
                className={`bk-fantasy-compact-button text-[9px] font-black uppercase ${activityView === view ? "bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]" : "text-zinc-400"}`}
              >
                {view}
                {view === "trades" && receivedTrades.length
                  ? ` (${receivedTrades.length})`
                  : ""}
              </button>
            ))}
          </div>
          {activityView === "trades" && (
            <div className="space-y-3">
              <Panel
                title="Trade Center"
                sub="Build a balanced offer"
                icon={<ArrowRightLeft className="h-5 w-5 text-[#D4AF37]" />}
              >
                <div ref={tradeBuilderRef} className="scroll-mt-36 space-y-2">
                  <select
                    value={tradeTarget}
                    onChange={(event) => {
                      setTradeTarget(event.target.value);
                      setTradeGet([]);
                      setTradeGive([]);
                      setTradeDrops([]);
                    }}
                    className="min-h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-xs font-bold"
                  >
                    <option value="">Choose a team</option>
                    {league.members
                      .filter((member) => member.id !== me?.id)
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {displayManagerName(member)}
                          {member.isAi ? " · CPU" : ""}
                        </option>
                      ))}
                  </select>
                  {tradeTarget && (
                    <>
                      <TeamNeedStrip member={tradePartner} />
                      <PackagePicker
                        title="You Get"
                        players={tradePartner?.roster || []}
                        selected={tradeGet}
                        onChange={setTradeGet}
                        valueLabel={valueLabel}
                      />
                      <PackagePicker
                        title="They Get"
                        players={roster}
                        selected={tradeGive}
                        onChange={setTradeGive}
                        valueLabel={valueLabel}
                      />
                      {requiredTradeDrops > 0 && (
                        <CutPicker
                          title={`Your roster cut · choose ${requiredTradeDrops}`}
                          players={roster.filter(
                            (player) => !tradeGive.includes(player.id) && !irIds.includes(player.id),
                          )}
                          selected={tradeDrops}
                          onChange={setTradeDrops}
                          max={requiredTradeDrops}
                          valueLabel={valueLabel}
                        />
                      )}
                      <TradeSizeNote
                        myCount={roster.length}
                        give={tradeGive.length}
                        get={tradeGet.length}
                        partner={tradePartner}
                      />
                      <button
                        disabled={
                          busy ||
                          !memberMetaLoaded ||
                          !tradeGive.length ||
                          !tradeGet.length ||
                          tradeDrops.length !== requiredTradeDrops
                        }
                        onClick={sendTrade}
                        className="min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase text-black disabled:opacity-35"
                      >
                        {tradePartner?.isAi
                          ? "Send Offer · CPU Decides Now"
                          : "Send Trade Offer"}
                      </button>
                    </>
                  )}
                </div>
              </Panel>

              {receivedTrades.length > 0 && (
                <Panel
                  title="Offers To You"
                  sub="Accept, reject or counter without leaving this screen"
                  icon={<Bell className="h-5 w-5 text-[#D4AF37]" />}
                >
                  {receivedTrades.map((trade) => {
                    const proposer = league.members.find(
                      (member) => member.id === trade.proposerMemberId,
                    );
                    const neededDrops = Math.max(
                      0,
                      activeRosterCount -
                        trade.requestedPlayerIds.filter(id => !irIds.includes(id)).length +
                        trade.offeredPlayerIds.length -
                        fantasyRosterSize,
                    );
                    const selectedDrops = acceptDrops[trade.id] || [];
                    return (
                      <div
                        key={trade.id}
                        className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-3"
                      >
                        <TradeSummary
                          trade={trade}
                          proposer={proposer}
                          recipient={me}
                          findPlayer={findPlayer}
                          valueLabel={valueLabel}
                        />
                        {neededDrops > 0 && (
                          <CutPicker
                            title={`Accepting requires ${neededDrops} roster cut${neededDrops === 1 ? "" : "s"}`}
                            players={roster.filter(
                              (player) =>
                                !trade.requestedPlayerIds.includes(player.id) && !irIds.includes(player.id),
                            )}
                            selected={selectedDrops}
                            onChange={(ids) =>
                              setAcceptDrops((prev) => ({
                                ...prev,
                                [trade.id]: ids,
                              }))
                            }
                            max={neededDrops}
                            valueLabel={valueLabel}
                          />
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            disabled={
                              busy || !memberMetaLoaded || selectedDrops.length !== neededDrops
                            }
                            onClick={() => actOnTrade(trade, "accepted")}
                            className="min-h-10 rounded-lg bg-emerald-500/15 text-[9px] font-black uppercase text-emerald-300 disabled:opacity-35"
                          >
                            <Check className="mr-1 inline h-3.5 w-3.5" />
                            Accept
                          </button>
                          <button
                            disabled={busy || !memberMetaLoaded}
                            onClick={() => openCounter(trade)}
                            className="min-h-10 rounded-lg border border-white/10 text-[9px] font-black uppercase"
                          >
                            Counter
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => actOnTrade(trade, "rejected")}
                            className="min-h-10 rounded-lg bg-red-500/10 text-[9px] font-black uppercase text-red-300"
                          >
                            <X className="mr-1 inline h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </Panel>
              )}

              {selectedCounter && (
                <Panel
                  title={`Counter ${displayManagerName(counterPartner)}`}
                  sub="Change either side; unequal packages are allowed"
                  icon={<ArrowRightLeft className="h-5 w-5 text-[#D4AF37]" />}
                >
                  <PackagePicker
                    title="You send"
                    players={roster}
                    selected={counterGive}
                    onChange={setCounterGive}
                    valueLabel={valueLabel}
                  />
                  <PackagePicker
                    title="You request"
                    players={counterPartner?.roster || []}
                    selected={counterGet}
                    onChange={setCounterGet}
                    valueLabel={valueLabel}
                  />
                  {requiredCounterDrops > 0 && (
                    <CutPicker
                      title={`Your roster cut · choose ${requiredCounterDrops}`}
                      players={roster.filter(
                        (player) => !counterGive.includes(player.id) && !irIds.includes(player.id),
                      )}
                      selected={counterDrops}
                      onChange={setCounterDrops}
                      max={requiredCounterDrops}
                      valueLabel={valueLabel}
                    />
                  )}
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <button
                      disabled={
                        busy ||
                        !memberMetaLoaded ||
                        !counterGive.length ||
                        !counterGet.length ||
                        counterDrops.length !== requiredCounterDrops
                      }
                      onClick={sendCounter}
                      className="min-h-11 rounded-xl bg-[#D4AF37] text-[10px] font-black uppercase text-black disabled:opacity-35"
                    >
                      Send Counter
                    </button>
                    <button
                      onClick={() => {
                        setCounterTradeId("");
                        setCounterGive([]);
                        setCounterGet([]);
                        setCounterDrops([]);
                      }}
                      className="min-h-11 rounded-xl border border-white/10 px-4 text-[10px] font-black uppercase"
                    >
                      Cancel
                    </button>
                  </div>
                </Panel>
              )}

              {sentTrades.length > 0 && (
                <Panel
                  title="Sent Offers"
                  sub="Pending with the other owner — retry a CPU decision if the first response was interrupted"
                  icon={<Clock3 className="h-5 w-5 text-zinc-500" />}
                >
                  {sentTrades.map((trade) => {
                    const recipient = league.members.find(
                      (member) => member.id === trade.recipientMemberId,
                    );
                    return (
                      <div
                        key={trade.id}
                        className="flex flex-col gap-3 rounded-xl bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-xs font-black">
                              To {displayManagerName(recipient)}
                            </div>
                            {recipient?.isAi && <CpuBadge />}
                          </div>
                          <div className="text-[9px] text-zinc-500">
                            {trade.offeredPlayerIds.length} for{" "}
                            {trade.requestedPlayerIds.length} · Pending
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                          {recipient?.isAi && (
                            <button
                              disabled={busy}
                              onClick={() => actOnTrade(trade, "accepted")}
                              className="min-h-10 rounded-lg bg-[#D4AF37] px-3 text-[9px] font-black uppercase text-black disabled:opacity-40"
                            >
                              Retry CPU Decision
                            </button>
                          )}
                          <button
                            disabled={busy}
                            onClick={() => actOnTrade(trade, "cancelled")}
                            className="min-h-10 rounded-lg border border-red-500/20 px-3 text-[9px] font-black uppercase text-red-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </Panel>
              )}

              {reviewTrades.length > 0 &&
                settings.tradeReview === "league_vote" && (
                  <Panel
                    title="League Vote"
                    sub="Trade participants cannot vote unless the commissioner fallback is required because no neutral human voters exist"
                    icon={<Gavel className="h-5 w-5 text-[#D4AF37]" />}
                  >
                    {reviewTrades.map((trade) => {
                      const participant =
                        me?.id === trade.proposerMemberId ||
                        me?.id === trade.recipientMemberId;
                      const neutralHumans = league.members.filter(
                        (member) =>
                          !member.isAi &&
                          member.id !== trade.proposerMemberId &&
                          member.id !== trade.recipientMemberId,
                      ).length;
                      const canVote =
                        !participant || (isCommissioner && neutralHumans === 0);
                      return (
                        <div
                          key={trade.id}
                          className="space-y-2 rounded-xl bg-black/25 p-3"
                        >
                          <TradeSummary
                            trade={trade}
                            proposer={league.members.find(
                              (member) => member.id === trade.proposerMemberId,
                            )}
                            recipient={league.members.find(
                              (member) => member.id === trade.recipientMemberId,
                            )}
                            findPlayer={findPlayer}
                            valueLabel={valueLabel}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              disabled={busy || !canVote}
                              onClick={() =>
                                run(async () => {
                                  const result = await voteOnFantasyTrade(
                                    trade.id,
                                    "approve",
                                  );
                                  showToast(
                                    result.status === "accepted"
                                      ? "Trade approved and completed."
                                      : `Approval saved · ${result.approvals}/${result.needed}`,
                                  );
                                })
                              }
                              className="min-h-10 rounded-lg bg-emerald-500/15 text-[9px] font-black uppercase text-emerald-300 disabled:opacity-35"
                            >
                              Approve
                            </button>
                            <button
                              disabled={busy || !canVote}
                              onClick={() =>
                                run(async () => {
                                  const result = await voteOnFantasyTrade(
                                    trade.id,
                                    "veto",
                                  );
                                  showToast(
                                    result.status === "vetoed"
                                      ? "Trade vetoed."
                                      : `Veto saved · ${result.vetoes}/${result.needed}`,
                                  );
                                })
                              }
                              className="min-h-10 rounded-lg bg-red-500/10 text-[9px] font-black uppercase text-red-300 disabled:opacity-35"
                            >
                              Veto
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </Panel>
                )}
              {isCommissioner &&
                reviewTrades.length > 0 &&
                settings.tradeReview !== "league_vote" && (
                  <Panel
                    title="Commissioner Review"
                    sub="Accepted trades waiting for a ruling"
                    icon={<Gavel className="h-5 w-5 text-[#D4AF37]" />}
                  >
                    {reviewTrades.map((trade) => (
                      <div
                        key={trade.id}
                        className="space-y-2 rounded-xl bg-black/25 p-3"
                      >
                        <TradeSummary
                          trade={trade}
                          proposer={league.members.find(
                            (member) => member.id === trade.proposerMemberId,
                          )}
                          recipient={league.members.find(
                            (member) => member.id === trade.recipientMemberId,
                          )}
                          findPlayer={findPlayer}
                          valueLabel={valueLabel}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            disabled={busy}
                            onClick={() => actOnTrade(trade, "approved")}
                            className="min-h-10 rounded-lg bg-emerald-500/15 text-[9px] font-black uppercase text-emerald-300"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => actOnTrade(trade, "vetoed")}
                            className="min-h-10 rounded-lg bg-red-500/10 text-[9px] font-black uppercase text-red-300"
                          >
                            Veto
                          </button>
                        </div>
                      </div>
                    ))}
                  </Panel>
                )}

              {!receivedTrades.length &&
                !sentTrades.length &&
                !selectedCounter && (
                  <Empty text="No pending offers. Open League, tap a team, then tap Trade for on any player." />
                )}
            </div>
          )}
          {activityView === "moves" && (
            <Panel
              title="League Moves"
              sub="Adds, drops, waivers and completed trades"
              icon={<Activity className="h-5 w-5 text-[#D4AF37]" />}
            >
              {transactions.length ? (
                transactions.slice(0, 40).map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-white/5 py-3 text-xs"
                  >
                    {item.summary}
                  </div>
                ))
              ) : (
                <Empty text="No league transactions yet." />
              )}
            </Panel>
          )}
          {activityView === "messages" && (
            <Panel
              title="Messages"
              sub={
                isCloudConfigured
                  ? "League chat, private DMs, trade threads and Trading Block"
                  : "League chat"
              }
              icon={<MessageCircle className="h-5 w-5 text-[#D4AF37]" />}
            >
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && message.trim())
                      void sendMessage();
                  }}
                  placeholder="Message the league…"
                  className="min-h-12 min-w-0 flex-1 rounded-xl bg-black/40 px-3 text-sm"
                />
                <button
                  disabled={!message.trim() || busy}
                  onClick={sendMessage}
                  className="min-h-11 rounded-xl bg-[#D4AF37] px-4 text-xs font-black text-black disabled:opacity-35"
                >
                  Send
                </button>
              </div>
              <div className="max-h-[35dvh] space-y-2 overflow-y-auto">
                {messages.length ? (
                  messages.map((item) => (
                    <div key={item.id} className="rounded-xl bg-black/30 p-3">
                      <b className="text-[10px] uppercase text-[#D4AF37]">
                        {item.memberName}
                      </b>
                      <p className="mt-1 text-sm">{item.body}</p>
                    </div>
                  ))
                ) : (
                  <Empty text="No messages yet." />
                )}
              </div>
              {isCloudConfigured && (
                <FantasyLeagueCommunications league={league} trades={trades} />
              )}
            </Panel>
          )}
        </div>
      )}

      {tab === "league" && leagueView === "power" && (
        <div className="space-y-2">
          <div className="px-1 pt-2">
            <div className="text-[9px] font-black uppercase tracking-[.2em] text-[#D4AF37]">
              Fantasy Intelligence
            </div>
            <h2 className="mt-0.5 text-base font-black uppercase">Power Rankings</h2>
            <p className="mt-0.5 text-[9px] text-zinc-500">
              Fantasy projections, record, scoring, matchup performance and availability—never Madden OVR.
            </p>
          </div>
          <Panel title="League Power Index" sub="40% roster projection · 28% record · 20% scoring · 12% matchup performance · injury adjustment" icon={<Star className="h-5 w-5 text-[#D4AF37]" />}>
            <div className="space-y-1">
              {powerRankings.map((row) => {
                const member = league.members.find((item) => item.id === row.memberId);
                const standing = visibleStandings.find((item) => item.memberId === row.memberId);
                const previousRank = previousPowerRanks.get(row.memberId);
                const movement = previousRank ? previousRank - row.rank : 0;
                return <button key={row.memberId} type="button" onClick={() => setSelectedTeamId(row.memberId)} className="bk-fantasy-row grid min-h-12 w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 px-2 text-left">
                  <span className="text-center"><span className="block font-display text-lg font-black text-[var(--bk-team-accent)]">{row.rank}</span>{previousRank ? <span className={`block text-[7px] font-black ${movement > 0 ? "text-emerald-300" : movement < 0 ? "text-red-300" : "text-zinc-600"}`}>{movement > 0 ? `▲${movement}` : movement < 0 ? `▼${Math.abs(movement)}` : "—"}</span> : null}</span>
                  <span className="min-w-0"><span className="block truncate text-xs font-black uppercase">{row.memberName}</span><span className="block truncate text-[8px] font-bold text-zinc-500">{standing ? `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ""} · ${standing.pointsFor.toFixed(1)} PF` : "Preseason"}{row.injuryCount ? ` · ${row.injuryCount} injury flag${row.injuryCount === 1 ? "" : "s"}` : ""}</span></span>
                  <span className="text-right"><span className="block text-base font-black">{row.score.toFixed(1)}</span><span className="block text-[7px] font-black uppercase text-zinc-600">Power</span></span>
                </button>;
              })}
            </div>
          </Panel>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#101318] p-1">
            <button
              onClick={() => setIntelView("awards")}
              className={`bk-fantasy-compact-button text-[9px] font-black uppercase ${intelView === "awards" ? "bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]" : "text-zinc-400"}`}
            >
              Weekly Awards
            </button>
            <button
              onClick={() => setIntelView("allbk")}
              className={`bk-fantasy-compact-button text-[9px] font-black uppercase ${intelView === "allbk" ? "bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]" : "text-zinc-400"}`}
            >
              All-BK Team
            </button>
          </div>
          {intelView === "awards" && (
            <Panel
              title="Weekly High Scores"
              sub="Only results the league actually has — no fake player stat awards"
              icon={<Medal className="h-5 w-5 text-[#D4AF37]" />}
            >
              {weeklyAwards.length ? (
                weeklyAwards.map((award) => (
                  <div
                    key={award.week}
                    className="flex items-center justify-between gap-3 border-b border-white/5 py-3"
                  >
                    <div>
                      <div className="text-[9px] font-black uppercase text-[#D4AF37]">
                        Week {award.week}
                      </div>
                      <div className="text-sm font-black">
                        {displayManagerName(award.member)}
                      </div>
                    </div>
                    <div className="text-lg font-black">
                      {award.points.toFixed(1)}
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="Weekly awards unlock after games are played." />
              )}
            </Panel>
          )}
          {intelView === "allbk" && (
            <Panel
              title={
                seasonHasGames
                  ? "All-BK Roster Value Team"
                  : "Preseason All-BK Team"
              }
              sub="QB · RB · WR · TE · FLEX · K · D/ST only, using published 2026 fantasy projection data"
              icon={<Star className="h-5 w-5 text-[#D4AF37]" />}
            >
              {rankingsBusy ? (
                <Empty text="Loading the 2026 fantasy projection board…" />
              ) : rankingsError ? (
                <Empty text="The 2026 fantasy projection board is unavailable right now. No Madden rating fallback is used." />
              ) : allBkTeam.length ? (
                <>
                  <div className="divide-y divide-white/5">
                    {allBkTeam.map((item, index) => (
                      <div
                        key={`${item.label}-${item.player.id}-${index}`}
                        className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 py-3"
                      >
                        <span className="text-[10px] font-black uppercase text-[#D4AF37]">
                          {item.label}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black">
                            {item.player.name}
                          </div>
                          <div className="flex items-center gap-1.5 truncate text-[9px] text-zinc-500">
                            <span>{displayManagerName(item.member)}</span>
                            {item.member.isAi && <CpuBadge />}
                          </div>
                        </div>
                        <div className="max-w-28 text-right text-[9px] font-black text-zinc-400">
                          {item.score.toFixed(1)} proj
                        </div>
                      </div>
                    ))}
                  </div>
                  {!allBkHasDst && (
                    <DataNotice text="D/ST projection data is not published in the current 2026 ranking feed, so Ball Knower will not invent a D/ST value." />
                  )}
                </>
              ) : (
                <Empty text="No drafted players currently have published 2026 fantasy projection data." />
              )}
            </Panel>
          )}
        </div>
      )}

      {swapSlot && swapDefinition && (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSwapSlot("");
          }}
        >
          <div className="max-h-[78dvh] w-full overflow-hidden pb-[env(safe-area-inset-bottom)] rounded-t-3xl border border-white/10 bg-[#0d1015] shadow-2xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <div className="text-[9px] font-black uppercase text-[#D4AF37]">
                  {swapDefinition.label} starter
                </div>
                <div className="text-lg font-black">
                  Swap {currentSwapPlayer?.name || "player"}
                </div>
              </div>
              <button
                aria-label="Close lineup swap"
                onClick={() => setSwapSlot("")}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[62dvh] space-y-1 overflow-y-auto p-3">
              {swapOptions.map((player) => (
                <button
                  key={player.id}
                  onClick={() => {
                    setStarters((prev) => ({ ...prev, [swapSlot]: player.id }));
                    setSwapSlot("");
                  }}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-xl p-2 text-left ${player.id === currentSwapPlayer?.id ? "border border-[#D4AF37]/30 bg-[#D4AF37]/5" : "bg-black/25"}`}
                >
                  <Portrait player={player} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black">{player.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {valueLabel(player)}
                    </div>
                  </div>
                  {player.id === currentSwapPlayer?.id ? (
                    <span className="text-[9px] font-black uppercase text-[#D4AF37]">
                      Current
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase">
                      Start
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {dropPickerOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[90] flex items-end bg-black/75 backdrop-blur-sm sm:items-center sm:justify-center"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDropPickerOpen(false);
            }}
          >
            <section role="dialog" aria-modal="true" aria-labelledby="drop-player-title" className="max-h-[78dvh] w-full overflow-hidden rounded-t-2xl border border-white/10 bg-[#0b0d11] pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-w-md sm:rounded-2xl">
              <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <h2 id="drop-player-title" className="text-sm font-black uppercase">Choose Player to Drop</h2>
                  <p className="mt-0.5 text-[9px] text-zinc-500">Lowest projected players are listed first.</p>
                </div>
                <button type="button" aria-label="Close player picker" onClick={() => setDropPickerOpen(false)} className="bk-fantasy-icon-button grid place-items-center border border-white/10"><X className="h-4 w-4"/></button>
              </header>
              <div className="max-h-[62dvh] overflow-y-auto p-2">
                {activeRosterCount < fantasyRosterSize && (
                  <button type="button" onClick={() => { setDropPlayer(""); setDropPickerOpen(false); }} className="mb-1 flex min-h-12 w-full items-center justify-between rounded-lg border border-emerald-400/20 bg-emerald-400/[.05] px-3 text-left text-xs font-black text-emerald-300">
                    No drop needed <Check className="h-4 w-4"/>
                  </button>
                )}
                {roster.filter((player) => player.id !== faabPlayer && !irIds.includes(player.id)).sort(compareLowestKnownValue).map((player) => {
                  const context = weeklyContextFor(player);
                  const selected = dropPlayer === player.id;
                  return <button key={player.id} type="button" aria-pressed={selected} onClick={() => { setDropPlayer(player.id); setDropPickerOpen(false); }} className={`bk-fantasy-player-row flex w-full items-center gap-2 border-b border-white/[.06] px-2 py-1.5 text-left ${selected ? "bg-[var(--bk-team-accent)]/[.08]" : ""}`}>
                    <Portrait player={player}/>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{player.name}</span><span className="block truncate text-[8px] text-zinc-500">{player.team} · {player.position} · {context?.opponentText || "Opponent TBD"}</span></span>
                    <span className="shrink-0 text-right"><span className="block text-xs font-black">{context?.projection === null || context?.projection === undefined ? "—" : context.projection.toFixed(1)}</span><span className="block text-[7px] font-black uppercase text-zinc-600">Proj</span></span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-[var(--bk-team-accent)]"/>}
                  </button>;
                })}
              </div>
            </section>
          </div>
        </ModalPortal>
      )}

      {selectedTeam && (
        <TeamRosterDrawer
          member={selectedTeam}
          me={me}
          comparePlayers={comparePlayers}
          valueLabel={valueLabel}
          onClose={() => setSelectedTeamId("")}
          onTrade={(playerId) => startTrade(selectedTeam.id, playerId)}
          onOpenPlayer={(player) => openPlayerDetail(player, selectedTeam)}
        />
      )}
      <FantasyPlayerDetail
        player={detailPlayer}
        ownerName={detailOwnerName}
        injuryStatus={injuries.find(item => item.playerId === detailPlayer?.id)?.status}
        ranking={detailPlayer ? rankingsByName.get(normalizeName(detailPlayer.name)) : undefined}
          primaryAction={detailPrimaryAction ? { label: detailPrimaryAction.label, onAction: handleDetailPrimaryAction } : undefined}
          onClose={() => setDetailPlayer(null)}
      />
    </section>
  );
};

const CpuBadge = () => (
  <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-sky-300">
    CPU
  </span>
);

const DataNotice = ({
  text,
  warning = false,
}: {
  text: string;
  warning?: boolean;
}) => (
  <div
    className={`rounded-xl border p-3 text-[10px] font-bold leading-4 ${warning ? "border-amber-400/20 bg-amber-400/[.05] text-amber-200" : "border-white/10 bg-white/[.03] text-zinc-400"}`}
  >
    {text}
  </div>
);

const Portrait = ({ player }: { player?: Player }) => (
  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/5 bg-white/5 sm:h-12 sm:w-12">
    {player && playerPortraitUrl(player) ? (
      <img
        src={playerPortraitUrl(player)}
        alt={`${player.name} headshot`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = playerPortraitFallbackUrl(player);
        }}
        className="h-full w-full object-cover"
      />
    ) : (
      <div className="grid h-full w-full place-items-center text-xs font-black text-zinc-600">
        {player?.name
          .split(" ")
          .map((piece) => piece[0])
          .slice(0, 2)
          .join("") || "—"}
      </div>
    )}
  </div>
);

const RosterSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0b0d11]">
    <div className="flex items-center justify-between border-b border-white/10 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.08em] text-zinc-500">
      {title}
      <span>Week Proj</span>
    </div>
    {children}
  </section>
);

type WeeklyRowContext = {
  opponentText: string;
  kickoffText: string;
  projection: number | null;
  status: string;
};

const LineupRow = ({
  label,
  player,
  valueLabel,
  weekContext,
  onSwap,
  onOpen,
  locked = false,
}: {
  label: string;
  player?: Player;
  valueLabel: (player: Player) => string;
  weekContext?: WeeklyRowContext;
  onSwap: () => void;
  onOpen: () => void;
  locked?: boolean;
}) => (
  <div className="bk-fantasy-row bk-fantasy-player-row grid grid-cols-[26px_36px_minmax(0,1fr)_34px_30px] items-center gap-1.5 px-2 py-1.5 sm:grid-cols-[38px_48px_minmax(0,1fr)_52px_58px] sm:gap-2 sm:p-2">
    <span className="grid h-6 min-w-6 place-items-center rounded-md bg-[#D4AF37]/14 px-1 text-[8px] font-black text-[#D4AF37] sm:h-9 sm:rounded-full sm:bg-[#D4AF37] sm:text-black">
      {label}
    </span>
    <Portrait player={player} />
    <button onClick={onOpen} title={player ? valueLabel(player) : undefined} className="bk-fantasy-compact-button min-w-0 text-left">
      <div className="truncate text-[11px] font-black sm:text-xs">
        {player?.name || "Empty starter"}
      </div>
      <div className="truncate text-[8px] font-bold leading-tight text-zinc-500 sm:text-[9px]">
        {player ? `${player.team} · ${player.position} · ${weekContext?.opponentText || "Opponent unavailable"}` : "Choose an eligible player"}
      </div>
      <div className="truncate text-[7px] font-bold leading-tight text-zinc-600 sm:text-[8px]">
        {locked
          ? "Game started · locked"
          : player
            ? `${weekContext?.kickoffText || "Kickoff unavailable"} · ${weekContext?.status || "Scheduled"}`
            : "Choose an eligible player"}
      </div>
    </button>
    <div className="text-right">
      <div className="text-xs font-black sm:text-sm">{weekContext?.projection === null || weekContext?.projection === undefined ? "—" : weekContext.projection.toFixed(1)}</div>
      <div className="text-[7px] font-black uppercase text-zinc-600">Proj</div>
    </div>
    <button
      disabled={locked}
      onClick={onSwap}
      aria-label={locked ? `${player?.name || "Starter"} is locked` : `Swap ${player?.name || "starter"}`}
      title={locked ? "Game started — player locked" : "Swap player"}
      className="bk-fantasy-icon-button grid place-items-center border border-[var(--bk-team-accent)]/35 bg-[var(--bk-team-accent)]/8 text-[var(--bk-team-accent)] disabled:border-white/10 disabled:text-zinc-600 sm:w-auto sm:px-2"
    >
      {locked ? <Clock3 className="h-3.5 w-3.5" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
    </button>
  </div>
);

const PlayerRow = ({
  label,
  player,
  valueLabel,
  weekContext,
  onOpen,
  onAction,
}: {
  label: string;
  player: Player;
  valueLabel: (player: Player) => string;
  weekContext?: WeeklyRowContext;
  onOpen: () => void;
  onAction: () => void;
}) => (
  <div className="bk-fantasy-row bk-fantasy-player-row grid w-full grid-cols-[26px_36px_minmax(0,1fr)_34px_30px] items-center gap-1.5 px-2 py-1.5 text-left sm:grid-cols-[38px_48px_minmax(0,1fr)_52px_58px] sm:gap-2 sm:p-2">
    <span className="grid h-6 min-w-6 place-items-center rounded-md border border-[#D4AF37]/25 px-1 text-[8px] font-black text-[#D4AF37] sm:h-9 sm:rounded-full">
      {label}
    </span>
    <Portrait player={player} />
    <button type="button" onClick={onOpen} title={valueLabel(player)} className="bk-fantasy-compact-button min-w-0 text-left">
      <div className="truncate text-[11px] font-black sm:text-xs">{player.name}</div>
      <div className="truncate text-[8px] font-bold text-zinc-500 sm:text-[9px]">
        {player.team} · {player.position} · {weekContext?.opponentText || "Opponent unavailable"}
      </div>
      <div className="truncate text-[7px] font-black uppercase text-zinc-600 sm:text-[8px]">{weekContext?.kickoffText || "Kickoff unavailable"} · {weekContext?.status || "Scheduled"}</div>
    </button>
    <div className="text-right"><div className="text-xs font-black sm:text-sm">{weekContext?.projection === null || weekContext?.projection === undefined ? "—" : weekContext.projection.toFixed(1)}</div><div className="text-[7px] font-black uppercase text-zinc-600">Proj</div></div>
    <button type="button" onClick={onAction} aria-label={`Start ${player.name}`} title="Move to starting lineup" className="bk-fantasy-icon-button grid place-items-center border border-[var(--bk-team-accent)]/30 bg-[var(--bk-team-accent)]/8 text-[var(--bk-team-accent)] sm:w-auto sm:px-2 sm:text-[9px]"><ArrowUp className="h-3.5 w-3.5 sm:hidden"/><span className="hidden sm:inline">Start</span></button>
  </div>
);

const Panel = ({
  title,
  sub,
  icon,
  children,
}: {
  title: string;
  sub: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="bk-fantasy-card space-y-2 p-3 sm:space-y-3 sm:p-4">
    <div className="flex items-start gap-2.5">
      {icon}
      <div className="min-w-0">
        <h3 className="text-sm font-black uppercase">{title}</h3>
        <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">{sub}</p>
      </div>
    </div>
    {children}
  </section>
);
const Empty = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs font-semibold leading-5 text-zinc-600">
    {text}
  </div>
);
const Action = ({
  text,
  label,
  onClick,
}: {
  text: string;
  label: string;
  onClick?: () => void;
}) => (
  <button
    disabled={!onClick}
    onClick={onClick}
    className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-white/5 text-left text-xs disabled:cursor-default"
  >
    <span>{text}</span>
    <span className="shrink-0 text-[9px] font-black uppercase text-[#D4AF37]">
      {label}
    </span>
  </button>
);
const Record = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-white/10 bg-[#101318] p-3">
    <div className="text-[8px] font-black uppercase tracking-wider text-zinc-600">
      {label}
    </div>
    <div className="mt-1 truncate text-xs font-black">{value}</div>
  </div>
);
const formatKickoff = (value?: string) => {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

const matchupTotal = (score: WeeklyScore | undefined, status: "Scheduled" | "Live" | "Final") => {
  if (!score) return { value: "—", label: status === "Scheduled" ? "Projection unavailable" : status };
  if (status === "Scheduled") {
    return score.hasProjectedTotal === true
      ? { value: score.projectedPoints.toFixed(1), label: "Projected" }
      : { value: "—", label: "Projection unavailable" };
  }
  return {
    value: score.livePoints.toFixed(1),
    label: status === "Final" ? "Final" : "Live",
  };
};

const TeamMatchupHeader = ({
  member,
  score,
  status,
  side,
}: {
  member?: LeagueMember;
  score?: WeeklyScore;
  status: "Scheduled" | "Live" | "Final";
  side: "away" | "home";
}) => {
  const total = matchupTotal(score, status);
  const name = displayManagerName(member);
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${side === "home" ? "items-end text-right" : "items-start text-left"}`}>
      <div className="max-w-full truncate text-[10px] font-black uppercase text-zinc-200">{name}</div>
      <div className={`flex items-center gap-2 ${side === "home" ? "flex-row-reverse" : ""}`}>
      <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[#D4AF37]/35 bg-[#171b22] text-[10px] font-black text-[#D4AF37] sm:h-14 sm:w-14 sm:text-xs">
        {name.slice(0, 2).toUpperCase()}
        {member?.userAvatar && (
          <img
            src={member.userAvatar}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={(event) => { event.currentTarget.style.display = "none"; }}
          />
        )}
      </div>
      <div className="min-w-0">
        <div className={`text-base font-black sm:text-xl ${status === "Live" ? "text-amber-300" : "text-white"}`}>{total.value}</div>
        <div className="truncate text-[8px] font-black uppercase text-zinc-600">{total.label}</div>
      </div>
      </div>
    </div>
  );
};

const HeadToHeadMatchup = ({
  away,
  home,
  awayScore,
  homeScore,
  status,
  injuries,
  onOpenAway,
  onOpenHome,
}: {
  away?: LeagueMember;
  home?: LeagueMember;
  awayScore?: WeeklyScore;
  homeScore?: WeeklyScore;
  status: "Scheduled" | "Live" | "Final";
  injuries: LeagueInjury[];
  onOpenAway: (playerId: string) => void;
  onOpenHome: (playerId: string) => void;
}) => {
  const projectionReady = awayScore?.hasProjectedTotal === true && homeScore?.hasProjectedTotal === true;
  const projectionSum = Number(awayScore?.projectedPoints || 0) + Number(homeScore?.projectedPoints || 0);
  const awayShare = projectionReady && projectionSum > 0
    ? Math.max(0, Math.min(100, Number(awayScore?.projectedPoints || 0) / projectionSum * 100))
    : null;
  return (
    <section aria-label={`${displayManagerName(away)} versus ${displayManagerName(home)}`} className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141a]">
      <div className="grid grid-cols-[minmax(0,1fr)_26px_minmax(0,1fr)] items-center gap-1.5 p-2 sm:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] sm:gap-2 sm:p-3">
        <TeamMatchupHeader member={away} score={awayScore} status={status} side="away" />
        <div className="text-center text-[9px] font-black uppercase text-[#D4AF37]">VS</div>
        <TeamMatchupHeader member={home} score={homeScore} status={status} side="home" />
      </div>
      {awayShare === null ? (
        <div className="border-b border-white/5 px-3 py-2 text-center text-[8px] font-black uppercase text-zinc-600">
          Matchup advantage unavailable
        </div>
      ) : (
        <div className="border-b border-white/5 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[8px] font-black uppercase text-zinc-500">
            <span>{awayShare.toFixed(0)}%</span>
            <span>Projected matchup advantage</span>
            <span>{(100 - awayShare).toFixed(0)}%</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <span className="bg-[#D4AF37]" style={{ width: `${awayShare}%` }} />
            <span className="bg-zinc-500" style={{ width: `${100 - awayShare}%` }} />
          </div>
        </div>
      )}
      </div>
      <div className="divide-y divide-white/[.04] overflow-hidden rounded-lg border border-white/[.05] bg-[#0d1015]">
        {LINEUP_SLOTS.map((slot) => {
          const awayPlayer = awayScore?.players.find((player) => player.slot === slot.id);
          const homePlayer = homeScore?.players.find((player) => player.slot === slot.id);
          const awayInjury = injuries.find((item) => item.memberId === away?.id && item.playerId === awayPlayer?.playerId);
          const homeInjury = injuries.find((item) => item.memberId === home?.id && item.playerId === homePlayer?.playerId);
          const awayProjectedEdge = status === "Scheduled" && awayPlayer?.projectionAvailable === true && homePlayer?.projectionAvailable === true && awayPlayer.projectedPoints > homePlayer.projectedPoints;
          const homeProjectedEdge = status === "Scheduled" && awayPlayer?.projectionAvailable === true && homePlayer?.projectionAvailable === true && homePlayer.projectedPoints > awayPlayer.projectedPoints;
          return (
            <div key={slot.id} className="grid grid-cols-[minmax(0,1fr)_42px_minmax(0,1fr)] items-stretch sm:grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)]">
              <MatchupPlayerSide player={awayPlayer} injury={awayInjury} align="left" projectedEdge={awayProjectedEdge} onOpen={onOpenAway} />
              <div className="grid place-items-center border-x border-white/5 bg-black/20 px-1 text-center">
                <span className="w-full rounded-md border border-[#D4AF37]/25 bg-[#D4AF37]/[.06] px-1 py-1 text-center text-[7px] font-black uppercase leading-tight text-[#D4AF37]">
                  {slot.id === "FLEX" ? "FLEX/WRT" : slot.id === "DST" ? "DST" : slot.label}
                </span>
              </div>
              <MatchupPlayerSide player={homePlayer} injury={homeInjury} align="right" projectedEdge={homeProjectedEdge} onOpen={onOpenHome} />
            </div>
          );
        })}
      </div>
    </section>
  );
};

const MatchupPlayerSide = ({
  player,
  injury,
  align,
  projectedEdge,
  onOpen,
}: {
  player?: PlayerScoreDetail;
  injury?: LeagueInjury;
  align: "left" | "right";
  projectedEdge: boolean;
  onOpen: (playerId: string) => void;
}) => {
  if (!player) {
    return <div className={`grid min-h-[3.5rem] place-items-center px-1.5 text-[8px] font-bold text-zinc-700 sm:min-h-[4.5rem] sm:px-2 sm:text-[9px] ${align === "right" ? "text-right" : "text-left"}`}>No starter</div>;
  }
  const gameLabel = player.isFinal
    ? "Final"
    : player.isLive
      ? player.status
      : player.isBye
        ? "Bye"
        : formatKickoff(player.kickoffAt);
  const opponentLabel = player.isBye
    ? "Bye"
    : player.opponent
      ? `${player.isHome === false ? "@" : "vs"} ${player.opponent}`
      : "Opponent unavailable";
  const score = player.isLive || player.isFinal
    ? player.points.toFixed(1)
    : player.projectionAvailable === true
      ? player.projectedPoints.toFixed(1)
      : "—";
  const scoreLabel = player.isLive ? "Live" : player.isFinal ? "Final" : player.projectionAvailable === true ? "Proj" : "N/A";
  return (
    <button
      type="button"
      aria-label={`Open ${player.playerName}`}
      onClick={() => onOpen(player.playerId)}
      className={`flex min-h-[3.5rem] min-w-0 items-center gap-1 rounded-lg px-1.5 py-1.5 sm:min-h-[4.5rem] sm:gap-1.5 sm:px-2 sm:py-2 ${injury ? "bg-red-950/45" : ""} ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-[10px] font-black sm:text-xs ${align === "right" ? "order-2" : ""}`}>
            {player.playerName}
          </span>
          {injury && (
            <span className="shrink-0 rounded bg-red-500/10 px-1 py-0.5 text-[7px] font-black uppercase text-red-300">
              {injury.status}
            </span>
          )}
        </div>
        <div
          className={`mt-0.5 truncate text-[8px] font-bold sm:text-[9px] ${player.isLive ? "text-amber-300" : player.isFinal ? "text-zinc-600" : "text-zinc-500"}`}
        >
          {player.team} · {opponentLabel}
        </div>
        <div className="mt-0.5 truncate text-[7px] font-black uppercase text-zinc-600 sm:text-[8px]">{gameLabel}{player.locked ? " · Locked" : ""}</div>
      </div>
      <div className={`w-8 shrink-0 ${align === "right" ? "text-left" : "text-right"}`}>
        <div className={`text-sm font-black ${player.isLive ? "text-amber-300" : projectedEdge ? "text-[#D4AF37]" : "text-white"}`}>{score}</div>
        <div className="text-[7px] font-black uppercase text-zinc-600">{scoreLabel}</div>
      </div>
    </button>
  );
};

const Rule = ({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  options: string[][];
  onChange: (value: string) => void;
}) => (
  <label className="rounded-xl bg-black/25 p-3">
    <span className="mb-1 block text-[8px] font-black uppercase text-zinc-600">
      {label}
    </span>
    <select
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-10 w-full bg-transparent text-xs font-bold disabled:text-zinc-500"
    >
      {options.map((option) => (
        <option key={option[0]} value={option[0]}>
          {option[1]}
        </option>
      ))}
    </select>
  </label>
);

const PackagePicker = ({
  title,
  players,
  selected,
  onChange,
  valueLabel,
}: {
  title: string;
  players: Player[];
  selected: string[];
  onChange: (ids: string[]) => void;
  valueLabel: (player: Player) => string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const selectedPlayers = selected.map((id) => players.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  const availablePlayers = [...players].filter((player) => !selected.includes(player.id)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <fieldset className="rounded-lg border border-white/10 bg-black/20 p-2">
      <legend className="px-1 text-[9px] font-black uppercase text-zinc-400">{title} · {selected.length}/3</legend>
      <div className="space-y-1">
        {selectedPlayers.map((player) => (
          <div key={player.id} className="flex min-h-12 items-center gap-2 rounded-lg bg-[#15181e] px-2 py-1">
            <Portrait player={player}/>
            <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-black">{player.name}</div><div className="truncate text-[8px] text-zinc-500">{player.team} · {player.position} · {valueLabel(player)}</div></div>
            <button type="button" aria-label={`Remove ${player.name} from trade`} onClick={() => onChange(selected.filter((id) => id !== player.id))} className="bk-fantasy-icon-button grid place-items-center text-zinc-500"><X className="h-3.5 w-3.5"/></button>
          </div>
        ))}
        {selected.length < 3 && (
          <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="bk-fantasy-compact-button flex w-full items-center justify-center gap-1.5 border border-dashed border-[var(--bk-team-accent)]/35 text-[9px] font-black uppercase text-[var(--bk-team-accent)]">
            <Plus className="h-3.5 w-3.5"/> Add Player
          </button>
        )}
        {expanded && (
          <div className="max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-[#07090c] p-1">
            {availablePlayers.map((player) => (
              <button type="button" key={player.id} onClick={() => { onChange([...selected, player.id]); if (selected.length >= 2) setExpanded(false); }} className="bk-fantasy-player-row flex w-full items-center gap-2 border-b border-white/[.06] px-2 py-1 text-left last:border-0">
                <Portrait player={player}/><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black">{player.name}</span><span className="block truncate text-[8px] text-zinc-500">{player.team} · {player.position} · {valueLabel(player)}</span></span><Plus className="h-3.5 w-3.5 shrink-0 text-[var(--bk-team-accent)]"/>
              </button>
            ))}
          </div>
        )}
      </div>
    </fieldset>
  );
};

const CutPicker = ({
  title,
  players,
  selected,
  onChange,
  max,
  valueLabel,
}: {
  title: string;
  players: Player[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max: number;
  valueLabel: (player: Player) => string;
}) => (
  <fieldset className="rounded-xl border border-amber-400/20 bg-amber-400/[.04] p-2">
    <legend className="px-1 text-[9px] font-black uppercase text-amber-300">
      {title} · {selected.length}/{max}
    </legend>
    <div className="max-h-44 space-y-1 overflow-y-auto">
      {[...players]
        .sort((a, b) =>
          selected.includes(a.id) === selected.includes(b.id)
            ? a.name.localeCompare(b.name)
            : selected.includes(a.id)
              ? -1
              : 1,
        )
        .map((player) => {
          const active = selected.includes(player.id);
          return (
            <button
              type="button"
              key={player.id}
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active
                    ? selected.filter((id) => id !== player.id)
                    : selected.length < max
                      ? [...selected, player.id]
                      : selected,
                )
              }
              className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${active ? "bg-amber-300 text-black" : "bg-black/30"}`}
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-black">
                  {player.name} · {player.position}
                </div>
                <div
                  className={`truncate text-[8px] ${active ? "text-black/60" : "text-zinc-600"}`}
                >
                  {valueLabel(player)}
                </div>
              </div>
              <b className="shrink-0 text-[9px] uppercase">
                {active ? "Cut ✓" : "Cut"}
              </b>
            </button>
          );
        })}
    </div>
  </fieldset>
);

const TradeSizeNote = ({
  myCount,
  give,
  get,
  partner,
}: {
  myCount: number;
  give: number;
  get: number;
  partner?: LeagueMember;
}) => (
  <div className="grid grid-cols-2 gap-2 text-center">
    <div className="rounded-xl bg-black/25 p-2">
      <div className="text-[8px] font-black uppercase text-zinc-600">
        Your roster after deal
      </div>
      <div className="mt-1 text-sm font-black">
        {myCount - give + get} before cuts
      </div>
    </div>
    <div className="rounded-xl bg-black/25 p-2">
      <div className="text-[8px] font-black uppercase text-zinc-600">
        Other team
      </div>
      <div className="mt-1 text-sm font-black">
        {Math.max(0, rosterCount(partner) - get + give)} before cuts
      </div>
    </div>
  </div>
);

const TradeSummary = ({
  trade,
  proposer,
  recipient,
  findPlayer,
  valueLabel,
}: {
  trade: TradeOffer;
  proposer?: LeagueMember;
  recipient?: LeagueMember;
  findPlayer: (id: string) => Player | undefined;
  valueLabel: (player: Player) => string;
}) => (
  <div>
    <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase">
      <span>{displayManagerName(proposer)}</span>
      <span className="text-zinc-600">→</span>
      <span>{displayManagerName(recipient)}</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      <TradeSide
        label={`${displayManagerName(proposer)} sends`}
        ownerName={displayManagerName(proposer)}
        ids={trade.offeredPlayerIds}
        findPlayer={findPlayer}
        valueLabel={valueLabel}
      />
      <TradeSide
        label={`${displayManagerName(recipient)} sends`}
        ownerName={displayManagerName(recipient)}
        ids={trade.requestedPlayerIds}
        findPlayer={findPlayer}
        valueLabel={valueLabel}
      />
    </div>
  </div>
);
const TradeSide = ({
  label,
  ownerName,
  ids,
  findPlayer,
  valueLabel,
}: {
  label: string;
  ownerName: string;
  ids: string[];
  findPlayer: (id: string) => Player | undefined;
  valueLabel: (player: Player) => string;
}) => {
  const [detailPlayer,setDetailPlayer]=useState<Player|null>(null);
  return <div className="rounded-xl bg-black/25 p-2">
    <div className="mb-1 text-[8px] font-black uppercase text-zinc-600">
      {label}
    </div>
    {ids.map((id) => {
      const player = findPlayer(id);
      return (
        <button key={id} disabled={!player} onClick={()=>player&&setDetailPlayer(player)} className="min-h-11 w-full py-1 text-left">
          <div className="truncate text-xs font-black">
            {player?.name || "Player unavailable"}
          </div>
          {player && (
            <div className="truncate text-[8px] text-zinc-600">
              {valueLabel(player)}
            </div>
          )}
        </button>
      );
    })}
    <FantasyPlayerDetail player={detailPlayer} ownerName={ownerName} onClose={()=>setDetailPlayer(null)}/>
  </div>;
};

const TeamNeedStrip = ({ member }: { member?: LeagueMember }) => {
  if (!member) return null;
  const roster = member.roster || [];
  const targets: Record<string, number> = {
    QB: 2,
    RB: 4,
    WR: 5,
    TE: 2,
    K: 1,
    DST: 1,
  };
  const counts = Object.fromEntries(
    Object.keys(targets).map((position) => [
      position,
      roster.filter((player) => player.position === position).length,
    ]),
  );
  const needs = Object.keys(targets)
    .filter((position) => counts[position] < targets[position])
    .sort(
      (a, b) =>
        counts[a] / targets[a] - counts[b] / targets[b] || a.localeCompare(b),
    )
    .slice(0, 3);
  const strengths = Object.keys(targets)
    .filter((position) => counts[position] > 0)
    .sort(
      (a, b) =>
        counts[b] / targets[b] - counts[a] / targets[a] ||
        counts[b] - targets[b] - (counts[a] - targets[a]) ||
        a.localeCompare(b),
    )
    .slice(0, 3);
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-red-500/[.06] p-2">
        <div className="text-[8px] font-black uppercase text-red-300">
          Roster needs
        </div>
        <div className="mt-1 text-[10px] font-bold">
          {needs.length
            ? needs
                .map(
                  (position) =>
                    `${position} ${counts[position]}/${targets[position]}`,
                )
                .join(" · ")
            : "No obvious depth hole"}
        </div>
      </div>
      <div className="rounded-xl bg-emerald-500/[.06] p-2">
        <div className="text-[8px] font-black uppercase text-emerald-300">
          Deepest rooms
        </div>
        <div className="mt-1 text-[10px] font-bold">
          {strengths.length
            ? strengths
                .map((position) => `${position} ${counts[position]}`)
                .join(" · ")
            : "Building"}
        </div>
      </div>
    </div>
  );
};

const TeamRosterDrawer = ({
  member,
  me,
  comparePlayers,
  valueLabel,
  onClose,
  onTrade,
  onOpenPlayer,
}: {
  member: LeagueMember;
  me?: LeagueMember;
  comparePlayers: (a: Player, b: Player) => number;
  valueLabel: (player: Player) => string;
  onClose: () => void;
  onTrade: (playerId: string) => void;
  onOpenPlayer: (player: Player) => void;
}) => {
  const roster = (member.roster || [])
    .filter((player) => STANDARD_POSITIONS.has(player.position))
    .sort(comparePlayers);
  return (
    <div
      className="fixed inset-0 z-[75] flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[88dvh] w-full overflow-hidden pb-[env(safe-area-inset-bottom)] rounded-t-3xl border border-white/10 bg-[#0d1015] shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-xl font-black uppercase">
                  {displayManagerName(member)}
                </h2>
                {member.isAi && <CpuBadge />}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {roster.length} fantasy players · tap any player to build a
                trade
              </p>
            </div>
            <button
              aria-label="Close roster"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3">
            <TeamNeedStrip member={member} />
          </div>
        </div>
        <div className="max-h-[68dvh] overflow-y-auto p-3">
          <div className="space-y-1">
            {roster.map((player) => (
              <div
                key={player.id}
                className="flex min-h-16 items-center gap-3 rounded-xl bg-black/25 p-2"
              >
                <Portrait player={player} />
                <button onClick={() => onOpenPlayer(player)} className="min-h-11 min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-[#D4AF37]">
                      {player.position}
                    </span>
                    <span className="truncate text-sm font-black">
                      {player.name}
                    </span>
                  </div>
                  <div className="truncate text-[9px] text-zinc-500">
                    {valueLabel(player)}
                  </div>
                </button>
                {member.id !== me?.id && (
                  <button
                    onClick={() => onTrade(player.id)}
                    className="min-h-10 shrink-0 rounded-lg bg-[#D4AF37] px-3 text-[8px] font-black uppercase text-black"
                  >
                    Trade for
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
