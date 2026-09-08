import React, { useId } from 'react';
import { LockKeyhole, Trophy } from 'lucide-react';
import type { Achievement } from './progressionCloud';
import './profileLockerRefinements.css';

// Decorative crops of the owner's approved reference, not a flattened UI.
// Sample initials/date and shield centers were removed; identity and awards stay live.
export const LOCKER_ATLAS = '/profile/locker-reference-atlas.webp';
function ReferenceArt({ region, className }: { region: string; className?: string }) {
  const clipId = `locker-art-${useId().replace(/:/g, '')}`;
  const [x, y, width, height] = region.split(' ').map(Number);
  // Letterboxed SVG viewports otherwise reveal neighboring atlas cells.
  return <svg className={className} viewBox={region} aria-hidden="true" focusable="false" overflow="hidden">
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
    <g clipPath={`url(#${clipId})`}><image href={LOCKER_ATLAS} width="544" height="552"/></g>
  </svg>;
}
export function LockerManagerIllustration() {
  return <ReferenceArt region="280 0 255 223" className="bk-locker-manager"/>;
}
export function LockerReceiptScene() {
  return <div className="bk-locker-receipt-art" aria-hidden="true"><ReferenceArt region="0 240 180 182" className="bk-locker-receipt-player"/><ReferenceArt region="200 240 177 184" className="bk-locker-receipt-tunnel"/></div>;
}
export function LockerTrophyBadge({ tier, unlocked }: { tier: Achievement['tier']; unlocked: boolean }) {
  return <span className="bk-locker-badge" data-tier={tier} data-unlocked={unlocked} aria-hidden="true">
    <ReferenceArt region={tier === 'silver' || tier === 'diamond' ? '400 352 108 108' : '400 240 108 108'}/>
    {unlocked ? <Trophy className="bk-locker-badge-symbol"/> : <LockKeyhole className="bk-locker-badge-symbol"/>}
  </span>;
}
export function LockerRatingNumeral({ value }: { value: string }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 160 104" role="img" aria-label={`Rating: ${value}`} focusable="false">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fffff4"/><stop offset=".38" stopColor="#b5b7b6"/><stop offset=".49" stopColor="#858a8b"/><stop offset=".52" stopColor="#fffae2"/><stop offset=".82" stopColor="#c9c8bd"/><stop offset="1" stopColor="#797a73"/></linearGradient></defs>
    <text x="80" y="88" textAnchor="middle" fill={`url(#${id})`} stroke="#e6d097" strokeWidth="1.3" paintOrder="stroke" fontFamily="Arial, sans-serif" fontWeight="900" fontSize={value.length > 2 ? '76' : '104'} letterSpacing="-5">{value}</text>
  </svg>;
}
