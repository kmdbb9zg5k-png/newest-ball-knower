import { League, LeagueMember, UserProfile } from './types';

export function resolveMyLeagueMember(league: League | undefined, user: UserProfile | null | undefined): LeagueMember | undefined {
  if (!league || !user) return undefined;
  const exact = league.members.find(member => member.userId === user.id);
  if (exact) return exact;
  if (league.commissionerId === user.id) return league.members.find(member => member.isCommissioner && !member.isAi);
  const humans = league.members.filter(member => !member.isAi);
  return humans.length === 1 ? humans[0] : undefined;
}

export function cleanCpuDisplayName(name: string, index = 0): string {
  const match = name.match(/^(.*?)\s+CPU(?:\s+(\d+))?$/i);
  const base = (match?.[1] || name).replace(/\s*\([^)]*\)\s*$/, '').trim();
  return base ? `${base}${match?.[2] ? ` ${match[2]}` : ''}` : `CPU Team ${index + 1}`;
}

export function displayLeagueMemberName(member: LeagueMember | undefined, mine: boolean, user: UserProfile | null | undefined, index = 0): string {
  if (mine) return user?.name || 'You';
  if (member?.isAi) {
    const cpuName = cleanCpuDisplayName(member.userName, index);
    if (cpuName.toLowerCase().replace(/\s+\d+$/, '') === user?.name?.toLowerCase()) return `CPU Team ${index + 1}`;
    return cpuName;
  }
  return member?.userName || 'Manager';
}
