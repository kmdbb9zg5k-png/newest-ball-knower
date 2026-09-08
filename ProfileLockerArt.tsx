import React, { useId } from 'react';
import { LockKeyhole, Trophy } from 'lucide-react';
import type { Achievement } from './progressionCloud';

// Original decorative vector artwork; never a player portrait or an account avatar.
export function LockerManagerIllustration() {
  const id = useId().replace(/:/g, '');
  return <svg className="bk-locker-manager" viewBox="0 0 180 250" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-suit`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#727372"/><stop offset=".38" stopColor="#303237"/><stop offset="1" stopColor="#0b0d11"/></linearGradient>
      <linearGradient id={`${id}-skin`} x1="0" x2="1"><stop stopColor="#797063"/><stop offset=".5" stopColor="#b5a48d"/><stop offset="1" stopColor="#716c63"/></linearGradient>
      <linearGradient id={`${id}-case`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#5d5241"/><stop offset="1" stopColor="#171714"/></linearGradient>
      <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1"><stop offset=".64" stopColor="white"/><stop offset="1" stopColor="black"/></linearGradient>
      <mask id={`${id}-mask`}><rect width="180" height="250" fill={`url(#${id}-fade)`}/></mask>
    </defs>
    <g mask={`url(#${id}-mask)`}>
      <g fill="none" stroke="#98a7ac" strokeWidth=".8" opacity=".23"><path d="M2 115H168M2 95H168M2 75H168M12 62V145M37 62V145M142 62V145M167 62V145"/><path d="m0 132 27-13 17 4 24-22 27 8 27-34 20 7 33-29" stroke="#c6d5ce" strokeWidth="2"/></g>
      <path d="M43 93 67 82H100L129 96Q139 101 143 129L153 221H27L30 129Q31 103 43 93Z" fill={`url(#${id}-suit)`} stroke="#a5a296" strokeWidth="1.1"/>
      <path d="M74 67H96V90L85 105 70 88Z" fill={`url(#${id}-skin)`}/>
      <path d="M64 28Q80 7 101 26L102 56Q100 70 85 80 70 76 64 58Z" fill={`url(#${id}-skin)`} stroke="#59534a"/>
      <path d="m63 47-4-14 4-14q8-12 20-12l21 8 5 14-5 17-5-22q-14 2-26-6l-7 12Z" fill="#34302a" stroke="#8e8170"/>
      <path d="m67 84 18 20 16-20-7 70H80Z" fill="#e4e0d3"/>
      <path d="m80 101 5-4 6 6-4 10 8 52-9 13-9-13 6-52Z" fill="#18191c"/>
      <path d="m65 85-11 29 18 8-8 9 21 49-12-70Z" fill="#4b4c4c" stroke="#a7a398" strokeWidth=".8"/>
      <path d="m103 85 12 29-17 9 7 10-20 47 12-69Z" fill="#24272b" stroke="#8f918c" strokeWidth=".8"/>
      <path d="m47 119-7 72m88-68 9 66M85 179v55M52 169l18 3m31-4 19-3" fill="none" stroke="#b2ada0" strokeWidth=".7" opacity=".6"/>
      <circle cx="88" cy="183" r="2" fill="#a89b7d"/>
      <path d="M107 174v-7q0-9 10-9h12q10 0 10 9v7" fill="none" stroke="#a2967a" strokeWidth="3"/>
      <rect x="92" y="172" width="76" height="56" rx="4" fill={`url(#${id}-case)`} stroke="#9c8d6d"/>
      <path d="m93 187 36 5 38-5" fill="none" stroke="#b7a889" strokeWidth="1.3"/><rect x="126" y="187" width="7" height="12" rx="1" fill="#b9aa86"/>
    </g>
  </svg>;
}

export function LockerTrophyBadge({ tier, unlocked }: { tier: Achievement['tier']; unlocked: boolean }) {
  return <span className="bk-locker-badge" data-tier={tier} data-unlocked={unlocked} aria-hidden="true">
    <svg viewBox="0 0 120 126" focusable="false"><g fill="none" stroke="currentColor">
      <path d="M60 4 106 28V82L60 118 14 82V28Z" strokeWidth="5"/><path d="M60 11 100 32V79L60 110 20 79V32Z" strokeWidth="1.5"/>
      <path d="M60 19 92 37V75L60 100 28 75V37Z" fill="#16191c" strokeWidth="2"/>
      <path d="M15 91Q1 71 7 46M105 91q14-20 8-45" strokeWidth="1.8"/>
      {[0,1,2,3,4].map(n => <g key={n} transform={`translate(0 ${n*8})`}><path d="M11 50Q0 39 3 54L12 64" fill="currentColor" opacity=".65"/><path d="M109 50q11-11 8 4l-9 10" fill="currentColor" opacity=".65"/></g>)}
    </g></svg>
    {unlocked ? <Trophy className="bk-locker-badge-symbol"/> : <LockKeyhole className="bk-locker-badge-symbol"/>}
  </span>;
}
