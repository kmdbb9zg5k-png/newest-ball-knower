import { RecruitingPitch } from "./agentRecruiting";

export type ClientPromise = RecruitingPitch;
export type ClientEventKind =
  | "playing_time"
  | "injury"
  | "contract"
  | "trade"
  | "family"
  | "brand";
export type ClientEventChoice = "fight" | "support" | "business";
export type ContractStrategy =
  | "maximize_aav"
  | "secure_guarantees"
  | "long_term";
export const WEEKLY_AGENT_ACTION_LIMIT = 2;

export type ClientCareer = {
  trust: number;
  promises: ClientPromise[];
  fulfilledPromises: ClientPromise[];
  brokenPromises: ClientPromise[];
  pendingEvent?: ClientCareerEvent;
  lastEventKey?: string;
  resolvedEvents: number;
};

export type ClientCareerEvent = {
  id: string;
  kind: ClientEventKind;
  title: string;
  story: string;
  promise?: ClientPromise;
};

export type CareerAgency = {
  reputation: number;
  negotiation: number;
  brandPower: number;
  clientCare: number;
};
export type CareerPlayer = {
  id: string;
  name: string;
  age?: number;
  ovr: number;
  position: string;
};

const hash = (value: string) =>
  Array.from(value).reduce(
    (total, char, index) => total + char.charCodeAt(0) * (index + 17),
    0,
  );
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const agentWeekKey = (
  seasonYear: number,
  phase: string,
  seasonWeek: number,
) => `${seasonYear}:${phase}:${seasonWeek}`;
export const agentActionsRemaining = (used: number) =>
  Math.max(0, WEEKLY_AGENT_ACTION_LIMIT - used);

const EVENT_COPY: Record<
  ClientEventKind,
  { title: string; story: (name: string) => string; promise?: ClientPromise }
> = {
  playing_time: {
    title: "ROLE MEETING",
    story: (name) =>
      `${name} says the coaching staff is shrinking his role and wants you in the room.`,
    promise: "playing_time",
  },
  injury: {
    title: "INJURY DECISION",
    story: (name) =>
      `${name} is cleared to play hurt, but his camp wants protection before he risks the season.`,
    promise: "guarantees",
  },
  contract: {
    title: "CONTRACT WINDOW",
    story: (name) =>
      `${name}'s team wants an early deal before his market grows.`,
    promise: "money",
  },
  trade: {
    title: "FRESH START",
    story: (name) =>
      `${name} believes a different team gives him a better path to winning and meaningful snaps.`,
    promise: "winning",
  },
  family: {
    title: "FAMILY FIRST",
    story: (name) =>
      `${name}'s family needs stability before any football decision is made.`,
    promise: "family",
  },
  brand: {
    title: "BRAND OPPORTUNITY",
    story: (name) =>
      `${name} has a public opportunity that could raise his profile but distract from football.`,
    promise: "brand",
  },
};

export function createClientCareer(
  promises: ClientPromise[],
  trust = 72,
): ClientCareer {
  return {
    trust: clamp(trust, 0, 100),
    promises: [...new Set(promises)].slice(0, 2),
    fulfilledPromises: [],
    brokenPromises: [],
    resolvedEvents: 0,
  };
}

export function nextClientEvent(
  player: CareerPlayer,
  career: ClientCareer,
  seasonYear: number,
  seasonWeek: number,
): ClientCareerEvent | undefined {
  if (seasonWeek <= 0 || seasonWeek % 3 !== 0 || career.pendingEvent)
    return undefined;
  const id = `${player.id}:${seasonYear}:${seasonWeek}`;
  if (career.lastEventKey === id) return undefined;
  const kinds = Object.keys(EVENT_COPY) as ClientEventKind[];
  const promised = career.promises.filter((p) =>
    kinds.includes(p as ClientEventKind),
  ) as ClientEventKind[];
  const kind =
    promised.length && career.resolvedEvents % 2 === 0
      ? promised[hash(id) % promised.length]
      : kinds[hash(id) % kinds.length];
  const copy = EVENT_COPY[kind];
  return {
    id,
    kind,
    title: copy.title,
    story: copy.story(player.name),
    promise: copy.promise,
  };
}

