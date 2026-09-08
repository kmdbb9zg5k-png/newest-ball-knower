import {BroadcastStage} from './BroadcastScene';
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  ChevronRight,
} from "lucide-react";
import { League, Player } from "./types";
import { useBallKnower } from "./BallKnowerContext";
import { ModeGuide } from "./ModeGuide";
import { loadUserState, saveUserState } from "./userStateCloud";
import { ModalPortal } from "./ModalPortal";
import { loadFantasyRankings } from "./fantasyRankingsCloud";
import type { FantasyRanking } from "./fantasyRankingsCloud";
import { PLAYERS_DATABASE, KNOWN_PLAYERS_DATABASE } from "./players";
import { FantasyPlayerDetail } from "./FantasyPlayerDetail";
import "./fantasyHub.css";

const RANKINGS_PAGE_SIZE = 75;
const STADIUM_LIGHTS = Array.from({ length: 6 }, (_, index) => index);
const STADIUM_BANK_BULBS = Array.from({ length: 18 }, (_, index) => index);
const normalizePlayerName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const leagueInitials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "BK";
const scoringLabel = (league: League) => {
  const format = league.settings?.scoringFormat;
  if (format === "half_ppr") return "Half PPR";
  if (format === "standard") return "Standard";
  return "PPR";
};

