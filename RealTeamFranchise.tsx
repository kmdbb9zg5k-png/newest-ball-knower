import { GmArtwork } from './GmArtwork';
import {SoloPlayerIdentity,SoloPlayerLink} from './solo/SoloPresentation';
import {BroadcastStage,BroadcastMasthead} from './BroadcastScene';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  ClipboardList,
  Play,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import { FranchiseSeason } from "./FranchiseSeason";
import {
  assignPlayerToFranchiseTeam,
  buildFranchiseTradeResult,
  buildSoloTeamRoster,
  SOLO_FRANCHISE_SAVE_KEYS,
  validateFranchiseRoster,
} from "./soloFranchiseEngine";
import { SoloTeamPicker } from "./SoloTeamPicker";
import { getSavedSoloTeamTheme, SOLO_TEAM_THEMES, soloTeamLogoUrl } from "./soloUniverse";
import { Player } from "./types";
import { ModeHelp } from "./ModeHelp";
import { ModalPortal } from "./ModalPortal";
import {
  createFranchiseDraftPicks,
  ensureFranchiseDraftYear,
  FranchiseDraftPick,
  franchiseDraftPickKey,
  normalizeFranchiseDraftPicks,
  ownedFranchiseDraftPicks,
  transferFranchiseDraftPicks,
} from "./franchiseDraftPicks";

import { GmEventAlerts, type GmImportantEvent } from './GmEventAlerts';
import { counterGmTradeOffer, emptyGmTradeInbox, finishGmTradeOffer, generateGmTradeOffer, gmTradeCounterOptions, gmTradeRosterPreview, restoreGmTradeInbox, validateGmTradeOffer, type GmTradeOffer, type GmTradeInbox } from './gmTradeOffers';

type Props = { onBack: () => void };
type RealFranchiseSave = {
  version: 5;
  careerId: string;
  teamAbbr: string;
  roster: Player[];
  draftPickAssets: FranchiseDraftPick[];
  gamePlan: string;
  opponentRosters: Record<string, Player[]>;
  tradeInbox?: GmTradeInbox;
};

function migrateLegacyDraftPicks(saved: any): FranchiseDraftPick[] {
  const owned = new Set(Array.isArray(saved.draftPicks) ? saved.draftPicks : [1, 2, 3, 4]);
  return createFranchiseDraftPicks(restoredFranchiseYear() + 1, [saved.teamAbbr]).map((pick) => ({
    ...pick,
    ownerTeam: pick.round > 4 || owned.has(pick.round) ? saved.teamAbbr : 'LEGACY_TRADED',
  }));
}

function restoreFranchise(): RealFranchiseSave | null {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.real);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (
      typeof saved?.teamAbbr !== "string" ||
      !SOLO_TEAM_THEMES.some((team) => team.abbr === saved.teamAbbr)
    )
      return null;
    const baseRoster = buildSoloTeamRoster(saved.teamAbbr);
    const savedRoster =
      Array.isArray(saved.roster) && saved.roster.length
        ? saved.roster.map((player: Player) =>
            assignPlayerToFranchiseTeam(player, saved.teamAbbr),
          )
        : baseRoster;
    const opponentRosters =
      saved.opponentRosters && typeof saved.opponentRosters === "object"
        ? Object.entries(saved.opponentRosters).reduce<
            Record<string, Player[]>
          >((rosters, [abbr, value]) => {
            if (!Array.isArray(value)) return rosters;
            const normalized = (value as Player[]).map((player) =>
              assignPlayerToFranchiseTeam(player, abbr),
            );
            if (!validateFranchiseRoster(normalized).length)
              rosters[abbr] = normalized;
            return rosters;
          }, {})
        : {};
    return {
      version: 5,
      careerId: typeof saved.careerId === 'string' && saved.careerId ? saved.careerId : `legacy:${saved.teamAbbr}`,
      teamAbbr: saved.teamAbbr,
      roster: validateFranchiseRoster(savedRoster).length
        ? baseRoster
        : savedRoster,
      draftPickAssets: Array.isArray(saved.draftPickAssets)
        ? normalizeFranchiseDraftPicks(saved.draftPickAssets, saved.teamAbbr)
        : migrateLegacyDraftPicks(saved),
      gamePlan:
        typeof saved.gamePlan === "string" && saved.gamePlan
          ? saved.gamePlan
          : "Balanced attack",
      opponentRosters,
      tradeInbox: restoreGmTradeInbox(saved.tradeInbox, saved.teamAbbr),
    };
  } catch {
    return null;
  }
}

function restoredFranchiseYear() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`) || "null",
    );
    return Number.isInteger(saved?.year) && saved.year >= 2026
      ? saved.year
      : 2026;
  } catch {
    return 2026;
  }
}

function restoredGmWeek() {
  try {
    const saved = JSON.parse(localStorage.getItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`) || 'null');
    if (saved && saved.stage !== 'regular') return 18;
    return Array.isArray(saved?.weeks) ? saved.weeks.length + 1 : 1;
  } catch { return 1; }
}

