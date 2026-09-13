import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAYERS_DATABASE, NFL_TEAMS } from '../players';
import {
  SOLO_PLAYERS_DATABASE,
  SOLO_TEAM_THEMES,
  SOLO_UNIVERSE_VERSION,
} from '../soloUniverse';
import {
  buildSoloTeamRoster,
  buildFranchiseRookieClass,
  createFantasyDraft,
  fantasyAvailablePlayers,
  fantasyDraftComplete,
  franchiseSchedule,
  isValidFantasyDraftState,
  makeFantasyUserPick,
  validateFranchiseRoster,
} from '../soloFranchiseEngine';
import { chooseSmartPick } from '../smartDraft';
import { buildAwards, defaultCareer, generatePlayerLines, getSoloOpponentTeam, makeSoloOpponent, playoffSnapshot, ratingsWithInjuries, simulateInjuries, updateCareer, type InjuryEvent } from '../soloSeasonEngine';
import { calculateTeamRatings } from '../evaluation';
import { simulateGame } from '../simulation';
import { DEFAULT_SALARY_CAP, type LeagueMember } from '../types';

import {calculateCombineResults} from '../myPlayerCombine';

assert.equal(SOLO_UNIVERSE_VERSION, 1);
assert.equal(SOLO_TEAM_THEMES.length, 32, 'Solo must have a complete 32-team fictional league.');
assert.equal(SOLO_PLAYERS_DATABASE.length, 32 * 53, 'Every simulated team must have 53 generated players.');
assert.equal(new Set(SOLO_TEAM_THEMES.map(team => team.abbr)).size, 32, 'Solo team abbreviations must be unique.');
assert.equal(new Set(SOLO_TEAM_THEMES.map(team => team.name)).size, 32, 'Solo team names must be unique.');
assert.equal(new Set(SOLO_PLAYERS_DATABASE.map(player => player.id)).size, SOLO_PLAYERS_DATABASE.length, 'Simulated player IDs must be unique.');
assert.equal(new Set(SOLO_PLAYERS_DATABASE.map(player => player.name)).size, SOLO_PLAYERS_DATABASE.length, 'Simulated player names must be unique.');

const realNames = new Set(PLAYERS_DATABASE.map(player => player.name.toLowerCase()));
const realTeamNames = new Set(NFL_TEAMS.map(team => `${team.city} ${team.name}`.toLowerCase()));
const realTeamCodes = new Set(NFL_TEAMS.map(team => team.code));
assert.ok(SOLO_PLAYERS_DATABASE.every(player => player.id.startsWith('solo-') || player.id === 'bk-001-eli-rodriguez'), 'Every Solo player must use a simulated identity namespace or the approved creator Easter egg.');
assert.ok(SOLO_PLAYERS_DATABASE.every(player => player.ratingSource === 'Ball Knower simulated universe'), 'Solo ratings must identify the simulation model.');
assert.ok(SOLO_PLAYERS_DATABASE.every(player => !realNames.has(player.name.toLowerCase())), 'A real NFL player name leaked into Solo.');
assert.ok(SOLO_TEAM_THEMES.every(team => !realTeamCodes.has(team.abbr) && !realTeamNames.has(team.name.toLowerCase())), 'An NFL team identity leaked into Solo.');

for (const team of SOLO_TEAM_THEMES) {
  const fullTeam = SOLO_PLAYERS_DATABASE.filter(player => player.team === team.abbr);
  assert.equal(fullTeam.length, 53, `${team.abbr} does not have 53 simulated players.`);
  const franchiseRoster = buildSoloTeamRoster(team.abbr);
  assert.deepEqual(validateFranchiseRoster(franchiseRoster), [], `${team.abbr} cannot produce a legal Franchise roster.`);
}

const capRoster = [];
for (let attempt = 0; attempt < 60 && capRoster.length < 20; attempt += 1) {
  const pick = chooseSmartPick(SOLO_PLAYERS_DATABASE, capRoster, DEFAULT_SALARY_CAP, 'balanced');
  if (!pick) break;
  capRoster.push(pick);
}
assert.equal(capRoster.length, 20, 'Cap Challenge cannot auto-draft a complete simulated roster.');
assert.ok(capRoster.reduce((total, player) => total + player.salary, 0) <= DEFAULT_SALARY_CAP, 'Simulated Cap Challenge roster exceeds the cap.');

