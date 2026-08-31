import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  FastForward,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { PLAYERS_DATABASE } from "./players";
import { Player } from "./types";
import { playerPortraitUrl } from "./playerPortraits";
import { ModalPortal } from "./ModalPortal";
import { commitAgentSigningForExpectedUser, loadUserState } from "./userStateCloud";
import { claimPendingVerifiedModeMilestones } from "./modeProgressionCloud";
import { ensureOnlineSession } from "./supabase";
import {
  createRecruitingProfile,
  evaluateRecruitingDecision,
  RecruitingPitch,
  RecruitingProfile,
  recruitingPitchImpact,
  recruitingRoundChoices,
} from "./agentRecruiting";
import {
  agentActionsRemaining,
  agentWeekKey,
  ClientCareer,
  ClientEventChoice,
  ContractStrategy,
  clientRetentionStatus,
  contractStrategyModifiers,
  createClientCareer,
  nextClientEvent,
  resolveClientEvent,
} from "./agentClientCareer";
import {
  AgencyStaff,
  STAFF_OPTIONS,
  StaffRole,
  agencyClientCapacity,
  buildAgencyResume,
  contractFeeK,
  hireAgencyStaff,
} from "./agentAgencyGrowth";

const SAVE_KEY = "ballknower_player_agent_v4";
const PENDING_SIGNING_KEY = "ballknower_player_agent_signing_pending_v1";
const AGENT_SIGNING_LOCK_NAME = "ballknower-player-agent-signing-v1";
const AGENT_SESSION_TIMEOUT_MS = 12_000;
const LEGACY_SAVE_KEYS = [
  "ballknower_player_agent_v3",
  "ballknower_player_agent_v2",
  "ballknower_player_agent_v1",
];
const RECRUIT_COOLDOWN_DAYS = 7;
const TRADE_DEADLINE_WEEK = 9;
const REGULAR_SEASON_WEEKS = 18;

type Pitch = RecruitingPitch;
type AgentProfile = { name: string; age: number; location: string };
type FutureDeal = {
  totalM: number;
  annualM: number;
  guaranteedM: number;
  years: number;
  negotiatedAt: string;
};
type NegotiationState = {
  playerId: string;
  round: number;
  years: number;
  annualM: number;
  guaranteedPct: number;
  gmPatience: number;
  message: string;
  strategy: ContractStrategy;
};
type TradeRequest = {
  requestedWeek: number;
  requestedAt: string;
  reason: string;
  status: "open" | "resolved" | "denied";
  attempts?: number;
  outcome?: string;
  destination?: string;
};
type Client = {
  playerId: string;
  trust: number;
  currentTeam?: string;
  futureDeal?: FutureDeal;
  signedAt: string;
  tradeRequest?: TradeRequest;
  career: ClientCareer;
};
type SeasonPhase = "preseason" | "regular" | "postseason" | "offseason";
type AgencyState = {
  profile?: AgentProfile;
  reputation: number;
  negotiation: number;
  brandPower: number;
  clientCare: number;
  clients: Client[];
  wins: number;
  losses: number;
  recruitCooldowns: Record<string, string>;
  recruitLockouts: Record<string, number>;
  storyStarted: boolean;
  seasonYear: number;
  seasonWeek: number;
  phase: SeasonPhase;
  simulatedDate: string;
  timeline: string[];
  weeklyActionKey: string;
  weeklyActionsUsed: number;
  cashK: number;
  staff: AgencyStaff[];
  signedClients: number;
  dealHistory: FutureDeal[];
  promisesKept: number;
  promisesBroken: number;
};
type RecruitState = {
  playerId: string;
  baseInterest: number;
  interest: number;
  round: number;
  used: Pitch[];
  rivalPressure: number;
  message: string;
  playerReply: string;
  choices: Pitch[];
  scenarioIndex: number;
  profile: RecruitingProfile;
  beforeState?: AgencyState;
  completed?: boolean;
  failed?: boolean;
};

export const isAgentTradeWindowOpen = (phase: SeasonPhase, week: number) =>
  phase === "regular" &&
  Number.isInteger(week) &&
  week >= 1 &&
  week <= TRADE_DEADLINE_WEEK;

export const agentTradeWindowMessage = (phase: SeasonPhase) =>
  phase === "preseason"
    ? "The regular-season trade window is not open yet. This request remains open."
    : `The Week ${TRADE_DEADLINE_WEEK} trade deadline has passed. This request remains open until the next regular-season trade window.`;

export const canResolveAgentTradeRequest = (
  status: "resolved" | "denied",
  phase: SeasonPhase,
  week: number,
) => status !== "resolved" || isAgentTradeWindowOpen(phase, week);

const MAJOR_CITIES = [
  "Atlanta, GA",
  "Austin, TX",
  "Baltimore, MD",
  "Boston, MA",
  "Buffalo, NY",
  "Charlotte, NC",
  "Chicago, IL",
  "Cincinnati, OH",
  "Cleveland, OH",
  "Columbus, OH",
  "Dallas, TX",
  "Denver, CO",
  "Detroit, MI",
  "Fort Worth, TX",
  "Houston, TX",
  "Indianapolis, IN",
  "Jacksonville, FL",
  "Kansas City, MO",
  "Las Vegas, NV",
  "Los Angeles, CA",
  "Louisville, KY",
  "Memphis, TN",
  "Miami, FL",
  "Milwaukee, WI",
  "Minneapolis, MN",
  "Nashville, TN",
  "New Orleans, LA",
  "New York, NY",
  "Oklahoma City, OK",
  "Orlando, FL",
  "Philadelphia, PA",
  "Phoenix, AZ",
  "Pittsburgh, PA",
  "Portland, OR",
  "Raleigh, NC",
  "Sacramento, CA",
  "Salt Lake City, UT",
  "San Antonio, TX",
  "San Diego, CA",
  "San Francisco, CA",
  "San Jose, CA",
  "Seattle, WA",
  "St. Louis, MO",
  "Tampa, FL",
  "Washington, DC",
  "Allentown, PA",
  "Birmingham, AL",
  "Boise, ID",
  "Charleston, SC",
  "Des Moines, IA",
  "Hartford, CT",
  "Honolulu, HI",
  "Little Rock, AR",
  "Omaha, NE",
  "Providence, RI",
  "Richmond, VA",
  "Rochester, NY",
  "Tucson, AZ",
  "Virginia Beach, VA",
  "Wichita, KS",
];

const fallbackAgency = (): AgencyState => ({
  reputation: 20,
  negotiation: 32,
  brandPower: 24,
  clientCare: 48,
  clients: [],
  wins: 0,
  losses: 0,
  recruitCooldowns: {},
  recruitLockouts: {},
  storyStarted: false,
  seasonYear: 2026,
  seasonWeek: 0,
  phase: "preseason",
  simulatedDate: "2026-09-03",
  timeline: [
    "Your agency opened its doors. The league has no idea who you are yet.",
  ],
  weeklyActionKey: "2026:preseason:0",
  weeklyActionsUsed: 0,
  cashK: 150,
  staff: [],
  signedClients: 0,
  dealHistory: [],
  promisesKept: 0,
  promisesBroken: 0,
});

const restore = (): AgencyState => {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      for (const key of LEGACY_SAVE_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) return fallbackAgency();
    const v = JSON.parse(raw);
    return {
      ...fallbackAgency(),
      ...v,
      profile: v?.profile,
      clients: Array.isArray(v?.clients)
        ? v.clients
            .map((c: any) => ({
              playerId: String(c.playerId),
              trust: Number.isFinite(Number(c.trust))
                ? clamp(Number(c.trust), 0, 100)
                : 72,
              currentTeam:
                typeof c.currentTeam === "string" && c.currentTeam
                  ? c.currentTeam
                  : undefined,
              futureDeal: c.futureDeal,
              signedAt: c.signedAt || new Date().toISOString(),
              tradeRequest: c.tradeRequest,
              career:
                c.career ||
                createClientCareer(
                  [],
                  Number.isFinite(Number(c.trust))
                    ? clamp(Number(c.trust), 0, 100)
                    : 72,
                ),
            }))
            .slice(0, 5)
        : [],
      recruitCooldowns:
        v?.recruitCooldowns && typeof v.recruitCooldowns === "object"
          ? v.recruitCooldowns
          : {},
      recruitLockouts:
        v?.recruitLockouts && typeof v.recruitLockouts === "object"
          ? v.recruitLockouts
          : {},
      storyStarted: Boolean(v?.profile),
      timeline: Array.isArray(v?.timeline)
        ? v.timeline
        : fallbackAgency().timeline,
      weeklyActionKey:
        typeof v?.weeklyActionKey === "string"
          ? v.weeklyActionKey
          : agentWeekKey(
              v?.seasonYear || 2026,
              v?.phase || "preseason",
              v?.seasonWeek || 0,
            ),
      weeklyActionsUsed: Number.isFinite(Number(v?.weeklyActionsUsed))
        ? clamp(Number(v.weeklyActionsUsed), 0, 2)
        : 0,
      cashK: Number.isFinite(Number(v?.cashK)) ? Math.max(0, Number(v.cashK)) : 150,
      staff: Array.isArray(v?.staff) ? v.staff : [],
      signedClients: Number.isFinite(Number(v?.signedClients))
        ? Math.max(Number(v.signedClients), Array.isArray(v?.clients) ? v.clients.length : 0)
        : Array.isArray(v?.clients) ? v.clients.length : 0,
      dealHistory: Array.isArray(v?.dealHistory)
        ? v.dealHistory
        : Array.isArray(v?.clients)
          ? v.clients.flatMap((c: Client) => c.futureDeal ? [c.futureDeal] : [])
          : [],
      promisesKept: Number.isFinite(Number(v?.promisesKept))
        ? Math.max(0, Number(v.promisesKept))
        : Array.isArray(v?.clients)
          ? v.clients.reduce((n: number, c: Client) => n + (c.career?.fulfilledPromises?.length || 0), 0)
          : 0,
      promisesBroken: Number.isFinite(Number(v?.promisesBroken))
        ? Math.max(0, Number(v.promisesBroken))
        : Array.isArray(v?.clients)
          ? v.clients.reduce((n: number, c: Client) => n + (c.career?.brokenPromises?.length || 0), 0)
          : 0,
    };
  } catch {
    return fallbackAgency();
  }
};

