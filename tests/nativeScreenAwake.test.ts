import { createScreenAwakeLease, createSerializedScreenAwakeSetter } from '../src/lib/screenAwakeLease';

function expect(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
}

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const completions: Array<() => void> = [];
const calls: boolean[] = [];
const delayedBridge = (enabled: boolean) => {
  calls.push(enabled);
  return new Promise<void>(resolve => completions.push(resolve));
};
const delayedSend = createSerializedScreenAwakeSetter(delayedBridge);
let staleActive = 0;
let currentActive = 0;
const stopOld = createScreenAwakeLease(delayedSend, () => { staleActive += 1; }, () => undefined);
stopOld();
const stopCurrent = createScreenAwakeLease(delayedSend, () => { currentActive += 1; }, () => undefined);
await flush();
expect(calls.join(','), 'true', 'only one native operation runs at a time');
completions[0]();
await flush();
expect(staleActive, 0, 'late old enable does not update an inactive session');
expect(calls.join(','), 'true,false', 'cleanup disables after the first enable');
completions[1]();
await flush();
expect(calls.join(','), 'true,false,true', 'new session enables after cleanup');
completions[2]();
await flush();
expect(currentActive, 1, 'current session becomes active');
stopCurrent();
await flush();
expect(calls.join(','), 'true,false,true,false', 'current session releases the screen on exit');