export function resolveClientEvent(args: {
  career: ClientCareer;
  event: ClientCareerEvent;
  choice: ClientEventChoice;
  agency: CareerAgency;
}): {
  career: ClientCareer;
  trustDelta: number;
  reputationDelta: number;
  clientCareDelta: number;
  brandDelta: number;
  outcome: string;
} {
  const { career, event, choice, agency } = args;
  const promised = Boolean(
    event.promise && career.promises.includes(event.promise),
  );
  const fit: Record<ClientEventKind, ClientEventChoice> = {
    playing_time: "fight",
    injury: "support",
    contract: "business",
    trade: "fight",
    family: "support",
    brand: "business",
  };
  const matched = choice === fit[event.kind];
  const skill =
    choice === "fight"
      ? agency.reputation
      : choice === "support"
        ? agency.clientCare
        : Math.round((agency.negotiation + agency.brandPower) / 2);
  const success = matched && skill >= 28;
  const trustDelta = success
    ? promised
      ? 10
      : 6
    : matched
      ? 2
      : promised
        ? -12
        : -5;
  const fulfilled =
    promised && success && event.promise
      ? [...new Set([...career.fulfilledPromises, event.promise])]
      : career.fulfilledPromises;
  const broken =
    promised && !success && event.promise
      ? [...new Set([...career.brokenPromises, event.promise])]
      : career.brokenPromises;
  return {
    career: {
      ...career,
      trust: clamp(career.trust + trustDelta, 0, 100),
      pendingEvent: undefined,
      lastEventKey: event.id,
      resolvedEvents: career.resolvedEvents + 1,
      fulfilledPromises: fulfilled,
      brokenPromises: broken,
    },
    trustDelta,
    reputationDelta: success ? 1 : promised && !matched ? -1 : 0,
    clientCareDelta: choice === "support" && success ? 1 : 0,
    brandDelta: choice === "business" && success ? 1 : 0,
    outcome: success
      ? `You handled ${event.title.toLowerCase()} the way your client needed.`
      : matched
        ? `You chose the right lane, but your agency is not strong enough there yet.`
        : `Your response missed what this moment required${promised ? " and broke a recruiting promise" : ""}.`,
  };
}

export function clientRetentionStatus(
  career: ClientCareer,
): "loyal" | "at_risk" | "fired" {
  if (career.trust < 20 || career.brokenPromises.length >= 2) return "fired";
  if (career.trust < 45 || career.brokenPromises.length > 0) return "at_risk";
  return "loyal";
}

export function contractStrategyModifiers(
  strategy: ContractStrategy,
  player: CareerPlayer,
  career: ClientCareer,
): {
  annualMultiplier: number;
  guaranteeDelta: number;
  yearsDelta: number;
  patienceDelta: number;
  trustOnDeal: number;
} {
  if (strategy === "maximize_aav")
    return {
      annualMultiplier: 1.1,
      guaranteeDelta: -5,
      yearsDelta: 0,
      patienceDelta: -10,
      trustOnDeal: career.promises.includes("money") ? 9 : 5,
    };
  if (strategy === "secure_guarantees")
    return {
      annualMultiplier: 0.96,
      guaranteeDelta: 15,
      yearsDelta: 0,
      patienceDelta: -4,
      trustOnDeal: career.promises.includes("guarantees") ? 10 : 6,
    };
  return {
    annualMultiplier: 0.93,
    guaranteeDelta: 5,
    yearsDelta: (player.age ?? 27) >= 30 ? -1 : 2,
    patienceDelta: 4,
    trustOnDeal: career.promises.includes("long_term") ? 10 : 7,
  };
}
