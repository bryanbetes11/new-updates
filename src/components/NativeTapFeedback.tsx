import { useEffect } from 'react';
import { getInteractionTarget, triggerHaptic, usesNativeTapFeedback } from '../lib/haptics';

export function NativeTapFeedback() {
  useEffect(() => {
    if (!usesNativeTapFeedback()) return;
    const tap = (event: MouseEvent) => {
      if (!event.isTrusted || !getInteractionTarget(event.target)) return;
      triggerHaptic('light');
    };
    // A click represents an activation; pointer-up alone can be the end of a scroll.
    document.addEventListener('click', tap, { capture: true, passive: true });
    return () => document.removeEventListener('click', tap, true);
  }, []);
  return null;
}
