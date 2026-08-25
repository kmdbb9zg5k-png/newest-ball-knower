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
};

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
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationLock = useRef(false);
  const schedule = useMemo(() => franchiseSchedule(userTeam.abbr), [userTeam.abbr]);
  const ratings = useMemo(() => calculateTeamRatings(roster), [roster]);
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
      localStorage.setItem(seasonKey, JSON.stringify({ version: 1, stage, weeks, playoffs, injuries, message, draftRound, draftedProspects }));
    } catch (error) {
      console.warn('Unable to save franchise season', error);
    }
  }, [seasonKey, stage, weeks, playoffs, injuries, message, draftRound, draftedProspects]);

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
    const myRatings = ratingsWithInjuries(roster, activeInjuries);
    const me: LeagueMember = {
      id: 'franchise-user',
      userId: 'franchise-user',
      userName: userTeam.name,
      isCommissioner: true,
      status: 'ready',
      roster,
      teamRatings: myRatings,
    };
    const userHome = weekNumber % 2 === 1;
    const game = userHome ? simulateGame(weekNumber, me, opponent) : simulateGame(weekNumber, opponent, me);
    const won = game.winnerId === 'franchise-user';
    const nextWins = wins + (won ? 1 : 0);
    const nextLosses = losses + (won ? 0 : 1);
    const snapshot = playoffSnapshot(nextWins, nextLosses, weekNumber);
    const newInjuries = simulateInjuries(roster, weekNumber, 'normal', activeInjuries);
    const playerLines = generatePlayerLines(roster, game, userHome, weekNumber);
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
    if (wins < 9 || (wins === 9 && differential < 0)) {
      setStage('finished');
      setMessage(`Season complete at ${wins}-${losses}. You missed the playoffs.`);
      return;
    }
    setStage('playoffs');
    setMessage(`Playoff berth clinched at ${wins}-${losses}.`);
  };

  const round = playoffs.length === 0
    ? 'WILD CARD'
    : playoffs.length === 1
      ? 'DIVISIONAL'
      : playoffs.length === 2
        ? 'CONFERENCE CHAMPIONSHIP'
        : playoffs.length === 3
          ? 'SUPER BOWL'
          : null;

  const playRound = () => {
    if (!round || simulationLock.current) return;
    simulationLock.current = true;
    setIsSimulating(true);
    try {
    const candidates = TEAM_THEMES.filter(team => team.abbr !== userTeam.abbr);
    const opponentTeam = candidates[(20 + playoffs.length) % candidates.length];
    const opponent = makeFranchiseOpponent(opponentTeam, rosterFor(opponentTeam), difficulty as SoloDifficulty, `playoff-${playoffs.length}`);
    const me: LeagueMember = {
      id: 'franchise-user',
      userId: 'franchise-user',
      userName: userTeam.name,
      isCommissioner: true,
      status: 'ready',
      roster,
      teamRatings: ratingsWithInjuries(roster, activeInjuries),
    };
    const userHome = playoffs.length % 2 === 0;
    const game = userHome ? simulateGame(18 + playoffs.length, me, opponent) : simulateGame(18 + playoffs.length, opponent, me);
    const you = userHome ? game.homeScore : game.awayScore;
    const them = userHome ? game.awayScore : game.homeScore;
    const won = game.winnerId === 'franchise-user';
    if (myPlayerId && onMyPlayerGame) {
      const playerLines = generatePlayerLines(roster, game, userHome, 18 + playoffs.length);
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
                <SeasonStat label={weeks.length === 17 ? 'PLAYOFF STATUS' : 'SEED'} value={weeks.length === 17 ? (finalPlayoffOdds === 100 ? 'CLINCHED' : 'OUT') : `#${weeks.at(-1)?.playoffSeed ?? '—'}`} />
                <SeasonStat label="PLAYOFF ODDS" value={`${finalPlayoffOdds}%`} />
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
              {['WILD CARD', 'DIVISIONAL', 'CONFERENCE', 'SUPER BOWL'].map((label, index) => {
                const result = playoffs[index];
                return <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-left"><div className="text-[9px] font-black text-[var(--bk-team-accent)]">{label}</div><div className="mt-2 font-black">{result ? `${result.won ? 'WIN' : 'LOSS'} ${result.you}-${result.them}` : 'TBD'}</div>{result ? <div className="truncate text-xs text-zinc-500">{result.opponent}</div> : null}</div>;
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

const OffseasonDraft = ({ round, wins, selected, onSelect }: { round: number; wins: number; selected: RookieProspect[]; onSelect: (prospect: RookieProspect) => void }) => {
  const draftSlot = Math.max(1, Math.min(32, 4 + wins * 2));
  const available = PROSPECTS.filter(prospect => !selected.some(player => player.id === prospect.id));
  const cpuBefore = Math.max(0, draftSlot - 1);
  return <div className="grid gap-4 lg:grid-cols-[1fr_19rem]"><section className="rounded-[2rem] border border-[var(--bk-team-accent)]/25 bg-[#10151d] p-5 sm:p-7"><div className="flex items-center gap-3 text-[var(--bk-team-accent)]"><Users/><span className="text-[10px] font-black tracking-[.24em]">LIVE 32-TEAM ROOKIE DRAFT</span></div><h2 className="mt-2 text-4xl font-black">YOU'RE ON THE CLOCK</h2><p className="mt-2 text-sm text-zinc-400">Round {round}, Pick {draftSlot}. The {cpuBefore} teams ahead of you have already simulated their selections. Nobody picks for you.</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{available.map(prospect => <button key={prospect.id} onClick={() => onSelect(prospect)} className="flex min-h-20 items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:border-[var(--bk-team-accent)]/50"><div><div className="text-base font-black">{prospect.name}</div><div className="text-[10px] font-bold text-zinc-500">{prospect.position} · {prospect.school}</div></div><div className="text-right"><div className="text-xl font-black text-[var(--bk-team-accent)]">{prospect.grade}</div><div className="text-[8px] font-black text-zinc-600">SCOUT GRADE</div></div></button>)}</div></section><aside className="space-y-3"><SeasonPanel title="YOUR DRAFT CLASS">{selected.length ? selected.map((prospect, index) => <div key={prospect.id} className="border-b border-white/5 py-2 text-sm"><b>R{index + 1}: {prospect.name}</b><div className="text-xs text-zinc-500">{prospect.position} · {prospect.school}</div></div>) : <p className="text-sm text-zinc-500">No picks yet.</p>}</SeasonPanel><SeasonPanel title="CPU PICK SIMULATION"><p className="text-sm text-zinc-400">After your selection, the other 31 CPU front offices draft by roster need and prospect grade. The board then advances automatically to your next pick.</p></SeasonPanel></aside></div>;
};
