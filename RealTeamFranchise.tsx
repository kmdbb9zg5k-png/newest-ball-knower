import React, { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Play, RotateCcw } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { FranchiseManagementPanel } from './FranchiseManagementPanel';
import {
  cpuRosterPlayers,
  createFranchiseManagement,
  franchiseRoster,
  FranchiseManagementState,
  restoreFranchiseManagement,
} from './franchiseManagementEngine';
import { buildRealTeamRoster, SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { SoloTeamPicker } from './SoloTeamPicker';
import { getSavedTeamTheme, TEAM_THEMES, teamLogoUrl } from './teamTheme';

type Props = { onBack: () => void };
type RealSave = { version: 2; teamAbbr: string; management: FranchiseManagementState };

function restoreSave(): RealSave | null {
  try {
    const raw = localStorage.getItem(SOLO_FRANCHISE_SAVE_KEYS.real);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (typeof saved?.teamAbbr !== 'string' || !TEAM_THEMES.some(team => team.abbr === saved.teamAbbr)) return null;
    if (saved.version === 2) {
      const management = restoreFranchiseManagement(saved.management, saved.teamAbbr);
      if (management) return { version: 2, teamAbbr: saved.teamAbbr, management };
    }
    if (saved.version === 1) {
      const management = createFranchiseManagement(saved.teamAbbr);
      return { version: 2, teamAbbr: saved.teamAbbr, management };
    }
    return null;
  } catch {
    return null;
  }
}

function persistReal(save: RealSave) {
  try {
    localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.real, JSON.stringify(save));
    return true;
  } catch (error) {
    console.warn('Unable to save Real Team Franchise', error);
    return false;
  }
}

export const RealTeamFranchise: React.FC<Props> = ({ onBack }) => {
  const restored = useMemo(restoreSave, []);
  const [teamAbbr, setTeamAbbr] = useState<string | null>(() => restored?.teamAbbr ?? null);
  const [selectedAbbr, setSelectedAbbr] = useState(() => restored?.teamAbbr ?? getSavedTeamTheme().abbr);
  const [management, setManagement] = useState<FranchiseManagementState | null>(() => restored?.management ?? null);
  const [view, setView] = useState<'gameday' | 'manage'>('gameday');
  const [message, setMessage] = useState('');
  const team = teamByAbbr(teamAbbr ?? selectedAbbr);
  const roster = useMemo(() => management ? franchiseRoster(management) : [], [management]);
  const opponents = useMemo(() => management ? cpuRosterPlayers(management) : undefined, [management]);

  const start = () => {
    const nextManagement = createFranchiseManagement(selectedAbbr);
    const saved = persistReal({ version: 2, teamAbbr: selectedAbbr, management: nextManagement });
    try { localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`); } catch {}
    setTeamAbbr(selectedAbbr);
    setManagement(nextManagement);
    setView('gameday');
    setMessage(saved ? 'Franchise ready. Manage your roster or play Week 1.' : 'Franchise started, but Safari could not save it. Keep this page open.');
  };

  const updateManagement = (next: FranchiseManagementState) => {
    setManagement(next);
    if (teamAbbr && !persistReal({ version: 2, teamAbbr, management: next })) setMessage('Roster move completed, but Safari could not save it. Keep this page open.');
  };

  const newCareer = () => {
    try {
      localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.real);
      localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`);
    } catch (error) {
      console.warn('Unable to clear Real Team Franchise', error);
    }
    setTeamAbbr(null);
    setManagement(null);
    setView('gameday');
    setMessage('');
  };

  if (teamAbbr && management) {
    return (
      <div className="relative min-h-[100dvh] bg-transparent text-white">
        <div className="px-4 pt-4 sm:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-3 rounded-[2rem] border border-white/10 bg-black/45 p-3 backdrop-blur-sm sm:p-4">
              <button type="button" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#111]" aria-label="Back to Solo Franchise Hub"><ArrowLeft size={18} /></button>
              <img src={teamLogoUrl(team.abbr)} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" />
              <div className="min-w-0 flex-1"><div className="text-[9px] font-black tracking-[.2em] text-[var(--bk-team-accent)]">REAL TEAM FRANCHISE</div><div className="truncate text-lg font-black">{team.name}</div></div>
              <button type="button" onClick={newCareer} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#111]" aria-label="Start a new franchise"><RotateCcw size={16} /></button>
            </div>

            {message ? <div className="mt-3 rounded-2xl border border-[var(--bk-team-accent)]/25 bg-[var(--bk-team-accent)]/10 px-4 py-3 text-sm font-bold text-[var(--bk-team-accent)]">{message}</div> : null}

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#0d1118]/90 p-2">
              <button type="button" aria-pressed={view === 'gameday'} onClick={() => setView('gameday')} className={`min-h-11 rounded-xl text-xs font-black ${view === 'gameday' ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]' : 'text-zinc-400'}`}><Play className="mr-2 inline" size={15}/> GAMEDAY</button>
              <button type="button" aria-pressed={view === 'manage'} onClick={() => setView('manage')} className={`min-h-11 rounded-xl text-xs font-black ${view === 'manage' ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]' : 'text-zinc-400'}`}><ClipboardList className="mr-2 inline" size={15}/> MANAGE TEAM</button>
            </div>
          </div>
        </div>

        {view === 'manage' ? (
          <FranchiseManagementPanel state={management} onChange={updateManagement} onMessage={setMessage} />
        ) : (
          <FranchiseSeason title="REAL TEAM FRANCHISE" userTeam={team} roster={roster} opponentRosters={opponents} saveKey={SOLO_FRANCHISE_SAVE_KEYS.real} onBack={onBack} />
        )}
      </div>
    );
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
          <p className="mt-3 text-sm font-semibold text-zinc-400">Choose one of the 32 current NFL rosters, then control the depth chart, free agency, trades, signings and the full season.</p>
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
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px] font-black text-zinc-400"><div className="rounded-xl bg-white/5 p-3">TRADES + CPU LOGIC</div><div className="rounded-xl bg-white/5 p-3">FREE AGENTS + SIGNINGS</div><div className="rounded-xl bg-white/5 p-3">DEPTH CHARTS</div><div className="rounded-xl bg-white/5 p-3">TRANSACTION LOG</div></div>
          <button type="button" onClick={start} className="mt-5 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 text-lg font-black text-[var(--bk-on-accent)]"><Play className="mr-2 inline" /> START FRANCHISE</button>
        </div>
      </div>
    </div>
  );
};

function teamByAbbr(abbr: string) {
  return TEAM_THEMES.find(team => team.abbr === abbr) ?? TEAM_THEMES[0];
}
