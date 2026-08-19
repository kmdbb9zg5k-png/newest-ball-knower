import React, { useMemo, useState } from 'react';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';
import { FranchiseSeason } from './FranchiseSeason';
import { buildRealTeamRoster, SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { SoloTeamPicker } from './SoloTeamPicker';
import { getSavedTeamTheme, TEAM_THEMES, teamLogoUrl } from './teamTheme';

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
  const team = teamByAbbr(teamAbbr ?? selectedAbbr);
  const roster = useMemo(() => teamAbbr ? buildRealTeamRoster(teamAbbr) : [], [teamAbbr]);

  const start = () => {
    try {
      localStorage.setItem(SOLO_FRANCHISE_SAVE_KEYS.real, JSON.stringify({ version: 1, teamAbbr: selectedAbbr }));
      localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`);
    } catch (error) {
      console.warn('Unable to save Real Team Franchise', error);
      setMessage('Franchise started, but Safari could not save it. Keep this page open.');
    }
    setTeamAbbr(selectedAbbr);
  };

  const newCareer = () => {
    try {
      localStorage.removeItem(SOLO_FRANCHISE_SAVE_KEYS.real);
      localStorage.removeItem(`${SOLO_FRANCHISE_SAVE_KEYS.real}:season`);
    } catch (error) {
      console.warn('Unable to clear Real Team Franchise', error);
    }
    setTeamAbbr(null);
  };

  if (teamAbbr) {
    return (
      <div className="relative">
        <button type="button" onClick={newCareer} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/90 px-4 text-xs font-black shadow-xl">
          <RotateCcw size={15} /> NEW TEAM
        </button>
        <FranchiseSeason title="REAL TEAM FRANCHISE" userTeam={team} roster={roster} saveKey={SOLO_FRANCHISE_SAVE_KEYS.real} onBack={onBack} />
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
