import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, ClipboardList, Play, RotateCcw, Users } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { buildRealTeamRoster, SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { SoloTeamPicker } from './SoloTeamPicker';
import { getSavedTeamTheme, TEAM_THEMES, teamLogoUrl } from './teamTheme';
import { PLAYERS_DATABASE } from './players';
import { Player } from './types';
import { ModeGuide } from './ModeGuide';

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
  const [selectedAbbr, setSelectedAbbr] = useState(() => teamAbbr ?? getSavedTeamTheme().abbr);
  const [message, setMessage] = useState('');
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [commandTab, setCommandTab] = useState<'week' | 'trade' | 'roster'>('week');
  const [gamePlan, setGamePlan] = useState('Balanced attack');
  const [tradeSearch, setTradeSearch] = useState('');
  const [rosterOverride, setRosterOverride] = useState<Player[] | null>(null);
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
      .filter(player => player.team !== teamAbbr && !roster.some(item => item.id === player.id))
      .filter(player => !tradeSearch.trim() || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(tradeSearch.toLowerCase()))
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 18);
    const makeOffer = (target: Player) => {
      const samePosition = roster.filter(player => player.position === target.position).sort((a, b) => a.ovr - b.ovr);
      const outgoing = samePosition[0] ?? roster.slice().sort((a, b) => a.ovr - b.ovr)[0];
      if (!outgoing) return;
      const gap = target.ovr - outgoing.ovr;
      const pickCost = gap >= 8 ? 'a 1st and 3rd' : gap >= 4 ? 'a 2nd' : 'a future 4th';
      setRosterOverride(roster.map(player => player.id === outgoing.id ? { ...target, team: teamAbbr } : player));
      setMessage(`${target.team} accepted ${outgoing.name} plus ${pickCost}. ${target.name} joins your roster.`);
      setCommandTab('roster');
    };
    return <div className="min-h-[100dvh] px-4 pb-24 pt-4 text-white sm:px-8"><div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-[#111]" aria-label="Back"><ArrowLeft /></button><ModeGuide storageKey="bk-guide-franchise-command-v1" title="Franchise Command" summary="You control the football side of a real NFL team. Build the roster, listen to your coaches and then play the season." steps={["Pick a weekly game plan.", "Trade players and future picks to improve weak spots.", "Start the week and see whether your choices helped you win."]} /></div>
      <section className="mt-4 overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-[#0c1117] p-5 sm:p-7"><div className="flex items-center gap-4"><img src={teamLogoUrl(team.abbr)} alt="" className="h-16 w-16 object-contain"/><div><div className="text-[10px] font-black uppercase tracking-[.25em] text-emerald-300">Football operations</div><h1 className="text-3xl font-black sm:text-5xl">FRANCHISE COMMAND</h1><p className="mt-1 text-sm font-semibold text-zinc-400">{team.name} · Make the calls that shape Sunday.</p></div></div></section>
      <nav className="sticky top-0 z-20 mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/90 p-2 backdrop-blur">{([['week','THIS WEEK',ClipboardList],['trade','TRADE CENTER',ArrowRightLeft],['roster','ROSTER',Users]] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setCommandTab(id)} className={`min-h-12 rounded-xl text-[10px] font-black ${commandTab===id?'bg-emerald-300 text-black':'bg-white/[.04] text-zinc-400'}`}><Icon className="mx-auto mb-1 h-4 w-4"/>{label}</button>)}</nav>
      {message && <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">{message}</div>}
      {commandTab === 'week' && <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-5 sm:p-7"><div className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">Coach meeting</div><h2 className="mt-2 text-3xl font-black">WHAT'S THE PLAN?</h2><p className="mt-2 text-sm text-zinc-400">Your coaches need one clear priority. Pick it before starting the season.</p><div className="mt-5 grid gap-2 sm:grid-cols-3">{['Attack through the air','Control the clock','Balanced attack','Bring heavy pressure','Protect against big plays','Play aggressive'].map(plan => <button key={plan} onClick={() => setGamePlan(plan)} className={`min-h-14 rounded-2xl border px-4 text-left text-sm font-black ${gamePlan===plan?'border-emerald-300 bg-emerald-300/10 text-emerald-200':'border-white/10 bg-black/20'}`}>{plan}</button>)}</div><div className="mt-5 rounded-2xl bg-black/30 p-4 text-sm"><span className="font-black text-emerald-300">LOCKED PLAN:</span> {gamePlan}</div><button onClick={() => setSeasonOpen(true)} className="mt-4 min-h-14 w-full rounded-2xl bg-emerald-300 font-black text-black"><Play className="mr-2 inline h-5 w-5"/>START SEASON</button></section>}
      {commandTab === 'trade' && <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-4 sm:p-6"><div className="text-[10px] font-black uppercase tracking-[.22em] text-emerald-300">All 32 teams</div><h2 className="mt-2 text-3xl font-black">TRADE CENTER</h2><p className="mt-2 text-sm text-zinc-400">Search any player. Better players cost your player plus stronger future picks.</p><input value={tradeSearch} onChange={event => setTradeSearch(event.target.value)} placeholder="Search player, team or position" className="mt-4 min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none"/><div className="mt-3 divide-y divide-white/5">{tradeTargets.map(player => <div key={player.id} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{player.name}</div><div className="text-[10px] font-bold text-zinc-500">{player.team} · {player.position} · {player.ovr} OVR · ${player.salary}M</div></div><button onClick={() => makeOffer(player)} className="min-h-11 shrink-0 rounded-xl border border-emerald-300/30 px-3 text-[10px] font-black text-emerald-300">BUILD OFFER</button></div>)}</div></section>}
      {commandTab === 'roster' && <section className="mt-3 rounded-[2rem] border border-white/10 bg-[#10151d] p-4 sm:p-6"><h2 className="text-3xl font-black">YOUR ROSTER</h2><p className="mt-1 text-sm text-zinc-500">{roster.length} players · strongest ratings first</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{roster.slice().sort((a,b)=>b.ovr-a.ovr).map(player => <div key={player.id} className="flex items-center justify-between rounded-xl bg-black/25 p-3"><div><div className="text-sm font-black">{player.name}</div><div className="text-[10px] text-zinc-500">{player.position} · ${player.salary}M</div></div><div className="text-lg font-black text-emerald-300">{player.ovr}</div></div>)}</div></section>}
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
