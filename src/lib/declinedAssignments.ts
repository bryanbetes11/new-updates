import type { InactiveAssignmentRow } from './inactiveAssignments';

export type DeclinedAssignmentRow = InactiveAssignmentRow & { decline_reason?: string | null };
export interface DeclinedMember { id: string; name: string; reasons: string[] }
export type DeclinedAssignmentGroups = Record<string, DeclinedMember[]>;

export function groupDeclinedAssignments(rows: DeclinedAssignmentRow[]): DeclinedAssignmentGroups {
  const groups: DeclinedAssignmentGroups = {};
  for (const row of rows) {
    if (row.status !== 'declined') continue;
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const group = groups[row.event_id] ??= [];
    let member = group.find(item => item.id === row.user_id);
    if (!member) {
      member = { id: row.user_id, name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Team member', reasons: [] };
      group.push(member);
    }
    const reason = row.decline_reason?.trim();
    if (reason && !member.reasons.includes(reason)) member.reasons.push(reason);
  }
  return groups;
}
