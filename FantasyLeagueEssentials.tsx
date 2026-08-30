import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRightLeft,
  Bandage,
  Banknote,
  Bell,
  Clock3,
  Crown,
  MessageCircle,
  LockKeyhole,
  RefreshCw,
  Save,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import { League, Player } from "./types";
import { PLAYERS_DATABASE } from "./players";
import { useBallKnower } from "./BallKnowerContext";
import { playerPortraitUrl } from "./playerPortraits";
import { FantasyAdvancedLeagueSettings } from "./FantasyAdvancedLeagueSettings";
import {
  fetchSeasonOperations,
  fetchFantasyCommunications,
  FantasyDmMessage,
  FantasyDmThread,
  getLeagueFreeAgents,
  LeagueInjury,
  LeagueMessage,
  LeagueTransaction,
  postLeagueMessage,
  markFantasyDmRead,
  openFantasyDm,
  removeTradingBlockEntry,
  sendFantasyDm,
  setTradingBlockEntry,
  setWatchedFantasyPlayer,
  sendTradeThreadMessage,
  TradeMessage,
  TradingBlockEntry,
  proposeTrade,
  TradeOffer,
} from "./fantasySeasonCloud";
import {
  ArchivedSeason,
  buildLeagueRecords,
  counterTrade,
  fetchFantasyParityState,
  LINEUP_SLOTS,
  MemberFantasyMeta,
  optimizeWeeklyLineup,
  saveMyWeeklyLineup,
  setMyIrPlayer,
  submitFaabClaim,
  subscribeToFantasyParity,
  validateWeeklyLineup,
  WeeklyLineup,
  WeeklyScore,
} from "./fantasyLeagueParityCloud";

type Tab = "team" | "matchup" | "players" | "league" | "activity";
type ActivityView = "overview" | "moves" | "trades" | "messages";
type MessageView = "league" | "direct" | "block";
const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "team", label: "My Team", icon: <Users className="h-4 w-4" /> },
  { id: "matchup", label: "Matchup", icon: <Activity className="h-4 w-4" /> },
  { id: "players", label: "Players", icon: <Banknote className="h-4 w-4" /> },
  { id: "league", label: "League", icon: <Trophy className="h-4 w-4" /> },
  { id: "activity", label: "Activity", icon: <Bell className="h-4 w-4" /> },
];

