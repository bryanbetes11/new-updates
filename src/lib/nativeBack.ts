// Higher priority surfaces (dialogs) consume Back before the page underneath.
export function createBackHandlerRegistry() {
  const entries: { handler: () => boolean; priority: number }[] = [];
  return {
    register(handler: () => boolean, priority = 0) {
      const entry = { handler, priority };
      entries.push(entry);
      return () => { const index = entries.indexOf(entry); if (index >= 0) entries.splice(index, 1); };
    },
    handle() {
      const ordered = [...entries].reverse().sort((a, b) => b.priority - a.priority);
      return ordered.some(entry => entry.handler());
    },
  };
}

export const nativeBackHandlers = createBackHandlerRegistry();
