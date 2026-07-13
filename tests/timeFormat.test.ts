import { formatTime12Hour } from '../src/lib/timeFormat';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

expectEqual(formatTime12Hour('00:00'), '12:00 AM', 'formats midnight');
expectEqual(formatTime12Hour('12:05'), '12:05 PM', 'formats noon');
expectEqual(formatTime12Hour('23:59:00'), '11:59 PM', 'accepts database time values with seconds');
expectEqual(formatTime12Hour('7:30'), '7:30 AM', 'accepts a one-digit hour');
expectEqual(formatTime12Hour('24:00'), '', 'rejects an out-of-range hour');
expectEqual(formatTime12Hour('09:75'), '', 'rejects out-of-range minutes');
expectEqual(formatTime12Hour('not-a-time'), '', 'does not render NaN for malformed input');
