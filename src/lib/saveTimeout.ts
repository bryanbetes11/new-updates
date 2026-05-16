export function withSaveTimeout<T>(promise: PromiseLike<T>, timeoutMs = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Save timed out. Please check your connection and try again.'));
    }, timeoutMs);

    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}
