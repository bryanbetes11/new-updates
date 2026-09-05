import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { readRecovery, writeRecovery } from '../lib/draftRecovery';

// Persist in the input handler, before navigation/unmount or browser suspension.
export function useRecoverableDraft<T>(key: string | null, initial: T, validate: (value: unknown) => value is T) {
  const load = () => {
    const saved = readRecovery(key, validate);
    return { key, value: saved ?? initial, restored: saved !== null, available: true };
  };
  const [state, setState] = useState(load);
  const current = useRef(state);
  if (state.key !== key) {
    const next = load();
    current.current = next;
    setState(next);
  } else current.current = state;

  const update = useCallback((action: SetStateAction<T>) => {
    const previous = current.current;
    if (previous.key !== key) return;
    const value = typeof action === 'function' ? (action as (value: T) => T)(previous.value) : action;
    const empty = JSON.stringify(value) === JSON.stringify(initial);
    const available = writeRecovery(key, empty ? null : value);
    const next = { ...previous, value, available, restored: empty ? false : previous.restored };
    current.current = next;
    setState(next);
  }, [initial, key]);

  const discard = () => update(initial);
  return [current.current.value, update, { restored: current.current.restored, available: current.current.available, discard }] as const;
}
