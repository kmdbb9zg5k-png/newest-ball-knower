import React from 'react';
import { FantasyPlayerAvailability } from './fantasyPlayerAvailability';

export const FantasyAvailabilityBadge = ({ availability, full = false }: { availability?: FantasyPlayerAvailability; full?: boolean }) => {
  if (!availability) return null;
  const out = availability.status === 'out';
  const label = full ? (out ? 'OUT' : 'QUESTIONABLE') : availability.label;
  const detail = [label, availability.injury].filter(Boolean).join(' · ');
  return (
    <span
      title={detail}
      aria-label={detail}
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide ${out ? 'bg-red-500/15 text-red-400' : 'bg-yellow-400/15 text-yellow-300'}`}
    >
      {label}
    </span>
  );
};
