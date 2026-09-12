export type NotificationOutcome = { response_status?: string | null; event_viewed_at?: string | null };
export function notificationOutcomeLabel(row: NotificationOutcome) {
  switch (row.response_status) {
    case 'confirmed': return 'Availability confirmed';
    case 'declined': return 'Availability declined';
    case 'responded': return 'All assignments answered';
    case 'superseded': return 'Older schedule — replaced by a newer update';
    case 'no_assignment': return 'No current assignment';
    case 'unavailable': return 'Event unavailable';
    case 'awaiting_response': return row.event_viewed_at ? 'Viewed update · awaiting response' : 'Awaiting response · no event view recorded';
    default: return null;
  }
}
