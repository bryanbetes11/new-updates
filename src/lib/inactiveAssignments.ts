export interface InactiveAssignmentRow {
  event_id: string;
  user_id: string;
  status: string;
  profiles: { first_name: string; last_name: string; ministry_status: string } | { first_name: string; last_name: string; ministry_status: string }[] | null;
}

export function groupInactiveAssignments(rows: InactiveAssignmentRow[]) {
  const groups: Record<string, { id: string; name: string }[]> = {};
  for (const row of rows) {
    const member = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (row.status === 'declined' || member?.ministry_status !== 'inactive') continue;
    const group = groups[row.event_id] ??= [];
    if (!group.some(item => item.id === row.user_id)) {
      group.push({ id: row.user_id, name: `${member.first_name} ${member.last_name}`.trim() || 'Unnamed member' });
    }
  }
  return groups;
}
