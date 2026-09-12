export function createBufferedDraftWriter(storageKey: string) {
  let pending: unknown;
  let hasPending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    if (!hasPending) return;
    try {
      if (pending === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(pending));
    } catch { /* Draft storage is optional; keep the in-memory editor available. */ }
    hasPending = false;
  };
  return {
    flush,
    schedule(value: unknown) {
      pending = value;
      hasPending = true;
      if (value === null) flush();
      else if (timer === undefined) timer = setTimeout(flush, 150);
    },
  };
}
