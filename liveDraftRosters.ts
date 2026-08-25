import { calculateFantasyTeamRatings } from './fantasyEvaluation';
import { PLAYERS_DATABASE } from './players';
import { validateLiveFantasyRoster } from './liveFantasyRules';
import { League, LiveFantasyDraft, Player, TeamRatings, TOTAL_ROSTER_SIZE } from './types';

export type LiveDraftRosterAssignment = {
  memberId: string;
  roster: Player[];
  teamRatings: TeamRatings;
};

const PLAYER_BY_ID = new Map(PLAYERS_DATABASE.map(player => [player.id, player]));

export function buildLiveDraftRosterAssignments(
  league: League,
  draft: LiveFantasyDraft,
): LiveDraftRosterAssignment[] {
  if (draft.status !== 'completed') {
    throw new Error('The fantasy draft must be complete before rosters can be finalized.');
  }
  if (draft.rounds !== TOTAL_ROSTER_SIZE) {
    throw new Error(`The fantasy draft must contain exactly ${TOTAL_ROSTER_SIZE} rounds.`);
  }

  const leagueMemberIds = new Set(league.members.map(member => member.id));
  const orderedMemberIds = [...new Set(draft.orderMemberIds)];
  if (
    orderedMemberIds.length !== league.members.length
    || orderedMemberIds.some(memberId => !leagueMemberIds.has(memberId))
  ) {
    throw new Error('The completed draft order no longer matches the league members.');
  }

  const expectedPickCount = league.members.length * TOTAL_ROSTER_SIZE;
  if (draft.picks.length !== expectedPickCount || draft.pickIndex !== expectedPickCount) {
    throw new Error(`The fantasy draft is missing picks (${draft.picks.length}/${expectedPickCount}).`);
  }

  const draftedPlayerIds = new Set<string>();
  for (const pick of draft.picks) {
    if (draftedPlayerIds.has(pick.playerId)) {
      throw new Error(`Player ${pick.playerId} appears more than once in the completed draft.`);
    }
    draftedPlayerIds.add(pick.playerId);
  }

  return orderedMemberIds.map(memberId => {
    const roster = draft.picks
      .filter(pick => pick.memberId === memberId)
      .sort((first, second) => first.overall - second.overall)
      .map(pick => PLAYER_BY_ID.get(pick.playerId))
      .filter((player): player is Player => Boolean(player));

    if (roster.length !== TOTAL_ROSTER_SIZE) {
      throw new Error(`A completed fantasy roster has ${roster.length}/${TOTAL_ROSTER_SIZE} known players.`);
    }
    const rosterErrors = validateLiveFantasyRoster(roster);
    if (rosterErrors.length > 0) {
      throw new Error(`A completed fantasy roster is invalid: ${rosterErrors[0]}`);
    }

    return {
      memberId,
      roster,
      teamRatings: calculateFantasyTeamRatings(roster),
    };
  });
}

export function applyLiveDraftRosterAssignments(
  league: League,
  draft: LiveFantasyDraft,
  completedAt = new Date().toISOString(),
): League {
  const assignments = buildLiveDraftRosterAssignments(league, draft);
  const assignmentByMemberId = new Map(assignments.map(assignment => [assignment.memberId, assignment]));

  return {
    ...league,
    status: 'drafting',
    rostersLocked: true,
    liveDraft: draft,
    members: league.members.map(member => {
      const assignment = assignmentByMemberId.get(member.id);
      if (!assignment) return member;
      return {
        ...member,
        status: 'ready',
        roster: assignment.roster,
        teamRatings: assignment.teamRatings,
        submittedAt: completedAt,
      };
    }),
  };
}
