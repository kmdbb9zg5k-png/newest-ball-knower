import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Check, ClipboardList, Play, RotateCcw, Users, X } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { ModeGuide } from './ModeGuide';
import { PLAYERS_DATABASE } from './players';
import { buildRealTeamRoster, SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { SoloTeamPicker } from './SoloTeamPicker';
import { getSavedTeamTheme, getTeamCssVariables, TEAM_THEMES, teamLogoUrl } from './teamTheme';
import { Player } from './types';

type Props = { onBack: () => void };
type FranchiseMove = { playerId: string; toTeam: string };
type FranchiseSave = { version: 2; teamAbbr: string; moves: FranchiseMove[]; rookies: Player[]; tradedPickRounds: number[] };
type TradeTarget = { player: Player; ownerTeam: string };

const ALL_DRAFT_ROUNDS = [1, 2, 3, 4, 5, 6, 7] as const;
const PICK_VALUES = [38, 22, 12, 7, 4, 3, 2];

function validTeamAbbr(value: unknown): value is string {
  return typeof value === 'string' && TEAM_THEMES.some(team => team.abbr === value);
}

function validPersistedPlayer(value: unknown): value is Player {
  if (!value || typeof value !== 'object') return false;
  const player = value as Partial<Player>;
  return typeof player.id === 'string'
    && typeof player.name === 'string'
    && validTeamAbbr(player.team)
    && typeof player.position === 'string'
    && Number.isFinite(Number(player.ovr))
    && Number.isFinite(Number(player.salary));
}

function restoreSave(): FranchiseSave | null {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.real);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!validTeamAbbr(saved?.teamAbbr)) return null;
    if (saved.version === 1) return { version: 2, teamAbbr: saved.teamAbbr, moves: [], rookies: [], tradedPickRounds: [] };
    if (saved.version !== 2) return null;

    const moves: FranchiseMove[] = Array.isArray(saved.moves)
      ? saved.moves.filter((move: unknown): move is FranchiseMove => {
          if (!move || typeof move !== 'object') return false;
          const item = move as Partial<FranchiseMove>;
          return typeof item.playerId === 'string' && validTeamAbbr(item.toTeam);
        })
      : [];
    const rookies: Player[] = Array.isArray(saved.rookies) ? saved.rookies.filter(validPersistedPlayer) : [];
    const parsedRounds = Array.isArray(saved.tradedPickRounds)
      ? saved.tradedPickRounds
          .map((round: unknown) => Number(round))
          .filter((round: number) => Number.isInteger(round) && ALL_DRAFT_ROUNDS.includes(round as typeof ALL_DRAFT_ROUNDS[number]))
      : [];
    const tradedPickRounds: number[] = Array.from(new Set<number>(parsedRounds));
    return { version: 2, teamAbbr: saved.teamAbbr, moves, rookies, tradedPickRounds };
  } catch {
    return null;
  }
}

function persistSave(save: FranchiseSave) {
  try {
    localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.real, JSON.stringify(save));
    return true;
  } catch (error) {
    console.warn('Unable to save Real Team Franchise', error);
    return false;
  }
}

function teamByAbbr(abbr: string) {
  return TEAM_THEMES.find(team => team.abbr === abbr) ?? TEAM_THEMES[0];
}

function buildManagedRosters(moves: FranchiseMove[], rookies: Player[]) {
  const rosters: Record<string, Player[]> = Object.fromEntries(TEAM_THEMES.map(team => [team.abbr, buildRealTeamRoster(team.abbr).map(player => ({ ...player }))]));
  for (const rookie of rookies) {
    if (rosters[rookie.team] && !rosters[rookie.team].some(player => player.id === rookie.id)) rosters[rookie.team].push({ ...rookie });
  }
  for (const move of moves) {
    const current = Object.values(rosters).flat().find(player => player.id === move.playerId)
      ?? PLAYERS_DATABASE.find(player => player.id === move.playerId)
      ?? rookies.find(player => player.id === move.playerId);
    if (!current || !rosters[move.toTeam]) continue;
    for (const abbr of Object.keys(rosters)) rosters[abbr] = rosters[abbr].filter(player => player.id !== move.playerId);
    const destination = teamByAbbr(move.toTeam);
    const words = destination.name.split(' ');
    rosters[move.toTeam].push({
      ...current,
      team: move.toTeam,
      teamId: move.toTeam,
      teamAbbreviation: move.toTeam,
      teamCity: words.slice(0, -1).join(' ') || destination.name,
      teamName: destination.name,
      isFreeAgent: false,
    });
  }
  return rosters;
}

