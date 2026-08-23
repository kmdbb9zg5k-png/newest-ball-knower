import type { League } from './types';

/** Honor both the league owner id and its member role for restored leagues. */
export const isLeagueCommissioner = (
  league: League,
  userId?: string | null,
  isDemoMode = false,
) => Boolean(
  isDemoMode ||
  (userId && (
    league.commissionerId === userId ||
    league.members.some(member => member.userId === userId && member.isCommissioner)
  ))
);

export const getLeagueCommissionerName = (league: League) =>
  league.members.find(member => member.isCommissioner)?.userName ||
  league.commissionerName ||
  'the commissioner';
