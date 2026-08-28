import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Play, RotateCcw, Trophy, Users } from 'lucide-react';
import { calculateTeamRatings } from './evaluation';
import { simulateGame } from './simulation';
import {
  buildAwards,
  generatePlayerLines,
  InjuryEvent,
  playoffSnapshot,
  ratingsWithInjuries,
  simulateInjuries,
  SoloDifficulty,
  SoloWeek,
} from './soloSeasonEngine';
import { buildRealTeamRoster, franchiseSchedule, makeFranchiseOpponent } from './soloFranchiseEngine';
import { TeamTheme, TEAM_THEMES, teamLogoUrl } from './teamTheme';
import { LeagueMember, Player } from './types';

type PlayoffResult = { round: string; opponent: string; you: number; them: number; won: boolean };
type SeasonStage = 'regular' | 'playoffs' | 'finished' | 'draft';
type RookieProspect = { id: string; name: string; position: string; school: string; grade: number };
type Conference = 'AFC' | 'NFC';
type PlayoffSeed = { abbr: string; name: string; conference: Conference; seed: number; wins: number; losses: number; differential: number };
type PlayoffMatchup = { round: 'WILD CARD' | 'DIVISIONAL' | 'CONFERENCE CHAMPIONSHIP' | 'SUPER BOWL'; opponentAbbr: string; opponentSeed: number };

type Props = {
  title: string;
  userTeam: TeamTheme;
  roster: Player[];
  saveKey: string;
  onBack: () => void;
  opponentRosters?: Record<string, Player[]>;
  difficulty?: SoloDifficulty;
  myPlayerId?: string;
  onMyPlayerGame?: (fantasyScore: number, won: boolean) => void;
  onRosterChange?: (roster: Player[]) => void;
};

const AFC = new Set(['BAL','BUF','CIN','CLE','DEN','HOU','IND','JAX','KC','LAC','LV','MIA','NE','NYJ','PIT','TEN']);
const conferenceFor = (abbr: string): Conference => AFC.has(abbr) ? 'AFC' : 'NFC';
const stableNumber = (value: string) => Array.from(value).reduce((total, character) => Math.imul(total ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0;
const pairWinner = (first: PlayoffSeed, second: PlayoffSeed, userAbbr: string) => first.abbr === userAbbr ? first : second.abbr === userAbbr ? second : first.seed < second.seed ? first : second;

export function buildFranchisePlayoffField(userTeam: TeamTheme, userWins: number, userDifferential: number, teamOverall: (team: TeamTheme) => number): PlayoffSeed[] {
  const rows = TEAM_THEMES.map(team => {
    const overall = teamOverall(team);
    const variation = (stableNumber(`${team.abbr}:2026-playoffs`) % 5) - 2;
    const wins = team.abbr === userTeam.abbr ? userWins : Math.max(3, Math.min(14, Math.round(8 + (overall - 78) / 3 + variation)));
    const differential = team.abbr === userTeam.abbr ? userDifferential : (overall - 78) * 18 + variation * 11;
    return { abbr: team.abbr, name: team.name, conference: conferenceFor(team.abbr), wins, losses: 17 - wins, differential, seed: 0 };
  });
  return (['AFC', 'NFC'] as Conference[]).flatMap(conference => rows
    .filter(team => team.conference === conference)
    .sort((first, second) => second.wins - first.wins || second.differential - first.differential || first.abbr.localeCompare(second.abbr))
    .slice(0, 7)
    .map((team, index) => ({ ...team, seed: index + 1 })));
}

export function buildFranchisePlayoffPath(field: PlayoffSeed[], userAbbr: string): PlayoffMatchup[] {
  const user = field.find(team => team.abbr === userAbbr);
  if (!user) return [];
  const conference = field.filter(team => team.conference === user.conference).sort((a, b) => a.seed - b.seed);
  const seed = (number: number) => conference.find(team => team.seed === number)!;
  const wildPairs = [[2, 7], [3, 6], [4, 5]] as const;
  const wildWinners = wildPairs.map(([first, second]) => pairWinner(seed(first), seed(second), userAbbr));
  const divisionalTeams = [seed(1), ...wildWinners].sort((a, b) => a.seed - b.seed);
  const divisionalPairs = [[divisionalTeams[0], divisionalTeams[3]], [divisionalTeams[1], divisionalTeams[2]]] as const;
  const userWildOpponent = user.seed === 1 ? null : seed(9 - user.seed);
  const userDivisionalPair = divisionalPairs.find(pair => pair.some(team => team.abbr === userAbbr));
  const userDivisionalOpponent = userDivisionalPair?.find(team => team.abbr !== userAbbr);
  const divisionalWinners = divisionalPairs.map(([first, second]) => pairWinner(first, second, userAbbr));
  const conferenceOpponent = divisionalWinners.find(team => team.abbr !== userAbbr);
  const otherConference = field.filter(team => team.conference !== user.conference).sort((a, b) => a.seed - b.seed);
  const otherChampion = otherConference[0];
  return [
    ...(userWildOpponent ? [{ round: 'WILD CARD' as const, opponentAbbr: userWildOpponent.abbr, opponentSeed: userWildOpponent.seed }] : []),
    ...(userDivisionalOpponent ? [{ round: 'DIVISIONAL' as const, opponentAbbr: userDivisionalOpponent.abbr, opponentSeed: userDivisionalOpponent.seed }] : []),
    ...(conferenceOpponent ? [{ round: 'CONFERENCE CHAMPIONSHIP' as const, opponentAbbr: conferenceOpponent.abbr, opponentSeed: conferenceOpponent.seed }] : []),
    ...(otherChampion ? [{ round: 'SUPER BOWL' as const, opponentAbbr: otherChampion.abbr, opponentSeed: otherChampion.seed }] : []),
  ];
}

function restoreSeason(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || !['regular', 'playoffs', 'finished', 'draft'].includes(saved.stage)) return null;
    if (!Array.isArray(saved.weeks) || saved.weeks.length > 17 || saved.weeks.some((week: any) => !week?.game || !Number.isFinite(Number(week.game.homeScore)) || !Number.isFinite(Number(week.game.awayScore)) || !Array.isArray(week.playerLines))) return null;
    if (!Array.isArray(saved.playoffs) || saved.playoffs.length > 4 || !Array.isArray(saved.injuries)) return null;
    return saved;
  } catch {
    return null;
  }
}

