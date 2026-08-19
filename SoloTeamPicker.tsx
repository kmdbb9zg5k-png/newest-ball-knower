import React from 'react';
import { TEAM_THEMES, applyTeamCssVariables, teamLogoUrl } from './teamTheme';

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
          onClick={() => {
            applyTeamCssVariables(team);
            onSelect(team.abbr);
          }}
          aria-pressed={selected}
          aria-label={team.name}
          className="min-h-20 rounded-2xl border p-2 transition active:bg-white/10"
          style={selected ? {
            borderColor: team.secondary,
            background: `linear-gradient(155deg, ${team.primary}44, ${team.secondary}18 72%, rgba(17,17,17,.92))`,
            boxShadow: `0 0 0 1px ${team.primary}66 inset, 0 10px 30px ${team.primary}33`,
          } : {
            borderColor: 'rgba(255,255,255,.10)',
            background: '#111',
          }}
        >
          <img src={teamLogoUrl(team.abbr)} alt="" aria-hidden="true" className="mx-auto h-10 w-10 object-contain" />
          <div className={`mt-1 text-[10px] font-black ${selected ? 'text-white' : 'text-zinc-400'}`}>{team.abbr}</div>
        </button>
      );
    })}
  </div>
);
