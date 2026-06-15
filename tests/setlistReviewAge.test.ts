import { describeSetlistReviewAge, getSetlistPendingMessage } from '../src/lib/setlistReviewAge';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const pending = describeSetlistReviewAge('2026-06-12T09:30:00+08:00', new Date('2026-06-15T12:00:00+08:00'));
expectEqual(pending.submittedDateLabel, 'Jun 12, 2026', 'formats the submitted date');
expectEqual(pending.pendingDaysLabel, 'Pending 3 days', 'counts full calendar days pending');
expectEqual(pending.pendingDays, 3, 'exposes pending day count');

const sameDay = describeSetlistReviewAge('2026-06-15T09:30:00+08:00', new Date('2026-06-15T12:00:00+08:00'));
expectEqual(sameDay.pendingDaysLabel, 'Pending today', 'labels same-day submissions');

const missing = describeSetlistReviewAge(null, new Date('2026-06-15T12:00:00+08:00'));
expectEqual(missing.submittedDateLabel, 'Submission date unavailable', 'handles missing submitted dates');
expectEqual(missing.pendingDaysLabel, 'Pending age unavailable', 'handles missing pending age');

const longPending = describeSetlistReviewAge('2026-06-06T09:30:00+08:00', new Date('2026-06-15T12:00:00+08:00'));
expectEqual(getSetlistPendingMessage(longPending, true), 'Your setlist has been pending for 9 days', 'formats submitter pending message');
expectEqual(getSetlistPendingMessage(longPending, false), 'Setlist pending for 9 days', 'formats general pending message');
expectEqual(getSetlistPendingMessage(sameDay, true), 'Your setlist is pending today', 'formats same-day submitter pending message');
expectEqual(getSetlistPendingMessage(missing, false), null, 'hides pending message when age is unavailable');
