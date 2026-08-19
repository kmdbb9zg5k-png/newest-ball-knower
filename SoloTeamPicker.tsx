import React from 'react';
import { TEAM_THEMES, teamLogoUrl } from './teamTheme';

type Props = {
  selectedAbbr: string;
  onSelect: (abbr: string) => void;
};

export const SoloTeamPicker: React.FC<Props> = ({ selectedAbbr, onSelect }) => (
  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="group" aria-label="Choose an NFL team">
    {TEAM_THEMES.map(team => {
      const selected = team.abbr === selectedAbbr;
      return (
        <button
          key={team.abbr}
          type="button"
          onClick={() => onSelect(team.abbr)}
          aria-pressed={selected}
          aria-label={team.name}
          className={`min-h-20 rounded-2xl border p-2 transition ${selected ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/15' : 'border-white/10 bg-[#111] active:bg-white/10'}`}
        >
          <img src={teamLogoUrl(team.abbr)} alt="" aria-hidden="true" className="mx-auto h-10 w-10 object-contain" />
          <div className={`mt-1 text-[10px] font-black ${selected ? 'text-[var(--bk-team-accent)]' : 'text-zinc-400'}`}>{team.abbr}</div>
        </button>
      );
    })}
  </div>
);
