// Coalesce bursts and repeat once if a change arrives while a request is running.
export function createAccessRefreshQueue(refresh: () => Promise<void>) {
  let running = false;
  let pending = false;
  let disposed = false;
  return {
    async request() {
      if (disposed) return;
      pending = true;
      if (running) return;
      running = true;
      try {
        while (pending && !disposed) {
          pending = false;
          try { await refresh(); } catch { /* Next signal/resume retries. */ }
        }
      } finally { running = false; }
    },
    dispose() { disposed = true; pending = false; },
  };
}
