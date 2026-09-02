import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Shield,
  Trophy,
  Users,
  Crown,
  Search,
  Star,
  X,
  Globe2,
  LoaderCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { League, Player } from "./types";
import { useBallKnower } from "./BallKnowerContext";
import { ModeGuide } from "./ModeGuide";
import { loadUserState, saveUserState } from "./userStateCloud";
import { ModalPortal } from "./ModalPortal";
import { loadFantasyRankings } from "./fantasyRankingsCloud";
import type { FantasyRanking } from "./fantasyRankingsCloud";
import { PLAYERS_DATABASE } from "./players";
import { FantasyPlayerDetail } from "./FantasyPlayerDetail";

const RANKINGS_PAGE_SIZE = 75;
const normalizePlayerName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const fantasyPlayerFromRanking = (ranking?: FantasyRanking): Player | null => {
  if (!ranking) return null;
  const exactId = PLAYERS_DATABASE.find(player => player.id === ranking.player_key);
  const identityMatches = PLAYERS_DATABASE.filter(player => normalizePlayerName(player.name) === normalizePlayerName(ranking.player_name) && player.position === ranking.position);
  const known = exactId || (identityMatches.length === 1 ? identityMatches[0] : undefined);
  if (known) return known;
  return {
    id: ranking.player_key,
    playerId: ranking.player_key,
    name: ranking.player_name,
    team: ranking.team,
    teamId: ranking.team,
    teamCity: "",
    position: ranking.position,
    ovr: 0,
    salary: 0,
    attributes: { athleticism: 0, footballIQ: 0 },
  };
};

interface FantasyHubProps {
  view: "leagues" | "cheatsheet";
  onViewChange: (view: "leagues" | "cheatsheet") => void;
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onSelectLeague: (
    league: League,
    tab: "lobby" | "draft" | "simulation",
  ) => void;
}

