// Serialize writes for each identity, retaining only the latest waiting write.
// Shared across mounted viewers so an older request cannot finish after a newer one.
type Job = { run: () => Promise<void>; resolve: (saved: boolean) => void; reject: (error: unknown) => void };
const queues = new Map<string, { pending?: Job }>();

export function enqueueLatestSave(identity: string, run: () => Promise<void>): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const job = { run, resolve, reject };
    const existing = queues.get(identity);
    if (existing) {
      existing.pending?.resolve(false);
      existing.pending = job;
      return;
    }
    const queue: { pending?: Job } = {};
    queues.set(identity, queue);
    void (async () => {
      let next: Job | undefined = job;
      while (next) {
        try { await next.run(); next.resolve(true); }
        catch (error) { next.reject(error); }
        next = queue.pending;
        queue.pending = undefined;
      }
      queues.delete(identity);
    })();
  });
}
