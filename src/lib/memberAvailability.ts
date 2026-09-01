export interface MemberAvailabilityWindow {
  user_id: string;
  status: string;
  request_type?: string | null;
  leave_type?: string | null;
  unavailable_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export function isApprovedLeaveOnDate(availability: MemberAvailabilityWindow, eventDate?: string | null) {
  if (!eventDate || availability.status !== 'approved') return false;
  if (availability.request_type && availability.request_type !== 'leave') return false;

  if (availability.leave_type === 'range') {
    return Boolean(
      availability.start_date
      && availability.end_date
      && availability.start_date <= eventDate
      && availability.end_date >= eventDate,
    );
  }

  return availability.unavailable_date === eventDate;
}

export function getOutMemberIdsForDate(availability: MemberAvailabilityWindow[], eventDate?: string | null) {
  return new Set(
    availability
      .filter(entry => isApprovedLeaveOnDate(entry, eventDate))
      .map(entry => entry.user_id),
  );
}
