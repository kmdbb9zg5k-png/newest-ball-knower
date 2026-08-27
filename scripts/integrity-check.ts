import { PLAYERS_DATABASE } from '../players';
import { getDraftPositionGroup, validateRosterShape } from '../rosterRules';
import { getLiveFantasyDraftGroup, validateLiveFantasyRoster } from '../liveFantasyRules';
import { buildFantasyWeekPairings, buildScoredFantasyGames, buildStandings, simulateFantasyPlayoffs, simulateFantasyWeek } from '../simulation';
import {
  buildRealTeamRoster,
  FANTASY_DRAFT_ROUNDS,
  FANTASY_ROSTER_REQUIREMENTS,
} from '../soloFranchiseEngine';
import { TEAM_THEMES } from '../teamTheme';
import { LeagueMember, TOTAL_ROSTER_SIZE } from '../types';
import { estimatePlayerSalary } from '../currentSeasonRoster';
import {
  allFormatScores,
  isFinalGameStatus,
  kickoffIsoFromTank01Game,
  liveProjectedPoints,
  normalizeTank01DefenseStats,
  scoreFantasyDefense,
} from '../fantasyLiveScoring';

const failures: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) failures.push(message);
};

const EXPECTED_TEAM_CODES = [
  'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC',
  'LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WAS',
] as const;

const teamCodes = new Set(TEAM_THEMES.map(team => team.abbr));
check(TEAM_THEMES.length === 32, `Expected 32 NFL teams, found ${TEAM_THEMES.length}.`);
check(teamCodes.size === 32, 'NFL team abbreviations contain duplicates.');
check(EXPECTED_TEAM_CODES.every(code => teamCodes.has(code)), `NFL team set does not match the canonical 32-team code list.`);
check([...teamCodes].every(code => EXPECTED_TEAM_CODES.includes(code as typeof EXPECTED_TEAM_CODES[number])), 'Unexpected NFL team abbreviation found.');

const playerIds = PLAYERS_DATABASE.map(player => player.id);
check(new Set(playerIds).size === playerIds.length, 'Player database contains duplicate permanent player IDs.');

for (const player of PLAYERS_DATABASE) {
  check(Boolean(player.id && player.name), 'Found a player missing id or name.');
  check(Number.isFinite(player.ovr) && player.ovr >= 0 && player.ovr <= 99, `${player.name}: invalid OVR ${player.ovr}.`);
  check(Number.isFinite(player.salary) && player.salary >= 0, `${player.name}: invalid salary ${player.salary}.`);
  check(teamCodes.has(player.team) || player.team === 'FA', `${player.name}: invalid team ${player.team}.`);
  if (player.teamId) check(teamCodes.has(player.teamId) || player.teamId === 'FA', `${player.name}: invalid teamId ${player.teamId}.`);
  check(Boolean(getDraftPositionGroup(player) || getLiveFantasyDraftGroup(player)), `${player.name}: unsupported position ${player.position}.`);
}

for (const team of TEAM_THEMES) {
  const teamPlayers = PLAYERS_DATABASE.filter(player => player.team === team.abbr);
  check(teamPlayers.length > 0, `${team.abbr}: no active players in database.`);
  check(teamPlayers.some(player => player.position === 'QB'), `${team.abbr}: no QB in database.`);

  const standardRoster = buildRealTeamRoster(team.abbr);
  const shapeErrors = validateRosterShape(standardRoster);
  check(standardRoster.length === TOTAL_ROSTER_SIZE, `${team.abbr}: standard franchise roster builds ${standardRoster.length}/${TOTAL_ROSTER_SIZE}.`);
  check(shapeErrors.length === 0, `${team.abbr}: standard roster shape invalid: ${shapeErrors.join(' ')}`);
}

const fantasyRoundSum = Object.values(FANTASY_ROSTER_REQUIREMENTS).reduce((sum, value) => sum + value, 0);
check(FANTASY_DRAFT_ROUNDS === 53, `Fantasy Franchise must stay 53 rounds; found ${FANTASY_DRAFT_ROUNDS}.`);
check(fantasyRoundSum === 53, `Fantasy roster requirements sum to ${fantasyRoundSum}, not 53.`);

for (const [group, requiredPerTeam] of Object.entries(FANTASY_ROSTER_REQUIREMENTS)) {
  const available = PLAYERS_DATABASE.filter(player => getDraftPositionGroup(player) === group).length;
  const leagueNeed = requiredPerTeam * 32;
  check(available >= leagueNeed, `${group}: player pool has ${available}; 32 teams x ${requiredPerTeam} requires at least ${leagueNeed}.`);
}

