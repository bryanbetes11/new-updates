// Keeps an old native request's completion from changing a newer Live Mode session.
export function createScreenAwakeLease(
  setEnabled: (enabled: boolean) => Promise<void>,
  onActive: () => void,
  onUnavailable: () => void,
) {
  let active = true;
  void setEnabled(true).then(() => {
    if (active) onActive();
  }).catch(() => {
    if (active) onUnavailable();
  });

  return () => {
    if (!active) return;
    active = false;
    void setEnabled(false).catch(() => undefined);
  };
}

export function createSerializedScreenAwakeSetter(send: (enabled: boolean) => Promise<void>) {
  let pending = Promise.resolve();
  return (enabled: boolean) => {
    const operation = pending.catch(() => undefined).then(() => send(enabled));
    pending = operation;
    return operation;
  };
}
