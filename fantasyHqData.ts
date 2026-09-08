import type { League } from './types';
import type { FantasyRanking } from './fantasyRankingsCloud';
import type { WeeklyScore } from './fantasyLeagueParityCloud';

/** Display facts only. Never treat the Draft Order Game as the fantasy season. */
export function fantasyHqSummary(league: League, userId?: string) {
  const mine = league.members.find(member => member.userId === userId);
  const draft = league.liveDraft;
  const orderIndex = draft?.orderMemberIds.indexOf(mine?.id || '') ?? -1;
  const orderPick = league.seasonResult?.draftOrder?.find(item => item.memberId === mine?.id)?.pickNumber;
  const pick = orderIndex >= 0 ? orderIndex + 1 : orderPick;
  const myPicks = mine && draft ? draft.picks.filter(item => item.memberId === mine.id).length : null;
  const rosterSize = league.settings?.rosterSize || 15;
  const rosterCount = mine?.roster?.length ?? (draft?.status === 'completed' ? myPicks : null);
  const seasonComplete = Boolean(league.settings?.fantasySeasonComplete);
  const phase = seasonComplete ? 'Season complete' : draft?.status === 'active' ? 'Live draft'
    : league.settings?.fantasySeasonStarted ? `In season · Week ${league.settings.currentWeek || 1}`
    : draft?.status === 'completed' ? 'Draft complete'
    : league.status === 'completed' ? 'Draft order set' : 'Draft setup';
  const resultTab = league.status === 'completed' && !draft ? 'simulation' : 'lobby';
  return {
    mine, pick: Number.isInteger(pick) && Number(pick) > 0 ? pick : null,
    ready: league.members.filter(member => member.status === 'ready').length,
    phase, resultTab: resultTab as 'lobby' | 'simulation',
    roster: !mine ? 'Not joined' : draft?.status === 'completed' ? (rosterCount === null ? 'Pending sync' : `${rosterCount}/${rosterSize}`)
      : mine.status === 'ready' ? 'Submitted' : 'Building',
    players: draft ? myPicks : rosterCount,
    playersLabel: draft ? 'drafted' : 'rostered',
    primaryLabel: seasonComplete ? 'View season' : draft?.status === 'active' ? 'Enter draft'
      : draft?.status === 'completed' ? 'My team' : mine?.status === 'ready' ? 'Draft board' : 'Build team',
    primaryTab: (seasonComplete || draft?.status === 'completed' ? 'lobby' : 'draft') as 'lobby' | 'draft',
  };
}

export type HqPracticePick = { overall: number; round: number; memberId: string; player: FantasyRanking };
/** Read-only snake practice using published full-PPR rankings, never OVR or live-draft writes. */
export function buildHqPracticeDraft(league: League, rankings: FantasyRanking[], seed: number): HqPracticePick[] {
  const memberIds = league.members.map(member => member.id);
  if (memberIds.length < 2) return [];
  const saved = league.liveDraft?.orderMemberIds || [...(league.seasonResult?.draftOrder || [])].sort((a,b) => a.pickNumber-b.pickNumber).map(item => item.memberId);
  const order = saved.length === memberIds.length && new Set(saved).size === memberIds.length && saved.every(id => memberIds.includes(id)) ? [...saved] : memberIds;
  const rounds = Math.max(9, Math.min(30, league.settings?.rosterSize || 15));
  const required: Record<string, number> = { QB:1, RB:2, WR:2, TE:1, K:1, DST:1 };
  const seen = new Set<string>();
  const noise = (key:string) => { let n=seed>>>0; for (const char of key) n=(n*31+char.charCodeAt(0))>>>0; return (n%1000)/1000; };
  const available = rankings.filter(player => {
    if (!(player.position in required) || seen.has(player.player_key)) return false;
    seen.add(player.player_key); return true;
  }).sort((a,b) => (a.overall_rank + noise(a.player_key)*12) - (b.overall_rank + noise(b.player_key)*12) || a.player_key.localeCompare(b.player_key));
  const picks: HqPracticePick[] = [];
  const counts = new Map<string,Record<string,number>>();
  for (let round=0; round<rounds; round++) {
    for (const memberId of round%2 ? [...order].reverse() : order) {
      const c = counts.get(memberId) || {};
      const missing = Object.entries(required).flatMap(([position, min]) => Array(Math.max(0,min-(c[position]||0))).fill(position) as string[]);
      const skills = (c.RB||0)+(c.WR||0)+(c.TE||0);
      const flexMissing = skills + missing.filter(position => ['RB','WR','TE'].includes(position)).length < 6;
      const mustFill = rounds-round <= missing.length + Number(flexMissing);
      const index = available.findIndex(player => {
        const p=player.position;
        if ((p==='K'||p==='DST') && (c[p]||0)>=1) return false;
        if (p==='QB' && (c[p]||0)>=2) return false;
        return !mustFill || missing.includes(p) || (flexMissing && ['RB','WR','TE'].includes(p));
      });
      if (index<0) continue;
      const player = available.splice(index,1)[0];
      picks.push({overall:picks.length+1,round:round+1,memberId,player});
      c[player.position]=(c[player.position]||0)+1; counts.set(memberId,c);
    }
  }
  return picks;
}

/** Missing or partial totals must stay unavailable, not become a fabricated zero. */
export function hqPublishedProjection(score?: WeeklyScore): number | null {
  if (!score || score.hasProjectedTotal !== true || !Number.isFinite(score.projectedPoints)) return null;
  return score.projectedPoints;
}

/** Match the post-draft schedule's persisted-first regular-season rules. */
export function fantasyHqScheduleFacts(league: League) {
  const persisted = (league.seasonResult?.games || [])
    .filter(game => !game.playoffRound)
    .map(game => ({ id: game.id, week: game.week, homeMemberId: game.homeMemberId, awayMemberId: game.awayMemberId }));
  const persistedWeeks = Math.max(0, ...persisted.map(game => Number(game.week) || 0));
  const playoffWeeks = league.settings?.playoffTeams === 4 ? 2 : 3;
  const configured = Number(league.settings?.regularSeasonWeeks ?? league.settings?.seasonGames) || 17;
  const weeks = persistedWeeks || Math.min(Math.max(13, Math.min(17, configured)), 18 - playoffWeeks);
  return { weeks, persisted };
}
