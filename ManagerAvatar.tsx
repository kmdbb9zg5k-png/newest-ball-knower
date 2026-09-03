import React from 'react';
import type { LeagueMember } from './types';

const initials = (name: string) => name
  .replace(/\s+CPU(?:\s+\d+)?$/i, '')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map(part => part[0] || '')
  .join('')
  .toUpperCase() || 'BK';

export const ManagerAvatar = ({ member, name, className = 'h-9 w-9' }: { member?: LeagueMember; name?: string; className?: string }) => {
  const label = name || member?.userName || 'Ball Knower manager';
  return <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--bk-team-accent)]/35 bg-[#171b22] text-[9px] font-black text-[var(--bk-team-accent)] ${className}`} aria-label={`${label} profile photo`}>
    {initials(label)}
    {member?.userAvatar && <img src={member.userAvatar} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} />}
  </div>;
};
