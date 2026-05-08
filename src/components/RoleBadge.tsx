import { Crown } from 'lucide-react';
import type { Role } from '../types';

interface RoleBadgeProps {
  role: Role | { name: string; is_leadership?: boolean };
  size?: 'sm' | 'md';
}

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const isLead = 'is_leadership' in role && role.is_leadership;
  const baseClass = isLead ? 'badge-gold' : 'badge-blue';
  const iconSize = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <span className={`${baseClass} ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : ''} inline-flex items-center gap-1`}>
      {isLead && <Crown className={iconSize} />}
      {role.name}
    </span>
  );
}

export function sortRolesLeadershipFirst<T extends { is_leadership?: boolean; name?: string; roles?: { is_leadership?: boolean; name?: string } }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aLead = a.is_leadership ?? a.roles?.is_leadership ?? false;
    const bLead = b.is_leadership ?? b.roles?.is_leadership ?? false;
    if (aLead && !bLead) return -1;
    if (!aLead && bLead) return 1;
    return 0;
  });
}