const LeagueDestinationCard = ({
  league,
  currentUserId,
  featured,
  onSelect,
}: {
  league: League;
  currentUserId?: string;
  featured: boolean;
  onSelect: (league: League, tab: "lobby" | "draft" | "simulation") => void;
}) => {
  const mine = league.members.find(member => member.userId === currentUserId);
  const submitted = league.members.filter(member => member.status === "ready").length;
  const completed = league.status === "completed";
  const isPublic = league.settings?.leagueType === "public_free";
  const humans = league.members.filter(member => !member.isAi).length;
  const phase = completed
    ? "Season complete"
    : league.status === "simulating"
      ? `In season${league.settings?.currentWeek ? ` · Week ${league.settings.currentWeek}` : ""}`
      : league.liveDraft?.status === "active"
        ? "Live draft"
        : submitted === league.members.length && submitted > 1
          ? "Ready to draft"
          : "Draft setup";
  const primaryTab = completed ? "simulation" : "lobby";

  return (
    <article className={`bk-fantasy-league-card${featured ? " bk-fantasy-league-card--featured" : ""}`}>
      <div className="bk-fantasy-league-summary">
        <div className="bk-fantasy-league-crest" aria-hidden="true">
          <span>{leagueInitials(league.name)}</span>
          {featured && <Crown />}
        </div>
        <div className="bk-fantasy-league-copy">
          <div className="bk-fantasy-league-kicker">
            {league.commissionerId === currentUserId ? "Commissioner" : isPublic ? "Public free" : league.code}
          </div>
          <h4>{league.name}</h4>
          <p>
            {league.members.length}/{league.maxMembers} teams <span>•</span> {scoringLabel(league)} <span>•</span> {league.settings?.nflSeason || 2026} season
          </p>
          <div className="bk-fantasy-league-status"><i aria-hidden="true" />{phase}</div>
        </div>
        <button type="button" className="bk-fantasy-league-open" onClick={() => onSelect(league, primaryTab)} aria-label={`Open ${league.name}`}>
          <ChevronRight />
        </button>
      </div>

      {featured && (
        <div className="bk-fantasy-league-facts" aria-label={`${league.name} status`}>
          <span><small>Owners</small><strong>{submitted}/{league.members.length} ready</strong></span>
          <span><small>Your roster</small><strong>{mine?.status === "ready" ? "Locked" : "Build"}</strong></span>
          <span><small>{league.liveDraft?.status === "completed" ? "Players" : "Cap"}</small><strong>{league.liveDraft?.status === "completed" ? `${league.liveDraft.picks.length} drafted` : `${league.salaryCap}M`}</strong></span>
          {isPublic && <span><small>Managers</small><strong>{humans} human</strong></span>}
        </div>
      )}

      <div className="bk-fantasy-league-actions">
        <button type="button" onClick={() => onSelect(league, primaryTab)}>
          {completed ? <Trophy /> : <Users />}
          {completed ? "View results" : "League HQ"}
        </button>
        {!completed && (
          <button type="button" className="bk-fantasy-league-actions-primary" onClick={() => onSelect(league, "draft")}>
            {mine?.status === "ready" ? "Draft board" : "Build team"}
            <ArrowRight />
          </button>
        )}
      </div>
    </article>
  );
};
const fantasyPlayerFromRanking = (ranking?: FantasyRanking): Player | null => {
  if (!ranking) return null;
  const exactId = KNOWN_PLAYERS_DATABASE.find(player => player.id === ranking.player_key);
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
  const { leagues, currentUser, activeLeague, joinPublicLeague } = useBallKnower();
  const guideTriggerRef = useRef<HTMLButtonElement>(null);
  const resumablePublicLeague = leagues.find(
    (league) =>
      league.settings?.leagueType === "public_free" &&
      (league.status === "drafting" ||
        league.liveDraft?.status === "active" ||
        (league.status === "completed" && !league.liveDraft)),
  );
  const activeLeagueId = activeLeague?.id;
  const displayLeagues = useMemo(() => {
    if (!activeLeagueId) return leagues;
    return [...leagues].sort((left, right) => Number(right.id === activeLeagueId) - Number(left.id === activeLeagueId));
  }, [activeLeagueId, leagues]);
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
    <BroadcastStage scene="tunnel" page="fantasy" quiet={view==='cheatsheet'} className="bk-fantasy-hq-screen min-h-[calc(100dvh-7rem)] text-white">
      <div className="bk-fantasy-hq-shell mx-auto max-w-6xl">
        <nav className="bk-fantasy-hq-tabs" aria-label="Fantasy views">
          <button
            type="button"
            onClick={() => onViewChange("leagues")}
            aria-current={view === "leagues" ? "page" : undefined}
          >
            League HQ
          </button>
          <button
            type="button"
            onClick={() => onViewChange("cheatsheet")}
            aria-current={view === "cheatsheet" ? "page" : undefined}
          >
            Cheat Sheet
          </button>
          <ModeGuide
            triggerRef={guideTriggerRef}
            storageKey="bk-guide-fantasy-hq-v3"
            title="Fantasy"
            summary="League HQ is where you create, join, resume, and manage leagues. The Cheat Sheet keeps your full-PPR player board close by."
            steps={[
              "Open a saved league to return to its lobby, roster, draft, or results.",
              "Create a league, join with a commissioner code, or enter free public matchmaking.",
              "Open Cheat Sheet to compare player rankings, projections, and movement.",
            ]}
          />
        </nav>
        {view === "leagues" && (
          <>
            <section className="bk-fantasy-hq-hero" aria-labelledby="fantasy-hq-title" data-testid="fantasy-hq-hero">
              <div className="bk-fantasy-hq-stadium" aria-hidden="true">
                <img src="/atmosphere/home-stadium.webp" alt="" />
                <div className="bk-fantasy-hq-tint" />
                <div className="bk-home-floodlights bk-fantasy-hq-floodlights">
                  {STADIUM_LIGHTS.map(index => <i className="bk-home-floodlight" key={index} />)}
                </div>
                <div className="bk-fantasy-hq-light-bank bk-fantasy-hq-light-bank--left">
                  {STADIUM_BANK_BULBS.map(index => <i key={index} />)}
                </div>
                <div className="bk-fantasy-hq-light-bank bk-fantasy-hq-light-bank--right">
                  {STADIUM_BANK_BULBS.map(index => <i key={index} />)}
                </div>
                <div className="bk-home-haze bk-fantasy-hq-haze" />
                <div className="bk-fantasy-hq-shade" />
              </div>
              <div className="bk-fantasy-hq-hero-copy">
                <p>Your league. Your legacy.</p>
                <h1 id="fantasy-hq-title">Fantasy <span>HQ</span></h1>
                <div>Create, join, and manage your leagues.<br />Build the team everyone has to beat.</div>
              </div>
            </section>

            <div className="bk-fantasy-section-heading">
              <h2>Your Leagues</h2>
              <span>{leagues.length} saved <ChevronRight /></span>
            </div>

            {leagues.length === 0 ? (
              <div className="bk-fantasy-leagues-empty">
                <Trophy />
                <div>
                  Your trophy case is empty
                </div>
                <p>
                  Create your first league or join your friends with a code.
                </p>
              </div>
            ) : (
              <div className="bk-fantasy-league-grid" data-testid="fantasy-league-grid">
                {displayLeagues.map((league, leagueIndex) => (
                  <LeagueDestinationCard
                    key={league.id}
                    league={league}
                    currentUserId={currentUser?.id}
                    featured={leagueIndex === 0}
                    onSelect={onSelectLeague}
                  />
                ))}
              </div>
            )}

            <section className="bk-fantasy-tools" aria-labelledby="fantasy-tools-title">
              <div className="bk-fantasy-section-heading">
                <h2 id="fantasy-tools-title">League Tools</h2>
              </div>
              <div className="bk-fantasy-tool-grid" data-testid="fantasy-tool-grid">
                <button type="button" onClick={onOpenCreateLeague}>
                  <Shield />
                  <strong>Create League</strong>
                  <span>Start a league in minutes.</span>
                  <ChevronRight />
                </button>
                <button type="button" onClick={onOpenJoinLeague}>
                  <Users />
                  <strong>Join With Code</strong>
                  <span>Enter a commissioner code.</span>
                  <ChevronRight />
                </button>
                <button type="button" onClick={() => void enterPublicLeague()} disabled={publicMatchBusy}>
                  {publicMatchBusy ? <LoaderCircle className="bk-fantasy-tool-spinner" /> : <Globe2 />}
                  <strong>{resumablePublicLeague ? "Resume Public" : "Public League"}</strong>
                  <span>{resumablePublicLeague ? `Continue ${resumablePublicLeague.code}.` : "Find and join a free league."}</span>
                  <ChevronRight />
                </button>
              </div>
              {publicMatchError && (
                <div className="bk-fantasy-public-error" role="alert">
                  <AlertTriangle /> {publicMatchError}
                </div>
              )}
            </section>

            <button type="button" className="bk-fantasy-help-card" onClick={() => guideTriggerRef.current?.click()}>
              <span className="bk-fantasy-help-icon"><Trophy /></span>
              <span><strong>Need help getting started?</strong><small>Learn how Ball Knower Fantasy works.</small></span>
              <ChevronRight />
            </button>
          </>
        )}
        {view === "cheatsheet" && (
          <section className="bk-cheatsheet-panel rounded-[2rem] border border-[#D4AF37]/35 bg-[#0b0e12] p-4 sm:p-6">
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
    </BroadcastStage>
  );
};
