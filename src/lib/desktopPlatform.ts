/** Tauri supplies this marker before the bundled application starts. */
export function isDesktopApp() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Display labels and update routing only; native permissions enforce access. */
export function desktopPlatformName(): 'Windows' | 'Mac' | 'Desktop' {
  if (typeof navigator === 'undefined') return 'Desktop';
  if (/Mac/i.test(navigator.platform)) return 'Mac';
  if (/Win/i.test(navigator.platform)) return 'Windows';
  return 'Desktop';
}

export function hasDesktopUpdater() {
  return isDesktopApp() && desktopPlatformName() === 'Windows';
}
