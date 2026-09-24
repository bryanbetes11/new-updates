type SetlistEvent = {
  id: string;
  event_type: string;
  linked_event_id?: string | null;
  org_id?: string;
};

/** A linked rehearsal edits the service's one proposal, never a second copy. */
export function resolveSetlistEvent<T extends SetlistEvent>(event: T, linkedEvent?: T | null): T {
  if (event.event_type !== 'Rehearsals' || !event.linked_event_id) return event;
  if (!linkedEvent || linkedEvent.id !== event.linked_event_id || linkedEvent.event_type !== 'Sunday Service'
    || !event.org_id || linkedEvent.org_id !== event.org_id) {
    throw new Error('The linked Sunday Service could not be loaded. Check the event link before editing its setlist.');
  }
  return linkedEvent;
}
