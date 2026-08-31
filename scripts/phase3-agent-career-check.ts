import assert from "node:assert/strict";
import {
  agentActionsRemaining,
  agentWeekKey,
  clientRetentionStatus,
  contractStrategyModifiers,
  createClientCareer,
  nextClientEvent,
  resolveClientEvent,
} from "../agentClientCareer";

const player = {
  id: "test-player",
  name: "Test Player",
  age: 25,
  ovr: 76,
  position: "WR",
};
const agency = {
  reputation: 50,
  negotiation: 55,
  brandPower: 45,
  clientCare: 60,
};
const career = createClientCareer(["playing_time", "long_term"]);
assert.deepEqual(career.promises, ["playing_time", "long_term"]);
assert.equal(nextClientEvent(player, career, 2026, "regular", 2), undefined);
assert.equal(nextClientEvent(player, career, 2026, "offseason", 3), undefined);
const event = nextClientEvent(player, career, 2026, "regular", 3);
assert.ok(event);
const moneyEvent = nextClientEvent(
  player,
  createClientCareer(["money"]),
  2026,
  "regular",
  3,
);
assert.equal(moneyEvent?.kind, "contract");
assert.equal(moneyEvent?.promise, "money");
const kept = resolveClientEvent({
  career: { ...career, pendingEvent: event },
  event: event!,
  choice: "fight",
  agency,
});
assert.ok(kept.trustDelta > 0);
assert.ok(kept.career.fulfilledPromises.includes("playing_time"));
const replayed = resolveClientEvent({
  career: kept.career,
  event: event!,
  choice: "fight",
  agency,
});
assert.equal(replayed.trustDelta, 0);
assert.equal(replayed.career.resolvedEvents, kept.career.resolvedEvents);
const broken = resolveClientEvent({
  career: { ...career, pendingEvent: event },
  event: event!,
  choice: "business",
  agency,
});
assert.ok(broken.trustDelta < 0);
assert.ok(broken.career.brokenPromises.includes("playing_time"));
assert.equal(clientRetentionStatus({ ...broken.career, trust: 19 }), "fired");
assert.ok(
  contractStrategyModifiers("maximize_aav", player, career).annualMultiplier >
    1,
);
assert.ok(
  contractStrategyModifiers("secure_guarantees", player, career)
    .guaranteeDelta > 0,
);
assert.ok(
  contractStrategyModifiers("long_term", player, career).yearsDelta > 0,
);
assert.equal(agentActionsRemaining(0), 2);
assert.equal(agentActionsRemaining(2), 0);
assert.notEqual(
  agentWeekKey(2026, "regular", 3),
  agentWeekKey(2026, "regular", 4),
);
console.log("Phase 3 Agent client-career and contract-strategy checks passed.");