export const RealTeamFranchise: React.FC<Props> = ({ onBack }) => {
  const restored = useMemo(restoreFranchise, []);
  const [teamAbbr, setTeamAbbr] = useState<string | null>(
    restored?.teamAbbr ?? null,
  );
  const [selectedAbbr, setSelectedAbbr] = useState(
    () => teamAbbr ?? getSavedSoloTeamTheme().abbr,
  );
  const [message, setMessage] = useState("");
  const [careerId, setCareerId] = useState(restored?.careerId ?? "");
  const [seasonOpen, setSeasonOpen] = useState(false);
  // Internal screens share one Solo route, so the outer route reset cannot handle them.
  // Reset before an incoming alert locks the document and captures its scroll position.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [seasonOpen, teamAbbr]);
  const [confirmNewCareer, setConfirmNewCareer] = useState(false);
  useEffect(() => {
    if (!confirmNewCareer) return;
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfirmNewCareer(false); };
    document.addEventListener('keydown', cancel);
    return () => document.removeEventListener('keydown', cancel);
  }, [confirmNewCareer]);
  const [commandTab, setCommandTab] = useState<"week" | "trade" | "roster">(
    "week",
  );
  const [gamePlan, setGamePlan] = useState(
    restored?.gamePlan ?? "Balanced attack",
  );
  const [tradeSearch, setTradeSearch] = useState("");
  const [rosterOverride, setRosterOverride] = useState<Player[] | null>(
    restored?.roster ?? null,
  );
  const [draftPickAssets, setDraftPickAssets] = useState<FranchiseDraftPick[]>(
    restored?.draftPickAssets ?? [],
  );
  const [opponentRosters, setOpponentRosters] = useState<
    Record<string, Player[]>
  >(restored?.opponentRosters ?? {});
  const [tradeTarget, setTradeTarget] = useState<Player | null>(null);
  const [outgoingIds, setOutgoingIds] = useState<string[]>([]);
  const [outgoingPicks, setOutgoingPicks] = useState<string[]>([]);
  const [franchiseYear, setFranchiseYear] = useState(restoredFranchiseYear);
  const [gmWeek, setGmWeek] = useState(restoredGmWeek);
  const [tradeInbox, setTradeInbox] = useState<GmTradeInbox>(() => restored?.tradeInbox ?? emptyGmTradeInbox());
  const handledOffers = useRef(new Set<string>());
  const onGmWeekChange = useCallback((week: number, year: number) => { setGmWeek(week); setFranchiseYear(year); }, []);
  const team = teamByAbbr(teamAbbr ?? selectedAbbr);
  const baseRoster = useMemo(
    () => (teamAbbr ? buildSoloTeamRoster(teamAbbr) : []),
    [teamAbbr],
  );
  const roster = rosterOverride ?? baseRoster;
  const nextDraftYear = franchiseYear + 1;
  const draftInProgress = (() => {
    try { return JSON.parse(localStorage.getItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`) || 'null')?.stage === 'draft'; }
    catch { return false; }
  })();
  useEffect(() => {
    if (!draftInProgress || commandTab !== 'trade') return;
    setCommandTab('week');
    setTradeTarget(null);
    setOutgoingIds([]);
    setOutgoingPicks([]);
  }, [commandTab, draftInProgress]);
  const draftPicks = teamAbbr
    ? ownedFranchiseDraftPicks(draftPickAssets, teamAbbr, nextDraftYear)
    : [];
  const leagueRosters = useMemo(
    () =>
      Object.fromEntries(
        SOLO_TEAM_THEMES.filter((item) => item.abbr !== teamAbbr).map((item) => [
          item.abbr,
          opponentRosters[item.abbr] ?? buildSoloTeamRoster(item.abbr),
        ]),
      ),
    [opponentRosters, teamAbbr],
  );

  useEffect(() => {
    if (!teamAbbr || !roster.length) return;
    try {
      localStorage.setItem(
        SOLO_FRANCHISE_SAVE_KEYS.real,
        JSON.stringify({
          version: 5,
          careerId,
          teamAbbr,
          roster,
          draftPickAssets,
          gamePlan,
          opponentRosters,
          tradeInbox,
        } satisfies RealFranchiseSave),
      );
    } catch (error) {
      console.warn("Unable to persist Franchise Command changes", error);
    }
  }, [careerId, draftPickAssets, gamePlan, opponentRosters, roster, teamAbbr, tradeInbox]);

  useEffect(() => {
    if (!teamAbbr || !roster.length) return;
    setTradeInbox(current => {
      const pending = current.pending;
      if (pending && (pending.week !== gmWeek || pending.year !== franchiseYear || draftInProgress)) return finishGmTradeOffer(current, pending, 'expired');
      if (pending) return current;
      const offer = generateGmTradeOffer(teamAbbr, roster, leagueRosters, gmWeek, franchiseYear, draftInProgress, current.decisions);
      return offer ? { ...current, pending: offer } : current;
    });
  }, [teamAbbr, roster, leagueRosters, gmWeek, franchiseYear, draftInProgress, tradeInbox.pending]);

  const respondToIncomingTrade = (accept: boolean) => {
    const offer = tradeInbox.pending;
    if (!offer || !teamAbbr || handledOffers.current.has(offer.id) || tradeInbox.decisions.some(item => item.id === offer.id)) return;
    const result = accept ? validateGmTradeOffer(offer, teamAbbr, roster, leagueRosters, gmWeek, franchiseYear, draftInProgress) : null;
    if (result?.errors.length) throw new Error(`${result.errors[0]} You can decline this offer and keep your roster.`);
    const nextInbox = finishGmTradeOffer(tradeInbox, offer, accept ? 'accepted' : 'declined');
    const nextRoster = result?.userRoster ?? roster;
    const nextOpponents = result ? { ...opponentRosters, [offer.partner]: result.partnerRoster } : opponentRosters;
    // Save all sides of the decision together before applying it to the UI.
    try {
      localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.real, JSON.stringify({ version: 5, careerId, teamAbbr, roster: nextRoster, draftPickAssets, gamePlan, opponentRosters: nextOpponents, tradeInbox: nextInbox } satisfies RealFranchiseSave));
    } catch { throw new Error('Your decision could not be saved. Try again before leaving this page.'); }
    handledOffers.current.add(offer.id);
    setTradeInbox(nextInbox);
    if (result) { setRosterOverride(nextRoster); setOpponentRosters(nextOpponents); }
    setMessage(accept ? `Trade completed with ${teamByAbbr(offer.partner).name}. Both rosters are updated.` : `You declined ${teamByAbbr(offer.partner).name}'s offer. Your roster is unchanged.`);
  };
  const proposeIncomingCounter = (counter: GmTradeOffer) => {
    if (!teamAbbr || !tradeInbox.pending || handledOffers.current.has(tradeInbox.pending.id)) return;
    const choices = gmTradeCounterOptions(tradeInbox.pending, teamAbbr, roster, leagueRosters, gmWeek, franchiseYear, draftInProgress);
    if (!choices.some(choice => choice.id === counter.id)) throw new Error('That counter is no longer available. Review the current offer.');
    const nextInbox = counterGmTradeOffer(tradeInbox, counter);
    try { localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.real, JSON.stringify({ version: 5, careerId, teamAbbr, roster, draftPickAssets, gamePlan, opponentRosters, tradeInbox: nextInbox } satisfies RealFranchiseSave)); }
    catch { throw new Error('Your counter could not be saved. Try again.'); }
    handledOffers.current.add(tradeInbox.pending.id);
    setTradeInbox(nextInbox);
    setMessage(`${teamByAbbr(counter.partner).name} is willing to revise the package. Review the new player and cap impact before accepting.`);
  };
  const incomingOffer = tradeInbox.pending;
  const incomingPlayer = incomingOffer ? leagueRosters[incomingOffer.partner]?.find(player => player.id === incomingOffer.incomingId) : undefined;
  const outgoingPlayer = incomingOffer ? roster.find(player => player.id === incomingOffer.outgoingId) : undefined;
  const incomingResult = incomingOffer && teamAbbr ? validateGmTradeOffer(incomingOffer, teamAbbr, roster, leagueRosters, gmWeek, franchiseYear, draftInProgress) : null;
  const incomingPreview = incomingResult ? gmTradeRosterPreview(roster, incomingResult.userRoster) : null;
  const partnerPreview = incomingResult && incomingOffer ? gmTradeRosterPreview(leagueRosters[incomingOffer.partner] ?? [], incomingResult.partnerRoster) : null;
  const counterOptions = incomingOffer && teamAbbr ? gmTradeCounterOptions(incomingOffer, teamAbbr, roster, leagueRosters, gmWeek, franchiseYear, draftInProgress) : [];
  const gmEvents: GmImportantEvent[] = incomingOffer && incomingOffer.week === gmWeek && incomingOffer.year === franchiseYear && !draftInProgress ? [{
    id: incomingOffer.id,
    eyebrow: `TRADE REQUEST · WEEK ${incomingOffer.week}`,
    title: `${teamByAbbr(incomingOffer.partner).name} ${incomingOffer.counterOf ? 'revises the offer' : 'is calling'}`,
    tone: 'trade',
    people: [...(incomingPlayer ? [{ player: incomingPlayer, label: 'You receive' }] : []), ...(outgoingPlayer ? [{ player: outgoingPlayer, label: 'You send' }] : [])],
    facts: incomingPreview && partnerPreview ? [{ label: 'Your cap room after', value: `$${incomingPreview.capRoom.toFixed(2)}M` }, { label: 'Partner cap room after', value: `$${partnerPreview.capRoom.toFixed(2)}M` }, { label: 'Your roster after', value: `${incomingPreview.rosterSize} players · ${incomingPreview.ovrDelta >= 0 ? '+' : ''}${incomingPreview.ovrDelta.toFixed(2)} average OVR` }] : [],
    detail: incomingPlayer && outgoingPlayer
      ? `They offer ${incomingPlayer.name} (${incomingPlayer.position}, ${incomingPlayer.ovr} OVR, $${incomingPlayer.salary.toFixed(2)}M) for ${outgoingPlayer.name} (${outgoingPlayer.position}, ${outgoingPlayer.ovr} OVR, $${outgoingPlayer.salary.toFixed(2)}M). This is a one-for-one player trade with no draft picks. The offer expires when you advance the week. In-season trade calls close after Week 9.${incomingResult?.errors.length ? `\n\nUnable to accept: ${incomingResult.errors[0]}` : ''}`
      : 'This offer involves a player who is no longer available. Decline it to clear the request.',
    choices: [
      ...(incomingPlayer && outgoingPlayer && !incomingResult?.errors.length ? [{ id: 'accept', label: 'Accept trade', detail: `Send ${outgoingPlayer.name} and receive ${incomingPlayer.name}. Both rosters change immediately.`, onSelect: () => respondToIncomingTrade(true) }] : []),
      ...counterOptions.map(counter => { const player = leagueRosters[counter.partner].find(player => player.id === counter.incomingId)!; return { id: counter.id, label: `Counter for ${player.name}`, detail: `${player.ovr} OVR · $${player.salary.toFixed(2)}M. Request this player instead and review the revised offer. Your outgoing player stays the same; no roster changes yet.`, onSelect: () => proposeIncomingCounter(counter) }; }),
      { id: 'decline', label: 'Decline offer', detail: 'Keep your players and close this negotiation.', onSelect: () => respondToIncomingTrade(false) },
    ],
  }] : [];

  const start = () => {
    const nextCareerId = globalThis.crypto?.randomUUID?.() ?? `career-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const startingRoster = buildSoloTeamRoster(selectedAbbr);
      localStorage.setItem(
        SOLO_FRANCHISE_SAVE_KEYS.real,
        JSON.stringify({
          version: 5,
          careerId: nextCareerId,
          teamAbbr: selectedAbbr,
          roster: startingRoster,
          draftPickAssets: createFranchiseDraftPicks(
            2027,
            SOLO_TEAM_THEMES.map((team) => team.abbr),
          ),
          gamePlan: "Balanced attack",
          opponentRosters: {},
        } satisfies RealFranchiseSave),
      );
      localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`);
    } catch (error) {
      console.warn("Unable to save Real Team Franchise", error);
      setMessage(
        "Franchise started, but Safari could not save it. Keep this page open.",
      );
    }
    setCareerId(nextCareerId);
    setTeamAbbr(selectedAbbr);
    setSeasonOpen(false);
    setRosterOverride(buildSoloTeamRoster(selectedAbbr));
    setDraftPickAssets(
      createFranchiseDraftPicks(
        2027,
        SOLO_TEAM_THEMES.map((team) => team.abbr),
      ),
    );
    setFranchiseYear(2026);
    setGmWeek(1);
    setTradeInbox(emptyGmTradeInbox());
    handledOffers.current.clear();
    setGamePlan("Balanced attack");
    setOpponentRosters({});
  };

  const newCareer = () => {
    setConfirmNewCareer(false);
    try {
      localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.real);
      localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`);
    } catch (error) {
      console.warn("Unable to clear Real Team Franchise", error);
    }
    setCareerId("");
    setTeamAbbr(null);
    setSeasonOpen(false);
    setRosterOverride(null);
    setDraftPickAssets([]);
    setFranchiseYear(2026);
    setGmWeek(1);
    setTradeInbox(emptyGmTradeInbox());
    handledOffers.current.clear();
    setGamePlan("Balanced attack");
    setOpponentRosters({});
  };

  const resetConfirmation = confirmNewCareer ? <ModalPortal><div role="dialog" aria-modal="true" aria-label="Start a new franchise" className="fixed inset-0 z-[10000] grid place-items-center bg-black/90 p-5"><section className="w-full max-w-md rounded-3xl border border-amber-300/30 bg-[#0d121b] p-6 text-white"><h2 className="text-2xl font-black">Start a new franchise?</h2><p className="mt-3 text-sm leading-6 text-zinc-300">This replaces your {team.name} career, roster, draft assets, season and relationship history. Choose Keep my franchise to return to the current save.</p><button type="button" onClick={() => setConfirmNewCareer(false)} className="mt-5 min-h-12 w-full rounded-xl bg-emerald-300 px-4 text-sm font-black text-black">KEEP MY FRANCHISE</button><button type="button" onClick={newCareer} className="mt-3 min-h-12 w-full rounded-xl border border-red-300/30 px-4 text-sm font-black text-red-200">REPLACE CAREER & CHOOSE TEAM</button></section></div></ModalPortal> : null;

  if (teamAbbr && seasonOpen) {
    return (
      <BroadcastStage scene="suite" page="franchise" quiet={seasonOpen} className="relative">
        {resetConfirmation}
        <div className="mx-auto flex max-w-6xl justify-end px-4 pt-4">
        <button
          type="button"
          onClick={() => setConfirmNewCareer(true)}
          className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/90 px-4 text-xs font-black"
        >
          <RotateCcw size={15} /> NEW TEAM
        </button>
        </div>
        <FranchiseSeason
          title="FRANCHISE COMMAND"
          userTeam={team}
          roster={roster}
          saveKey={SOLO_FRANCHISE_SAVE_KEYS.real}
          onBack={() => setSeasonOpen(false)}
          onRosterChange={setRosterOverride}
          opponentRosters={leagueRosters}
          gamePlan={gamePlan}
          draftPickAssets={draftPickAssets}
          onDraftPickAssetsChange={setDraftPickAssets}
          onSeasonYearChange={setFranchiseYear}
          onGmWeekChange={onGmWeekChange}
          gmEvents={gmEvents}
          gmAlertScopeKey={`${SOLO_FRANCHISE_SAVE_KEYS.real}:${team.abbr}:${careerId}`}
        />
      </BroadcastStage>
    );
  }

  if (teamAbbr) {
    const tradeTargets = Object.values(leagueRosters)
      .flat()
      .filter((player) => !roster.some((item) => item.id === player.id))
      .filter(
        (player) =>
          !tradeSearch.trim() ||
          `${player.name} ${player.team} ${player.position}`
            .toLowerCase()
            .includes(tradeSearch.toLowerCase()),
      )
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 18);
    const outgoingPlayers = roster.filter((player) =>
      outgoingIds.includes(player.id),
    );
    const offeredValue =
      outgoingPlayers.reduce((sum, player) => sum + tradeValue(player), 0) +
      outgoingPicks.reduce(
        (sum, key) =>
          sum +
          PICK_VALUES[
            (draftPicks.find((pick) => franchiseDraftPickKey(pick) === key)
              ?.round ?? 1) - 1
          ],
        0,
      );
    const requestedValue = tradeTarget ? tradeValue(tradeTarget) : 0;
    const builderResult = tradeTarget && outgoingIds.length === 1 ? buildFranchiseTradeResult(roster, team.abbr, leagueRosters[tradeTarget.team] ?? [], tradeTarget.team, tradeTarget.id, outgoingIds) : null;
    const builderPreview = builderResult ? gmTradeRosterPreview(roster, builderResult.userRoster) : null;
    const builderPartnerPreview = builderResult && tradeTarget ? gmTradeRosterPreview(leagueRosters[tradeTarget.team] ?? [], builderResult.partnerRoster) : null;
    const builderErrors = [...(builderResult?.errors ?? []), ...(builderPreview && builderPreview.capRoom < -.001 ? ['Your roster would exceed the salary cap.'] : []), ...(builderPartnerPreview && builderPartnerPreview.capRoom < -.001 ? ['The other roster would exceed the salary cap.'] : [])];
    const submitOffer = () => {
      if (draftInProgress) {
        setMessage('Finish the active rookie draft before trading.');
        return;
      }
      if (!tradeTarget || (!outgoingPlayers.length && !outgoingPicks.length))
        return;
      if (
        tradeTarget.team === team.abbr ||
        roster.some((player) => player.id === tradeTarget.id)
      ) {
        setMessage(
          "That player is already on your roster and cannot be acquired in a trade.",
        );
        setTradeTarget(null);
        setOutgoingIds([]);
        setOutgoingPicks([]);
        return;
      }
      if (builderErrors.length) { setMessage(builderErrors[0]); return; }
      if (offeredValue < requestedValue * 0.92) {
        setMessage(
          `${tradeTarget.team} declined. Your offer is short by ${Math.ceil(requestedValue * 0.92 - offeredValue)} value points.`,
        );
        return;
      }
      const tradePartner = tradeTarget.team;
      const partnerRoster =
        leagueRosters[tradePartner] ?? buildSoloTeamRoster(tradePartner);
      const result = buildFranchiseTradeResult(
        roster,
        team.abbr,
        partnerRoster,
        tradePartner,
        tradeTarget.id,
        outgoingIds,
      );
      if (result.errors.length) {
        setMessage(result.errors[0]);
        return;
      }
      const outgoingNames = outgoingPlayers.map((player) => player.name);
      const pickNames = outgoingPicks.map((key) => {
        const pick = draftPicks.find(
          (item) => franchiseDraftPickKey(item) === key,
        );
        return pick
          ? `the ${pick.originalTeam} ${ordinal(pick.round)}-round pick`
          : "a draft pick";
      });
      setRosterOverride(result.userRoster);
      setOpponentRosters((current) => ({
        ...current,
        [tradePartner]: result.partnerRoster,
      }));
      setDraftPickAssets((picks) =>
        transferFranchiseDraftPicks(
          ensureFranchiseDraftYear(
            picks,
            nextDraftYear,
            SOLO_TEAM_THEMES.map((item) => item.abbr),
          ),
          team.abbr,
          tradePartner,
          nextDraftYear,
          outgoingPicks,
        ),
      );
      setMessage(
        `${tradePartner} accepted ${[...outgoingNames, ...pickNames].join(", ")} for ${tradeTarget.name}. Both rosters were updated.`,
      );
      setTradeTarget(null);
      setOutgoingIds([]);
      setOutgoingPicks([]);
      setCommandTab("roster");
    };
    return (
      <BroadcastStage scene="suite" page="franchise" quiet={seasonOpen} className="min-h-[100dvh] px-4 pb-24 pt-4 text-white sm:px-8">
        <div className="mx-auto max-w-6xl">
          {resetConfirmation}
          <GmEventAlerts events={tradeTarget ? [] : gmEvents} scopeKey={`${SOLO_FRANCHISE_SAVE_KEYS.real}:${team.abbr}:${careerId}:${franchiseYear}`} />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]"
              aria-label="Back to Solo Franchise Hub"
            >
              <ArrowLeft />
            </button>
            <ModeHelp mode="gm" />
          </div>
          <section className="mt-4 overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-[#0c1117] p-5 sm:p-7">
            <GmArtwork scene={commandTab === "trade" ? "trade" : commandTab === "week" ? "gameplan" : "office"} />
            <div className="flex items-center gap-4">
              <img
                src={soloTeamLogoUrl(team.abbr)}
                alt=""
                className="h-16 w-16 object-contain"
              />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[.25em] text-emerald-300">
                  Football operations
                </div>
                <h1 className="text-3xl font-black sm:text-5xl">
                  FRANCHISE COMMAND
                </h1>
                <p className="mt-1 text-sm font-semibold text-zinc-400">
                  {team.name} · Make the calls that shape Sunday.
                </p>
              </div>
            </div>
          </section>
          <nav aria-label="GM career sections" className="bk-gm-tabs sticky top-0 z-20 mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/90 p-2 backdrop-blur">
            {(
              [
                ["week", "THIS WEEK", ClipboardList],
                ["trade", "TRADE CENTER", ArrowRightLeft],
                ["roster", "ROSTER", Users],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                disabled={id === 'trade' && draftInProgress}
                onClick={() => setCommandTab(id)}
                className={`min-h-12 rounded-xl text-[10px] font-black ${commandTab === id ? "bg-emerald-300 text-black" : "bg-white/[.04] text-zinc-400"}`}
                title={id === 'trade' && draftInProgress ? 'Finish the active rookie draft before trading picks.' : undefined}
              >
                <Icon className="mx-auto mb-1 h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
          {message && (
            <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">
              {message}
            </div>
          )}
          {commandTab === "week" && (
            <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-5 sm:p-7">
              <div className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">
                Coach meeting
              </div>
              <h2 className="mt-2 text-3xl font-black">WHAT'S THE PLAN?</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Your coaches need one clear priority. Pick it before starting
                the season.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {[
                  "Attack through the air",
                  "Control the clock",
                  "Balanced attack",
                  "Bring heavy pressure",
                  "Protect against big plays",
                  "Play aggressive",
                ].map((plan) => (
                  <button
                    key={plan}
                    onClick={() => setGamePlan(plan)}
                    className={`min-h-14 rounded-2xl border px-4 text-left text-sm font-black ${gamePlan === plan ? "border-emerald-300 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-black/20"}`}
                  >
                    {plan}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm">
                <span className="font-black text-emerald-300">
                  LOCKED PLAN:
                </span>{" "}
                {gamePlan}
              </div>
              <button
                onClick={() => setSeasonOpen(true)}
                className="mt-4 min-h-14 w-full rounded-2xl bg-emerald-300 font-black text-black"
              >
                <Play className="mr-2 inline h-5 w-5" />
                {gmWeek > 1 ? "CONTINUE SEASON" : "START SEASON"}
              </button>
            </section>
          )}
          {commandTab === "trade" && (
            <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-4 sm:p-6">
              <div className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">
                All 32 teams
              </div>
              <h2 className="mt-2 text-3xl font-black">TRADE CENTER</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Choose a target, then build the offer yourself with your players
                and remaining draft picks.
              </p>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[10px] font-black text-zinc-400">
                PICK INVENTORY:{" "}
                {draftPicks.length
                  ? draftPicks
                      .map((pick) => `${pick.originalTeam} ${ordinal(pick.round).toUpperCase()}`)
                      .join(" · ")
                  : "NO PICKS REMAINING"}
              </div>
              <input
                aria-label="Search trade targets"
                value={tradeSearch}
                onChange={(event) => setTradeSearch(event.target.value)}
                placeholder="Search player, team or position"
                className="mt-4 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none"
              />
              <div className="mt-3 divide-y divide-white/5">
                {tradeTargets.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">
                        <SoloPlayerLink player={player}/>
                      </div>
                      <div className="text-[10px] font-bold text-zinc-500">
                        {player.team} · {player.position} · {player.ovr} OVR · $
                        {player.salary}M
                        {player.salaryType === "estimated" ? " est." : ""}
                      </div>
                    </div>
                    <button
                      aria-label={`Build offer for ${player.name}`}
                      onClick={() => {
                        setTradeTarget(player);
                        setOutgoingIds([]);
                        setOutgoingPicks([]);
                        setMessage("");
                      }}
                      className="min-h-11 shrink-0 rounded-xl border border-emerald-300/30 px-3 text-[10px] font-black text-emerald-300"
                    >
                      BUILD OFFER
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {commandTab === "roster" && (
            <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-4 sm:p-6">
              <h2 className="text-3xl font-black">YOUR ROSTER</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {roster.length} players · strongest ratings first
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {roster
                  .slice()
                  .sort((a, b) => b.ovr - a.ovr)
                  .map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between rounded-xl bg-black/25 p-3"
                    >
                      <div>
                        <div className="text-sm font-black"><SoloPlayerLink player={player}/></div>
                        <div className="text-[10px] text-zinc-500">
                          {player.position} · ${player.salary}M
                          {player.salaryType === "estimated"
                            ? " estimated"
                            : ""}
                        </div>
                      </div>
                      <div className="text-lg font-black text-emerald-300">
                        {player.ovr}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
          {tradeTarget && (
            <ModalPortal>
              <div
                className="fixed inset-0 z-[9999] flex items-end bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5"
                role="dialog"
                aria-modal="true"
                aria-label="Build trade offer"
              >
                <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0d1219] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-3xl sm:rounded-[2rem] sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black tracking-[.22em] text-emerald-300">
                        YOU CONTROL EVERY ASSET
                      </div>
                      <h2 className="mt-1 text-3xl font-black">
                        BUILD THE OFFER
                      </h2>
                    </div>
                    <button
                      onClick={() => setTradeTarget(null)}
                      className="grid h-11 w-11 place-items-center rounded-full border border-white/10"
                      aria-label="Close trade builder"
                    >
                      <X />
                    </button>
                  </div>
                  <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                    <div className="text-[9px] font-black text-zinc-500">
                      YOU RECEIVE
                    </div>
                    <div className="mt-1 font-black">
                      <SoloPlayerIdentity player={tradeTarget}/>{" "}
                      <span className="text-emerald-300">
                        {tradeTarget.ovr} OVR
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {tradeTarget.team} · {tradeTarget.position} · Value{" "}
                      {requestedValue}
                    </div>
                  </div>
                  <h3 className="mt-5 text-sm font-black">
                    YOUR PLAYER{" "}
                    <span className="text-zinc-500">· SELECT ONE</span>
                  </h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {roster
                      .slice()
                      .sort((a, b) => b.ovr - a.ovr)
                      .map((player) => {
                        const selected = outgoingIds.includes(player.id);
                        return (
                          <button
                            key={player.id}
                            onClick={() =>
                              setOutgoingIds(selected ? [] : [player.id])
                            }
                            className={`flex min-h-14 items-center justify-between rounded-xl border px-3 text-left ${selected ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-black/20"}`}
                          >
                            <div>
                              <div className="text-xs font-black">
                                <SoloPlayerIdentity player={player}/>
                              </div>
                              <div className="text-[9px] text-zinc-500">
                                {player.position} · {player.ovr} OVR · Value{" "}
                                {tradeValue(player)}
                              </div>
                            </div>
                            {selected && (
                              <Check className="h-4 w-4 text-emerald-300" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                  <h3 className="mt-5 text-sm font-black">
                    FUTURE DRAFT PICKS{" "}
                    <span className="text-zinc-500">· OPTIONAL SWEETENERS</span>
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {draftPicks.map((pick) => {
                      const key = franchiseDraftPickKey(pick);
                      const selected = outgoingPicks.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() =>
                            setOutgoingPicks((picks) =>
                              selected
                                ? picks.filter((selectedKey) => selectedKey !== key)
                                : [...picks, key],
                            )
                          }
                          className={`min-h-14 rounded-xl border text-xs font-black ${selected ? "border-emerald-300 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-black/20"}`}
                        >
                          {ordinal(pick.round).toUpperCase()} ROUND
                          <div className="text-[9px] text-zinc-500">
                            {pick.originalTeam} · {PICK_VALUES[pick.round - 1]} value
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!draftPicks.length && (
                    <div className="mt-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-200">
                      You traded every pick in this draft.
                    </div>
                  )}
                  {builderPreview && builderPartnerPreview && <section aria-label="Trade impact preview" className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/5 p-4"><h3 className="text-sm font-black text-sky-200">TRADE IMPACT</h3><dl className="mt-2 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-zinc-400">Your cap room</dt><dd className="mt-1 font-black">${builderPreview.capRoom.toFixed(2)}M</dd></div><div><dt className="text-zinc-400">Partner cap room</dt><dd className="mt-1 font-black">${builderPartnerPreview.capRoom.toFixed(2)}M</dd></div><div><dt className="text-zinc-400">Your roster</dt><dd className="mt-1 font-black">{builderPreview.rosterSize} players</dd></div><div><dt className="text-zinc-400">Average OVR change</dt><dd className="mt-1 font-black">{builderPreview.ovrDelta >= 0 ? '+' : ''}{builderPreview.ovrDelta.toFixed(2)}</dd></div></dl>{builderErrors.map(error => <p key={error} className="mt-2 text-xs text-red-300">{error}</p>)}</section>}
                  {message && <p role="status" className="mt-3 text-sm leading-5 text-amber-200">{message}</p>}
                  <div className="mt-5 flex items-center justify-between rounded-2xl bg-black/30 p-4">
                    <div>
                      <div className="text-[9px] font-black text-zinc-500">
                        OFFER VALUE
                      </div>
                      <div
                        className={`text-2xl font-black ${offeredValue >= requestedValue * 0.92 ? "text-emerald-300" : "text-amber-300"}`}
                      >
                        {offeredValue} / {Math.ceil(requestedValue * 0.92)}
                      </div>
                    </div>
                    <button
                      onClick={submitOffer}
                      disabled={outgoingIds.length !== 1 || builderErrors.length > 0}
                      className="min-h-12 rounded-xl bg-emerald-300 px-5 text-xs font-black text-black disabled:opacity-30"
                    >
                      PROPOSE TRADE
                    </button>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
        </div>
      </BroadcastStage>
    );
  }

  const selectedTeam = teamByAbbr(selectedAbbr);
  const previewRoster = buildSoloTeamRoster(selectedAbbr);
  const topPlayers = previewRoster
    .slice()
    .sort((first, second) => second.ovr - first.ovr)
    .slice(0, 3);

  return (
    <BroadcastStage scene="suite" page="franchise" quiet={seasonOpen} className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <BroadcastMasthead compact eyebrow="Football operations" title="Franchise Command" subtitle="Choose your team. Build a contender."/>
        <button
          type="button"
          onClick={onBack}
          className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]"
          aria-label="Back to Solo Franchise Hub"
        >
          <ArrowLeft size={19} />
        </button>
        <div className="mt-3"><ModeHelp mode="gm" /></div>
        <div className="bk-franchise-panel mt-5 rounded-[2rem] border border-white/10 bg-[#10151d] p-5 sm:p-8">
          <GmArtwork scene="office" />
          <div className="text-[10px] font-black tracking-[.25em] text-[var(--bk-team-accent)]">
            BALL KNOWER LEAGUE ROSTERS
          </div>
          <h2 className="mt-2 text-4xl font-black leading-none">
            TAKE OVER A TEAM
          </h2>
          <p className="mt-3 text-sm font-semibold text-zinc-400">
            Choose one of 32 original simulated teams and start your franchise
            immediately.
          </p>
          <div className="mt-6">
            <SoloTeamPicker
              selectedAbbr={selectedAbbr}
              onSelect={setSelectedAbbr}
            />
          </div>
        </div>

        <div className="mt-4 rounded-[2rem] border border-white/10 bg-[#111] p-5">
          {message ? (
            <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">
              {message}
            </div>
          ) : null}
          <div className="flex items-center gap-4">
            <img
              src={soloTeamLogoUrl(selectedTeam.abbr)}
              alt=""
              aria-hidden="true"
              className="h-16 w-16 object-contain"
            />
            <div>
              <div className="text-2xl font-black">{selectedTeam.name}</div>
              <div className="text-xs font-bold text-zinc-500">
                CURRENT 2026 LINEUP
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {topPlayers.map((player) => (
              <div
                key={player.id}
                className="min-w-0 rounded-2xl bg-white/5 p-3"
              >
                <div className="truncate text-xs font-black"><SoloPlayerLink player={player}/></div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  {player.position} • {player.ovr} OVR
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={start}
            className="mt-5 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"
          >
            <Play className="mr-2 inline" /> START FRANCHISE
          </button>
        </div>
      </div>
    </BroadcastStage>
  );
};

function teamByAbbr(abbr: string) {
  return SOLO_TEAM_THEMES.find((team) => team.abbr === abbr) ?? SOLO_TEAM_THEMES[0];
}

const PICK_VALUES = [38, 22, 12, 7, 4, 2, 1];
const tradeValue = (player: Player) =>
  Math.max(4, Math.round((player.ovr - 62) * 2.25 - player.salary * 0.2));
const ordinal = (round: number) =>
  `${round}${round === 1 ? "st" : round === 2 ? "nd" : round === 3 ? "rd" : "th"}`;
