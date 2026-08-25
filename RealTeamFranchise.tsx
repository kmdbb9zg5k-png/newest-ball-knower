import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Check, ClipboardList, Play, RotateCcw, Users, X } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { buildRealTeamRoster, SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { SoloTeamPicker } from './SoloTeamPicker';
import { getSavedNflTeamTheme, TEAM_THEMES, teamLogoUrl } from './teamTheme';
import { PLAYERS_DATABASE } from './players';
import { Player } from './types';
import { ModeGuide } from './ModeGuide';
import { ModalPortal } from './ModalPortal';

type Props = { onBack: () => void };

function restoreTeam() {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.real);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return typeof saved?.teamAbbr === 'string' && TEAM_THEMES.some(team => team.abbr === saved.teamAbbr) ? saved.teamAbbr : null;
  } catch {
    return null;
  }
}

export const RealTeamFranchise: React.FC<Props> = ({ onBack }) => {
  const [teamAbbr, setTeamAbbr] = useState<string | null>(restoreTeam);
  const [selectedAbbr, setSelectedAbbr] = useState(() => teamAbbr ?? getSavedNflTeamTheme().abbr);
  const [message, setMessage] = useState('');
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [commandTab, setCommandTab] = useState<'week' | 'trade' | 'roster'>('week');
  const [gamePlan, setGamePlan] = useState('Balanced attack');
  const [tradeSearch, setTradeSearch] = useState('');
  const [rosterOverride, setRosterOverride] = useState<Player[] | null>(null);
  const [tradeTarget, setTradeTarget] = useState<Player | null>(null);
  const [outgoingIds, setOutgoingIds] = useState<string[]>([]);
  const [outgoingPicks, setOutgoingPicks] = useState<number[]>([]);
  const team = teamByAbbr(teamAbbr ?? selectedAbbr);
  const baseRoster = useMemo(() => teamAbbr ? buildRealTeamRoster(teamAbbr) : [], [teamAbbr]);
  const roster = rosterOverride ?? baseRoster;

  const start = () => {
    try {
      localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.real, JSON.stringify({ version: 1, teamAbbr: selectedAbbr }));
      localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`);
    } catch (error) {
      console.warn('Unable to save Real Team Franchise', error);
      setMessage('Franchise started, but Safari could not save it. Keep this page open.');
    }
    setTeamAbbr(selectedAbbr);
    setSeasonOpen(false);
    setRosterOverride(null);
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
    setRosterOverride(null);
  };

  if (teamAbbr && seasonOpen) {
    return (
      <div className="relative">
        <button type="button" onClick={newCareer} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/90 px-4 text-xs font-black shadow-xl">
          <RotateCcw size={15} /> NEW TEAM
        </button>
        <FranchiseSeason title="FRANCHISE COMMAND" userTeam={team} roster={roster} saveKey={SOLO_FRANCHISE_SAVE_KEYS.real} onBack={() => setSeasonOpen(false)} />
      </div>
    );
  }

  if (teamAbbr) {
    const tradeTargets = PLAYERS_DATABASE
      .filter(player => player.team !== team.abbr && !roster.some(item => item.id === player.id))
      .filter(player => !tradeSearch.trim() || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(tradeSearch.toLowerCase()))
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 18);
    const outgoingPlayers = roster.filter(player => outgoingIds.includes(player.id));
    const offeredValue = outgoingPlayers.reduce((sum, player) => sum + tradeValue(player), 0)
      + outgoingPicks.reduce((sum, round) => sum + PICK_VALUES[round - 1], 0);
    const requestedValue = tradeTarget ? tradeValue(tradeTarget) : 0;
    const submitOffer = () => {
      if (!tradeTarget || !outgoingPlayers.length && !outgoingPicks.length) return;
      if (tradeTarget.team === team.abbr || roster.some(player => player.id === tradeTarget.id)) {
        setMessage('That player is already on your roster and cannot be acquired in a trade.');
        setTradeTarget(null);
        setOutgoingIds([]);
        setOutgoingPicks([]);
        return;
      }
      if (offeredValue < requestedValue * .92) {
        setMessage(`${tradeTarget.team} declined. Your offer is short by ${Math.ceil(requestedValue * .92 - offeredValue)} value points.`);
        return;
      }
      const outgoingNames = outgoingPlayers.map(player => player.name);
      const pickNames = outgoingPicks.map(round => `a ${ordinal(round)}-round pick`);
      setRosterOverride([...roster.filter(player => !outgoingIds.includes(player.id)), { ...tradeTarget, team: team.abbr }]);
      setMessage(`${tradeTarget.team} accepted ${[...outgoingNames, ...pickNames].join(', ')} for ${tradeTarget.name}.`);
      setTradeTarget(null);
      setOutgoingIds([]);
      setOutgoingPicks([]);
      setCommandTab('roster');
    };
    return <div className="min-h-[100dvh] px-4 pb-24 pt-4 text-white sm:px-8"><div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft /></button><ModeGuide storageKey="bk-guide-franchise-command-v1" title="Franchise Command" summary="You control the football side of a real NFL team. Build the roster, listen to your coaches and then play the season." steps={["Pick a weekly game plan.", "Trade players and future picks to improve weak spots.", "Start the week and see whether your choices helped you win."]} /></div>
      <section className="mt-4 overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-[#0c1117] p-5 sm:p-7"><div className="flex items-center gap-4"><img src={teamLogoUrl(team.abbr)} alt="" className="h-16 w-16 object-contain"/><div><div className="text-[10px] font-black uppercase tracking-[.25em] text-emerald-300">Football operations</div><h1 className="text-3xl font-black sm:text-5xl">FRANCHISE COMMAND</h1><p className="mt-1 text-sm font-semibold text-zinc-400">{team.name} · Make the calls that shape Sunday.</p></div></div></section>
      <nav className="sticky top-0 z-20 mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/90 p-2 backdrop-blur">{([['week','THIS WEEK',ClipboardList],['trade','TRADE CENTER',ArrowRightLeft],['roster','ROSTER',Users]] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setCommandTab(id)} className={`min-h-12 rounded-xl text-[10px] font-black ${commandTab===id?'bg-emerald-300 text-black':'bg-white/[.04] text-zinc-400'}`}><Icon className="mx-auto mb-1 h-4 w-4"/>{label}</button>)}</nav>
      {message && <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div>}
      {commandTab === 'week' && <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-5 sm:p-7"><div className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">Coach meeting</div><h2 className="mt-2 text-3xl font-black">WHAT'S THE PLAN?</h2><p className="mt-2 text-sm text-zinc-400">Your coaches need one clear priority. Pick it before starting the season.</p><div className="mt-5 grid gap-2 sm:grid-cols-3">{['Attack through the air','Control the clock','Balanced attack','Bring heavy pressure','Protect against big plays','Play aggressive'].map(plan => <button key={plan} onClick={() => setGamePlan(plan)} className={`min-h-14 rounded-2xl border px-4 text-left text-sm font-black ${gamePlan===plan?'border-emerald-300 bg-emerald-300/10 text-emerald-200':'border-white/10 bg-black/20'}`}>{plan}</button>)}</div><div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm"><span className="font-black text-emerald-300">LOCKED PLAN:</span> {gamePlan}</div><button onClick={() => setSeasonOpen(true)} className="mt-4 min-h-14 w-full rounded-2xl bg-emerald-300 font-black text-black"><Play className="mr-2 inline h-5 w-5"/>START SEASON</button></section>}
      {commandTab === 'trade' && <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-4 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">All 32 teams</div><h2 className="mt-2 text-3xl font-black">TRADE CENTER</h2><p className="mt-2 text-sm text-zinc-400">Choose a target, then build the offer yourself with your players and draft picks.</p><input aria-label="Search trade targets" value={tradeSearch} onChange={event => setTradeSearch(event.target.value)} placeholder="Search player, team or position" className="mt-4 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none"/><div className="mt-3 divide-y divide-white/5">{tradeTargets.map(player => <div key={player.id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{player.name}</div><div className="text-[10px] font-bold text-zinc-500">{player.team} · {player.position} · {player.ovr} OVR · ${player.salary}M{player.salaryType==='estimated'?' est.':''}</div></div><button aria-label={`Build offer for ${player.name}`} onClick={() => { setTradeTarget(player); setOutgoingIds([]); setOutgoingPicks([]); setMessage(''); }} className="min-h-11 shrink-0 rounded-xl border border-emerald-300/30 px-3 text-[10px] font-black text-emerald-300">BUILD OFFER</button></div>)}</div></section>}
      {commandTab === 'roster' && <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-4 sm:p-6"><h2 className="text-3xl font-black">YOUR ROSTER</h2><p className="mt-1 text-sm text-zinc-500">{roster.length} players · strongest ratings first</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{roster.slice().sort((a,b)=>b.ovr-a.ovr).map(player => <div key={player.id} className="flex items-center justify-between rounded-xl bg-black/25 p-3"><div><div className="text-sm font-black">{player.name}</div><div className="text-[10px] text-zinc-500">{player.position} · ${player.salary}M{player.salaryType==='estimated'?' estimated':''}</div></div><div className="text-lg font-black text-emerald-300">{player.ovr}</div></div>)}</div></section>}
      {tradeTarget && <ModalPortal><div className="fixed inset-0 z-[9999] flex items-end bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5" role="dialog" aria-modal="true" aria-label="Build trade offer"><div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#0d1219] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-3xl sm:rounded-[2rem] sm:p-7"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black tracking-[.22em] text-emerald-300">YOU CONTROL EVERY ASSET</div><h2 className="mt-1 text-3xl font-black">BUILD THE OFFER</h2></div><button onClick={() => setTradeTarget(null)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10" aria-label="Close trade builder"><X /></button></div><div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4"><div className="text-[9px] font-black text-zinc-500">YOU RECEIVE</div><div className="mt-1 font-black">{tradeTarget.name} <span className="text-emerald-300">{tradeTarget.ovr} OVR</span></div><div className="text-xs text-zinc-500">{tradeTarget.team} · {tradeTarget.position} · Value {requestedValue}</div></div><h3 className="mt-5 text-sm font-black">YOUR PLAYERS</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{roster.slice().sort((a,b) => b.ovr-a.ovr).map(player => { const selected = outgoingIds.includes(player.id); return <button key={player.id} onClick={() => setOutgoingIds(ids => selected ? ids.filter(id => id !== player.id) : [...ids, player.id])} className={`flex min-h-14 items-center justify-between rounded-xl border px-3 text-left ${selected?'border-emerald-300 bg-emerald-300/10':'border-white/10 bg-black/20'}`}><div><div className="text-xs font-black">{player.name}</div><div className="text-[9px] text-zinc-500">{player.position} · {player.ovr} OVR · Value {tradeValue(player)}</div></div>{selected && <Check className="h-4 w-4 text-emerald-300"/>}</button>})}</div><h3 className="mt-5 text-sm font-black">FUTURE DRAFT PICKS</h3><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{[1,2,3,4].map(round => { const selected = outgoingPicks.includes(round); return <button key={round} onClick={() => setOutgoingPicks(picks => selected ? picks.filter(pick => pick !== round) : [...picks, round])} className={`min-h-14 rounded-xl border text-xs font-black ${selected?'border-emerald-300 bg-emerald-300/10 text-emerald-200':'border-white/10 bg-black/20'}`}>{ordinal(round).toUpperCase()} ROUND<div className="text-[9px] text-zinc-500">{PICK_VALUES[round-1]} value</div></button>})}</div><div className="mt-5 flex items-center justify-between rounded-2xl bg-black/30 p-4"><div><div className="text-[9px] font-black text-zinc-500">OFFER VALUE</div><div className={`text-2xl font-black ${offeredValue >= requestedValue*.92?'text-emerald-300':'text-amber-300'}`}>{offeredValue} / {Math.ceil(requestedValue*.92)}</div></div><button onClick={submitOffer} disabled={!outgoingIds.length&&!outgoingPicks.length} className="min-h-12 rounded-xl bg-emerald-300 px-5 text-xs font-black text-black disabled:opacity-30">PROPOSE TRADE</button></div></div></div></ModalPortal>}
    </div></div>;
  }

  const selectedTeam = teamByAbbr(selectedAbbr);
  const previewRoster = buildRealTeamRoster(selectedAbbr);
  const topPlayers = previewRoster.slice().sort((first, second) => second.ovr - first.ovr).slice(0, 3);

  return (
    <div className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft size={19} /></button>
        <div className="mt-5 rounded-[2rem] border border-white/10 bg-[#10151d] p-5 sm:p-8">
          <div className="text-[10px] font-black tracking-[.25em] text-[var(--bk-team-accent)]">2026 NFL ROSTERS</div>
          <h2 className="mt-2 text-4xl font-black leading-none">TAKE OVER A TEAM</h2>
          <p className="mt-3 text-sm font-semibold text-zinc-400">Choose one of the 32 current NFL rosters and start your franchise immediately.</p>
          <div className="mt-6"><SoloTeamPicker selectedAbbr={selectedAbbr} onSelect={setSelectedAbbr} /></div>
        </div>

        <div className="mt-4 rounded-[2rem] border border-white/10 bg-[#111] p-5">
          {message ? <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">{message}</div> : null}
          <div className="flex items-center gap-4">
            <img src={teamLogoUrl(selectedTeam.abbr)} alt="" aria-hidden="true" className="h-16 w-16 object-contain" />
            <div><div className="text-2xl font-black">{selectedTeam.name}</div><div className="text-xs font-bold text-zinc-500">CURRENT 2026 LINEUP</div></div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {topPlayers.map(player => <div key={player.id} className="min-w-0 rounded-2xl bg-white/5 p-3"><div className="truncate text-xs font-black">{player.name}</div><div className="mt-1 text-[10px] text-zinc-500">{player.position} • {player.ovr} OVR</div></div>)}
          </div>
          <button type="button" onClick={start} className="mt-5 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"><Play className="mr-2 inline" /> START FRANCHISE</button>
        </div>
      </div>
    </div>
  );
};

function teamByAbbr(abbr: string) {
  return TEAM_THEMES.find(team => team.abbr === abbr) ?? TEAM_THEMES[0];
}

const PICK_VALUES = [38, 22, 12, 7];
const tradeValue = (player: Player) => Math.max(4, Math.round((player.ovr - 62) * 2.25 - player.salary * .2));
const ordinal = (round: number) => `${round}${round === 1 ? 'st' : round === 2 ? 'nd' : round === 3 ? 'rd' : 'th'}`;
