import { DRAFT_MAX_AGE_MS, draftRecoveryKey, mergeUntouchedFields, readRecovery, writeRecovery } from '../src/lib/draftRecovery';
import { churchToday, nextApprovedLeave, relativeEventDay } from '../src/lib/workflowDates';
import { eventsOverlap, leaveCoversDate } from '../src/lib/substituteAvailability';
import { compareEventSchedule } from '../src/lib/eventChronology';
import { acknowledgeMessage, type MessageWrite } from '../src/lib/messageDelivery';

function equal(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} } });
try {
  const key = draftRecoveryKey('announcement', 'church-a', 'member-a')!;
  const isString = (value: unknown): value is string => typeof value === 'string';
  equal(writeRecovery(key, 'Unsaved work'), true, 'Draft written');
  equal(readRecovery(key, isString), 'Unsaved work', 'Reload restores draft');
  equal(readRecovery(draftRecoveryKey('announcement', 'church-b', 'member-a'), isString), null, 'Church isolation');
  equal(readRecovery(draftRecoveryKey('announcement', 'church-a', 'member-b'), isString), null, 'Account isolation');
  equal(readRecovery(key, isString, Date.now() + DRAFT_MAX_AGE_MS + 1000), null, 'Expired drafts are not restored');
  storage.set(key, JSON.stringify({ savedAt: Date.now(), value: { invalid: true } }));
  equal(readRecovery(key, isString), null, 'Invalid draft shape');
  storage.set(key, '{invalid json');
  equal(readRecovery(key, isString), null, 'Corrupt storage is harmless');
  writeRecovery(key, 'discard me'); writeRecovery(key, null);
  equal(readRecovery(key, isString), null, 'Explicit discard clears recovery');
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
  equal(writeRecovery(key, 'keep in memory'), false, 'Storage denied is reported');
  equal(readRecovery(key, isString), null, 'Storage denied does not crash');
} finally {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
}
equal(mergeUntouchedFields({ name: 'Edited', phone: 'old' }, { name: 'Original', phone: 'old' }, { name: 'Original', phone: 'updated' }), { name: 'Edited', phone: 'updated' }, 'Refresh keeps edited fields and refreshes untouched fields');
equal(mergeUntouchedFields({ name: '' }, { name: 'Original' }, { name: 'Remote' }), { name: '' }, 'Intentional deletion is an edit');
equal(churchToday(new Date('2026-09-04T17:00:00Z')), '2026-09-05', 'Church date at UTC boundary');
equal(relativeEventDay('2026-10-03', '2026-09-05'), 'In 28 days', 'Future dates');
equal(relativeEventDay('2026-09-04', '2026-09-05'), 'Yesterday', 'Yesterday');
equal(relativeEventDay('2026-09-05', '2026-09-05'), 'Today', 'Today');
equal(relativeEventDay('2026-09-06', '2026-09-05'), 'Tomorrow', 'Tomorrow');
const expired = { status: 'approved', leave_type: 'single', unavailable_date: '2026-06-01' };
const current = { status: 'approved', leave_type: 'range', start_date: '2026-09-01', end_date: '2026-09-07' };
const future = { status: 'approved', leave_type: 'single', unavailable_date: '2026-09-20' };
equal(nextApprovedLeave([expired, future, current], '2026-09-05'), current, 'Current range wins over future and expired');
equal(nextApprovedLeave([expired], '2026-09-05'), undefined, 'Expired leave is excluded');
equal(leaveCoversDate(current, '2026-09-07'), true, 'Last day of leave is inclusive');
equal(leaveCoversDate({ ...current, status: 'pending' }, '2026-09-05'), false, 'Pending leave is not approved');
const event = { id: 'a', event_date: '2026-09-05', start_time: '16:30:00', end_time: '18:30:00' };
equal(eventsOverlap(event, { ...event, id: 'b', start_time: '18:30:00', end_time: '19:30:00' }), false, 'Back-to-back events are available');
equal(eventsOverlap(event, { ...event, id: 'b', start_time: '17:00:00' }), true, 'Overlapping events are flagged');
equal(eventsOverlap(event, event), false, 'Current event is handled separately');
equal(compareEventSchedule(event, { ...event, start_time: '18:30:00' }) < 0, true, 'Same-day events sort by start time');

const message: MessageWrite = { id: 'retry-id', content: 'Keep my work', reply_to: null, conversation_id: 'chat-a', sender_id: 'member-a' };
const noLookup = async () => { throw new Error('Unexpected lookup'); };
equal(await acknowledgeMessage(message, async () => ({ error: null }), noLookup), null, 'Successful acknowledgement');
equal(Boolean(await acknowledgeMessage(message, async () => { throw new Error('offline'); }, noLookup)), true, 'Network exception preserves failure');
const duplicate = { message: 'duplicate', code: '23505' };
equal(await acknowledgeMessage(message, async () => ({ error: duplicate }), async () => ({ error: null, data: { content: message.content, reply_to: null } })), null, 'Lost acknowledgement retry recognizes existing message');
equal(Boolean(await acknowledgeMessage(message, async () => ({ error: duplicate }), async () => ({ error: null, data: { content: 'Different message', reply_to: null } }))), true, 'ID collision never acknowledges different content');
equal(Boolean(await acknowledgeMessage(message, async () => ({ error: { message: 'Permission denied' } }), noLookup)), true, 'Permission failure stays a failure');
