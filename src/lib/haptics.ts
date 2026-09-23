import { Capacitor, registerPlugin } from '@capacitor/core';

export type HapticStrength = 'light' | 'strong';
const nativeHaptics = registerPlugin<{ tap(): Promise<void> }>('InteractionHaptics');
export const usesNativeTapFeedback = () => Capacitor.getPlatform() === 'android';

const interactiveSelector = 'button, a[href], [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"], select';

const vibrationDuration: Record<HapticStrength, number> = {
  light: 12,
  strong: 28,
};

export function triggerHaptic(strength: HapticStrength = 'light') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  if (usesNativeTapFeedback()) {
    void nativeHaptics.tap().catch(() => undefined);
    return true;
  }
  if (typeof navigator.vibrate !== 'function') return false;

  try {
    return navigator.vibrate(vibrationDuration[strength]);
  } catch {
    return false;
  }
}

export function shouldUseAppleTouchFeedback() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const isAppleDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  return isAppleDevice && navigator.maxTouchPoints > 0 && typeof navigator.vibrate !== 'function';
}

export function getInteractionTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  if (target.closest('textarea, input:not([type="checkbox"]):not([type="radio"]), [contenteditable="true"], [inert]')) return null;
  const interactive = target.closest<HTMLElement>(interactiveSelector);
  if (!interactive || interactive.matches(':disabled, [aria-disabled="true"]')) return null;
  if (interactive.dataset.haptic === 'none') return null;
  return interactive;
}

export function getInteractionHapticStrength(target: EventTarget | null): HapticStrength | null {
  const interactive = getInteractionTarget(target);
  if (!interactive) return null;
  if (interactive.dataset.haptic === 'strong') return 'strong';
  if (interactive.getAttribute('role') === 'tab' || interactive.closest('nav, aside, [data-main-navigation]')) return 'strong';
  return 'light';
}
