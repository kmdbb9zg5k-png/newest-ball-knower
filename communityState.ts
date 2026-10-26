import type {CommunityMatch} from './communityCloud';

// Scope async results to the account, conversation, or match that requested them.
export function createRequestGate() {
  let generation = 0;
  return {
    next: () => ++generation,
    isCurrent: (version: number) => version === generation,
    invalidate: () => { generation += 1; },
  };
}

export function matchSecondsLeft(startedAt: string | undefined, durationSeconds: number, now: number) {
  const start = Date.parse(startedAt || '');
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.min(durationSeconds, Math.ceil((start + durationSeconds * 1000 - now) / 1000)));
}

export function matchOutcome(match: CommunityMatch, me: string) {
  if (match.status !== 'completed') return null;
  return match.winnerId === me ? 'Win' : match.winnerId ? 'Loss' : 'Tie';
}

export function messageDay(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'});
}