const tradeValue = (player: Player) => Math.max(4, Math.round((player.ovr - 62) * 2.25 - player.salary * 0.2));
const ordinal = (round: number) => `${round}${round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'}`;

export const RealTeamFranchise: React.FC<Props> = ({ onBack }) => {
  const restored = useMemo(restoreSave, []);
  const savedTheme = useMemo(getSavedTeamTheme, []);
  const defaultTeamAbbr = TEAM_THEMES.some(team => team.abbr === savedTheme.abbr) ? savedTheme.abbr : TEAM_THEMES[0].abbr;
  const [teamAbbr, setTeamAbbr] = useState<string | null>(() => restored?.teamAbbr ?? null);
  const [selectedAbbr, setSelectedAbbr] = useState(() => restored?.teamAbbr ?? defaultTeamAbbr);
  const [message, setMessage] = useState('');
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [commandTab, setCommandTab] = useState<'week' | 'trade' | 'roster'>('week');
  const [gamePlan, setGamePlan] = useState('Balanced attack');
  const [tradeSearch, setTradeSearch] = useState('');
  const [moves, setMoves] = useState<FranchiseMove[]>(() => restored?.moves ?? []);
  const [rookies, setRookies] = useState<Player[]>(() => restored?.rookies ?? []);
  const [tradedPickRounds, setTradedPickRounds] = useState<number[]>(() => restored?.tradedPickRounds ?? []);
  const [tradeTarget, setTradeTarget] = useState<TradeTarget | null>(null);
  const [outgoingIds, setOutgoingIds] = useState<string[]>([]);
  const [outgoingPicks, setOutgoingPicks] = useState<number[]>([]);

  const team = teamByAbbr(teamAbbr ?? selectedAbbr);
  const managedRosters = useMemo(() => buildManagedRosters(moves, rookies), [moves, rookies]);
  const roster = teamAbbr ? managedRosters[teamAbbr] ?? [] : [];
  const ownedDraftRounds = ALL_DRAFT_ROUNDS.filter(round => !tradedPickRounds.includes(round));
  const themeStyle = useMemo(() => ({
    ...getTeamCssVariables(team),
    backgroundImage: 'radial-gradient(circle at 16% 0%, rgb(var(--bk-team-primary-rgb) / .24), transparent 34%), radial-gradient(circle at 88% 12%, rgb(var(--bk-team-secondary-rgb) / .14), transparent 30%), linear-gradient(180deg, #080b10 0%, #0a0d12 45%, #050608 100%)',
  }) as React.CSSProperties, [team]);

  const saveCurrent = (next: Partial<Pick<FranchiseSave, 'moves' | 'rookies' | 'tradedPickRounds'>> = {}) => {
    if (!teamAbbr) return true;
    return persistSave({ version: 2, teamAbbr, moves: next.moves ?? moves, rookies: next.rookies ?? rookies, tradedPickRounds: next.tradedPickRounds ?? tradedPickRounds });
  };

  const start = () => {
    const save: FranchiseSave = { version: 2, teamAbbr: selectedAbbr, moves: [], rookies: [], tradedPickRounds: [] };
    const saved = persistSave(save);
    try { localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`); } catch (error) { console.warn('Unable to clear prior franchise season', error); }
    setTeamAbbr(selectedAbbr);
    setMoves([]);
    setRookies([]);
    setTradedPickRounds([]);
    setSeasonOpen(false);
    setCommandTab('week');
    setMessage(saved ? 'Franchise ready. You control every roster move and draft pick.' : 'Franchise started, but Safari could not save it. Keep this page open.');
  };

  const newCareer = () => {
    try {
      localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.real);
      localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`);
    } catch (error) {
      console.warn('Unable to clear Real Team Franchise', error);
    }
    setTeamAbbr(null);
    setSeasonOpen(false);
    setMoves([]);
    setRookies([]);
    setTradedPickRounds([]);
    setTradeTarget(null);
    setOutgoingIds([]);
    setOutgoingPicks([]);
    setMessage('');
  };

  const addDraftedRookie = (player: Player) => {
    setRookies(previous => {
      if (previous.some(existing => existing.id === player.id)) return previous;
      const next = [...previous, player];
      if (!saveCurrent({ rookies: next })) setMessage('Draft pick added, but Safari could not save the roster. Keep this page open.');
      return next;
    });
  };

  if (teamAbbr && seasonOpen) {
    return <div className="relative min-h-[100dvh]" style={themeStyle}>
      <button type="button" onClick={newCareer} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/90 px-4 text-xs font-black shadow-xl"><RotateCcw size={15} /> NEW TEAM</button>
      <FranchiseSeason title="FRANCHISE COMMAND" userTeam={team} roster={roster} opponentRosters={managedRosters} saveKey={SOLO_FRANCHISE_SAVE_KEYS.real} ownedDraftRounds={ownedDraftRounds} onDraftProspect={addDraftedRookie} onBack={() => setSeasonOpen(false)} />
    </div>;
  }

  if (teamAbbr) {
    const tradeTargets = Object.entries(managedRosters)
      .filter(([ownerTeam]) => ownerTeam !== teamAbbr)
      .flatMap(([ownerTeam, players]) => players.map(player => ({ player, ownerTeam })))
      .filter(({ player }) => !tradeSearch.trim() || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(tradeSearch.toLowerCase()))
      .sort((first, second) => second.player.ovr - first.player.ovr || first.player.name.localeCompare(second.player.name))
      .slice(0, 24);
    const outgoingPlayers = roster.filter(player => outgoingIds.includes(player.id));
    const offeredValue = outgoingPlayers.reduce((sum, player) => sum + tradeValue(player), 0) + outgoingPicks.reduce((sum, round) => sum + PICK_VALUES[round - 1], 0);
    const requestedValue = tradeTarget ? tradeValue(tradeTarget.player) : 0;

    const submitOffer = () => {
      if (!tradeTarget || (!outgoingPlayers.length && !outgoingPicks.length)) return;
      if (offeredValue < requestedValue * 0.92) {
        setMessage(`${teamByAbbr(tradeTarget.ownerTeam).name} declined. Your offer is short by ${Math.ceil(requestedValue * 0.92 - offeredValue)} value points.`);
        return;
      }
      const nextMoves: FranchiseMove[] = [...moves, ...outgoingPlayers.map(player => ({ playerId: player.id, toTeam: tradeTarget.ownerTeam })), { playerId: tradeTarget.player.id, toTeam: teamAbbr }];
      const nextTradedPickRounds = Array.from(new Set<number>([...tradedPickRounds, ...outgoingPicks])).sort((a, b) => a - b);
      const outgoingNames = outgoingPlayers.map(player => player.name);
      const pickNames = outgoingPicks.map(round => `a ${ordinal(round)}-round pick`);
      setMoves(nextMoves);
      setTradedPickRounds(nextTradedPickRounds);
      setMessage(saveCurrent({ moves: nextMoves, tradedPickRounds: nextTradedPickRounds })
        ? `${teamByAbbr(tradeTarget.ownerTeam).name} accepted ${[...outgoingNames, ...pickNames].join(', ')} for ${tradeTarget.player.name}.`
        : 'Trade accepted, but Safari could not save it. Keep this page open.');
      setTradeTarget(null);
      setOutgoingIds([]);
      setOutgoingPicks([]);
      setCommandTab('roster');
    };

    return <div className="min-h-[100dvh] px-4 pb-24 pt-4 text-white sm:px-8" style={themeStyle}><div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]/90" aria-label="Back"><ArrowLeft /></button><ModeGuide storageKey="bk-guide-franchise-command-v1" title="Franchise Command" summary="You control the football side of a real NFL team. Build the roster, listen to your coaches and then play the season." steps={["Pick a weekly game plan.", "Trade players and future picks to improve weak spots.", "Start the week and see whether your choices helped you win."]} /></div>
      <section className="relative mt-4 overflow-hidden rounded-[2rem] border border-[var(--bk-team-accent)]/25 bg-[#0c1117]/90 p-5 shadow-2xl backdrop-blur sm:p-7"><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgb(var(--bk-team-primary-rgb)/.22),transparent_38%),radial-gradient(circle_at_92%_30%,rgb(var(--bk-team-secondary-rgb)/.12),transparent_34%)]" /><div className="relative flex items-center gap-4"><img src={teamLogoUrl(team.abbr)} alt="" className="h-16 w-16 object-contain drop-shadow-2xl" /><div><div className="text-[10px] font-black uppercase tracking-[.25em] text-[var(--bk-team-accent)]">Football operations</div><h1 className="text-3xl font-black sm:text-5xl">FRANCHISE COMMAND</h1><p className="mt-1 text-sm font-semibold text-zinc-400">{team.name} · Make the calls that shape Sunday.</p></div></div></section>
      <nav className="sticky top-0 z-20 mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/90 p-2 backdrop-blur">{([['week', 'THIS WEEK', ClipboardList], ['trade', 'TRADE CENTER', ArrowRightLeft], ['roster', 'ROSTER', Users]] as const).map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setCommandTab(id)} className={`min-h-12 rounded-xl text-[10px] font-black ${commandTab === id ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]' : 'bg-white/[.04] text-zinc-400'}`}><Icon className="mx-auto mb-1 h-4 w-4" />{label}</button>)}</nav>
      {message ? <div className="mt-3 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 p-4 text-sm font-bold text-[var(--bk-team-accent)]">{message}</div> : null}

      {commandTab === 'week' ? <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-5 backdrop-blur sm:p-7"><div className="text-[10px] font-black uppercase tracking-[.22em] text-[var(--bk-team-accent)]">Coach meeting</div><h2 className="mt-2 text-3xl font-black">WHAT'S THE PLAN?</h2><p className="mt-2 text-sm text-zinc-400">Your coaches need one clear priority. Pick it before starting the season.</p><div className="mt-5 grid gap-2 sm:grid-cols-3">{['Attack through the air', 'Control the clock', 'Balanced attack', 'Bring heavy pressure', 'Protect against big plays', 'Play aggressive'].map(plan => <button key={plan} type="button" onClick={() => setGamePlan(plan)} className={`min-h-14 rounded-2xl border px-4 text-left text-sm font-black ${gamePlan === plan ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]' : 'border-white/10 bg-black/20'}`}>{plan}</button>)}</div><div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm"><span className="font-black text-[var(--bk-team-accent)]">LOCKED PLAN:</span> {gamePlan}</div><button type="button" onClick={() => setSeasonOpen(true)} className="mt-4 min-h-14 w-full rounded-2xl bg-[var(--bk-team-accent)] font-black text-[var(--bk-on-accent)]"><Play className="mr-2 inline h-5 w-5" />START SEASON</button></section> : null}

      {commandTab === 'trade' ? <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-4 backdrop-blur sm:p-6"><div className="text-[10px] font-black uppercase tracking-[.22em] text-[var(--bk-team-accent)]">Live 32-team ownership</div><h2 className="mt-2 text-3xl font-black">TRADE CENTER</h2><p className="mt-2 text-sm text-zinc-400">Choose a target, then build the offer yourself. Accepted players move to their new teams and traded picks stay gone.</p><input value={tradeSearch} onChange={event => setTradeSearch(event.target.value)} placeholder="Search player, team or position" className="mt-4 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none focus:border-[var(--bk-team-accent)]" /><div className="mt-3 divide-y divide-white/5">{tradeTargets.map(({ player, ownerTeam }) => <div key={player.id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{player.name}</div><div className="text-[10px] font-bold text-zinc-500">{ownerTeam} · {player.position} · {player.ovr} OVR · ${player.salary}M</div></div><button type="button" onClick={() => { setTradeTarget({ player, ownerTeam }); setOutgoingIds([]); setOutgoingPicks([]); setMessage(''); }} className="min-h-11 shrink-0 rounded-xl border border-[var(--bk-team-accent)]/30 px-3 text-[10px] font-black text-[var(--bk-team-accent)]">BUILD OFFER</button></div>)}</div></section> : null}

      {commandTab === 'roster' ? <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-4 backdrop-blur sm:p-6"><h2 className="text-3xl font-black">YOUR ROSTER</h2><p className="mt-1 text-sm text-zinc-500">{roster.length} players · trades and rookies persist on this device</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{roster.slice().sort((a, b) => b.ovr - a.ovr).map(player => <div key={player.id} className="flex items-center justify-between rounded-xl bg-black/25 p-3"><div><div className="text-sm font-black">{player.name}</div><div className="text-[10px] text-zinc-500">{player.position} · ${player.salary}M</div></div><div className="text-lg font-black text-[var(--bk-team-accent)]">{player.ovr}</div></div>)}</div><div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-zinc-400"><b className="text-[var(--bk-team-accent)]">DRAFT CAPITAL:</b> {ownedDraftRounds.length ? ownedDraftRounds.map(round => `${ordinal(round)} round`).join(' · ') : 'No picks remaining'}</div></section> : null}

      {tradeTarget ? <div className="fixed inset-0 z-50 flex items-end bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-label="Build trade offer"><div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0d1219] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-3xl sm:rounded-[2rem] sm:p-7"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black tracking-[.22em] text-[var(--bk-team-accent)]">YOU CONTROL EVERY ASSET</div><h2 className="mt-1 text-3xl font-black">BUILD THE OFFER</h2></div><button type="button" onClick={() => setTradeTarget(null)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10" aria-label="Close trade builder"><X /></button></div><div className="mt-4 rounded-2xl border border-[var(--bk-team-accent)]/20 bg-[var(--bk-team-accent)]/5 p-4"><div className="text-[9px] font-black text-zinc-500">YOU RECEIVE</div><div className="mt-1 font-black">{tradeTarget.player.name} <span className="text-[var(--bk-team-accent)]">{tradeTarget.player.ovr} OVR</span></div><div className="text-xs text-zinc-500">{tradeTarget.ownerTeam} · {tradeTarget.player.position} · Value {requestedValue}</div></div><h3 className="mt-5 text-sm font-black">YOUR PLAYERS</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{roster.slice().sort((a, b) => b.ovr - a.ovr).map(player => { const selected = outgoingIds.includes(player.id); return <button key={player.id} type="button" onClick={() => setOutgoingIds(ids => selected ? ids.filter(id => id !== player.id) : [...ids, player.id])} className={`flex min-h-14 items-center justify-between rounded-xl border px-3 text-left ${selected ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10' : 'border-white/10 bg-black/20'}`}><div><div className="text-xs font-black">{player.name}</div><div className="text-[9px] text-zinc-500">{player.position} · {player.ovr} OVR · Value {tradeValue(player)}</div></div>{selected ? <Check className="h-4 w-4 text-[var(--bk-team-accent)]" /> : null}</button>; })}</div><h3 className="mt-5 text-sm font-black">FUTURE DRAFT PICKS</h3><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{ALL_DRAFT_ROUNDS.map(round => { const alreadyTraded = tradedPickRounds.includes(round); const selected = outgoingPicks.includes(round); return <button key={round} type="button" disabled={alreadyTraded} onClick={() => setOutgoingPicks(picks => selected ? picks.filter(pick => pick !== round) : [...picks, round])} className={`min-h-14 rounded-xl border text-xs font-black disabled:cursor-not-allowed disabled:opacity-30 ${selected ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]' : 'border-white/10 bg-black/20'}`}>{ordinal(round).toUpperCase()} ROUND<div className="text-[9px] text-zinc-500">{alreadyTraded ? 'TRADED' : `${PICK_VALUES[round - 1]} value`}</div></button>; })}</div><div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-black/30 p-4"><div><div className="text-[9px] font-black text-zinc-500">OFFER VALUE</div><div className={`text-2xl font-black ${offeredValue >= requestedValue * 0.92 ? 'text-[var(--bk-team-accent)]' : 'text-amber-300'}`}>{offeredValue} / {Math.ceil(requestedValue * 0.92)}</div></div><button type="button" onClick={submitOffer} disabled={!outgoingIds.length && !outgoingPicks.length} className="min-h-12 rounded-xl bg-[var(--bk-team-accent)] px-5 text-xs font-black text-[var(--bk-on-accent)] disabled:opacity-30">PROPOSE TRADE</button></div></div></div> : null}
    </div></div>;
  }

  const selectedTeam = teamByAbbr(selectedAbbr);
  const previewRoster = buildRealTeamRoster(selectedAbbr);
  const topPlayers = previewRoster.slice().sort((first, second) => second.ovr - first.ovr).slice(0, 3);
  const selectionStyle = { ...getTeamCssVariables(selectedTeam), backgroundImage: 'radial-gradient(circle at 18% 0%, rgb(var(--bk-team-primary-rgb) / .2), transparent 34%), radial-gradient(circle at 90% 12%, rgb(var(--bk-team-secondary-rgb) / .12), transparent 30%), linear-gradient(180deg, #080b10, #050608)' } as React.CSSProperties;
  return <div className="min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8" style={selectionStyle}><div className="mx-auto max-w-5xl"><button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft size={19} /></button><div className="mt-5 rounded-[2rem] border border-white/10 bg-[#10151d]/90 p-5 backdrop-blur sm:p-8"><div className="text-[10px] font-black tracking-[.25em] text-[var(--bk-team-accent)]">2026 NFL ROSTERS</div><h2 className="mt-2 text-4xl font-black leading-none">TAKE OVER A TEAM</h2><p className="mt-3 text-sm font-semibold text-zinc-400">Choose one of the 32 current NFL rosters, then control trades, draft capital and the full season.</p><div className="mt-6"><SoloTeamPicker selectedAbbr={selectedAbbr} onSelect={setSelectedAbbr} /></div></div><div className="mt-4 rounded-[2rem] border border-[var(--bk-team-accent)]/20 bg-[#111]/90 p-5 backdrop-blur">{message ? <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">{message}</div> : null}<div className="flex items-center gap-4"><img src={teamLogoUrl(selectedTeam.abbr)} alt="" aria-hidden="true" className="h-16 w-16 object-contain" /><div><div className="text-2xl font-black">{selectedTeam.name}</div><div className="text-xs font-bold text-zinc-500">CURRENT 2026 LINEUP</div></div></div><div className="mt-4 grid grid-cols-3 gap-2">{topPlayers.map(player => <div key={player.id} className="min-w-0 rounded-2xl bg-white/5 p-3"><div className="truncate text-xs font-black">{player.name}</div><div className="mt-1 text-[10px] text-zinc-500">{player.position} • {player.ovr} OVR</div></div>)}</div><div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px] font-black text-zinc-400"><div className="rounded-xl bg-white/5 p-3">MANUAL TRADES</div><div className="rounded-xl bg-white/5 p-3">7-ROUND DRAFT</div><div className="rounded-xl bg-white/5 p-3">PERSISTENT ROSTERS</div><div className="rounded-xl bg-white/5 p-3">LIVE DRAFT CAPITAL</div></div><button type="button" onClick={start} className="mt-5 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"><Play className="mr-2 inline" /> START FRANCHISE</button></div></div></div>;
};