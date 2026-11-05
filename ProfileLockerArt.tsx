import React, { useId } from 'react';
import { LockKeyhole, Trophy } from 'lucide-react';
import type { Achievement } from './progressionCloud';
import './profileLockerRefinements.css';

// Decorative crops of the owner's approved reference, not a flattened UI.
// Sample initials/date and shield centers were removed; identity and awards stay live.
export const LOCKER_ATLAS = '/profile/locker-reference-atlas.webp';
export const LOCKER_MANAGER_FACE = '/profile/locker-manager-face.webp';
function ReferenceArt({ region, className, children }: { region: string; className?: string; children?: React.ReactNode }) {
  const clipId = `locker-art-${useId().replace(/:/g, '')}`;
  const [x, y, width, height] = region.split(' ').map(Number);
  // Letterboxed SVG viewports otherwise reveal neighboring atlas cells.
  return <svg className={className} viewBox={region} aria-hidden="true" focusable="false" overflow="hidden">
    <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
    <g clipPath={`url(#${clipId})`}><image href={LOCKER_ATLAS} width="544" height="552"/>{children}</g>
  </svg>;
}
export function LockerManagerIllustration() {
  return <ReferenceArt region="280 0 255 223" className="bk-locker-manager"><image href={LOCKER_MANAGER_FACE} x="368" y="27" width="62" height="87"/></ReferenceArt>;
}
export function LockerReceiptScene() {
  return <div className="bk-locker-receipt-art" aria-hidden="true"><ReferenceArt region="0 240 180 182" className="bk-locker-receipt-player"/><ReferenceArt region="200 240 177 184" className="bk-locker-receipt-tunnel"/></div>;
}
export function LockerTrophyBadge({ tier, unlocked }: { tier: Achievement['tier']; unlocked: boolean }) {
  const id = `locker-trophy-${useId().replace(/:/g, '')}`;
  const metals = {
    bronze: { light: '#ffe0ba', mid: '#ba8554', dark: '#553521', edge: '#d3a477' },
    silver: { light: '#ffffff', mid: '#aeb9c2', dark: '#414b55', edge: '#dce3e8' },
    gold: { light: '#fff3c8', mid: '#d2a358', dark: '#68441e', edge: '#ebc77d' },
    diamond: { light: '#f3fdff', mid: '#9dbbcf', dark: '#395569', edge: '#d3f0ff' },
  };
  const metal = metals[tier] || metals.gold;
  return <span className="bk-locker-badge" data-tier={tier} data-unlocked={unlocked} aria-hidden="true">
    <svg viewBox="0 0 112 112" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={metal.dark}/><stop offset=".18" stopColor={metal.light}/><stop offset=".32" stopColor={metal.mid}/><stop offset=".48" stopColor={metal.light}/><stop offset=".51" stopColor={metal.dark}/><stop offset=".74" stopColor={metal.mid}/><stop offset=".88" stopColor={metal.light}/><stop offset="1" stopColor={metal.dark}/>
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={metal.light}/><stop offset=".42" stopColor={metal.mid}/><stop offset=".69" stopColor={metal.dark}/><stop offset="1" stopColor={metal.edge}/>
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={unlocked ? '#353529' : '#30363b'}/><stop offset=".45" stopColor="#12191e"/><stop offset="1" stopColor="#070c10"/>
        </linearGradient>
      </defs>
      {/* Transparent outside the emblem; no atlas rectangle behind the live badge. */}
      <path d="M56 9 93 29V77L56 107 19 77V29Z" fill="#000" opacity=".45"/>
      {[false, true].map(mirrored => <g key={String(mirrored)} transform={mirrored ? 'translate(112 0) scale(-1 1)' : undefined} fill={`url(#${id}-metal)`} stroke={metal.edge} strokeWidth=".45">
        <path d="M34 94C16 83 11 63 16 39" fill="none" stroke={`url(#${id}-edge)`} strokeWidth="1.8"/>
        <path d="M15 53C8 49 8 42 10 36 16 40 18 47 15 53Z"/>
        <path d="M14 64C6 60 5 54 6 48 13 51 17 57 14 64Z"/>
        <path d="M17 75C9 73 6 67 6 61 14 63 19 68 17 75Z"/>
        <path d="M23 85C15 85 10 80 9 74 17 74 23 78 23 85Z"/>
        <path d="M32 94C24 96 18 92 15 87 23 84 29 87 32 94Z"/>
      </g>)}
      <path d="M56 6 92 27V75L56 103 20 75V27Z" fill={`url(#${id}-metal)`} stroke={metal.dark} strokeWidth="1.2"/>
      <path d="M56 11 87 30V72L56 97 25 72V30Z" fill="#090e13" stroke={`url(#${id}-edge)`} strokeWidth="1.2"/>
      <path d="M56 16 83 33V70L56 92 29 70V33Z" fill={`url(#${id}-edge)`}/>
      <path d="M56 20 79 35V68L56 87 33 68V35Z" fill={`url(#${id}-face)`} stroke={metal.dark} strokeWidth=".8"/>
      <path d="M22 28 56 8 89 28M22 29V74L55 100" fill="none" stroke={metal.light} strokeWidth="1.1" opacity=".9"/>
      <path d="M56 12 85 30V72L56 95M34 36 56 22 77 36" fill="none" stroke={metal.edge} strokeWidth=".7" opacity=".55"/>
      <path d="M56 6V11M20 27 25 30M92 27 87 30M20 75 25 72M92 75 87 72M56 97V103" fill="none" stroke={metal.dark} strokeWidth="1"/>
    </svg>
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