const soloUser:LeagueMember={id:'solo-user',userId:'solo-user',userName:'YOU',isCommissioner:true,status:'ready',roster:capRoster,teamRatings:calculateTeamRatings(capRoster)};
const regularSeason=[];
let activeInjuries:InjuryEvent[]=[];
for(let week=1;week<=17;week+=1){
  const opponent=makeSoloOpponent(week,'pro');
  assert.deepEqual(validateFranchiseRoster(opponent.roster||[]),[],`Week ${week} CPU opponent has an illegal roster.`);
  const home=week%2===1;
  const adjustedUser={...soloUser,teamRatings:ratingsWithInjuries(capRoster,activeInjuries)};
  const game=home?simulateGame(week,adjustedUser,opponent):simulateGame(week,opponent,adjustedUser);
  assert.notEqual(game.homeScore,game.awayScore,`Week ${week} ended in an unsupported tie.`);
  const lines=generatePlayerLines(capRoster,game,home,week);
  assert.ok(lines.length>=8&&lines.every(line=>Number.isFinite(line.fantasyScore)),`Week ${week} did not produce usable player lines.`);
  regularSeason.push({game,lines});
  const newInjuries=simulateInjuries(capRoster,week,'normal',activeInjuries);
  activeInjuries=[...activeInjuries.map(injury=>({...injury,weeks:Math.max(0,injury.weeks-1)})),...newInjuries].filter(injury=>injury.weeks>0);
}
assert.equal(regularSeason.length,17,'Cap Challenge must simulate the complete 17-game regular season.');
assert.equal(new Set(Array.from({length:17},(_,index)=>getSoloOpponentTeam(index+1).abbr)).size,17,'Cap Challenge repeats an opponent during the 17-game schedule.');
const finalSnapshot=playoffSnapshot(11,6,17);
assert.ok(finalSnapshot.seed>=1&&finalSnapshot.seed<=12&&finalSnapshot.odds>=1&&finalSnapshot.odds<=99,'Cap Challenge playoff projection is invalid.');
const awards=buildAwards(regularSeason.flatMap(week=>week.lines));
assert.equal(awards.length,3,'Cap Challenge season must produce all three awards.');
assert.ok(awards.every(award=>award.winner!=='—'),'Cap Challenge season awards lost their winners.');
const career=updateCareer(defaultCareer(),11,6,true,4,92,['LEGACY BOWL CHAMPION']);
assert.deepEqual({runs:career.runs,titles:career.championships,playoffWins:career.playoffWins,record:career.bestRecord},{runs:1,titles:1,playoffWins:4,record:'11-6'},'Completed Cap Challenge results did not persist into the career summary.');

let fantasyDraft = createFantasyDraft(SOLO_TEAM_THEMES[0].abbr, 17);
while (!fantasyDraftComplete(fantasyDraft)) {
  const player = fantasyAvailablePlayers(fantasyDraft)[0];
  assert.ok(player, 'The simulated fantasy draft ran out of legal players.');
  const next = makeFantasyUserPick(fantasyDraft, player.id);
  assert.ok(next.pickIndex > fantasyDraft.pickIndex, 'A legal simulated fantasy pick did not advance the draft.');
  fantasyDraft = next;
}
assert.equal(fantasyDraft.picks.length,32*53,'Fantasy Draft must complete all 53 rounds for 32 teams.');
assert.ok(isValidFantasyDraftState(fantasyDraft,true),'A completed Fantasy Draft cannot be safely restored.');
assert.ok(isValidFantasyDraftState(JSON.parse(JSON.stringify(fantasyDraft)),true),'A serialized Fantasy Draft cannot be restored.');

const franchiseTeam=SOLO_TEAM_THEMES[0];
const schedule=franchiseSchedule(franchiseTeam.abbr);
assert.equal(schedule.length,17,'Franchise Command must schedule 17 regular-season games.');
assert.equal(new Set(schedule.map(team=>team.abbr)).size,17,'Franchise Command repeats an opponent in one regular season.');
assert.ok(schedule.every(team=>team.abbr!==franchiseTeam.abbr),'Franchise Command scheduled the user against their own team.');
const rookie2027=buildFranchiseRookieClass(2027),rookie2028=buildFranchiseRookieClass(2028);
assert.ok(rookie2027.length>=7,'Franchise offseason must offer enough prospects for a seven-round draft.');
assert.equal(new Set([...rookie2027,...rookie2028].map(player=>player.id)).size,rookie2027.length+rookie2028.length,'Franchise rookie classes repeat across seasons.');

for(const position of ['QB','RB','WR','TE','EDGE','LB','CB','S'] as const){
  const combine=calculateCombineResults({name:`Fixture ${position}`,position,heightInches:72,weightLbs:210,bodyBuild:50,armSize:48,legSize:52});
  assert.ok(combine.forty>=4.25&&combine.forty<6&&combine.bench>=8&&combine.vertical>=27&&combine.score>=0&&combine.score<=100,`My Player ${position} combine result is invalid.`);
}

const soloFiles = [
  'SoloMode.tsx','PlayerAgentMode.tsx','OwnerBusinessMode.tsx','SoloTeamPicker.tsx',
  'FantasyFranchise.tsx','RealTeamFranchise.tsx','MyPlayerStory.tsx','FranchiseSeason.tsx',
  'soloSeasonEngine.ts','soloFranchiseEngine.ts','ownerSeasonEngine.ts',
];
for (const file of soloFiles) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  assert.ok(!/from ['"]\.\/players['"]/.test(source), `${file} imports the real NFL player database.`);
  assert.ok(!/\b(NFL|SUPER BOWL)\b/.test(source), `${file} still exposes NFL-specific Solo copy.`);
}

const agentSource = readFileSync(new URL('../PlayerAgentMode.tsx', import.meta.url), 'utf8');
assert.match(agentSource, /SOLO_PLAYERS_DATABASE/);
assert.match(agentSource, /WHO WILL YOU REPRESENT\?/);
assert.doesNotMatch(agentSource, /playerPortraitUrl\(/, 'Agent Mode may not resolve real-player portrait licenses.');

console.log(`Solo full-flow checks passed: ${SOLO_TEAM_THEMES.length} original teams, ${SOLO_PLAYERS_DATABASE.length} simulated players, legal Cap roster, 17-game season, awards/career persistence, complete 53-round Fantasy Draft, Franchise schedule/rookies, and My Player combine.`);
