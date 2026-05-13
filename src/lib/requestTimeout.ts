const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

export async function withRequestTimeout<T>(
  request: PromiseLike<T>,
  fallback: T,
  label: string,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`[Request] ${label} timed out; continuing with fallback state.`);
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } catch (error) {
    console.error(`[Request] ${label} failed:`, error);
    return fallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