export const FantasyLeagueEssentials: React.FC<{ league: League }> = ({
  league,
}) => {
  const { currentUser, showToast, updateLeagueSettings } = useBallKnower();
  const me = league.members.find((member) => member.userId === currentUser?.id);
  const settings = (league.settings || {}) as any;
  const isCommissioner = currentUser?.id === league.commissionerId;
  const maxWeek = Math.max(13, Math.min(17, Number(settings.regularSeasonWeeks ?? settings.seasonGames) || 17));
  const fantasyRosterSize = Math.max(15, Math.min(20, Number(settings.rosterSize || league.liveDraft?.rounds) || 15));
  const [tab, setTab] = useState<Tab>("team");
  const [activityView, setActivityView] = useState<ActivityView>("overview");
  const [week, setWeek] = useState(
    Math.min(maxWeek, Math.max(1, Number(settings.currentWeek) || 1)),
  );
  useEffect(() => setWeek((current) => Math.min(current, maxWeek)), [maxWeek]);
  const [lineups, setLineups] = useState<WeeklyLineup[]>([]);
  const [scores, setScores] = useState<WeeklyScore[]>([]);
  const [memberMeta, setMemberMeta] = useState<MemberFantasyMeta[]>([]);
  const [archives, setArchives] = useState<ArchivedSeason[]>([]);
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [injuries, setInjuries] = useState<LeagueInjury[]>([]);
  const [messages, setMessages] = useState<LeagueMessage[]>([]);
  const [dmThreads,setDmThreads]=useState<FantasyDmThread[]>([]);
  const [dmMessages,setDmMessages]=useState<FantasyDmMessage[]>([]);
  const [tradingBlock,setTradingBlock]=useState<TradingBlockEntry[]>([]);
  const [tradeMessages,setTradeMessages]=useState<TradeMessage[]>([]);
  const [watchedPlayerIds,setWatchedPlayerIds]=useState<string[]>([]);
  const [transactions, setTransactions] = useState<LeagueTransaction[]>([]);
  const [starters, setStarters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [faabPlayer, setFaabPlayer] = useState("");
  const [faabBid, setFaabBid] = useState(1);
  const [dropPlayer, setDropPlayer] = useState("");
  const [counterTradeId, setCounterTradeId] = useState("");
  const [counterGive, setCounterGive] = useState<string[]>([]);
  const [counterGet, setCounterGet] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [messageView,setMessageView]=useState<MessageView>('league');
  const [dmTarget,setDmTarget]=useState('');
  const [activeDmThread,setActiveDmThread]=useState('');
  const [dmBody,setDmBody]=useState('');
  const [tradeMessageBodies,setTradeMessageBodies]=useState<Record<string,string>>({});
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [tradeTarget, setTradeTarget] = useState("");
  const [tradeGive, setTradeGive] = useState<string[]>([]);
  const [tradeGet, setTradeGet] = useState<string[]>([]);
  const roster = me?.roster || [];
  const refresh = async () => {
    try {
      setError("");
      const [parity, ops, communication] = await Promise.all([
        fetchFantasyParityState(league.id, week, Number(league.settings.nflSeason) || 2026),
        fetchSeasonOperations(league.id),
        fetchFantasyCommunications(league.id),
      ]);
      setLineups([...parity.lineups]);
      setScores([...parity.scores]);
      setMemberMeta([...parity.members]);
      setArchives([...parity.archives]);
      setTrades([...ops.trades]);
      setInjuries([...ops.injuries]);
      setMessages([...ops.messages]);
      setTransactions([...ops.transactions]);
      setDmThreads([...communication.dmThreads]);
      setDmMessages([...communication.dmMessages]);
      setTradingBlock([...communication.tradingBlock]);
      setTradeMessages([...communication.tradeMessages]);
      setWatchedPlayerIds([...communication.watchedPlayerIds]);
    } catch (err: any) {
      setError(err?.message || "Could not sync this league.");
    }
  };
  useEffect(() => {
    void refresh();
  }, [league.id, week]);
  useEffect(() => subscribeToFantasyParity(league.id, () => { void refresh(); }), [league.id, week]);
  const myLineup = lineups.find((item) => item.memberId === me?.id);
  useEffect(
    () =>
      setStarters(
        myLineup?.starters && Object.keys(myLineup.starters).length
          ? { ...myLineup.starters }
          : optimizeWeeklyLineup(roster),
      ),
    [me?.id, myLineup?.id, week, roster.length],
  );
  const myMeta = memberMeta.find((item) => item.memberId === me?.id);
  const irIds = myMeta?.irPlayerIds || [];
  const lineupErrors = validateWeeklyLineup(roster, starters);
  const starterIds = new Set(Object.values(starters).filter(Boolean));
  const bench = roster.filter(
    (player) => !starterIds.has(player.id) && !irIds.includes(player.id),
  );
  const freeAgents = useMemo(
    () =>
      getLeagueFreeAgents(league, PLAYERS_DATABASE)
        .filter((player) =>
          ["QB", "RB", "WR", "TE", "K", "DST"].includes(player.position),
        )
        .slice(0, 100),
    [league.members],
  );
  const records = useMemo(
    () => buildLeagueRecords(league, archives),
    [league, archives],
  );
  const receivedTrades = trades.filter(
    (trade) => trade.status === "pending" && trade.recipientMemberId === me?.id,
  );
  const selectedTeam = league.members.find(
    (member) => member.id === selectedTeamId,
  );
  const tradePartner = league.members.find(
    (member) => member.id === tradeTarget,
  );
  const selectedCounter = receivedTrades.find(
    (trade) => trade.id === counterTradeId,
  );
  const counterPartner = league.members.find(
    (member) => member.id === selectedCounter?.proposerMemberId,
  );
  const myInjuries = injuries.filter((injury) => injury.memberId === me?.id);
  const waiverType = settings.waiverType || "priority";
  const activeThread=dmThreads.find(thread=>thread.id===activeDmThread);
  const activeThreadMessages=dmMessages.filter(item=>item.threadId===activeDmThread);
  const unreadDmCount=dmThreads.reduce((count,thread)=>{
    const readAt=thread.participantA===currentUser?.id?thread.lastReadAAt:thread.lastReadBAt;
    return count+dmMessages.filter(item=>item.threadId===thread.id&&item.senderAuthId!==currentUser?.id&&Date.parse(item.createdAt)>Date.parse(readAt||'1970-01-01')).length;
  },0);
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
        bench.map((player) => player.id),
      );
    }, `Week ${week} lineup saved.`);
  const submitClaim = () =>
    run(async () => {
      if (!me || !faabPlayer) throw new Error("Choose a free agent.");
      if (roster.length >= fantasyRosterSize && !dropPlayer)
        throw new Error("Choose a player to drop.");
      await submitFaabClaim(
        league.id,
        me.id,
        faabPlayer,
        waiverType === "faab" ? faabBid : 0,
        dropPlayer || undefined,
        1,
      );
      setFaabPlayer("");
      setDropPlayer("");
    }, "Claim submitted.");
  const sendCounter = () =>
    run(async () => {
      if (
        !selectedCounter ||
        !counterGive.length ||
        counterGive.length !== counterGet.length
      )
        throw new Error("Choose the same number of players on both sides.");
      await counterTrade(selectedCounter.id, counterGive, counterGet, "");
      setCounterTradeId("");
      setCounterGive([]);
      setCounterGet([]);
    }, "Counter offer sent.");
  const sendTrade = () =>
    run(async () => {
      if (
        !me ||
        !tradeTarget ||
        !tradeGive.length ||
        tradeGive.length !== tradeGet.length
      )
        throw new Error("Choose the same number of players on both sides.");
      await proposeTrade(league, me.id, tradeTarget, tradeGive, tradeGet);
      setTradeGive([]);
      setTradeGet([]);
    }, "Trade offer sent.");
  const startTrade = (memberId: string) => {
    setTradeTarget(memberId);
    setTradeGet([]);
    setActivityView("trades");
    setTab("activity");
  };
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
  const matchup = league.seasonResult?.games.find(
    (game) =>
      game.week === week &&
      (game.homeMemberId === me?.id || game.awayMemberId === me?.id),
  );
  const opponentId = matchup
    ? matchup.homeMemberId === me?.id
      ? matchup.awayMemberId
      : matchup.homeMemberId
    : undefined;
  const opponent = league.members.find((member) => member.id === opponentId);
  const myScore = scores.find((score) => score.week === week && score.memberId === me?.id);
  const opponentScore = scores.find((score) => score.week === week && score.memberId === opponentId);
  const myPoints = matchup
    ? matchup.homeMemberId === me?.id
      ? matchup.homeScore
      : matchup.awayScore
    : 0;
  const oppPoints = matchup
    ? matchup.homeMemberId === me?.id
      ? matchup.awayScore
      : matchup.homeScore
    : 0;

  return (
    <section className="mt-3 space-y-3 pb-24">
      <div className="sticky top-16 z-20 rounded-2xl border border-white/10 bg-[#0b0e12]/95 p-2 shadow-2xl backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between px-2">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">
              {league.name}
            </div>
            <div className="text-xs font-black">Week {week}</div>
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Fantasy week"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="min-h-10 rounded-lg border border-white/10 bg-black/40 px-2 text-xs"
            >
              {Array.from({ length: maxWeek }, (_, i) => i + 1).map((value) => (
                <option key={value} value={value}>
                  Week {value}
                </option>
              ))}
            </select>
            <button
              aria-label="Refresh"
              onClick={() => void refresh()}
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/10"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[8px] font-black uppercase sm:flex-row sm:text-[10px] ${tab === item.id ? "bg-[#D4AF37] text-black" : "text-zinc-400"}`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
              {item.id === "activity" &&
                receivedTrades.length + myInjuries.length > 0 && (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] text-white">
                    {receivedTrades.length + myInjuries.length}
                  </span>
                )}
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
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-black uppercase">My Team</h2>
              <p className="text-xs text-zinc-500">
                Tap Change to swap a starter.
              </p>
            </div>
            <div
              className={`text-right text-[10px] font-black uppercase ${lineupErrors.length ? "text-amber-300" : "text-emerald-400"}`}
            >
              {lineupErrors.length ? lineupErrors[0] : "Lineup ready"}
            </div>
          </div>
          {!roster.length ? (
            <Empty text="Your team appears here when the draft ends." />
          ) : (
            <>
              <RosterSection title="Starters">
                {LINEUP_SLOTS.map((slot) => (
                  <LineupRow
                    key={slot.id}
                    label={slot.label}
                    player={roster.find(
                      (player) => player.id === starters[slot.id],
                    )}
                    eligible={roster.filter((player) => slot.accept(player))}
                    value={starters[slot.id] || ""}
                    onChange={(value) =>
                      setStarters((prev) => ({ ...prev, [slot.id]: value }))
                    }
                  />
                ))}
              </RosterSection>
              <button
                onClick={saveLineup}
                disabled={busy || lineupErrors.length > 0}
                className="min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase text-black disabled:opacity-35"
              >
                <Save className="mr-2 inline h-4 w-4" />
                Save Lineup
              </button>
              <RosterSection title={`Bench · ${bench.length}`}>
                {bench.map((player) => (
                  <PlayerRow key={player.id} label="BN" player={player} />
                ))}
              </RosterSection>
            </>
          )}
        </div>
      )}
      {tab === "matchup" && (
        <Panel
          title={`Week ${week} Matchup`}
          sub={`${me?.userName || "Your Team"} vs ${opponent?.userName || "TBD"}`}
          icon={<Clock3 className="h-5 w-5 text-zinc-600" />}
        >
          {matchup ? (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <Score
                name={me?.userName || "You"}
                points={myScore?.livePoints ?? myPoints}
                projection={myScore?.projectedPoints}
              />
              <b className="text-zinc-600">VS</b>
              <Score
                name={opponent?.userName || "Opponent"}
                points={opponentScore?.livePoints ?? oppPoints}
                projection={opponentScore?.projectedPoints}
              />
            </div>
          ) : (
            <Empty text="Your matchup appears when the schedule is ready." />
          )}
        </Panel>
      )}
      {tab === "players" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel
            title="Available Players"
            sub={
              waiverType === "faab"
                ? `$${myMeta?.faabBalance ?? 100} FAAB remaining`
                : "Free agents and waivers"
            }
            icon={<Banknote className="h-5 w-5 text-[#D4AF37]" />}
          >
            <select
              value={faabPlayer}
              onChange={(e) => setFaabPlayer(e.target.value)}
              className="min-h-12 w-full rounded-xl bg-black/40 px-3 text-xs"
            >
              <option value="">Search or choose a player</option>
              {freeAgents.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} · {player.position} · {player.team}
                </option>
              ))}
            </select>
            {waiverType === "faab" && (
              <input
                type="number"
                min={0}
                value={faabBid}
                onChange={(e) => setFaabBid(Number(e.target.value))}
                className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"
                placeholder="FAAB bid"
              />
            )}
            <select
              value={dropPlayer}
              onChange={(e) => setDropPlayer(e.target.value)}
              className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"
            >
              <option value="">
                {roster.length >= fantasyRosterSize
                  ? "Choose player to drop"
                  : "No drop needed"}
              </option>
              {roster.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
            <button
              disabled={busy || !faabPlayer}
              onClick={submitClaim}
              className="min-h-11 w-full rounded-xl bg-white text-[10px] font-black uppercase text-black disabled:opacity-30"
            >
              Submit Claim
            </button>
          </Panel>
          <Panel
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
              <Empty text="No eligible injuries." />
            )}
          </Panel>
        </div>
      )}
      {tab === "league" && (
        <div className="space-y-3">
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
          <Panel
            title="Teams & Standings"
            sub="Tap any team to view its roster"
            icon={<Users className="h-5 w-5 text-[#D4AF37]" />}
          >
            {league.members.map((member) => {
              const standing = league.seasonResult?.standings.find(
                (row) => row.memberId === member.id,
              );
              return (
                <Action
                  key={member.id}
                  text={member.userName}
                  label={`${standing ? `${standing.wins}-${standing.losses}` : "0-0"} ›`}
                  onClick={() =>
                    setSelectedTeamId(
                      selectedTeamId === member.id ? "" : member.id,
                    )
                  }
                />
              );
            })}
            {selectedTeam && (
              <div className="rounded-xl border border-[#D4AF37]/25 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black uppercase">
                      {selectedTeam.userName}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {selectedTeam.roster?.length || 0} players
                    </div>
                  </div>
                  {selectedTeam.id !== me?.id && (
                    <button
                      onClick={() => startTrade(selectedTeam.id)}
                      className="min-h-10 rounded-lg bg-[#D4AF37] px-3 text-[9px] font-black uppercase text-black"
                    >
                      Trade With Team
                    </button>
                  )}
                </div>
                <div className="mt-3 grid gap-1 sm:grid-cols-2">
                  {(selectedTeam.roster || []).map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded-lg bg-black/35 px-3 py-2 text-xs"
                    >
                      <span className="truncate">
                        <b>{player.position}</b> {player.name}
                      </span>
                      <b className="ml-2 text-[#D4AF37]">{player.ovr}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
          <Panel
            title="League Rules"
            sub={isCommissioner ? "Commissioner settings" : "View only"}
            icon={
              isCommissioner ? (
                <Crown className="h-5 w-5 text-[#D4AF37]" />
              ) : (
                <Shield className="h-5 w-5" />
              )
            }
          >
            <div className="grid gap-2 sm:grid-cols-3">
              <Rule
                label="Scoring"
                value={settings.scoringFormat || "ppr"}
                disabled={!isCommissioner}
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
                  updateLeagueSettings(league.id, { waiverType: value } as any)
                }
              />
              <Rule
                label="IR Slots"
                value={String(settings.irSlots ?? 2)}
                disabled={!isCommissioner}
                options={[
                  ["0", "0"],
                  ["1", "1"],
                  ["2", "2"],
                  ["3", "3"],
                ]}
                onChange={(value) =>
                  updateLeagueSettings(league.id, {
                    irSlots: Number(value),
                  } as any)
                }
              />
            </div>
            <FantasyAdvancedLeagueSettings league={league} disabled={!isCommissioner}/>
          </Panel>
        </div>
      )}
      {tab === "activity" && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#101318] p-1">
            {(
              ["overview", "moves", "trades", "messages"] as ActivityView[]
            ).map((view) => (
              <button
                key={view}
                onClick={() => setActivityView(view)}
                className={`min-h-11 rounded-lg text-[9px] font-black uppercase ${activityView === view ? "bg-white text-black" : "text-zinc-400"}`}
              >
                {view}
                {view === "trades" && receivedTrades.length
                  ? ` (${receivedTrades.length})`
                  : ""}
              </button>
            ))}
          </div>
          {activityView === "overview" && (
            <Panel
              title="Needs Attention"
              sub="Everything requiring action"
              icon={<Bell className="h-5 w-5 text-[#D4AF37]" />}
            >
              <Action
                text={lineupErrors[0] || "Your lineup is ready."}
                label={lineupErrors.length ? "Fix" : "✓"}
                onClick={lineupErrors.length ? () => setTab("team") : undefined}
              />
              <Action
                text={
                  receivedTrades.length
                    ? `${receivedTrades.length} trade offer waiting.`
                    : "No trades waiting."
                }
                label={receivedTrades.length ? "Open" : "✓"}
                onClick={
                  receivedTrades.length
                    ? () => setActivityView("trades")
                    : undefined
                }
              />
            </Panel>
          )}
          {activityView === "moves" && (
            <Panel
              title="League Moves"
              sub="Adds, drops and waiver receipts"
              icon={<Activity className="h-5 w-5 text-[#D4AF37]" />}
            >
              {transactions.length ? (
                transactions.slice(0, 30).map((item) => (
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
          {activityView === "trades" && (
            <div className="space-y-3">
              <Panel
                title="Build A Trade"
                sub="Select matching 1-for-1, 2-for-2, or 3-for-3 packages"
                icon={<ArrowRightLeft className="h-5 w-5 text-[#D4AF37]" />}
              >
                <select
                  value={tradeTarget}
                  onChange={(e) => {
                    setTradeTarget(e.target.value);
                    setTradeGet([]);
                  }}
                  className="min-h-12 w-full rounded-xl bg-black/40 px-3 text-xs"
                >
                  <option value="">Choose a team</option>
                  {league.members
                    .filter((member) => member.id !== me?.id)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.userName}
                      </option>
                    ))}
                </select>
                <PackagePicker title="You send" players={roster} selected={tradeGive} onChange={setTradeGive}/>
                <PackagePicker title="You receive" players={tradePartner?.roster||[]} selected={tradeGet} onChange={setTradeGet} disabled={!tradeTarget}/>
                <button
                  disabled={busy || !tradeTarget || !tradeGive.length || tradeGive.length !== tradeGet.length}
                  onClick={sendTrade}
                  className="min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase text-black disabled:opacity-35"
                >
                  Send Trade Offer
                </button>
              </Panel>
              <Panel
                title="Offers & Counters"
                sub="Review offers sent to you"
                icon={<ArrowRightLeft className="h-5 w-5 text-[#D4AF37]" />}
              >
                {receivedTrades.length ? (
                  <>
                    <select
                      value={counterTradeId}
                      onChange={(e) => setCounterTradeId(e.target.value)}
                      className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"
                    >
                      <option value="">Choose received offer</option>
                      {receivedTrades.map((trade) => (
                        <option key={trade.id} value={trade.id}>
                          {league.members.find(
                            (member) => member.id === trade.proposerMemberId,
                          )?.userName || "Owner"}
                        </option>
                      ))}
                    </select>
                    {selectedCounter && (
                      <>
                        <PackagePicker title="You send" players={roster} selected={counterGive} onChange={setCounterGive}/>
                        <PackagePicker title="You request" players={counterPartner?.roster||[]} selected={counterGet} onChange={setCounterGet}/>
                        <button
                          disabled={busy || !counterGive.length || counterGive.length !== counterGet.length}
                          onClick={sendCounter}
                          className="min-h-11 w-full rounded-xl bg-[#D4AF37] text-xs font-black text-black"
                        >
                          Send Counter
                        </button>
                        <div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] font-black uppercase text-[#D4AF37]">Trade Thread</div><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{tradeMessages.filter(item=>item.tradeId===selectedCounter.id).map(item=><div key={item.id} className={`rounded-lg px-3 py-2 text-xs ${item.senderAuthId===currentUser?.id?'ml-6 bg-[#D4AF37] text-black':'mr-6 bg-black/35'}`}>{item.body}</div>)}{!tradeMessages.some(item=>item.tradeId===selectedCounter.id)&&<div className="text-[10px] text-zinc-600">No trade messages yet.</div>}</div><div className="mt-2 flex gap-2"><input value={tradeMessageBodies[selectedCounter.id]||''} onChange={event=>setTradeMessageBodies(value=>({...value,[selectedCounter.id]:event.target.value}))} placeholder="Message about this trade…" className="min-h-11 min-w-0 flex-1 rounded-lg bg-black/40 px-3 text-xs"/><button disabled={!(tradeMessageBodies[selectedCounter.id]||'').trim()} onClick={()=>run(async()=>{await sendTradeThreadMessage(selectedCounter.id,tradeMessageBodies[selectedCounter.id]||'');setTradeMessageBodies(value=>({...value,[selectedCounter.id]:''}));},'Trade message sent.')} className="rounded-lg bg-[#D4AF37] px-3 text-[9px] font-black uppercase text-black">Send</button></div></div>
                      </>
                    )}
                  </>
                ) : (
                  <Empty text="No trade offers waiting." />
                )}
              </Panel>
            </div>
          )}
          {activityView === "messages" && (
            <Panel
              title="Messages"
              sub="League chat, owner-scoped DMs and the Trading Block"
              icon={<MessageCircle className="h-5 w-5 text-[#D4AF37]" />}
            >
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/35 p-1">{(['league','direct','block'] as MessageView[]).map(view=><button key={view} onClick={()=>setMessageView(view)} className={`min-h-11 rounded-lg text-[9px] font-black uppercase ${messageView===view?'bg-white text-black':'text-zinc-400'}`}>{view==='direct'?`DMs${unreadDmCount?` (${unreadDmCount})`:''}`:view==='block'?'Trading Block':'League Chat'}</button>)}</div>
              {messageView==='league'&&<>
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void sendMessage();
                  }}
                  placeholder="Message the league…"
                  className="min-h-12 min-w-0 flex-1 rounded-xl bg-black/40 px-3"
                />
                <button
                  disabled={!message.trim()}
                  onClick={sendMessage}
                  className="rounded-xl bg-[#D4AF37] px-4 text-xs font-black text-black"
                >
                  Send
                </button>
              </div>
              {messages.length ? (
                messages.map((item) => (
                  <div key={item.id} className="rounded-xl bg-black/30 p-3">
                    <b className="text-[10px] uppercase text-[#D4AF37]">
                      {item.memberName}
                    </b>
                    <p className="text-sm">{item.body}</p>
                  </div>
                ))
              ) : (
                <Empty text="No messages yet." />
              )}
              </>}
              {messageView==='direct'&&<div className="space-y-3">
                <div className="flex gap-2"><select aria-label="Manager to message" value={dmTarget} onChange={event=>setDmTarget(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl bg-black/40 px-3 text-xs"><option value="">Choose manager…</option>{league.members.filter(member=>!member.isAi&&member.id!==me?.id).map(member=><option key={member.id} value={member.id}>{member.userName}</option>)}</select><button disabled={!dmTarget} onClick={()=>run(async()=>{const id=await openFantasyDm(league.id,dmTarget);setActiveDmThread(id);await markFantasyDmRead(id);},'Private thread ready.')} className="rounded-xl bg-[#D4AF37] px-3 text-[9px] font-black uppercase text-black">Open DM</button></div>
                <div className="grid gap-1 sm:grid-cols-2">{dmThreads.map(thread=>{const otherId=thread.participantA===currentUser?.id?thread.participantB:thread.participantA;const other=league.members.find(member=>member.userId===otherId);const unread=dmMessages.some(item=>item.threadId===thread.id&&item.senderAuthId!==currentUser?.id&&Date.parse(item.createdAt)>Date.parse((thread.participantA===currentUser?.id?thread.lastReadAAt:thread.lastReadBAt)||'1970-01-01'));return <button key={thread.id} onClick={()=>{setActiveDmThread(thread.id);void markFantasyDmRead(thread.id).then(refresh);}} className={`flex min-h-11 items-center justify-between rounded-xl px-3 text-left text-xs font-black ${activeDmThread===thread.id?'bg-[#D4AF37] text-black':'bg-black/30'}`}><span><LockKeyhole className="mr-2 inline h-3.5 w-3.5"/>{other?.userName||'Manager'}</span>{unread&&<span className="h-2.5 w-2.5 rounded-full bg-red-400"/>}</button>})}</div>
                {activeThread&&<div className="rounded-xl border border-white/10 p-3"><div className="max-h-64 space-y-2 overflow-y-auto">{activeThreadMessages.map(item=><div key={item.id} className={`rounded-xl p-2 text-xs ${item.senderAuthId===currentUser?.id?'ml-8 bg-[#D4AF37] text-black':'mr-8 bg-black/40'}`}>{item.body}</div>)}{!activeThreadMessages.length&&<Empty text="No private messages yet."/>}</div><div className="mt-2 flex gap-2"><input value={dmBody} onChange={event=>setDmBody(event.target.value)} placeholder="Private message…" className="min-h-11 min-w-0 flex-1 rounded-xl bg-black/40 px-3 text-xs"/><button disabled={!dmBody.trim()} onClick={()=>run(async()=>{await sendFantasyDm(activeDmThread,dmBody);setDmBody('');},'DM sent.')} className="rounded-xl bg-[#D4AF37] px-4 text-xs font-black text-black">Send</button></div></div>}
              </div>}
              {messageView==='block'&&<div className="space-y-3">
                <p className="text-[10px] leading-4 text-zinc-500">Mark your players available, identify positional needs, or make them untouchable. Watch any listed player for owner-scoped alerts.</p>
                <div className="space-y-2">{tradingBlock.map(entry=>{const owner=league.members.find(member=>member.id===entry.memberId);const player=owner?.roster?.find(item=>item.id===entry.playerId)||PLAYERS_DATABASE.find(item=>item.id===entry.playerId);const mine=entry.memberId===me?.id;const watched=watchedPlayerIds.includes(entry.playerId);return <div key={`${entry.memberId}:${entry.playerId}`} className="rounded-xl bg-black/30 p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate text-xs font-black">{player?.position} {player?.name}</div><div className="text-[9px] font-black uppercase text-[#D4AF37]">{owner?.userName} · {entry.status.replace('_',' ')}{entry.lookingFor.length?` · wants ${entry.lookingFor.join('/')}`:''}</div></div>{mine?<button onClick={()=>run(()=>removeTradingBlockEntry(league.id,entry.memberId,entry.playerId),'Removed from block.')} className="min-h-10 rounded-lg border border-red-400/25 px-3 text-[9px] font-black uppercase text-red-300">Remove</button>:<button onClick={()=>run(async()=>{await setWatchedFantasyPlayer(league.id,entry.playerId,!watched);},watched?'Watch removed.':'Player watched.')} className={`min-h-10 rounded-lg px-3 text-[9px] font-black uppercase ${watched?'bg-[#D4AF37] text-black':'border border-white/10'}`}>{watched?'Watching':'Watch'}</button>}</div></div>})}{!tradingBlock.length&&<Empty text="The Trading Block is empty."/>}</div>
                {me&&<div className="rounded-xl border border-white/10 p-3"><div className="text-[9px] font-black uppercase text-zinc-500">Add one of your players</div><div className="mt-2 space-y-2">{roster.map(player=><TradingBlockAddRow key={player.id} player={player} disabled={tradingBlock.some(entry=>entry.memberId===me.id&&entry.playerId===player.id)} onSave={(status,needs)=>run(()=>setTradingBlockEntry(league.id,me.id,player.id,status,needs),'Trading Block updated.')}/>)}</div></div>}
              </div>}
            </Panel>
          )}
        </div>
      )}
    </section>
  );
};

const PackagePicker=({title,players,selected,onChange,disabled=false}:{title:string;players:Player[];selected:string[];onChange:(ids:string[])=>void;disabled?:boolean})=><fieldset disabled={disabled} className="rounded-xl border border-white/10 p-2 disabled:opacity-40"><legend className="px-1 text-[9px] font-black uppercase text-zinc-500">{title} · {selected.length}/3</legend><div className="max-h-52 space-y-1 overflow-y-auto">{players.map(player=>{const active=selected.includes(player.id);return <button type="button" key={player.id} aria-pressed={active} onClick={()=>onChange(active?selected.filter(id=>id!==player.id):selected.length<3?[...selected,player.id]:selected)} className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-xs ${active?'bg-[#D4AF37] text-black':'bg-black/30'}`}><span><b>{player.position}</b> {player.name}</span><b>{active?'✓':player.ovr}</b></button>})}</div></fieldset>;

const TradingBlockAddRow=({player,disabled,onSave}:{player:Player;disabled:boolean;onSave:(status:TradingBlockEntry['status'],needs:string[])=>void})=>{
  const [status,setStatus]=useState<TradingBlockEntry['status']>('available');
  const [need,setNeed]=useState('RB');
  return <div className="grid items-center gap-2 rounded-xl bg-black/30 p-2 sm:grid-cols-[1fr_120px_95px_76px]">
    <div className="min-w-0 truncate text-xs"><b>{player.position}</b> {player.name}</div>
    <select aria-label={`${player.name} block status`} value={status} disabled={disabled} onChange={event=>setStatus(event.target.value as TradingBlockEntry['status'])} className="min-h-10 rounded-lg bg-[#111] px-2 text-[9px] font-black uppercase"><option value="available">Available</option><option value="looking_for">Looking For</option><option value="untouchable">Untouchable</option></select>
    <select aria-label={`${player.name} desired position`} value={need} disabled={disabled||status!=='looking_for'} onChange={event=>setNeed(event.target.value)} className="min-h-10 rounded-lg bg-[#111] px-2 text-[9px] font-black uppercase disabled:opacity-35">{['QB','RB','WR','TE','K','DST'].map(position=><option key={position}>{position}</option>)}</select>
    <button type="button" disabled={disabled} onClick={()=>onSave(status,status==='looking_for'?[need]:[])} className="min-h-10 rounded-lg bg-[#D4AF37] px-2 text-[9px] font-black uppercase text-black disabled:opacity-35">{disabled?'Listed':'Add'}</button>
  </div>;
};

const RosterSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101318]">
    <div className="border-b border-white/10 px-3 py-2 text-[9px] font-black uppercase text-zinc-500">
      {title}
    </div>
    {children}
  </section>
);
const Portrait = ({ player }: { player?: Player }) => (
  <div className="h-12 w-12 overflow-hidden rounded-lg bg-white/5">
    {player && playerPortraitUrl(player) && (
      <img
        src={playerPortraitUrl(player)}
        alt=""
        className="h-full w-full object-cover"
      />
    )}
  </div>
);
const LineupRow = ({
  label,
  player,
  eligible,
  value,
  onChange,
}: {
  label: string;
  player?: Player;
  eligible: Player[];
  value: string;
  onChange: (v: string) => void;
}) => (
  <label className="grid grid-cols-[38px_48px_minmax(0,1fr)_72px] items-center gap-2 border-b border-white/5 p-2">
    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#D4AF37] text-[9px] font-black text-black">
      {label}
    </span>
    <Portrait player={player} />
    <span className="min-w-0">
      <b className="block truncate text-xs">
        {player?.name || "Empty starter"}
      </b>
      <small className="block truncate text-zinc-500">
        {player
          ? `${player.team} · ${player.position} · ${player.ovr} OVR`
          : "Choose a player"}
      </small>
    </span>
    <select
      aria-label={`${label} starter`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 min-w-0 rounded-lg bg-black/40 px-1 text-[8px]"
    >
      <option value="">Change</option>
      {eligible.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  </label>
);
const PlayerRow = ({ label, player }: { label: string; player: Player }) => (
  <div className="grid grid-cols-[38px_48px_1fr_auto] items-center gap-2 border-b border-white/5 p-2">
    <span className="grid h-9 w-9 place-items-center rounded-full border border-[#D4AF37]/30 text-[9px] font-black text-[#D4AF37]">
      {label}
    </span>
    <Portrait player={player} />
    <div className="min-w-0">
      <b className="block truncate text-xs">{player.name}</b>
      <small className="text-zinc-500">
        {player.team} · {player.position}
      </small>
    </div>
    <b>{player.ovr}</b>
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
  <section className="space-y-3 rounded-2xl border border-white/10 bg-[#101318] p-4">
    <div className="flex justify-between">
      <div>
        <h3 className="text-sm font-black uppercase">{title}</h3>
        <p className="text-[10px] text-zinc-500">{sub}</p>
      </div>
      {icon}
    </div>
    {children}
  </section>
);
const Empty = ({ text }: { text: string }) => (
  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-600">
    {text}
  </div>
);
const Score = ({
  name,
  points,
  projection,
}: {
  name: string;
  points: number;
  projection?: number;
}) => (
  <div className="rounded-xl bg-black/30 p-4 text-center">
    <small className="block truncate uppercase text-zinc-500">{name}</small>
    <b className="text-3xl">{Number(points || 0).toFixed(1)}</b>
    {projection ? (
      <small className="block text-zinc-600">
        PROJ {projection.toFixed(1)}
      </small>
    ) : null}
  </div>
);
const Record = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-[#101318] p-3">
    <small className="font-black uppercase text-[#D4AF37]">{label}</small>
    <b className="mt-1 block text-xs uppercase">{value}</b>
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
    onClick={onClick}
    disabled={!onClick}
    className="flex min-h-12 w-full items-center justify-between rounded-xl bg-black/30 px-3 text-left text-xs font-bold"
  >
    <span>{text}</span>
    <span className="text-[#D4AF37]">{label}</span>
  </button>
);
const Rule = ({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (v: string) => void;
  disabled: boolean;
}) => (
  <label className="text-[9px] font-black uppercase text-zinc-500">
    {label}
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs text-white"
    >
      {options.map(([key, text]) => (
        <option key={key} value={key}>
          {text}
        </option>
      ))}
    </select>
  </label>
);
