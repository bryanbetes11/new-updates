export function createStableId(prefix = 'id') {
  const uuidFactory = globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID.bind(globalThis.crypto)
    : null;

  if (uuidFactory) return uuidFactory();

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
