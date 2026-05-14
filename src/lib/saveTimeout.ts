export function withSaveTimeout<T>(promise: Promise<T>, timeoutMs = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Save timed out. Please check your connection and try again.'));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}