export const FantasyHub: React.FC<FantasyHubProps> = ({
  view,
  onViewChange,
  onOpenCreateLeague,
  onOpenJoinLeague,
  onSelectLeague,
}) => {
  const { leagues, currentUser, joinPublicLeague } = useBallKnower();
  const memberCount = leagues.reduce(
    (sum, league) => sum + league.members.length,
    0,
  );
  const resumablePublicLeague = leagues.find(
    (league) =>
      league.settings?.leagueType === "public_free" &&
      (league.status === "drafting" ||
        league.liveDraft?.status === "active" ||
        (league.status === "completed" && !league.liveDraft)),
  );
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [fantasyRankings, setFantasyRankings] = useState<FantasyRanking[]>([]);
  const [rankingsBusy, setRankingsBusy] = useState(true);
  const [rankingsError, setRankingsError] = useState<string | null>(null);
  const [visibleRankingCount, setVisibleRankingCount] =
    useState(RANKINGS_PAGE_SIZE);
  const [publicMatchBusy, setPublicMatchBusy] = useState(false);
  const [publicMatchError, setPublicMatchError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("bk-fantasy-watchlist-v1") || "[]",
      );
    } catch {
      return [];
    }
  });
  const fantasyPositions = ["QB", "RB", "WR", "TE", "K", "DST"];
  const ranked = useMemo(() => {
    return fantasyRankings
      .filter((player) => position === "ALL" || player.position === position)
      .filter((player) =>
        `${player.player_name} ${player.team} ${player.position}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      );
  }, [fantasyRankings, position, search]);
  const visibleRanked = useMemo(
    () => ranked.slice(0, visibleRankingCount),
    [ranked, visibleRankingCount],
  );
  const hasMoreRankings = visibleRanked.length < ranked.length;
  const selectedPlayer = fantasyRankings.find(
    (player) => player.player_key === selectedPlayerId,
  );
  const selectedFantasyPlayer = useMemo(() => fantasyPlayerFromRanking(selectedPlayer), [selectedPlayer]);
  useEffect(() => {
    let active = true;
    void loadUserState<string[]>("fantasy_watchlist")
      .then((cloud) => {
        if (!active || !Array.isArray(cloud)) return;
        const clean = cloud.filter((id) => typeof id === "string");
        setWatchlist(clean);
        try {
          localStorage.setItem(
            "bk-fantasy-watchlist-v1",
            JSON.stringify(clean),
          );
        } catch {}
      })
      .catch((error) =>
        console.warn("Fantasy watchlist cloud restore failed", error),
      );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setVisibleRankingCount(RANKINGS_PAGE_SIZE);
  }, [position, search, view]);
  useEffect(() => {
    let active = true;
    setRankingsBusy(true);
    void loadFantasyRankings()
      .then((rows) => {
        if (!active) return;
        setFantasyRankings(rows);
        setRankingsError(
          rows.length ? "" : "No 2026 PPR rankings have been published yet.",
        );
      })
      .catch((error) => {
        if (!active) return;
        setRankingsError(
          error instanceof Error
            ? error.message
            : "Could not load fantasy rankings.",
        );
      })
      .finally(() => {
        if (active) setRankingsBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const toggleWatch = (id: string) =>
    setWatchlist((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      try {
        localStorage.setItem("bk-fantasy-watchlist-v1", JSON.stringify(next));
      } catch {}
      void saveUserState("fantasy_watchlist", next).catch((error) =>
        console.warn("Fantasy watchlist cloud save failed", error),
      );
      return next;
    });
  const enterPublicLeague = async () => {
    if (publicMatchBusy) return;
    if (resumablePublicLeague) {
      onSelectLeague(
        resumablePublicLeague,
        resumablePublicLeague.liveDraft?.status === "active"
          ? "draft"
          : "lobby",
      );
      return;
    }
    setPublicMatchBusy(true);
    setPublicMatchError(null);
    try {
      const result = await joinPublicLeague();
      if (result.success && result.league) {
        onSelectLeague(result.league, "lobby");
        return;
      }
      setPublicMatchError(result.message);
    } catch (err: any) {
      setPublicMatchError(
        err?.message || "Could not enter public matchmaking.",
      );
    } finally {
      setPublicMatchBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-7rem)] px-4 pb-10 pt-5 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="grid flex-1 grid-cols-2 rounded-2xl border border-white/10 bg-[#0b0d10] p-1">
            <button
              onClick={() => onViewChange("leagues")}
              className={`min-h-11 rounded-xl text-xs font-black uppercase ${view === "leagues" ? "bg-[#D4AF37] text-black" : "text-zinc-400"}`}
            >
              League HQ
            </button>
            <button
              onClick={() => onViewChange("cheatsheet")}
              className={`min-h-11 rounded-xl text-xs font-black uppercase ${view === "cheatsheet" ? "bg-[#D4AF37] text-black" : "text-zinc-400"}`}
            >
              Cheat Sheet
            </button>
          </div>
          <ModeGuide
            storageKey="bk-guide-fantasy-hq-v3"
            title="Fantasy"
            summary="Use the Cheat Sheet for projected-versus-actual player rankings. League HQ is where you create, join and manage leagues."
            steps={[
              "Open Cheat Sheet for the full-PPR player board.",
              "Compare the 2026 projection with the 2025 actual score and movement arrow.",
              "Tap a player for the reasoning and data sources.",
            ]}
          />
        </div>
        {view === "leagues" && (
          <>
            <section className="relative mb-3 overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-[#080a0d] p-4 shadow-2xl sm:mb-7 sm:rounded-[2rem] sm:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_38%,rgba(212,175,55,.22),transparent_24%),radial-gradient(circle_at_15%_100%,rgba(212,175,55,.10),transparent_35%),linear-gradient(115deg,#070809,#111318_55%,#060708)]" />
              <div className="pointer-events-none absolute -right-8 top-5 hidden h-64 w-64 place-items-center rounded-full border border-[#D4AF37]/15 bg-black/30 shadow-[0_0_90px_rgba(212,175,55,.16)] sm:grid">
                <Trophy
                  className="h-36 w-36 text-[#D4AF37]/80"
                  strokeWidth={1}
                />
              </div>
              <div className="relative z-10 max-w-2xl">
                <div className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[.25em] text-[#D4AF37] sm:mb-3 sm:text-[11px] sm:tracking-[.3em]">
                  <Trophy className="h-4 w-4" /> Fantasy
                </div>
                <h2 className="font-display text-4xl font-black uppercase leading-[.88] tracking-[-.045em] sm:text-7xl">
                  League <span className="text-[#D4AF37]">HQ</span>
                </h2>
                <h3 className="mt-2 text-base font-black uppercase leading-tight sm:mt-5 sm:text-2xl">
                  Create, join, or enter a free public league.
                </h3>
                <p className="mt-2 max-w-xl text-xs font-semibold leading-relaxed text-zinc-400 sm:mt-3 sm:text-sm">
                  Choose how draft order is decided, invite your crew, and run
                  the league from one place.
                </p>
                <div className="mt-5 hidden items-center gap-3 text-xs font-black uppercase tracking-wider text-zinc-300 sm:flex">
                  <div className="flex -space-x-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#090a0d] bg-zinc-800 text-[10px] text-[#D4AF37]"
                      >
                        BK
                      </div>
                    ))}
                  </div>
                  <span>{memberCount || 0} league members</span>
                </div>
              </div>
            </section>

            <div className="mb-5 grid gap-2 sm:mb-9 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              <button
                onClick={() => void enterPublicLeague()}
                disabled={publicMatchBusy}
                className="group flex min-h-20 items-center gap-3 rounded-2xl border border-emerald-300/45 bg-emerald-300 p-3 text-left text-[#07100c] shadow-lg shadow-emerald-300/10 transition active:scale-[.99] disabled:opacity-60 sm:min-h-28 sm:gap-4 sm:p-5"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/15 bg-black/5 sm:h-12 sm:w-12">
                  {publicMatchBusy ? (
                    <LoaderCircle className="h-5 w-5 animate-spin sm:h-6 sm:w-6" />
                  ) : (
                    <Globe2 className="h-5 w-5 sm:h-6 sm:w-6" />
                  )}
                </div>
                <div>
                  <div className="text-base font-black uppercase sm:text-xl">
                    {resumablePublicLeague
                      ? "Resume Public League"
                      : "Public Free League"}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold leading-4 text-black/65 sm:mt-1 sm:text-xs">
                    {resumablePublicLeague
                      ? `${resumablePublicLeague.code} · Continue your saved ${resumablePublicLeague.liveDraft?.status === "active" ? "live draft" : "league setup"}.`
                      : "Real people first. CPU fills open spots only when you choose."}
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 transition group-hover:translate-x-1 sm:h-6 sm:w-6" />
              </button>
              <button
                onClick={onOpenCreateLeague}
                className="group flex min-h-20 items-center gap-3 rounded-2xl border border-[#D4AF37]/50 bg-[#D4AF37] p-3 text-left text-black shadow-lg shadow-[#D4AF37]/10 transition active:scale-[.99] sm:min-h-28 sm:gap-4 sm:p-5"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-black/15 bg-black/5 sm:h-12 sm:w-12">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <div className="text-base font-black uppercase sm:text-xl">
                    Create League
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold leading-4 text-black/65 sm:mt-1 sm:text-xs">
                    Start a league, then pick one of three draft-order methods.
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 transition group-hover:translate-x-1 sm:h-6 sm:w-6" />
              </button>
              <button
                onClick={onOpenJoinLeague}
                className="group flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-[#111318]/95 p-3 text-left transition hover:border-[#D4AF37]/40 active:scale-[.99] sm:min-h-28 sm:gap-4 sm:p-5"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 sm:h-12 sm:w-12">
                  <Users className="h-5 w-5 text-[#D4AF37] sm:h-6 sm:w-6" />
                </div>
                <div>
                  <div className="text-base font-black uppercase sm:text-xl">
                    Join With Code
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold leading-4 text-zinc-400 sm:mt-1 sm:text-xs">
                    Enter the commissioner’s code and join instantly.
                  </div>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[#D4AF37] transition group-hover:translate-x-1 sm:h-6 sm:w-6" />
              </button>
            </div>
            {publicMatchError && (
              <div className="-mt-6 mb-8 rounded-xl border border-red-400/25 bg-red-400/5 p-3 text-xs font-bold text-red-300">
                {publicMatchError}
              </div>
            )}

            <div className="mb-4 flex items-end justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-display text-2xl font-black uppercase">
                  Your Leagues
                </h3>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  {leagues.length} active or saved league
                  {leagues.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={onOpenCreateLeague}
                className="min-h-11 rounded-lg border border-[#D4AF37]/35 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#D4AF37]"
              >
                + New League
              </button>
            </div>

            {leagues.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-[#101216]/90 p-10 text-center">
                <Trophy className="mx-auto mb-3 h-10 w-10 text-[#D4AF37]/60" />
                <div className="font-black uppercase">
                  Your trophy case is empty
                </div>
                <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
                  Create your first league or join your friends with a code.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {leagues.map((league) => {
                  const mine = league.members.find(
                    (m) => m.userId === currentUser?.id,
                  );
                  const submitted = league.members.filter(
                    (m) => m.status === "ready",
                  ).length;
                  const completed = league.status === "completed";
                  const isPublic =
                    league.settings?.leagueType === "public_free";
                  const humans = league.members.filter(
                    (member) => !member.isAi,
                  ).length;
                  const cpu = league.members.length - humans;
                  return (
                    <article
                      key={league.id}
                      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1014]/95 p-5 shadow-xl sm:p-6"
                    >
                      <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_80%_45%,rgba(212,175,55,.12),transparent_55%)]" />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                              {league.commissionerId === currentUser?.id && (
                                <>
                                  <Crown className="h-3.5 w-3.5" /> Commissioner
                                  ·{" "}
                                </>
                              )}
                              {isPublic && <>Public Free · </>}
                              {league.code}
                            </div>
                            <h4 className="mt-2 font-display text-2xl font-black uppercase sm:text-3xl">
                              {league.name}
                            </h4>
                            <div className="mt-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
                              {league.members.length}/{league.maxMembers} teams
                              ·{" "}
                              {completed
                                ? "Complete"
                                : isPublic
                                  ? `${humans} human${humans === 1 ? "" : "s"} · ${cpu} CPU`
                                  : "Private league"}
                            </div>
                          </div>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-2 border-y border-white/5 py-4 sm:grid-cols-4">
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                              Current Phase
                            </div>
                            <div className="mt-1 text-sm font-black text-[#D4AF37]">
                              {completed
                                ? "FINAL"
                                : league.status === "simulating"
                                  ? "SIMULATING"
                                  : submitted === league.members.length &&
                                      submitted > 1
                                    ? "READY"
                                    : "DRAFT"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                              Owners Ready
                            </div>
                            <div className="mt-1 text-sm font-black">
                              {submitted}/{league.members.length}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                              Your Roster
                            </div>
                            <div className="mt-1 text-sm font-black">
                              {mine?.status === "ready" ? "LOCKED" : "BUILD"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                              {league.liveDraft?.status === "completed"
                                ? "Format"
                                : "Cap"}
                            </div>
                            <div className="mt-1 text-sm font-black">
                              {league.liveDraft?.status === "completed"
                                ? "PPR"
                                : `${league.salaryCap}M`}
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button
                            onClick={() =>
                              onSelectLeague(
                                league,
                                completed ? "simulation" : "lobby",
                              )
                            }
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-xs font-black uppercase tracking-wider hover:border-[#D4AF37]/35"
                          >
                            {completed ? (
                              <Trophy className="h-4 w-4" />
                            ) : (
                              <Users className="h-4 w-4" />
                            )}
                            {completed ? "View Results" : "League Lobby"}
                          </button>
                          {!completed && (
                            <button
                              onClick={() => onSelectLeague(league, "draft")}
                              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-xs font-black uppercase tracking-wider text-black"
                            >
                              {mine?.status === "ready"
                                ? "View Draft Board"
                                : "Build Your Team"}
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0d10]/90 p-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.22em] text-[#D4AF37]">
                  League Command Center
                </div>
                <p className="mt-1 text-xs font-semibold text-zinc-500">
                  Open a league above to manage its lobby, roster, draft and
                  results.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onOpenJoinLeague}
                  className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-300"
                >
                  Join Code
                </button>
                <button
                  onClick={onOpenCreateLeague}
                  className="min-h-11 rounded-xl bg-[#D4AF37] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black"
                >
                  New League
                </button>
              </div>
            </div>
          </>
        )}
        {view === "cheatsheet" && (
          <section className="rounded-[2rem] border border-[#D4AF37]/35 bg-[#0b0e12] p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.25em] text-[#D4AF37]">
                  2026 draft rankings · Full PPR
                </div>
                <h2 className="mt-1 font-display text-4xl font-black uppercase">
                  Player Cheat Sheet
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Draft rank, 2026 projected points, 2025 actual points, and the
                  football case behind every move.
                </p>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-black text-zinc-400">
                {watchlist.length} MY GUYS
              </div>
            </div>
            <div className="mt-4 space-y-2 border-y border-white/10 bg-black/90 py-3">
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#111] px-3">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search player, team or position"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </label>
              <div className="flex gap-2 overflow-x-auto">
                {["ALL", ...fantasyPositions].map((item) => (
                  <button
                    key={item}
                    onClick={() => setPosition(item)}
                    className={`min-h-10 shrink-0 rounded-full px-4 text-[10px] font-black ${position === item ? "bg-[#D4AF37] text-black" : "border border-white/10 text-zinc-400"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="px-1 text-[9px] font-black uppercase tracking-wider text-zinc-600">
                Showing {Math.min(visibleRankingCount, ranked.length)} of{" "}
                {ranked.length} players
              </div>
            </div>
            {rankingsBusy ? (
              <div className="grid min-h-48 place-items-center">
                <LoaderCircle className="h-7 w-7 animate-spin text-[#D4AF37]" />
              </div>
            ) : rankingsError ? (
              <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/5 p-5 text-red-200">
                <AlertTriangle className="h-6 w-6" />
                <h3 className="mt-3 font-black uppercase">
                  Rankings unavailable
                </h3>
                <p className="mt-2 text-xs leading-5 text-red-100/70">
                  {rankingsError}
                </p>
              </div>
            ) : (
              <>
                <div className="mt-3 divide-y divide-white/5">
                  {visibleRanked.map((player) => {
                    const up = player.point_change !== null && player.point_change >= 0;
                    return (
                      <article key={player.player_key} className="py-4">
                        <div className="grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-3">
                          <div className="text-center text-base font-black text-zinc-500">
                            {player.overall_rank}
                          </div>
                          <button
                            onClick={() =>
                              setSelectedPlayerId(player.player_key)
                            }
                            className="min-w-0 text-left"
                          >
                            <div className="truncate text-sm font-black sm:text-base">
                              {player.player_name}
                            </div>
                            <div className="mt-0.5 text-[10px] font-bold text-zinc-500">
                              {player.position}
                              {player.position_rank} · {player.team}
                            </div>
                          </button>
                          <button
                            onClick={() => toggleWatch(player.player_key)}
                            className="grid h-11 w-11 place-items-center rounded-xl border border-white/10"
                            aria-label={`${watchlist.includes(player.player_key) ? "Remove" : "Add"} ${player.player_name} ${watchlist.includes(player.player_key) ? "from" : "to"} My Guys`}
                          >
                            <Star
                              className={`h-4 w-4 ${watchlist.includes(player.player_key) ? "fill-[#D4AF37] text-[#D4AF37]" : "text-zinc-600"}`}
                            />
                          </button>
                        </div>
                        <button
                          onClick={() => setSelectedPlayerId(player.player_key)}
                          className="mt-3 grid w-full grid-cols-3 gap-2 text-left"
                        >
                          <div className="rounded-xl bg-white/[.04] p-2.5">
                            <div className="text-[8px] font-black uppercase text-zinc-600">
                              2026 projected
                            </div>
                            <div className="mt-1 text-base font-black">
                              {player.projected_points_2026.toFixed(1)}
                            </div>
                          </div>
                          <div className="rounded-xl bg-white/[.04] p-2.5">
                            <div className="text-[8px] font-black uppercase text-zinc-600">
                              2025 actual
                            </div>
                            <div className="mt-1 text-base font-black text-zinc-300">
                              {player.actual_points_2025?.toFixed(1) ?? "—"}
                            </div>
                          </div>
                          <div
                            className={`rounded-xl p-2.5 ${player.point_change === null ? "bg-white/[.04] text-zinc-300" : up ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}
                          >
                            <div className="text-[8px] font-black uppercase opacity-70">
                              Change
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-base font-black">
                              {player.point_change === null ? null : up ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              {player.point_change === null
                                ? "N/A"
                                : `${up ? "+" : ""}${player.point_change.toFixed(1)}`}
                            </div>
                          </div>
                        </button>
                        <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-zinc-400">
                          {player.projection_reason}
                        </p>
                      </article>
                    );
                  })}
                </div>
                {hasMoreRankings && (
                  <button
                    onClick={() =>
                      setVisibleRankingCount(
                        (count) => count + RANKINGS_PAGE_SIZE,
                      )
                    }
                    className="mt-4 min-h-12 w-full rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 text-xs font-black uppercase tracking-wider text-[#D4AF37]"
                  >
                    Load{" "}
                    {Math.min(
                      RANKINGS_PAGE_SIZE,
                      ranked.length - visibleRanked.length,
                    )}{" "}
                    More Players
                  </button>
                )}
              </>
            )}
            <p className="mt-5 border-t border-white/10 pt-4 text-[10px] leading-5 text-zinc-600">
              2025 actuals use full-PPR scoring from the credited final-results
              source. 2026 values are preseason projections, not guarantees. Tap
              a player for the full rationale and sources.
            </p>
          </section>
        )}
        {selectedPlayer && selectedFantasyPlayer ? (
          <FantasyPlayerDetail
            player={selectedFantasyPlayer}
            ranking={selectedPlayer}
            watchAction={{ watched: watchlist.includes(selectedPlayer.player_key), onToggle: () => toggleWatch(selectedPlayer.player_key) }}
            onClose={() => setSelectedPlayerId(null)}
          />
        ) : selectedPlayer && (
          <ModalPortal>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedPlayer.player_name} projection details`}
              className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto overscroll-contain bg-black/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] [-webkit-overflow-scrolling:touch]"
            >
              <section className="my-auto w-full max-w-lg rounded-[2rem] border border-[#D4AF37]/25 bg-[#0c1016] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black text-[#D4AF37]">
                      OVERALL #{selectedPlayer.overall_rank} ·{" "}
                      {selectedPlayer.position}
                      {selectedPlayer.position_rank} · {selectedPlayer.team}
                    </div>
                    <h3 className="mt-1 text-3xl font-black">
                      {selectedPlayer.player_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedPlayerId(null)}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/10"
                  >
                    <X />
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    [
                      "2026 projected",
                      selectedPlayer.projected_points_2026.toFixed(1),
                    ],
                    [
                      "2025 actual",
                      selectedPlayer.actual_points_2025?.toFixed(1) ?? "—",
                    ],
                    [
                      "Difference",
                      selectedPlayer.point_change === null
                        ? "N/A"
                        : `${selectedPlayer.point_change >= 0 ? "+" : ""}${selectedPlayer.point_change.toFixed(1)}`,
                    ],
                  ].map(([label, value], index) => (
                    <div
                      key={label}
                      className={`rounded-xl p-3 ${index === 2 ? (selectedPlayer.point_change === null ? "bg-white/[.04] text-zinc-300" : selectedPlayer.point_change >= 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300") : "bg-white/[.04]"}`}
                    >
                      <div className="text-[8px] font-black uppercase opacity-60">
                        {label}
                      </div>
                      <div className="mt-1 text-sm font-black">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-4">
                  <div className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">
                    Why the projection moves
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {selectedPlayer.projection_reason}
                  </p>
                </div>
                <div className="mt-3 text-[10px] leading-5 text-zinc-500">
                  {selectedPlayer.actual_source_url ? (
                    <a className="text-zinc-300 underline" href={selectedPlayer.actual_source_url} target="_blank" rel="noreferrer">
                      2025 actual: {selectedPlayer.actual_source_name}
                    </a>
                  ) : <>2025 actual: {selectedPlayer.actual_source_name}</>}
                  <br />
                  {selectedPlayer.projection_source_url ? (
                    <a
                      className="text-zinc-300 underline"
                      href={selectedPlayer.projection_source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Projection reference:{" "}
                      {selectedPlayer.projection_source_name}
                    </a>
                  ) : (
                    <>
                      Projection reference:{" "}
                      {selectedPlayer.projection_source_name}
                    </>
                  )}
                  <br />
                  {selectedPlayer.projection_model} · Updated{" "}
                  {new Date(selectedPlayer.updated_at).toLocaleDateString([], { timeZone: "UTC" })}
                </div>
                <button
                  onClick={() => toggleWatch(selectedPlayer.player_key)}
                  className="mt-4 min-h-12 w-full rounded-xl bg-[#D4AF37] text-sm font-black text-black"
                >
                  {watchlist.includes(selectedPlayer.player_key)
                    ? "REMOVE FROM MY GUYS"
                    : "ADD TO MY GUYS"}
                </button>
              </section>
            </div>
          </ModalPortal>
        )}
      </div>
    </div>
  );
};
