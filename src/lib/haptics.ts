export type HapticStrength = 'light' | 'strong';

const vibrationDuration: Record<HapticStrength, number> = {
  light: 7,
  strong: 18,
};

export function triggerHaptic(strength: HapticStrength = 'light') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  if (!window.matchMedia('(any-pointer: coarse)').matches) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (typeof navigator.vibrate !== 'function') return false;

  try {
    return navigator.vibrate(vibrationDuration[strength]);
  } catch {
    return false;
  }
}

export function getInteractionHapticStrength(target: EventTarget | null): HapticStrength | null {
  if (!(target instanceof HTMLElement)) return null;
  const interactive = target.closest<HTMLElement>('button, a[href], [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"], select');
  if (!interactive || interactive.matches(':disabled, [aria-disabled="true"]')) return null;
  if (interactive.dataset.haptic === 'none') return null;
  if (interactive.dataset.haptic === 'strong') return 'strong';
  if (interactive.getAttribute('role') === 'tab' || interactive.closest('nav, aside, [data-main-navigation]')) return 'strong';
  return 'light';
}
