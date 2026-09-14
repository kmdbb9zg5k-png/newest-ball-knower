/** Shared production trade rules. Kept independent of React and browser styles. */
export const TRADE_DEADLINE_WEEK = 9;
export type SeasonPhase = "preseason" | "regular" | "postseason" | "offseason";

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