export const FranchiseSeason: React.FC<Props> = ({
  title,
  userTeam,
  roster,
  saveKey,
  onBack,
  opponentRosters,
  difficulty = 'pro',
  myPlayerId,
  onMyPlayerGame,
  onRosterChange,
}) => {
  const seasonKey = `${saveKey}:season`;
  const restored = useMemo(() => restoreSeason(seasonKey), [seasonKey]);
  const [stage, setStage] = useState<SeasonStage>(() => restored?.stage ?? 'regular');
  const [weeks, setWeeks] = useState<SoloWeek[]>(() => restored?.weeks ?? []);
  const [playoffs, setPlayoffs] = useState<PlayoffResult[]>(() => restored?.playoffs ?? []);
  const [injuries, setInjuries] = useState<InjuryEvent[]>(() => restored?.injuries ?? []);
  const [message, setMessage] = useState(() => restored?.message ?? 'Week 1 is ready.');
  const [draftRound, setDraftRound] = useState<number>(() => restored?.draftRound ?? 1);
  const [draftedProspects, setDraftedProspects] = useState<RookieProspect[]>(() => restored?.draftedProspects ?? []);
  const [seasonRoster, setSeasonRoster] = useState<Player[]>(() => Array.isArray(restored?.roster) && restored.roster.length ? restored.roster : roster);
  const [playoffField, setPlayoffField] = useState<PlayoffSeed[]>(() => Array.isArray(restored?.playoffField) ? restored.playoffField : []);
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationLock = useRef(false);
  const schedule = useMemo(() => franchiseSchedule(userTeam.abbr), [userTeam.abbr]);
  useEffect(() => {
    setSeasonRoster(current => {
      const rookies = current.filter(player => player.id.startsWith('franchise-rookie-'));
      const next = [...roster, ...rookies.filter(rookie => !roster.some(player => player.id === rookie.id))];
      return JSON.stringify(next.map(player => player.id)) === JSON.stringify(current.map(player => player.id)) ? current : next;
    });
  }, [roster]);
  const activeRoster = useMemo(() => {
    const latest = new Map(roster.map(player => [player.id, player]));
    return seasonRoster.map(player => latest.get(player.id) ?? player);
  }, [roster, seasonRoster]);
  const ratings = useMemo(() => calculateTeamRatings(activeRoster), [activeRoster]);
  const wins = weeks.filter(week => week.won).length;
  const losses = weeks.length - wins;
  const finalPointDifferential = weeks.reduce((total, week) => total + (
    week.game.homeMemberId === 'franchise-user'
      ? week.game.homeScore - week.game.awayScore
      : week.game.awayScore - week.game.homeScore
  ), 0);
  const finalPlayoffOdds = weeks.length === 17
    ? (wins > 9 || (wins === 9 && finalPointDifferential >= 0) ? 100 : 0)
    : weeks.at(-1)?.playoffOdds ?? 50;
  const activeInjuries = injuries.filter(injury => injury.weeks > 0);
  const currentOpponent = schedule[Math.min(weeks.length, schedule.length - 1)];
  const allLines = weeks.flatMap(week => week.playerLines ?? []);
  const awards = useMemo(() => buildAwards(allLines), [weeks]);

  useEffect(() => {
    try {
      localStorage.setItem(seasonKey, JSON.stringify({ version: 1, stage, weeks, playoffs, injuries, message, draftRound, draftedProspects, roster: seasonRoster, playoffField }));
    } catch (error) {
      console.warn('Unable to save franchise season', error);
    }
  }, [seasonKey, stage, weeks, playoffs, injuries, message, draftRound, draftedProspects, seasonRoster, playoffField]);

  const rosterFor = (team: TeamTheme) => opponentRosters?.[team.abbr] ?? buildRealTeamRoster(team.abbr);
  const unlockSimulation = () => window.setTimeout(() => {
    simulationLock.current = false;
    setIsSimulating(false);
  }, 400);

  const playWeek = () => {
    const weekNumber = weeks.length + 1;
    if (weekNumber > 17 || simulationLock.current) return;
    simulationLock.current = true;
    setIsSimulating(true);
    try {
    const opponentTeam = schedule[weekNumber - 1];
    const opponent = makeFranchiseOpponent(opponentTeam, rosterFor(opponentTeam), difficulty as SoloDifficulty, weekNumber);
    const myRatings = ratingsWithInjuries(activeRoster, activeInjuries);
    const me: LeagueMember = {
      id: 'franchise-user',
      userId: 'franchise-user',
      userName: userTeam.name,
      isCommissioner: true,
      status: 'ready',
      roster: activeRoster,
      teamRatings: myRatings,
    };
    const userHome = weekNumber % 2 === 1;
    const game = userHome ? simulateGame(weekNumber, me, opponent) : simulateGame(weekNumber, opponent, me);
    const won = game.winnerId === 'franchise-user';
    const nextWins = wins + (won ? 1 : 0);
    const nextLosses = losses + (won ? 0 : 1);
    const snapshot = playoffSnapshot(nextWins, nextLosses, weekNumber);
    const newInjuries = simulateInjuries(activeRoster, weekNumber, 'normal', activeInjuries);
    const playerLines = generatePlayerLines(activeRoster, game, userHome, weekNumber);
    setWeeks(previous => [...previous, {
      week: weekNumber,
      opponent: opponentTeam.name,
      game,
      won,
      playerLines,
      injuries: newInjuries,
      playoffSeed: snapshot.seed,
      playoffOdds: snapshot.odds,
      record: `${nextWins}-${nextLosses}`,
    }]);
    setInjuries(previous => [...previous.map(injury => ({ ...injury, weeks: Math.max(0, injury.weeks - 1) })), ...newInjuries]);
    const myLine = myPlayerId ? playerLines.find(line => line.playerId === myPlayerId) : null;
    if (myPlayerId && onMyPlayerGame) onMyPlayerGame(myLine?.fantasyScore ?? 2, won);
    setMessage(newInjuries.length
      ? `${newInjuries[0].playerName} suffered a ${newInjuries[0].severity.toLowerCase()} injury.`
      : `${won ? 'WIN' : 'LOSS'} — ${nextWins}-${nextLosses}`);
    } finally {
      unlockSimulation();
    }
  };

  const enterPlayoffs = () => {
    const differential = weeks.reduce((total, week) => total + (
      week.game.homeMemberId === 'franchise-user'
        ? week.game.homeScore - week.game.awayScore
        : week.game.awayScore - week.game.homeScore
    ), 0);
    const field = buildFranchisePlayoffField(userTeam, wins, differential, team => calculateTeamRatings(rosterFor(team)).overall);
    setPlayoffField(field);
    const userSeed = field.find(team => team.abbr === userTeam.abbr);
    if (!userSeed) {
      setStage('finished');
      setMessage(`Season complete at ${wins}-${losses}. You missed the playoffs.`);
      return;
    }
    setStage('playoffs');
    setMessage(userSeed.seed === 1 ? `#1 seed clinched at ${wins}-${losses}. You earned a Wild Card bye.` : `#${userSeed.seed} seed clinched at ${wins}-${losses}.`);
  };

  const playoffPath = useMemo(() => buildFranchisePlayoffPath(playoffField, userTeam.abbr), [playoffField, userTeam.abbr]);
  const nextPlayoffMatchup = playoffPath[playoffs.length] ?? null;
  const round = nextPlayoffMatchup?.round ?? null;

  const playRound = () => {
    if (!round || simulationLock.current) return;
    simulationLock.current = true;
    setIsSimulating(true);
    try {
    const opponentTeam = TEAM_THEMES.find(team => team.abbr === nextPlayoffMatchup?.opponentAbbr);
    if (!opponentTeam) return;
    const opponent = makeFranchiseOpponent(opponentTeam, rosterFor(opponentTeam), difficulty as SoloDifficulty, `playoff-${playoffs.length}`);
    const me: LeagueMember = {
      id: 'franchise-user',
      userId: 'franchise-user',
      userName: userTeam.name,
      isCommissioner: true,
      status: 'ready',
      roster: activeRoster,
      teamRatings: ratingsWithInjuries(activeRoster, activeInjuries),
    };
    const userHome = playoffs.length % 2 === 0;
    const game = userHome ? simulateGame(18 + playoffs.length, me, opponent) : simulateGame(18 + playoffs.length, opponent, me);
    const you = userHome ? game.homeScore : game.awayScore;
    const them = userHome ? game.awayScore : game.homeScore;
    const won = game.winnerId === 'franchise-user';
    if (myPlayerId && onMyPlayerGame) {
      const playerLines = generatePlayerLines(activeRoster, game, userHome, 18 + playoffs.length);
      const myLine = playerLines.find(line => line.playerId === myPlayerId);
      onMyPlayerGame(myLine?.fantasyScore ?? 3, won);
    }
    const next = [...playoffs, { round, opponent: opponentTeam.name, you, them, won }];
    setPlayoffs(next);
    if (!won) {
      setStage('finished');
      setMessage(`${round}: ${you}-${them}. Your run ends here.`);
    } else if (round === 'SUPER BOWL') {
      setStage('finished');
      setMessage(`WORLD CHAMPION — ${userTeam.name} won Super Bowl LXI ${you}-${them}.`);
    } else {
      setMessage(`${round} WIN ${you}-${them}. Keep going.`);
    }
    } finally {
      unlockSimulation();
    }
  };

  const resetSeason = () => {
    setStage('regular');
    setWeeks([]);
    setPlayoffs([]);
    setInjuries([]);
    setMessage('Week 1 is ready.');
    setPlayoffField([]);
    try { localStorage.removeItem(seasonKey); } catch (error) { console.warn('Unable to clear franchise season', error); }
  };

  const startDraft = () => {
    setDraftRound(1);
    setDraftedProspects([]);
    setStage('draft');
    setMessage('Your scouts are ready. You make every one of your seven picks.');
  };

  const selectProspect = (prospect: RookieProspect) => {
    const next = [...draftedProspects, prospect];
    setDraftedProspects(next);
    if (draftRound === 7) {
      const rookies = next.map((player, index) => rookieToPlayer(player, userTeam, index + 1));
      const rookieIds = new Set(rookies.map(player => player.id));
      const nextRoster = [...seasonRoster.filter(player => !rookieIds.has(player.id)), ...rookies];
      setSeasonRoster(nextRoster);
      onRosterChange?.(nextRoster);
      setWeeks([]);
      setPlayoffs([]);
      setInjuries([]);
      setStage('regular');
      setDraftRound(1);
      setMessage(`Draft complete — ${next.map(player => player.name).join(', ')} join your franchise. Week 1 is ready.`);
      return;
    }
    setDraftRound(round => round + 1);
    setMessage(`${prospect.name} is the pick. CPU teams simulated forward to your next selection.`);
  };

  return (
    <div className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-black tracking-[.24em] text-[var(--bk-team-accent)]">{title}</div>
            <div className="truncate text-xl font-black">{userTeam.name}</div>
          </div>
          <button type="button" onClick={resetSeason} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Restart season">
            <RotateCcw size={18} />
          </button>
        </div>

        {message ? <div className="mb-4 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-4 py-3 text-sm font-bold text-[var(--bk-team-accent)]">{message}</div> : null}

        {stage === 'regular' ? (
          <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <div>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <SeasonStat label="WEEK" value={`${Math.min(weeks.length + 1, 17)}/17`} />
                <SeasonStat label="RECORD" value={`${wins}-${losses}`} />
                <SeasonStat label={weeks.length === 17 ? 'PLAYOFF STATUS' : 'SEED'} value={weeks.length === 17 ? 'SELECTION' : `#${weeks.at(-1)?.playoffSeed ?? '—'}`} />
                <SeasonStat label="PLAYOFF ODDS" value={weeks.length === 17 ? 'PENDING' : `${finalPlayoffOdds}%`} />
                <SeasonStat label="TEAM OVR" value={`${ratings.overall}`} />
              </div>

              {weeks.length < 17 ? (
                <div className="rounded-[2rem] border border-white/10 bg-[#10151d]/95 p-5 sm:p-7">
                  <div className="text-[10px] font-black tracking-[.25em] text-[var(--bk-team-accent)]">WEEK {weeks.length + 1} • GAMEDAY</div>
                  <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                    <TeamMatchup team={userTeam} label={`${ratings.overall} OVR`} />
                    <div className="text-2xl font-black text-zinc-600">VS</div>
                    <TeamMatchup team={currentOpponent} label="CPU" />
                  </div>
                  <button type="button" onClick={playWeek} disabled={isSimulating} aria-busy={isSimulating} className="mt-6 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)] disabled:cursor-wait disabled:opacity-60">
                    <Play className="mr-2 inline" size={20} /> {isSimulating ? 'SIMULATING…' : `SIMULATE WEEK ${weeks.length + 1}`}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={enterPlayoffs} className="w-full rounded-2xl bg-[var(--bk-team-accent)] py-5 text-lg font-black text-[var(--bk-on-accent)]">
                  SELECTION SUNDAY <ChevronRight className="inline" />
                </button>
              )}

              <div className="mt-6">
                <h3 className="mb-3 text-xl font-black">SEASON LOG</h3>
                <div className="space-y-2">
                  {[...weeks].reverse().map(week => {
                    const home = week.game.homeMemberId === 'franchise-user';
                    const you = home ? week.game.homeScore : week.game.awayScore;
                    const them = home ? week.game.awayScore : week.game.homeScore;
                    return (
                      <div key={week.week} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-2xl border border-white/10 bg-[#111] p-4 text-sm">
                        <b className={week.won ? 'text-green-400' : 'text-red-400'}>{week.won ? 'W' : 'L'}</b>
                        <span className="min-w-0 truncate"><b>WEEK {week.week}</b> vs {week.opponent}</span>
                        <b>{you}-{them}</b>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <aside className="space-y-3">
              <SeasonPanel title="INJURY REPORT">
                {activeInjuries.length ? activeInjuries.map(injury => (
                  <div key={injury.playerId} className="border-b border-white/5 py-2 text-sm">
                    <b>{injury.playerName}</b>
                    <div className="text-xs text-zinc-500">{injury.position} • {injury.weeks} week(s)</div>
                  </div>
                )) : <p className="text-sm text-zinc-500">Healthy roster.</p>}
              </SeasonPanel>
              <SeasonPanel title="TEAM LEADERS">
                {awards.slice(0, 3).map(award => (
                  <div key={award.award} className="border-b border-white/5 py-2">
                    <div className="text-[9px] font-black tracking-wider text-zinc-500">{award.award}</div>
                    <b>{award.winner}</b>
                  </div>
                ))}
              </SeasonPanel>
            </aside>
          </div>
        ) : null}

        {stage === 'playoffs' ? (
          <div className="rounded-[2rem] border border-white/10 bg-[#10151d] p-5 text-center sm:p-8">
            <Trophy className="mx-auto text-[var(--bk-team-accent)]" size={58} />
            <h3 className="mt-3 text-4xl font-black">NFL PLAYOFFS</h3>
            <div className="mt-6 grid gap-2 sm:grid-cols-4">
              {['WILD CARD', 'DIVISIONAL', 'CONFERENCE CHAMPIONSHIP', 'SUPER BOWL'].map(label => {
                const result = playoffs.find(game => game.round === label);
                const scheduled = playoffPath.find(game => game.round === label);
                const bye = label === 'WILD CARD' && playoffField.find(team => team.abbr === userTeam.abbr)?.seed === 1;
                const opponent = scheduled ? TEAM_THEMES.find(team => team.abbr === scheduled.opponentAbbr) : null;
                return <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-left"><div className="text-[9px] font-black text-[var(--bk-team-accent)]">{label === 'CONFERENCE CHAMPIONSHIP' ? 'CONFERENCE' : label}</div><div className="mt-2 font-black">{bye ? 'FIRST-ROUND BYE' : result ? `${result.won ? 'WIN' : 'LOSS'} ${result.you}-${result.them}` : scheduled ? `VS #${scheduled.opponentSeed}` : 'TBD'}</div>{result ? <div className="truncate text-xs text-zinc-500">{result.opponent}</div> : opponent ? <div className="truncate text-xs text-zinc-500">{opponent.name}</div> : null}</div>;
              })}
            </div>
            {round ? <button type="button" onClick={playRound} disabled={isSimulating} aria-busy={isSimulating} className="mt-6 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)] disabled:cursor-wait disabled:opacity-60">{isSimulating ? 'SIMULATING…' : `PLAY ${round}`}</button> : null}
          </div>
        ) : null}

        {stage === 'finished' ? (
          <div className="rounded-[2rem] border border-[var(--bk-team-accent)]/30 bg-[#10151d] p-7 text-center">
            <Trophy className="mx-auto text-[var(--bk-team-accent)]" size={64} />
            <h3 className="mt-4 text-4xl font-black">{message.includes('WORLD CHAMPION') ? 'SUPER BOWL CHAMPION' : 'SEASON COMPLETE'}</h3>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">{message}</p>
            <button type="button" onClick={startDraft} className="mt-6 rounded-2xl bg-[var(--bk-team-accent)] px-6 py-4 font-black text-[var(--bk-on-accent)]">ENTER OFFSEASON DRAFT</button>
          </div>
        ) : null}

        {stage === 'draft' ? <OffseasonDraft round={draftRound} wins={wins} selected={draftedProspects} onSelect={selectProspect} /> : null}
      </div>
    </div>
  );
};

const TeamMatchup = ({ team, label }: { team: TeamTheme; label: string }) => (
  <div className="min-w-0">
    <img src={teamLogoUrl(team.abbr)} alt="" aria-hidden="true" className="mx-auto h-14 w-14 object-contain sm:h-20 sm:w-20" />
    <div className="mt-2 text-lg font-black leading-tight sm:text-2xl">{team.name}</div>
    <div className="text-xs font-bold text-zinc-500">{label}</div>
  </div>
);

const SeasonStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/10 bg-[#111] p-3">
    <div className="text-[9px] font-black tracking-widest text-zinc-500">{label}</div>
    <div className="mt-1 text-xl font-black">{value}</div>
  </div>
);

const SeasonPanel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
    <h4 className="mb-3 text-xs font-black tracking-widest text-[var(--bk-team-accent)]">{title}</h4>
    {children}
  </div>
);

const PROSPECTS: RookieProspect[] = [
  { id: 'r-qb-wade', name: 'Cam Wade', position: 'QB', school: 'Texas', grade: 94 },
  { id: 'r-edge-cross', name: 'Malik Cross', position: 'EDGE', school: 'Georgia', grade: 93 },
  { id: 'r-wr-porter', name: 'Jalen Porter', position: 'WR', school: 'Ohio State', grade: 92 },
  { id: 'r-cb-stokes', name: 'Devin Stokes', position: 'CB', school: 'Alabama', grade: 91 },
  { id: 'r-ot-king', name: 'Trey King', position: 'OT', school: 'Notre Dame', grade: 90 },
  { id: 'r-dt-hayes', name: 'Darius Hayes', position: 'DT', school: 'Michigan', grade: 89 },
  { id: 'r-rb-foster', name: 'Micah Foster', position: 'RB', school: 'Oregon', grade: 88 },
  { id: 'r-s-reed', name: 'Kenny Reed', position: 'S', school: 'LSU', grade: 87 },
  { id: 'r-lb-wells', name: 'Jordan Wells', position: 'LB', school: 'Penn State', grade: 86 },
  { id: 'r-te-banks', name: 'Andre Banks', position: 'TE', school: 'Miami', grade: 85 },
  { id: 'r-og-fields', name: 'Noah Fields', position: 'OG', school: 'Iowa', grade: 84 },
  { id: 'r-wr-davis', name: 'Troy Davis', position: 'WR', school: 'USC', grade: 83 },
];

const rookieToPlayer = (prospect: RookieProspect, team: TeamTheme, round: number): Player => {
  const overall = Math.max(68, Math.min(84, prospect.grade - 10));
  return {
    id: `franchise-rookie-${prospect.id}`,
    playerId: `franchise-rookie-${prospect.id}`,
    teamId: team.abbr,
    team: team.abbr,
    teamAbbreviation: team.abbr,
    teamCity: team.name.split(' ').slice(0, -1).join(' '),
    teamName: team.name,
    name: prospect.name,
    fullName: prospect.name,
    position: prospect.position as Player['position'],
    age: 22,
    experience: 0,
    starter: false,
    active: true,
    ovr: overall,
    overall: overall,
    overallRating: overall,
    ratingSource: 'Ball Knower Rookie Draft',
    ratingSeason: 2027,
    salary: Number(Math.max(.9, 5.8 - round * .7).toFixed(1)),
    salaryType: 'estimated',
    archetype: `${prospect.school} rookie`,
    attributes: { athleticism: overall, footballIQ: Math.max(64, overall - 3) },
  };
};

const OffseasonDraft = ({ round, wins, selected, onSelect }: { round: number; wins: number; selected: RookieProspect[]; onSelect: (prospect: RookieProspect) => void }) => {
  const draftSlot = Math.max(1, Math.min(32, 4 + wins * 2));
  const available = PROSPECTS.filter(prospect => !selected.some(player => player.id === prospect.id));
  const cpuBefore = Math.max(0, draftSlot - 1);
  return <div className="grid gap-4 lg:grid-cols-[1fr_19rem]"><section className="rounded-[2rem] border border-[var(--bk-team-accent)]/25 bg-[#10151d] p-5 sm:p-7"><div className="flex items-center gap-3 text-[var(--bk-team-accent)]"><Users/><span className="text-[10px] font-black tracking-[.24em]">LIVE 32-TEAM ROOKIE DRAFT</span></div><h2 className="mt-2 text-4xl font-black">YOU'RE ON THE CLOCK</h2><p className="mt-2 text-sm text-zinc-400">Round {round}, Pick {draftSlot}. The {cpuBefore} teams ahead of you have already simulated their selections. Nobody picks for you.</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{available.map(prospect => <button key={prospect.id} onClick={() => onSelect(prospect)} className="flex min-h-20 items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-[var(--bk-team-accent)]/50"><div><div className="text-base font-black">{prospect.name}</div><div className="text-[10px] font-bold text-zinc-500">{prospect.position} · {prospect.school}</div></div><div className="text-right"><div className="text-xl font-black text-[var(--bk-team-accent)]">{prospect.grade}</div><div className="text-[8px] font-black text-zinc-600">SCOUT GRADE</div></div></button>)}</div></section><aside className="space-y-3"><SeasonPanel title="YOUR DRAFT CLASS">{selected.length ? selected.map((prospect, index) => <div key={prospect.id} className="border-b border-white/5 py-2 text-sm"><b>R{index + 1}: {prospect.name}</b><div className="text-xs text-zinc-500">{prospect.position} · {prospect.school}</div></div>) : <p className="text-sm text-zinc-500">No picks yet.</p>}</SeasonPanel><SeasonPanel title="CPU PICK SIMULATION"><p className="text-sm text-zinc-400">After your selection, the other 31 CPU front offices draft by roster need and prospect grade. The board then advances automatically to your next pick.</p></SeasonPanel></aside></div>;
};