const fantasyPool=PLAYERS_DATABASE.filter(player=>Boolean(getLiveFantasyDraftGroup(player))).slice(0,TOTAL_ROSTER_SIZE);
const testMembers:LeagueMember[]=Array.from({length:10},(_,index)=>({
  id:`integrity-member-${index}`,
  userId:`integrity-user-${index}`,
  userName:`Integrity Team ${index+1}`,
  isCommissioner:index===0,
  status:'ready',
  roster:fantasyPool,
}));
const weeklyGames=Array.from({length:17},(_,index)=>simulateFantasyWeek(testMembers,index+1)).flat();
const fullSchedule=Array.from({length:17},(_,index)=>buildFantasyWeekPairings(testMembers,index+1)).flat();
for(const member of testMembers){
  const gamesPlayed=weeklyGames.filter(game=>game.homeMemberId===member.id||game.awayMemberId===member.id).length;
  check(gamesPlayed===17,`${member.userName}: weekly fantasy schedule produced ${gamesPlayed}/17 games.`);
  const scheduledGames=fullSchedule.filter(game=>game.homeMemberId===member.id||game.awayMemberId===member.id).length;
  check(scheduledGames===17,`${member.userName}: preseason fantasy schedule produced ${scheduledGames}/17 matchups.`);
}
const openingPairing=buildFantasyWeekPairings(testMembers,1)[0];
const pendingScores=[
  {memberId:openingPairing.homeMemberId,week:1,livePoints:112.4,isFinal:false},
  {memberId:openingPairing.awayMemberId,week:1,livePoints:108.7,isFinal:false},
];
check(buildScoredFantasyGames(testMembers,17,pendingScores).length===0,'Online fantasy counted a non-final weekly score as a played matchup.');
const finalScores=pendingScores.map(score=>({...score,isFinal:true}));
const scoredOpening=buildScoredFantasyGames(testMembers,17,finalScores);
check(scoredOpening.length===1&&scoredOpening[0].homeScore===112.4&&scoredOpening[0].winnerId===openingPairing.homeMemberId,'Official weekly scores did not produce the expected fantasy result.');
const fantasyStandings=buildStandings(testMembers,weeklyGames);
check(fantasyStandings.every((standing,index)=>index===0||fantasyStandings[index-1].winPercentage>=standing.winPercentage),'Fantasy standings are not sorted by win percentage.');
const fantasyPlayoffs=simulateFantasyPlayoffs(testMembers,fantasyStandings,6,18);
check(fantasyPlayoffs.games.length===5,'A six-team fantasy playoff must produce five games.');
check(Boolean(fantasyPlayoffs.championMemberId),'Fantasy playoffs did not crown a champion.');
check(validateLiveFantasyRoster([]).length===6,'An empty live-fantasy roster must report all six missing position groups.');
check(estimatePlayerSalary('P', 79) <= 6, 'Estimated punter salary exceeds the position cap.');
check(estimatePlayerSalary('LB', 79) < estimatePlayerSalary('QB', 79), 'Position-aware salary estimates are not differentiated.');
check(PLAYERS_DATABASE.every(player => !(['K', 'P'].includes(player.position) && player.salaryType === 'estimated' && player.salary > 6)), 'An estimated kicker or punter salary exceeds $6M.');

const receiverScores=allFormatScores({
  Receiving:{recYds:'100',recTD:'1',receptions:'8'},
  Defense:{fumblesLost:'1'},
});
check(receiverScores.standard===14,'Standard scoring did not calculate receiving yards, touchdown and lost fumble correctly.');
check(receiverScores.half_ppr===18,'Half-PPR scoring did not add 0.5 points per reception.');
check(receiverScores.ppr===22,'PPR scoring did not add one point per reception.');

const kickerScores=allFormatScores({Kicking:{fgMade:'3',fgMissed:'1',xpMade:'2',xpMissed:'1'}});
check(kickerScores.ppr===9,'Kicker scoring did not apply field goals, PATs and misses correctly.');

const conversionScores=allFormatScores({
  Passing:{passingTwoPointConversion:'1'},
  Rushing:{rushingTwoPointConversion:'1'},
});
check(conversionScores.ppr===4,'Two-point conversions from multiple stat categories were not added together.');

const defenseScore=scoreFantasyDefense(normalizeTank01DefenseStats({
  sacks:'3',defensiveInterceptions:'2',fumblesRecovered:'1',defTD:'1',safeties:'1',ptsAllowed:'10',
}));
check(defenseScore===21,'D/ST scoring did not apply sacks, takeaways, touchdown, safety and points allowed correctly.');
check(isFinalGameStatus('Final'),'A final NFL game status was not recognized.');
check(!isFinalGameStatus('Halftime'),'Halftime was incorrectly treated as a final score.');
check(liveProjectedPoints(18,20,'In Progress','3')===23,'Live projection did not blend actual production with remaining game time.');
check(liveProjectedPoints(18,20,'Final','4')===18,'Final player projection must equal the official score.');
check(kickoffIsoFromTank01Game({gameTime_epoch:'1788782400'})==='2026-09-07T12:00:00.000Z','Tank01 kickoff epoch was not normalized deterministically.');

console.log(`Ball Knower integrity check: ${PLAYERS_DATABASE.length} players, ${TEAM_THEMES.length} teams, ${FANTASY_DRAFT_ROUNDS}-round fantasy franchise.`);

if (failures.length) {
  console.error(`Integrity failures (${failures.length}):`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log('Integrity check passed.');