const persist = (state: AgencyState) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {}
};

const ensureAgentSigningSession = async () => {
  let timer = 0;
  try {
    return await Promise.race([
      ensureOnlineSession(),
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new Error("Secure Agent session timed out. Retry when the connection is stable.")),
          AGENT_SESSION_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
};

const loadAuthoritativeAgentCareer = async (): Promise<AgencyState> => {
  const cloud = await loadUserState<{ raw?: unknown }>("player_agent_career");
  if (!cloud || typeof cloud.raw !== "string") {
    throw new Error("Authoritative Agent career is unavailable.");
  }
  localStorage.setItem(SAVE_KEY, cloud.raw);
  return restore();
};

const withAgentSigningTabLock = async <T,>(task: () => Promise<T>): Promise<T> => {
  if (typeof navigator === "undefined" || !navigator.locks) return task();
  return navigator.locks.request(
    AGENT_SIGNING_LOCK_NAME,
    { mode: "exclusive" },
    task,
  );
};

type PendingAgentSigning = {
  userId: string;
  beforeState: AgencyState;
  state: AgencyState;
};

class AgentSigningConflictError extends Error {}

let pendingAgentSigningWrite: Promise<void> | null = null;
const readPendingAgentSigning = (): PendingAgentSigning | null => {
  try {
    const raw = localStorage.getItem(PENDING_SIGNING_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Partial<PendingAgentSigning>;
    if (
      typeof pending.userId !== "string" ||
      !pending.userId ||
      !pending.beforeState ||
      typeof pending.beforeState !== "object" ||
      !pending.state ||
      typeof pending.state !== "object"
    ) {
      return null;
    }
    return pending as PendingAgentSigning;
  } catch {
    return null;
  }
};
const verifyPendingAgentSigning = async (
  state?: AgencyState,
  signingUserId?: string,
  beforeState?: AgencyState,
): Promise<void> => {
  if (state) {
    if (!signingUserId || !beforeState) {
      throw new Error("Signing account and pre-signing state are required.");
    }
    localStorage.setItem(
      PENDING_SIGNING_KEY,
      JSON.stringify({
        userId: signingUserId,
        beforeState,
        state,
      } satisfies PendingAgentSigning),
    );
  }
  if (pendingAgentSigningWrite) return pendingAgentSigningWrite;

  const write = (async () => {
    while (true) {
      const raw = localStorage.getItem(PENDING_SIGNING_KEY);
      if (!raw) return;
      const pending = readPendingAgentSigning();
      if (!pending) {
        if (localStorage.getItem(PENDING_SIGNING_KEY) === raw) {
          localStorage.removeItem(PENDING_SIGNING_KEY);
        }
        continue;
      }

      const user = await ensureAgentSigningSession();
      if (pending.userId !== user.id) {
        if (localStorage.getItem(PENDING_SIGNING_KEY) === raw) {
          localStorage.removeItem(PENDING_SIGNING_KEY);
        }
        continue;
      }

      try {
        await commitAgentSigningForExpectedUser(
          pending.userId,
          { raw: JSON.stringify(pending.beforeState) },
          { raw: JSON.stringify(pending.state) },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Agent career changed before signing")) {
          if (localStorage.getItem(PENDING_SIGNING_KEY) === raw) {
            localStorage.removeItem(PENDING_SIGNING_KEY);
          }
          throw new AgentSigningConflictError(
            "Another tab changed this Agent career first. The latest saved career was restored.",
          );
        }
        throw error;
      }
      if (localStorage.getItem(PENDING_SIGNING_KEY) !== raw) {
        continue;
      }

      localStorage.removeItem(PENDING_SIGNING_KEY);
      try {
        await claimPendingVerifiedModeMilestones();
      } catch (error) {
        // The durable milestone remains replayable after the signing save succeeds.
        console.warn("Agent signing milestone claim deferred", error);
      }
      // Loop once more in case a newer signing arrived while this save or
      // milestone claim was in flight.
    }
  })();
  pendingAgentSigningWrite = write;
  try {
    await write;
  } finally {
    if (pendingAgentSigningWrite === write) pendingAgentSigningWrite = null;
  }
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const moneyM = (n: number) => `$${n.toFixed(1)}M`;
const prettyDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const cooldownDaysLeft = (
  until?: string,
  from = new Date().toISOString().slice(0, 10),
) => {
  if (!until) return 0;
  return Math.max(
    0,
    Math.ceil(
      (new Date(`${until}T12:00:00`).getTime() -
        new Date(`${from}T12:00:00`).getTime()) /
        86400000,
    ),
  );
};

const marketProjection = (p: Player) => {
  const age = p.age ?? 27;
  const ageFactor =
    age <= 24 ? 1.14 : age <= 27 ? 1.04 : age <= 30 ? 0.92 : 0.72;
  const premium =
    p.position === "QB"
      ? 1.35
      : ["WR", "EDGE", "OT", "LT", "RT", "CB"].includes(p.position)
        ? 1.12
        : 1;
  const specialistFactor = ["K", "P"].includes(p.position) ? 0.38 : 1;
  return Math.max(
    1.1,
    p.salary * 1.08,
    (p.ovr - 60) * 0.62 * ageFactor * premium * specialistFactor,
  );
};
const salaryRange = (p: Player) => {
  const mid = marketProjection(p);
  return [Math.max(1, mid * 0.82), mid * 1.18] as const;
};
const maxUnlockedOverall = (reputation: number) =>
  reputation < 45
    ? 75
    : reputation < 60
      ? 80
      : reputation < 75
        ? 85
        : reputation < 90
          ? 90
          : 99;
const pitchLabel: Record<Pitch, string> = {
  money: "I can get you paid",
  guarantees: "I will protect your guarantees",
  loyalty: "I will stay when it gets hard",
  winning: "I will find the right contender",
  playing_time: "I will fight for the right role",
  family: "Your family has a seat at the table",
  brand: "I can grow your name",
  long_term: "I have a plan beyond one deal",
};
const QUESTIONS = [
  "Why should I trust a rookie with the biggest year of my career?",
  "My last agent disappeared when things got hard. What makes you different?",
  "Teams see my role. Do you actually see the player I can become?",
  "My family needs stability. What is your plan beyond one contract?",
  "I am tired of empty promises. What can you change right now?",
  "A bigger agency is calling. Why should I choose the underdog?",
  "My market is quiet. How are you going to create leverage?",
  "I want respect, not just headlines. Can you deliver both?",
  "One bad season can erase me. How do you protect my future?",
  "I need somebody willing to challenge a front office. Is that you?",
];
const STORIES = [
  "The veteran across the table has heard every sales pitch in football.",
  "His family and advisor are listening from the back of the room.",
  "A rival agency has already promised a national campaign.",
  "The player has one season to turn a limited role into a real market.",
  "His current team likes him, but has not committed to an extension.",
];
const PITCH_VARIANTS: Record<Pitch, string[]> = {
  money: [
    "Build leverage before we name a price",
    "Make every team bid against the market",
    "Protect the guarantees, not just the headline",
  ],
  guarantees: [
    "Secure the money that cannot disappear",
    "Make injury protection part of the deal",
    "Trade headlines for real security",
  ],
  loyalty: [
    "You get my number, not an assistant",
    "I stay involved when the season turns",
    "I tell you the truth before I sell a dream",
  ],
  winning: [
    "Target teams built to play in January",
    "Make winning part of every decision",
    "Find a contender that truly needs you",
  ],
  playing_time: [
    "Find the scheme that unlocks your game",
    "Use your film to prove the role is too small",
    "Create a path to meaningful snaps",
  ],
  family: [
    "Put location and stability into the plan",
    "Make every move work off the field too",
    "Your family is part of every decision",
  ],
  brand: [
    "Turn your work into a story teams remember",
    "Own your name before somebody else defines it",
    "Make your production impossible to ignore",
  ],
  long_term: [
    "Build the next three moves, not just one",
    "Protect your career after the next contract",
    "Plan for the player you will be in five years",
  ],
};
const hashPlayer = (id: string) =>
  Array.from(id).reduce((n, c) => n + c.charCodeAt(0), 0);
const scenarioFor = (p: Player) => {
  const index = hashPlayer(p.id) % 50;
  return {
    index,
    question: QUESTIONS[index % QUESTIONS.length],
    story: `${STORIES[Math.floor(index / 10)]} ${p.position} value, role and the final year of his deal all shape this meeting.`,
  };
};
const playerReplyForPitch = (pitch: Pitch, scenarioIndex = 0) => {
  const promise =
    PITCH_VARIANTS[pitch][scenarioIndex % PITCH_VARIANTS[pitch].length];
  if (scenarioIndex % 2 === 1)
    return `“${promise} sounds real. Give me one more reason this is not just a pitch.”`;
  if (pitch === "money")
    return "“Everybody says they can get me paid. Show me why you are different.”";
  if (pitch === "loyalty")
    return "“My last agent talked a lot. I need somebody who actually picks up the phone.”";
  if (pitch === "guarantees")
    return "“The headline number means nothing if the team can walk away. Keep talking.”";
  if (pitch === "winning")
    return "“I want January football, but I will not disappear on somebody else’s depth chart.”";
  if (pitch === "playing_time")
    return "“Show me the team and scheme where that role is real.”";
  if (pitch === "family")
    return "“That matters more than most agents understand.”";
  if (pitch === "brand")
    return "“I am not a superstar yet. If you can help people notice my game, I am listening.”";
  if (pitch === "long_term")
    return "“A real career plan is different. Tell me what the second contract sets up.”";
  return "“Everybody says they can get me paid. Show me why you are different.”";
};

const tradeReasons = (p: Player) => [
  `${p.name} is frustrated with his role and wants a bigger opportunity.`,
  `${p.name} believes the current offense/defense is hurting his value before his next contract.`,
  `${p.name} wants a fresh start with a contender before the deadline.`,
  `${p.name} is unhappy with how the team has handled his playing time and future.`,
  `${p.name} thinks a new team can put him in a better position for his next deal.`,
];

export const PlayerAgentMode: React.FC<{ onBack: () => void }> = ({
  onBack,
}) => {
  const [agency, setAgency] = useState<AgencyState>(restore);
  const [introStep, setIntroStep] = useState(0);
  const [draftName, setDraftName] = useState(agency.profile?.name || "");
  const [draftAge, setDraftAge] = useState(String(agency.profile?.age || 22));
  const [draftLocation, setDraftLocation] = useState(
    agency.profile?.location || "",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recruit, setRecruit] = useState<RecruitState | null>(null);
  const [negotiationRoom, setNegotiationRoom] =
    useState<NegotiationState | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [levelUp, setLevelUp] = useState<{ from: number; to: number } | null>(
    null,
  );
  const [agentSigningError, setAgentSigningError] = useState("");
  const signingInFlightRef = useRef(false);
  const [signingInFlight, setSigningInFlight] = useState(false);
  const [verifyingAgentSigning, setVerifyingAgentSigning] = useState(
    () => pendingAgentSigningWrite !== null || readPendingAgentSigning() !== null,
  );
  const recoverAgentSigningConflict = async (error: AgentSigningConflictError) => {
    let latest = restore();
    try {
      latest = await loadAuthoritativeAgentCareer();
    } catch (loadError) {
      console.warn("Authoritative Agent career reload deferred", loadError);
    }
    setAgency(latest);
    setRecruit(null);
    setSelectedId(null);
    setAgentSigningError(error.message);
    setVerifyingAgentSigning(false);
  };
  const retryAgentSigningVerification = async (
    state?: AgencyState,
    signingUserId?: string,
    beforeState?: AgencyState,
  ) => {
    setVerifyingAgentSigning(true);
    try {
      await verifyPendingAgentSigning(state, signingUserId, beforeState);
      setVerifyingAgentSigning(pendingAgentSigningWrite !== null || readPendingAgentSigning() !== null);
    } catch (error) {
      if (error instanceof AgentSigningConflictError) {
        await recoverAgentSigningConflict(error);
        return;
      }
      // Keep the lock and durable retry snapshot until cloud persistence works.
      setVerifyingAgentSigning(true);
      console.warn("Agent signing cloud verification pending retry", error);
    }
  };
  const handleBack = () => {
    onBack();
  };
  useEffect(() => {
    let cancelled = false;
    const retryPendingSigning = () => {
      if (!readPendingAgentSigning() && !pendingAgentSigningWrite) {
        if (!cancelled) setVerifyingAgentSigning(false);
        return;
      }
      if (!cancelled) setVerifyingAgentSigning(true);
      void verifyPendingAgentSigning()
        .then(() => {
          if (!cancelled) {
            setVerifyingAgentSigning(readPendingAgentSigning() !== null);
          }
        })
        .catch((error) => {
          if (!cancelled && error instanceof AgentSigningConflictError) {
            void recoverAgentSigningConflict(error);
            return;
          }
          if (!cancelled) setVerifyingAgentSigning(true);
          console.warn("Agent signing cloud verification pending retry", error);
        });
    };
    const handlePendingSigningStorage = (event: StorageEvent) => {
      if (event.key !== PENDING_SIGNING_KEY) return;
      if (!event.newValue) {
        const activeWrite = pendingAgentSigningWrite;
        if (!activeWrite) {
          if (!cancelled) {
            setAgency(restore());
            setRecruit(null);
            setSelectedId(null);
            setVerifyingAgentSigning(false);
          }
          return;
        }
        if (!cancelled) setVerifyingAgentSigning(true);
        void activeWrite.finally(() => {
          window.setTimeout(() => {
            if (!cancelled) {
              const stillPending =
                pendingAgentSigningWrite !== null || readPendingAgentSigning() !== null;
              if (!stillPending) {
                setAgency(restore());
                setRecruit(null);
                setSelectedId(null);
              }
              setVerifyingAgentSigning(stillPending);
            }
          }, 0);
        }).catch(() => undefined);
        return;
      }
      retryPendingSigning();
    };
    window.addEventListener("storage", handlePendingSigningStorage);
    retryPendingSigning();
    return () => {
      cancelled = true;
      window.removeEventListener("storage", handlePendingSigningStorage);
    };
  }, []);
  const clients = useMemo(
    () =>
      agency.clients
        .map((client) => ({
          client,
          player: PLAYERS_DATABASE.find((p) => p.id === client.playerId),
        }))
        .filter((x): x is { client: Client; player: Player } =>
          Boolean(x.player),
        ),
    [agency.clients],
  );

  const unlockedOvr = maxUnlockedOverall(agency.reputation);
  const prospects = useMemo(
    () =>
      PLAYERS_DATABASE.filter((p) => p.active !== false)
        .filter((p) => !agency.clients.some((c) => c.playerId === p.id))
        .filter((p) => p.ovr <= unlockedOvr)
        .filter((p) => filter === "ALL" || p.position === filter)
        .sort((a, b) => b.ovr - a.ovr || a.salary - b.salary)
        .slice(0, 50),
    [agency.clients, filter, unlockedOvr],
  );

  const selected = PLAYERS_DATABASE.find((p) => p.id === selectedId) || null;
  const actionsRemaining = agentActionsRemaining(agency.weeklyActionsUsed);
  const clientCapacity = agencyClientCapacity(agency.staff);
  const resume = buildAgencyResume({
    reputation: agency.reputation,
    activeClients: agency.clients.length,
    signedClients: agency.signedClients,
    wins: agency.wins,
    losses: agency.losses,
    staff: agency.staff,
    deals: agency.dealHistory,
    fulfilledPromises: agency.promisesKept,
    brokenPromises: agency.promisesBroken,
  });
  const spendAction = (label: string) => {
    if (actionsRemaining <= 0) {
      const next = {
        ...agency,
        timeline: [
          `No agency actions remain this week. Advance the calendar before ${label.toLowerCase()}.`,
          ...agency.timeline,
        ].slice(0, 20),
      };
      setAgency(next);
      persist(next);
      return null;
    }
    return { ...agency, weeklyActionsUsed: agency.weeklyActionsUsed + 1 };
  };

  const createAgent = () => {
    const age = Number(draftAge);
    if (
      !draftName.trim() ||
      !draftLocation.trim() ||
      !Number.isFinite(age) ||
      age < 18
    )
      return;
    const next: AgencyState = {
      ...agency,
      profile: { name: draftName.trim(), age, location: draftLocation.trim() },
      storyStarted: true,
      reputation: agency.profile ? agency.reputation : 20,
    };
    setAgency(next);
    persist(next);
    setIntroStep(3);
  };

  const hireStaff = (role: StaffRole) => {
    const result = hireAgencyStaff(role, agency.cashK, agency.staff, agency.simulatedDate);
    if (!result.hired) return;
    const next: AgencyState = {
      ...agency,
      cashK: result.cashK,
      staff: result.staff,
      negotiation: clamp(agency.negotiation + (role === "negotiator" ? 6 : 0), 0, 100),
      clientCare: clamp(agency.clientCare + (role === "client_manager" ? 6 : 0), 0, 100),
      brandPower: clamp(agency.brandPower + (role === "brand_director" ? 6 : 0), 0, 100),
      timeline: [`${result.hired.name} joined as ${STAFF_OPTIONS[role].label.toLowerCase()}.`, ...agency.timeline].slice(0, 20),
    };
    setAgency(next);
    persist(next);
  };

  const advanceWeek = () => {
    if (verifyingAgentSigning) return;
    let nextWeek = agency.seasonWeek + 1;
    let nextYear = agency.seasonYear;
    let nextPhase: SeasonPhase = agency.phase;
    let nextDate = addDays(agency.simulatedDate, 7);
    const events: string[] = [];

    if (agency.phase === "preseason") {
      nextPhase = "regular";
      nextWeek = 1;
      events.push(`The ${nextYear} regular season has begun.`);
    } else if (agency.phase === "regular" && nextWeek > REGULAR_SEASON_WEEKS) {
      nextPhase = "postseason";
      nextWeek = 1;
      events.push(
        "The regular season is over. Postseason and end-of-year contract decisions begin.",
      );
    } else if (agency.phase === "postseason" && nextWeek > 5) {
      nextPhase = "offseason";
      nextWeek = 1;
      events.push(
        "The offseason has begun. Teams are preparing for the new league year.",
      );
    } else if (agency.phase === "offseason" && nextWeek > 4) {
      nextYear += 1;
      nextPhase = "preseason";
      nextWeek = 0;
      events.push(
        `The ${nextYear} league year is open. Contract markets reset and every relationship matters again.`,
      );
    }

    const updatedClients = agency.clients.map((client) => {
      const p = PLAYERS_DATABASE.find((x) => x.id === client.playerId);
      if (!p) return client;
      const tradeWindowOpen =
        nextPhase === "regular" && nextWeek <= TRADE_DEADLINE_WEEK;
      const alreadyOpen = client.tradeRequest?.status === "open";
      const requestChance = Math.max(
        0.03,
        Math.min(0.18, 0.13 - client.trust / 1000 + (p.ovr >= 75 ? 0.02 : 0)),
      );
      const careerEvent = nextClientEvent(
        p,
        client.career,
        nextYear,
        nextPhase,
        nextWeek,
      );
      const career = careerEvent
        ? { ...client.career, pendingEvent: careerEvent }
        : client.career;
      if (careerEvent)
        events.push(
          `CLIENT DECISION: ${p.name} needs you to handle ${careerEvent.title.toLowerCase()}.`,
        );
      if (tradeWindowOpen && !alreadyOpen && Math.random() < requestChance) {
        const reasons = tradeReasons(p);
        const reason = reasons[Math.floor(Math.random() * reasons.length)];
        events.push(`TRADE REQUEST: ${reason}`);
        return {
          ...client,
          career,
          tradeRequest: {
            requestedWeek: nextWeek,
            requestedAt: nextDate,
            reason,
            status: "open" as const,
          },
        };
      }
      return { ...client, career };
    });

    if (nextPhase === "regular" && nextWeek === TRADE_DEADLINE_WEEK)
      events.push(
        "Trade deadline week. Any client who wants out has to make the move now.",
      );
    if (nextPhase === "regular" && nextWeek === TRADE_DEADLINE_WEEK + 1)
      events.push(
        "The trade deadline has passed. No new trade requests can be acted on until the next league year.",
      );

    const next: AgencyState = {
      ...agency,
      clients: updatedClients,
      seasonYear: nextYear,
      seasonWeek: nextWeek,
      phase: nextPhase,
      simulatedDate: nextDate,
      timeline: [...events, ...agency.timeline].slice(0, 20),
      weeklyActionKey: agentWeekKey(nextYear, nextPhase, nextWeek),
      weeklyActionsUsed: 0,
    };
    setAgency(next);
    persist(next);
  };

  const handleClientEvent = (playerId: string, choice: ClientEventChoice) => {
    const actionAgency = spendAction("handling a client decision");
    if (!actionAgency) return;
    const client = agency.clients.find((c) => c.playerId === playerId);
    const player = PLAYERS_DATABASE.find((p) => p.id === playerId);
    const event = client?.career.pendingEvent;
    if (!client || !player || !event) return;
    const result = resolveClientEvent({
      career: client.career,
      event,
      choice,
      agency,
    });
    const status = clientRetentionStatus(result.career);
    const fired = status === "fired";
    const newlyKept = Math.max(0, result.career.fulfilledPromises.length - client.career.fulfilledPromises.length);
    const newlyBroken = Math.max(0, result.career.brokenPromises.length - client.career.brokenPromises.length);
    const next: AgencyState = {
      ...actionAgency,
      reputation: clamp(
        actionAgency.reputation + result.reputationDelta + (fired ? -3 : 0),
        0,
        100,
      ),
      clientCare: clamp(
        actionAgency.clientCare + result.clientCareDelta,
        0,
        100,
      ),
      brandPower: clamp(actionAgency.brandPower + result.brandDelta, 0, 100),
      losses: actionAgency.losses + (fired ? 1 : 0),
      promisesKept: actionAgency.promisesKept + newlyKept,
      promisesBroken: actionAgency.promisesBroken + newlyBroken,
      clients: fired
        ? actionAgency.clients.filter((c) => c.playerId !== playerId)
        : actionAgency.clients.map((c) =>
            c.playerId === playerId
              ? { ...c, trust: result.career.trust, career: result.career }
              : c,
          ),
      timeline: [
        fired
          ? `${player.name} fired your agency after trust collapsed.`
          : `${player.name}: ${result.outcome}`,
        ...actionAgency.timeline,
      ].slice(0, 20),
    };
    setAgency(next);
    persist(next);
  };

  const resolveTradeRequest = (
    playerId: string,
    status: "resolved" | "denied",
  ) => {
    const p = PLAYERS_DATABASE.find((x) => x.id === playerId);
    const client = agency.clients.find((c) => c.playerId === playerId);
    if (!p || !client?.tradeRequest) return;
    if (!canResolveAgentTradeRequest(status, agency.phase, agency.seasonWeek)) {
      const outcome = `${agentTradeWindowMessage(agency.phase)} ${p.name}'s request cannot be worked now.`;
      const next = {
        ...agency,
        timeline: [outcome, ...agency.timeline].slice(0, 20),
      };
      setAgency(next);
      persist(next);
      return;
    }
    const currentTeam = client.currentTeam || p.team;
    const teams = [
      ...new Set(
        PLAYERS_DATABASE.map((player) => player.team).filter(
          (team) => team && team !== currentTeam && team !== "FA",
        ),
      ),
    ].sort();
    const destination =
      teams[
        hashPlayer(`${p.id}:${agency.seasonYear}:${agency.seasonWeek}`) %
          teams.length
      ] || "a new team";
    const attempts = (client.tradeRequest.attempts || 0) + 1;
    const worked =
      status === "resolved" &&
      agency.reputation +
        agency.negotiation +
        client.trust +
        (hashPlayer(`${p.id}:${attempts}`) % 25) >=
        130;
    const outcome =
      status === "denied"
        ? `You refused to pursue the request. ${p.name}'s trust took a major hit.`
        : worked
          ? `You created a market and moved ${p.name} to ${destination}.`
          : `No acceptable offer surfaced. The request stays open and ${p.name} expects another push.`;
    const next: AgencyState = {
      ...agency,
      reputation: clamp(
        agency.reputation + (worked ? 3 : status === "denied" ? -2 : 0),
        0,
        100,
      ),
      clients: agency.clients.map((c) =>
        c.playerId === playerId && c.tradeRequest
          ? {
              ...c,
              trust: clamp(
                c.trust + (worked ? 9 : status === "denied" ? -12 : -3),
                0,
                100,
              ),
              career: {
                ...c.career,
                trust: clamp(
                  c.career.trust +
                    (worked ? 9 : status === "denied" ? -12 : -3),
                  0,
                  100,
                ),
              },
              currentTeam: worked ? destination : c.currentTeam,
              tradeRequest: {
                ...c.tradeRequest,
                status: worked
                  ? "resolved"
                  : status === "denied"
                    ? "denied"
                    : "open",
                attempts,
                outcome,
                destination: worked ? destination : undefined,
              },
            }
          : c,
      ),
      timeline: [outcome, ...agency.timeline].slice(0, 20),
    };
    setAgency(next);
    persist(next);
  };

  const beginRecruit = (p: Player) => {
    if (clients.length >= clientCapacity) return;
    setAgentSigningError("");
    const actionAgency = spendAction("starting another recruiting meeting");
    if (!actionAgency) return;
    const profile = createRecruitingProfile(p);
    if (agency.recruitLockouts[p.id] === agency.seasonYear) {
      const scenario = scenarioFor(p);
      setSelectedId(p.id);
      setRecruit({
        playerId: p.id,
        baseInterest: 0,
        interest: 0,
        round: 3,
        used: [],
        rivalPressure: 0,
        failed: true,
        choices: [],
        scenarioIndex: scenario.index,
        profile,
        message: `${p.name} signed elsewhere. You are cooked for ${agency.seasonYear}; his camp will not reopen talks until next season.`,
        playerReply: "“We made our choice. See you next league year.”",
      });
      return;
    }
    const daysLeft = cooldownDaysLeft(
      agency.recruitCooldowns[p.id],
      agency.simulatedDate,
    );
    if (daysLeft > 0) {
      setSelectedId(p.id);
      setRecruit({
        playerId: p.id,
        baseInterest: 0,
        interest: 0,
        round: 1,
        used: [],
        rivalPressure: 0,
        failed: true,
        choices: [],
        scenarioIndex: 0,
        profile,
        message: `${p.name}'s camp is not taking another meeting yet. Try again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
        playerReply: "“We already made our decision for now.”",
      });
      return;
    }
    const difficulty = profile.difficulty;
    const base = clamp(
      22 +
        agency.reputation * 0.3 +
        agency.clientCare * 0.1 -
        difficulty * 0.19,
      10,
      55,
    );
    const scenario = scenarioFor(p);
    setAgency(actionAgency);
    setSelectedId(p.id);
    setRecruit({
      playerId: p.id,
      beforeState: agency,
      baseInterest: Math.round(base),
      interest: Math.round(base),
      round: 1,
      used: [],
      rivalPressure: Math.round(28 + difficulty * 0.48),
      choices: recruitingRoundChoices(p, profile, 1),
      scenarioIndex: scenario.index,
      profile,
      message: scenario.story,
      playerReply: `“${scenario.question}”`,
    });
  };

  const makePitch = async (pitch: Pitch) => {
    if (signingInFlightRef.current || verifyingAgentSigning) return;
    if (
      !selected ||
      !recruit ||
      recruit.failed ||
      recruit.completed ||
      recruit.used.includes(pitch) ||
      recruit.used.length >= 2 ||
      !recruit.choices.includes(pitch)
    )
      return;
    const impact = recruitingPitchImpact(
      pitch,
      selected,
      recruit.profile,
      agency,
    );
    const nextInterest = clamp(
      Math.round(recruit.interest + impact - recruit.rivalPressure / 28),
      0,
      100,
    );
    const used = [...recruit.used, pitch];
    if (used.length === 1) {
      setRecruit({
        ...recruit,
        interest: nextInterest,
        round: 2,
        used,
        choices: recruitingRoundChoices(
          selected,
          recruit.profile,
          2,
          recruit.choices,
        ),
        message: `${selected.name} weighs your first answer. Four new follow-ups are on the table—choose the one that fits what he actually values.`,
        playerReply: playerReplyForPitch(pitch, recruit.scenarioIndex),
      });
      return;
    }
    if (agency.clients.length >= clientCapacity) {
      setRecruit({
        ...recruit,
        used,
        choices: [],
        round: 3,
        failed: true,
        message: `Your agency already has its ${clientCapacity} clients. Hire recruiting staff or build those careers before adding anyone else.`,
        playerReply: "“Call me when your agency has room.”",
      });
      return;
    }
    const decision = evaluateRecruitingDecision({
      player: selected,
      profile: recruit.profile,
      agency,
      pitches: used,
      baseInterest: recruit.baseInterest,
      rivalPressure: recruit.rivalPressure,
      firstClient: agency.clients.length === 0,
    });
    if (decision.signed) {
      signingInFlightRef.current = true;
      setSigningInFlight(true);
      try {
        await withAgentSigningTabLock(async () => {
      const signingBeforeState = recruit.beforeState;
      if (!signingBeforeState) {
        throw new Error("Pre-recruiting Agent state is unavailable.");
      }
      const sharedAgency = restore();
      if (JSON.stringify(sharedAgency) !== JSON.stringify(signingBeforeState)) {
        throw new Error("Agent career changed in another tab before signing.");
      }
      let signingUserId: string;
      try {
        signingUserId = (await ensureAgentSigningSession()).id;
      } catch (error) {
        setRecruit({
          ...recruit,
          message: "A secure cloud connection is required before this signing can become official. Try your final pitch again when the connection returns.",
          playerReply: "“I am ready. Get the paperwork secured and we will make it official.”",
        });
        console.warn("Agent signing session unavailable", error);
        return;
      }
      if (JSON.stringify(restore()) !== JSON.stringify(signingBeforeState)) {
        throw new AgentSigningConflictError(
          "Another tab changed this Agent career during signing. The latest saved career was restored.",
        );
      }
      const cooldowns = { ...agency.recruitCooldowns };
      delete cooldowns[selected.id];
      const next: AgencyState = {
        ...agency,
        reputation: clamp(
          agency.reputation + (selected.ovr <= 75 ? 8 : 5),
          0,
          100,
        ),
        negotiation: clamp(agency.negotiation + 1, 0, 100),
        clients: [
          ...agency.clients,
          {
            playerId: selected.id,
            trust: 72,
            career: createClientCareer(used),
            signedAt: new Date().toISOString(),
          },
        ],
        wins: agency.wins + 1,
        signedClients: agency.signedClients + 1,
        recruitCooldowns: cooldowns,
        timeline: [
          `${selected.name} signed with your agency. Your two recruiting promises now follow his career.`,
          ...agency.timeline,
        ].slice(0, 20),
      };
      const before = maxUnlockedOverall(agency.reputation),
        after = maxUnlockedOverall(next.reputation);
      setAgency(next);
      persist(next);
      setRecruit({
        ...recruit,
        interest: nextInterest,
        round: 3,
        used,
        choices: [],
        completed: true,
        message: `The meeting is over. ${selected.name} chose your agency because your plan matched what matters to him—not because there was one magic answer.`,
        playerReply:
          "“You listened, you had a plan, and you did not sell me the same dream everybody else did. Let’s work.”",
      });
      // The durable pending snapshot survives mode navigation/reloads. The
      // week and Back controls stay locked until this exact signing is saved.
      await retryAgentSigningVerification(next, signingUserId, signingBeforeState);
      if (after > before) {
        setLevelUp({ from: before, to: after });
        try {
          navigator.vibrate?.([45, 40, 45, 40, 100]);
        } catch {}
      }
        });
      } catch (error) {
        const sharedAgency = restore();
        setAgency(sharedAgency);
        setAgentSigningError(
          error instanceof Error ? error.message : "Agent signing was blocked to preserve newer career progress.",
        );
        setRecruit({
          ...recruit,
          choices: [],
          failed: true,
          message: "Another Agent tab changed this career first. Its progress was preserved; reopen the meeting from the refreshed career.",
          playerReply: "“Refresh the room before we make anything official.”",
        });
        console.warn("Agent signing blocked to preserve newer cross-tab progress", error);
      } finally {
        signingInFlightRef.current = false;
        setSigningInFlight(false);
      }
    } else {
      const next: AgencyState = {
        ...agency,
        losses: agency.losses + 1,
        reputation: clamp(agency.reputation - 1, 0, 100),
        recruitCooldowns: {
          ...agency.recruitCooldowns,
          [selected.id]: addDays(agency.simulatedDate, RECRUIT_COOLDOWN_DAYS),
        },
        recruitLockouts: {
          ...agency.recruitLockouts,
          [selected.id]: agency.seasonYear,
        },
      };
      setAgency(next);
      persist(next);
      setRecruit({
        ...recruit,
        interest: nextInterest,
        round: 3,
        used,
        choices: [],
        failed: true,
        message: `${selected.name} chose another agency. Your two pitches did not fit his priorities well enough, and you cannot reopen talks during the ${agency.seasonYear} season.`,
        playerReply:
          "“I respect the work, but another agency understood what I need right now.”",
      });
    }
  };

  const openNegotiation = (p: Player, c: Client) => {
    if (c.futureDeal) return;
    const actionAgency = spendAction("opening another negotiation");
    if (!actionAgency) return;
    setAgency(actionAgency);
    persist(actionAgency);
    const market = marketProjection(p);
    setNegotiationRoom({
      playerId: p.id,
      round: 1,
      years: (p.age ?? 27) >= 30 ? 2 : 3,
      annualM: Number((market * 0.78).toFixed(1)),
      guaranteedPct: 42,
      gmPatience: clamp(62 + Math.round(agency.negotiation / 5), 62, 82),
      strategy: "long_term",
      message: `The GM opens below market at ${moneyM(market * 0.78)} per year. Your client expects you to fight.`,
    });
  };

  const counterNegotiation = () => {
    if (!negotiationRoom) return;
    const p = PLAYERS_DATABASE.find((x) => x.id === negotiationRoom.playerId);
    const client = agency.clients.find(
      (x) => x.playerId === negotiationRoom.playerId,
    );
    if (!p || !client) return;
    const market = marketProjection(p);
    const strategy = contractStrategyModifiers(
      negotiationRoom.strategy,
      p,
      client.career,
    );
    const askScore =
      (negotiationRoom.annualM / (market * strategy.annualMultiplier)) * 55 +
      (negotiationRoom.guaranteedPct - strategy.guaranteeDelta) * 0.35 +
      (negotiationRoom.years - strategy.yearsDelta) * 2;
    const leverage = agency.negotiation * 0.23 + agency.reputation * 0.09;
    const accepted = askScore <= 69 + leverage || negotiationRoom.round >= 3;
    if (accepted) {
      const totalM = Number(
        (negotiationRoom.annualM * negotiationRoom.years).toFixed(1),
      );
      const deal: FutureDeal = {
        totalM,
        annualM: negotiationRoom.annualM,
        guaranteedM: Number(
          ((totalM * negotiationRoom.guaranteedPct) / 100).toFixed(1),
        ),
        years: negotiationRoom.years,
        negotiatedAt: new Date().toISOString(),
      };
      const next: AgencyState = {
        ...agency,
        reputation: clamp(agency.reputation + 4, 0, 100),
        negotiation: clamp(agency.negotiation + 3, 0, 100),
        cashK: agency.cashK + contractFeeK(totalM),
        dealHistory: [...agency.dealHistory, deal],
        clients: agency.clients.map((x) =>
          x.playerId === p.id
            ? {
                ...x,
                futureDeal: deal,
                trust: clamp(x.trust + strategy.trustOnDeal, 0, 100),
                career: {
                  ...x.career,
                  trust: clamp(x.career.trust + strategy.trustOnDeal, 0, 100),
                },
              }
            : x,
        ),
        timeline: [
          `DEAL: ${p.name} signed for ${negotiationRoom.years} years, ${moneyM(totalM)} total and ${moneyM(deal.guaranteedM)} guaranteed.`,
          ...agency.timeline,
        ].slice(0, 20),
      };
      setAgency(next);
      persist(next);
      setNegotiationRoom(null);
      return;
    }
    const nextPatience =
      negotiationRoom.gmPatience +
      strategy.patienceDelta -
      Math.max(12, Math.round(askScore - 54));
    if (nextPatience <= 0) {
      const next: AgencyState = {
        ...agency,
        reputation: clamp(agency.reputation - 1, 0, 100),
        clients: agency.clients.map((x) =>
          x.playerId === p.id
            ? {
                ...x,
                trust: clamp(x.trust - 5, 0, 100),
                career: {
                  ...x.career,
                  trust: clamp(x.career.trust - 5, 0, 100),
                },
              }
            : x,
        ),
        timeline: [
          `The ${p.team} GM walked away from extension talks with ${p.name}.`,
          ...agency.timeline,
        ].slice(0, 20),
      };
      setAgency(next);
      persist(next);
      setNegotiationRoom(null);
      return;
    }
    const gmAnnual = Number(
      (
        market *
        (0.82 + negotiationRoom.round * 0.055 + agency.negotiation / 1400)
      ).toFixed(1),
    );
    setNegotiationRoom({
      ...negotiationRoom,
      round: negotiationRoom.round + 1,
      annualM: gmAnnual,
      guaranteedPct: Math.min(62, negotiationRoom.guaranteedPct + 5),
      gmPatience: nextPatience,
      message: `The GM counters at ${moneyM(gmAnnual)} per year with ${Math.min(62, negotiationRoom.guaranteedPct + 5)}% guaranteed. Push again or protect the relationship.`,
    });
  };

  if (verifyingAgentSigning) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-[#05070b] p-5 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-violet-300/25 bg-[#0d121b] p-6 text-center shadow-2xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-violet-400 text-black">
            <ShieldCheck size={28} />
          </div>
          <div className="mt-4 text-[10px] font-black tracking-[.22em] text-violet-300">
            SECURING YOUR SIGNING
          </div>
          <h2 className="mt-2 text-3xl font-black">KEEPING THIS DEAL SAFE.</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-zinc-400">
            Career actions are paused until this signing is safely stored on
            your account. You can retry without losing the deal.
          </p>
          <button
            onClick={() => void retryAgentSigningVerification()}
            className="mt-5 min-h-12 w-full rounded-2xl bg-violet-400 px-5 font-black text-black"
          >
            RETRY CLOUD VERIFICATION
          </button>
          <button
            onClick={handleBack}
            className="mt-3 min-h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-5 text-xs font-black"
          >
            BACK TO SOLO · KEEP RETRYING
          </button>
        </div>
      </div>
    );
  }

  if (!agency.profile) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden bg-[#05070b] text-white">
        <div className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-5 py-6 sm:px-8">
          <button
            onClick={handleBack}
            className="flex w-fit min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 text-xs font-black"
          >
            <ArrowLeft size={16} /> BACK
          </button>
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-3xl">
              {introStep < 2 && (
                <div className="mx-auto max-w-2xl rounded-[2rem] border border-violet-300/25 bg-[#0b0f17]/95 p-6 sm:p-8">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-400 text-black">
                      <MessageCircle />
                    </div>
                    <div>
                      <div className="text-[10px] font-black tracking-[.25em] text-violet-300">
                        AGENT CAREER · YEAR ONE
                      </div>
                      <div className="text-sm font-bold text-zinc-500">
                        The league does not know your name yet.
                      </div>
                    </div>
                  </div>
                  {introStep === 0 ? (
                    <>
                      <h1 className="text-3xl font-black leading-tight sm:text-5xl">
                        YOU'RE A ROOKIE AGENT,
                        <br />
                        TRYING TO FIND YOUR PLACE IN THIS LEAGUE.
                      </h1>
                      <p className="mt-5 text-sm font-semibold leading-7 text-zinc-400">
                        No superstar is calling you. You have to earn every
                        relationship, every contract and every point of
                        reputation.
                      </p>
                      <button
                        onClick={() => setIntroStep(1)}
                        className="mt-6 flex min-h-12 w-full items-center justify-between rounded-2xl bg-violet-400 px-5 font-black text-black"
                      >
                        CONTINUE <ChevronRight />
                      </button>
                    </>
                  ) : (
                    <>
                      <h1 className="text-3xl font-black leading-tight sm:text-5xl">
                        START WITH SOMEBODY
                        <br />
                        THE LEAGUE IS OVERLOOKING.
                      </h1>
                      <p className="mt-5 text-sm font-semibold leading-7 text-zinc-400">
                        Find a player entering the last year of his deal and
                        prove you can change his career.
                      </p>
                      <button
                        onClick={() => setIntroStep(2)}
                        className="mt-6 flex min-h-12 w-full items-center justify-between rounded-2xl bg-violet-400 px-5 font-black text-black"
                      >
                        CREATE YOUR AGENT <ChevronRight />
                      </button>
                    </>
                  )}
                </div>
              )}
              {introStep >= 2 && (
                <div className="rounded-[2rem] border border-white/10 bg-[#0b0f17]/95 p-6 sm:p-8">
                  <div className="text-[10px] font-black tracking-[.25em] text-violet-300">
                    CREATE YOUR AGENT
                  </div>
                  <h1 className="mt-2 text-4xl font-black sm:text-5xl">
                    WHO ARE YOU?
                  </h1>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-black text-zinc-400">
                      NAME
                      <input
                        aria-label="Agent name"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-base font-bold text-white"
                      />
                    </label>
                    <label className="text-xs font-black text-zinc-400">
                      AGE · 18 MIN
                      <input
                        aria-label="Agent age"
                        type="number"
                        min={18}
                        value={draftAge}
                        onChange={(e) => setDraftAge(e.target.value)}
                        className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-base font-bold text-white"
                      />
                    </label>
                    <label className="text-xs font-black text-zinc-400 sm:col-span-2">
                      HOME CITY
                      <input
                        aria-label="Home city"
                        list="agent-cities"
                        value={draftLocation}
                        onChange={(e) => setDraftLocation(e.target.value)}
                        className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-base font-bold text-white"
                      />
                      <datalist id="agent-cities">
                        {MAJOR_CITIES.map((city) => (
                          <option key={city} value={city} />
                        ))}
                      </datalist>
                    </label>
                  </div>
                  <button
                    onClick={createAgent}
                    disabled={
                      !draftName.trim() ||
                      Number(draftAge) < 18 ||
                      !draftLocation.trim()
                    }
                    className="mt-6 flex min-h-12 w-full items-center justify-between rounded-2xl bg-violet-400 px-5 font-black text-black disabled:opacity-30"
                  >
                    BEGIN MY CAREER <ChevronRight />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const deadlineOpen = isAgentTradeWindowOpen(agency.phase, agency.seasonWeek);
  return (
    <div className="min-h-[100dvh] bg-[#06080d] px-4 py-5 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <button
            onClick={handleBack}
            className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 text-xs font-black"
          >
            <ArrowLeft size={16} /> SOLO
          </button>
          <div className="text-right">
            <div className="text-[10px] font-black tracking-[.25em] text-violet-300">
              AGENT CAREER
            </div>
            <div className="text-lg font-black">{agency.profile.name}</div>
          </div>
        </div>

        {agentSigningError && (
          <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
            {agentSigningError}
          </div>
        )}

        <section className="rounded-[2rem] border border-violet-300/20 bg-[#0c1018] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-violet-300">
                <CalendarDays size={18} />
                <span className="text-xs font-black tracking-[.2em]">
                  CAREER CALENDAR
                </span>
              </div>
              <div className="mt-2 text-3xl font-black">
                {agency.phase === "regular"
                  ? `WEEK ${agency.seasonWeek}`
                  : agency.phase.toUpperCase()}{" "}
                · {agency.seasonYear}
              </div>
              <div className="mt-1 text-sm font-bold text-zinc-400">
                {prettyDate(agency.simulatedDate)} ·{" "}
                {deadlineOpen
                  ? `Trade deadline closes after Week ${TRADE_DEADLINE_WEEK}`
                  : agency.phase === "regular"
                    ? "Trade deadline closed"
                    : "Trade requests unavailable"}
              </div>
              <div className="mt-2 text-xs font-black text-cyan-300">
                {actionsRemaining}/2 AGENCY ACTIONS REMAIN THIS WEEK
              </div>
            </div>
            <button
              onClick={verifyingAgentSigning ? () => { void retryAgentSigningVerification(); } : advanceWeek}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-400 px-5 font-black text-black"
            >
              <FastForward size={18} /> {verifyingAgentSigning ? "RETRY CLOUD VERIFICATION" : "ADVANCE ONE WEEK"}
            </button>
          </div>
        </section>

        {agency.timeline.length > 0 && (
          <details className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <summary className="cursor-pointer text-[10px] font-black tracking-[.2em] text-zinc-400">
              LATEST LEAGUE EVENT · TAP TO OPEN
            </summary>
            <div className="mt-2 text-sm font-bold text-zinc-200">
              {agency.timeline[0]}
            </div>
          </details>
        )}

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-violet-300/20 bg-[#0c1018] p-5 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <div className="text-[10px] font-black tracking-[.26em] text-violet-300">
                YEAR {agency.seasonYear} · EARN YOUR NAME
              </div>
              <h1 className="mt-2 text-4xl font-black leading-none sm:text-6xl">
                PROVE YOU
                <br />
                BELONG.
              </h1>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-zinc-400">
                <span className="rounded-full bg-white/5 px-3 py-2">
                  <UserRound size={13} className="mr-1 inline" />
                  {agency.profile.age} years old
                </span>
                <span className="rounded-full bg-white/5 px-3 py-2">
                  <MapPin size={13} className="mr-1 inline" />
                  {agency.profile.location}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-2">
                  <BriefcaseBusiness size={13} className="mr-1 inline" />
                  {clients.length}/{clientCapacity} clients
                </span>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="text-xs font-black tracking-wider text-violet-300">
                REPUTATION
              </div>
              <div className="mt-1 text-5xl font-black">
                {agency.reputation}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {[
                  ["Negotiation", agency.negotiation],
                  ["Brand", agency.brandPower],
                  ["Client Care", agency.clientCare],
                  ["Max OVR", unlockedOvr],
                ].map(([l, v]) => (
                  <div key={String(l)} className="rounded-xl bg-white/5 p-3">
                    <div className="text-zinc-500">{l}</div>
                    <div className="mt-1 font-black">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#0d121b] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black tracking-[.22em] text-violet-300">AGENCY GROWTH</div>
              <h2 className="mt-1 text-3xl font-black">{resume.tier}</h2>
              <p className="mt-2 text-xs font-semibold text-zinc-500">
                ${agency.cashK}K cash · {resume.staffCount} staff · {resume.clientCapacity} client capacity
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-right">
              <div className="text-[9px] font-black text-zinc-500">CAREER RECORD</div>
              <div className="text-2xl font-black text-cyan-300">{resume.record}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(STAFF_OPTIONS) as [StaffRole, (typeof STAFF_OPTIONS)[StaffRole]][]).map(([role, option]) => {
              const employee = agency.staff.find((s) => s.role === role);
              return (
                <button
                  key={role}
                  disabled={Boolean(employee) || agency.cashK < option.costK}
                  onClick={() => hireStaff(role)}
                  className="min-h-20 rounded-2xl border border-white/10 bg-white/5 p-3 text-left disabled:opacity-40"
                >
                  <div className="text-[10px] font-black text-violet-200">{employee ? employee.name.toUpperCase() : option.label}</div>
                  <div className="mt-1 text-[10px] font-semibold leading-4 text-zinc-500">{employee ? "HIRED" : `\$${option.costK}K · ${option.description}`}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["CLIENTS SIGNED", resume.signedClients],
              ["DEALS", resume.careerDeals],
              ["CONTRACT VALUE", `\$${resume.contractValueM}M`],
              ["PROMISES KEPT", resume.fulfilledPromises],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-black/25 p-3">
                <div className="text-[9px] font-black text-zinc-500">{label}</div>
                <div className="mt-1 text-xl font-black">{value}</div>
              </div>
            ))}
          </div>
        </section>

        {clients.length > 0 && (
          <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#0d121b] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <BriefcaseBusiness className="text-violet-300" />
              <h2 className="text-2xl font-black">YOUR CLIENTS</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {clients.map(({ client, player }) => (
                <div
                  key={player.id}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={playerPortraitUrl(player)}
                      alt=""
                      className="h-14 w-14 rounded-xl bg-white/5 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-black">{player.name}</div>
                      <div className="text-xs text-zinc-500">
                        {client.currentTeam || player.team} · {player.position}{" "}
                        · {player.ovr} OVR
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black text-zinc-500">
                        TRUST
                      </div>
                      <div className="font-black text-emerald-300">
                        {client.trust}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {client.career.promises.map((promise) => (
                      <span
                        key={promise}
                        className={`rounded-full px-2 py-1 text-[9px] font-black ${
                          client.career.brokenPromises.includes(promise)
                            ? "bg-red-400/15 text-red-300"
                            : client.career.fulfilledPromises.includes(promise)
                              ? "bg-emerald-400/15 text-emerald-300"
                              : "bg-violet-400/10 text-violet-200"
                        }`}
                      >
                        {pitchLabel[promise].toUpperCase()}
                      </span>
                    ))}
                  </div>
                  {client.career.pendingEvent && (
                    <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3">
                      <div className="text-[10px] font-black tracking-wider text-cyan-200">
                        {client.career.pendingEvent.title}
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-300">
                        {client.career.pendingEvent.story}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <button
                          onClick={() => handleClientEvent(player.id, "fight")}
                          className="min-h-11 rounded-xl bg-violet-400 px-2 text-[10px] font-black text-black"
                        >
                          FIGHT FOR HIM
                        </button>
                        <button
                          onClick={() =>
                            handleClientEvent(player.id, "support")
                          }
                          className="min-h-11 rounded-xl bg-white/10 px-2 text-[10px] font-black"
                        >
                          SUPPORT HIM
                        </button>
                        <button
                          onClick={() =>
                            handleClientEvent(player.id, "business")
                          }
                          className="min-h-11 rounded-xl bg-white/10 px-2 text-[10px] font-black"
                        >
                          MAKE A BUSINESS MOVE
                        </button>
                      </div>
                    </div>
                  )}
                  {client.tradeRequest?.status === "open" && (
                    <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3">
                      <div className="flex items-center gap-2 text-xs font-black text-amber-200">
                        <AlertTriangle size={14} /> TRADE REQUEST · WEEK{" "}
                        {client.tradeRequest.requestedWeek}
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 text-zinc-300">
                        {client.tradeRequest.reason}
                      </p>
                      {client.tradeRequest.outcome && (
                        <p className="mt-2 text-[10px] font-bold leading-4 text-amber-100">
                          {client.tradeRequest.outcome}
                        </p>
                      )}
                      {!deadlineOpen && (
                        <p className="mt-2 text-[10px] font-black text-amber-200">
                          {agency.phase === "preseason"
                            ? "TRADE WINDOW NOT OPEN"
                            : "DEADLINE CLOSED"}{" "}
                          · This request stays open, but it cannot be worked
                          now.
                        </p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          disabled={!deadlineOpen}
                          onClick={() =>
                            resolveTradeRequest(player.id, "resolved")
                          }
                          className="min-h-11 rounded-xl bg-violet-400 px-3 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          {client.tradeRequest.attempts
                            ? "PUSH AGAIN"
                            : "WORK THE PHONES"}
                        </button>
                        <button
                          onClick={() =>
                            resolveTradeRequest(player.id, "denied")
                          }
                          className="min-h-11 rounded-xl bg-white/10 px-3 text-xs font-black"
                        >
                          TELL HIM NO
                        </button>
                      </div>
                    </div>
                  )}
                  {client.tradeRequest &&
                    client.tradeRequest.status !== "open" &&
                    client.tradeRequest.outcome && (
                      <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-[10px] font-bold leading-4 text-zinc-400">
                        {client.tradeRequest.outcome}
                      </div>
                    )}
                  <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs">
                    <div className="text-zinc-500">Current deal baseline</div>
                    <div className="mt-1 font-black">
                      {moneyM(player.salary)} · final contract year
                    </div>
                  </div>
                  {client.futureDeal ? (
                    <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs">
                      <div className="font-black text-emerald-300">
                        YOU GOT HIM PAID
                      </div>
                      <div className="mt-1 text-zinc-300">
                        {client.futureDeal.years} years ·{" "}
                        {moneyM(client.futureDeal.totalM)} total ·{" "}
                        {moneyM(client.futureDeal.guaranteedM || 0)} guaranteed
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openNegotiation(player, client)}
                      className="mt-3 min-h-11 w-full rounded-xl bg-violet-400 px-4 text-xs font-black text-black"
                    >
                      ENTER NEGOTIATION ROOM
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#0d121b] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black tracking-[.22em] text-violet-300">
                FIRST CLIENT BOARD
              </div>
              <h2 className="mt-1 text-3xl font-black">
                WHO ARE YOU BETTING ON?
              </h2>
              <p className="mt-2 text-xs font-semibold text-zinc-500">
                {clients.length >= clientCapacity
                  ? `Agency full · ${clients.length}/${clientCapacity} clients`
                  : `50 available targets · current unlock: ${unlockedOvr} OVR and below`}
              </p>
            </div>
            <select
              aria-label="Filter prospects by position"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black px-3 py-3 text-sm font-black"
            >
              {[
                "ALL",
                "QB",
                "RB",
                "WR",
                "TE",
                "OT",
                "EDGE",
                "DT",
                "LB",
                "CB",
                "S",
                "K",
                "P",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {prospects.map((p) => {
              const [low, high] = salaryRange(p);
              const days = cooldownDaysLeft(
                agency.recruitCooldowns[p.id],
                agency.simulatedDate,
              );
              return (
                <button
                  key={p.id}
                  onClick={() => beginRecruit(p)}
                  disabled={clients.length >= clientCapacity}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left disabled:opacity-35"
                >
                  <img
                    src={playerPortraitUrl(p)}
                    alt=""
                    className="h-16 w-16 rounded-xl bg-white/5 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black">{p.name}</div>
                    <div className="text-xs text-zinc-500">
                      {p.team} · {p.position}
                      {p.age ? ` · Age ${p.age}` : ""} · 1 year left
                    </div>
                    <div className="mt-1 text-[10px] text-zinc-500">
                      Expected next deal: {moneyM(low)}–{moneyM(high)}/yr
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-violet-300">
                      {p.ovr}
                    </div>
                    <div className="text-[9px] font-black text-zinc-500">
                      {days > 0 ? `${days}D WAIT` : "OVR"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {selected && recruit && (
          <ModalPortal>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Private meeting with ${selected.name}`}
              className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-black/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md [-webkit-overflow-scrolling:touch]"
            >
              <div className="mx-auto my-auto max-w-xl rounded-[2rem] border border-violet-300/25 bg-[#0c1018] p-5 sm:p-7">
                <div className="flex items-start gap-4">
                  <img
                    src={playerPortraitUrl(selected)}
                    alt=""
                    className="h-20 w-20 rounded-2xl bg-white/5 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black tracking-[.2em] text-violet-300">
                      PRIVATE MEETING ·{" "}
                      {recruit.round <= 2
                        ? `ROUND ${recruit.round}`
                        : "DECISION"}
                    </div>
                    <h3 className="mt-1 text-2xl font-black">
                      {selected.name}
                    </h3>
                    <div className="text-xs text-zinc-500">
                      {selected.team} · {selected.position} · {selected.ovr} OVR
                      · final year
                    </div>
                  </div>
                  <button
                    aria-label="Close private meeting"
                    disabled={signingInFlight}
                    onClick={() => {
                      if (signingInFlightRef.current) return;
                      persist(agency);
                      setRecruit(null);
                      setSelectedId(null);
                    }}
                    className="min-h-11 shrink-0 rounded-xl bg-white/5 px-3 text-xs font-black disabled:opacity-40"
                  >
                    CLOSE
                  </button>
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
                  <div className="text-[10px] font-black text-zinc-500">
                    PLAYER
                  </div>
                  <p className="mt-2 text-lg font-black leading-7 text-white">
                    {recruit.playerReply}
                  </p>
                </div>
                <div className="mt-3 rounded-2xl bg-violet-400/10 p-4">
                  <div className="text-[10px] font-black text-violet-300">
                    STORY
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">
                    {recruit.message}
                  </p>
                </div>
                {!recruit.failed && !recruit.completed && (
                  <>
                    <div className="mt-5 flex items-center justify-between text-[10px] font-black text-zinc-500">
                      <span>ROUND {recruit.round} · CHOOSE ONE</span>
                      <span>{recruit.used.length}/2 PITCHES</span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {recruit.choices.map((pitch) => (
                        <button
                          key={pitch}
                          disabled={signingInFlight}
                          onClick={() => void makePitch(pitch)}
                          className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-left text-xs font-black active:border-violet-300/50 active:bg-violet-400/10 disabled:opacity-40"
                        >
                          {pitchLabel[pitch]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-zinc-600">
                  <ShieldCheck size={13} /> The player weighs both choices
                  against his priorities, your skills and your reputation.
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
        {negotiationRoom &&
          (() => {
            const p = PLAYERS_DATABASE.find(
              (x) => x.id === negotiationRoom.playerId,
            );
            if (!p) return null;
            const market = marketProjection(p);
            return (
              <ModalPortal>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Negotiation room with ${p.name}`}
                  className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-black/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md [-webkit-overflow-scrolling:touch]"
                >
                  <div className="mx-auto my-auto max-w-xl rounded-[2rem] border border-violet-300/25 bg-[#0c1018] p-5 sm:p-7">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black tracking-[.22em] text-violet-300">
                          NEGOTIATION ROOM · ROUND {negotiationRoom.round}
                        </div>
                        <h3 className="mt-1 text-3xl font-black">{p.name}</h3>
                        <div className="text-xs text-zinc-500">
                          {p.team} GM · Market estimate {moneyM(market)}/yr
                        </div>
                      </div>
                      <button
                        onClick={() => setNegotiationRoom(null)}
                        className="min-h-11 rounded-xl bg-white/5 px-3 text-xs font-black"
                      >
                        LEAVE
                      </button>
                    </div>
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
                      <div className="text-[10px] font-black text-zinc-500">
                        GENERAL MANAGER
                      </div>
                      <p className="mt-2 text-lg font-black leading-7">
                        “{negotiationRoom.message}”
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="text-[10px] font-black tracking-wider text-zinc-500">
                        CONTRACT STRATEGY
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        {(
                          [
                            ["maximize_aav", "MAX AAV"],
                            ["secure_guarantees", "GUARANTEES"],
                            ["long_term", "LONG-TERM"],
                          ] as const
                        ).map(([strategy, label]) => (
                          <button
                            key={strategy}
                            onClick={() =>
                              setNegotiationRoom({
                                ...negotiationRoom,
                                strategy,
                              })
                            }
                            className={`min-h-11 rounded-xl px-3 text-[10px] font-black ${negotiationRoom.strategy === strategy ? "bg-violet-400 text-black" : "bg-white/5 text-zinc-300"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <label className="rounded-2xl bg-white/5 p-3 text-[10px] font-black text-zinc-400">
                        YEARS
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={negotiationRoom.years}
                          onChange={(e) =>
                            setNegotiationRoom({
                              ...negotiationRoom,
                              years: Number(e.target.value),
                            })
                          }
                          className="mt-3 w-full accent-violet-400"
                        />
                        <span className="mt-2 block text-2xl text-white">
                          {negotiationRoom.years}
                        </span>
                      </label>
                      <label className="rounded-2xl bg-white/5 p-3 text-[10px] font-black text-zinc-400">
                        PER YEAR
                        <input
                          type="range"
                          min={Math.max(1, market * 0.65)}
                          max={market * 1.3}
                          step="0.5"
                          value={negotiationRoom.annualM}
                          onChange={(e) =>
                            setNegotiationRoom({
                              ...negotiationRoom,
                              annualM: Number(e.target.value),
                            })
                          }
                          className="mt-3 w-full accent-violet-400"
                        />
                        <span className="mt-2 block text-lg text-white">
                          {moneyM(negotiationRoom.annualM)}
                        </span>
                      </label>
                      <label className="rounded-2xl bg-white/5 p-3 text-[10px] font-black text-zinc-400">
                        GUARANTEED
                        <input
                          type="range"
                          min="25"
                          max="80"
                          step="5"
                          value={negotiationRoom.guaranteedPct}
                          onChange={(e) =>
                            setNegotiationRoom({
                              ...negotiationRoom,
                              guaranteedPct: Number(e.target.value),
                            })
                          }
                          className="mt-3 w-full accent-violet-400"
                        />
                        <span className="mt-2 block text-2xl text-white">
                          {negotiationRoom.guaranteedPct}%
                        </span>
                      </label>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 p-3 text-xs">
                      <span className="text-zinc-500">GM patience</span>
                      <span
                        className={
                          negotiationRoom.gmPatience < 30
                            ? "font-black text-red-300"
                            : "font-black text-emerald-300"
                        }
                      >
                        {negotiationRoom.gmPatience}/100
                      </span>
                    </div>
                    <button
                      onClick={counterNegotiation}
                      className="mt-4 min-h-12 w-full rounded-2xl bg-violet-400 px-5 font-black text-black"
                    >
                      SEND COUNTEROFFER ·{" "}
                      {moneyM(negotiationRoom.annualM * negotiationRoom.years)}{" "}
                      TOTAL
                    </button>
                  </div>
                </div>
              </ModalPortal>
            );
          })()}
        {levelUp && (
          <ModalPortal>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Reputation level up"
              className="fixed inset-0 z-[10000] grid place-items-center overflow-y-auto overscroll-contain bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur"
            >
              <div className="w-full max-w-sm rounded-[2rem] border border-violet-300/30 bg-[#111525] p-6 text-center shadow-2xl">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-violet-400 text-black">
                  <Sparkles size={30} />
                </div>
                <div className="mt-4 text-[10px] font-black tracking-[.25em] text-violet-300">
                  REPUTATION LEVEL UP
                </div>
                <h2 className="mt-2 text-4xl font-black">YOU'RE MOVING UP.</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-zinc-400">
                  Players up to <b className="text-white">{levelUp.to} OVR</b>{" "}
                  will now take your call. Your old ceiling was {levelUp.from}.
                </p>
                <button
                  onClick={() => setLevelUp(null)}
                  className="mt-5 min-h-12 w-full rounded-2xl bg-violet-400 font-black text-black"
                >
                  SEE WHO UNLOCKED
                </button>
              </div>
            </div>
          </ModalPortal>
        )}
      </div>
    </div>
  );
};
