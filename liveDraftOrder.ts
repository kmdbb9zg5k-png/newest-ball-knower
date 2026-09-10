import type { LiveFantasyDraft } from './types';

export interface UpcomingLiveDraftPick {
  pickIndex: number;
  overall: number;
  round: number;
  pickInRound: number;
  memberId: string;
}

export const memberIdAtLiveDraftPick = (draft: LiveFantasyDraft, pickIndex = draft.pickIndex): string | null => {
  const teamCount = draft.orderMemberIds.length;
  const totalPicks = teamCount * draft.rounds;
  if (!teamCount || pickIndex < 0 || pickIndex >= totalPicks) return null;
  const roundIndex = Math.floor(pickIndex / teamCount);
  const slot = pickIndex % teamCount;
  return draft.orderMemberIds[roundIndex % 2 === 0 ? slot : teamCount - 1 - slot] || null;
};

export const liveDraftPickDetails = (draft: LiveFantasyDraft, pickIndex: number): UpcomingLiveDraftPick | null => {
  const memberId = memberIdAtLiveDraftPick(draft, pickIndex);
  if (!memberId) return null;
  const teamCount = draft.orderMemberIds.length;
  return {
    pickIndex,
    overall: pickIndex + 1,
    round: Math.floor(pickIndex / teamCount) + 1,
    pickInRound: (pickIndex % teamCount) + 1,
    memberId,
  };
};

export const upcomingLiveDraftOrder = (draft: LiveFantasyDraft, count = 12): UpcomingLiveDraftPick[] => {
  const totalPicks = draft.orderMemberIds.length * draft.rounds;
  const end = Math.min(totalPicks, draft.pickIndex + Math.max(0, count));
  const upcoming: UpcomingLiveDraftPick[] = [];
  for (let pickIndex = draft.pickIndex; pickIndex < end; pickIndex += 1) {
    const pick = liveDraftPickDetails(draft, pickIndex);
    if (pick) upcoming.push(pick);
  }
  return upcoming;
};

export const nextLiveDraftPickForMember = (draft: LiveFantasyDraft, memberId: string): UpcomingLiveDraftPick | null => {
  const totalPicks = draft.orderMemberIds.length * draft.rounds;
  for (let pickIndex = draft.pickIndex; pickIndex < totalPicks; pickIndex += 1) {
    const pick = liveDraftPickDetails(draft, pickIndex);
    if (pick?.memberId === memberId) return pick;
  }
  return null;
};
