import React from 'react';
import { getLicensedPlayerPortrait, LICENSED_PLAYER_PORTRAITS } from './licensedPlayerPortraits';

export function PlayerPhotoCredit({ name }: { name: string }) {
  const photo = getLicensedPlayerPortrait(name);
  if (!photo) return null;
  return <div className="flex flex-wrap items-center gap-x-2 border-b border-white/10 px-4 py-1 text-[10px] leading-5 text-zinc-400" aria-label={`${name} photo attribution`}>
    <span>Photo: {photo.creator}</span>
    <a className="inline-flex min-h-11 items-center underline" href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a>
    <a className="inline-flex min-h-11 items-center underline" href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a>
    <span>Resized; framing varies by view.</span>
  </div>;
}

export function PhotoCreditsContent() {
  return <div className="mt-5 space-y-4 text-sm leading-6 text-zinc-300">
    <p>Photographs remain the work of their credited creators. The file-specific licenses below cover the photographs, not Ball Knower code or an endorsement by a player or team.</p>
    <p>Images may be resized and clipped to fit a portrait slot. Any adapted image is offered under the applicable source license, including ShareAlike where required. Source pages document earlier crops and versions.</p>
    {Object.entries(LICENSED_PLAYER_PORTRAITS).map(([name, photo]) => <section key={name} className="rounded-2xl border border-white/10 p-4">
      <h3 className="font-bold text-white">{name}</h3>
      <p>Photo: {photo.creator}</p>
      <p className="break-words text-xs">{photo.fileName}</p>
      <div className="flex flex-wrap gap-x-4">
        <a className="inline-flex min-h-11 items-center text-[#D4AF37] underline" href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">Original file and history</a>
        <a className="inline-flex min-h-11 items-center text-[#D4AF37] underline" href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license}</a>
      </div>
    </section>)}
    <p>Unmapped players and team defenses use Ball Knower initials or abbreviation artwork. Rights or attribution concerns: <a className="underline" href="mailto:BallKnowerOfficial@gmail.com">BallKnowerOfficial@gmail.com</a>.</p>
  </div>;
}
