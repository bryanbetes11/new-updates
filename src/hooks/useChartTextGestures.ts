import { bindChartTextGestures } from '../lib/chartTextGestures';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export function useChartTextGestures(ref: RefObject<HTMLElement>, enabled: boolean, size: number, onSize: (size: number) => void) {
  const current = useRef({ size, onSize });
  current.current = { size, onSize };
  const [pinching, setPinching] = useState(false);
  const committing = useRef(false);
  const anchor = useRef<{ node: HTMLElement; fraction: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (pinching) return;
    const element = ref.current;
    const content = element?.firstElementChild as HTMLElement | null;
    if (!element || !content) return;
    content.style.transform = '';
    content.style.willChange = '';
  }, [size, pinching, ref]);
  const restoreAnchor = useCallback(() => {
    if (!committing.current) return;
    const element = ref.current;
    if (!element) return;
    const saved = anchor.current;
    if (saved?.node.isConnected) {
      const rect = saved.node.getBoundingClientRect();
      element.scrollTop += rect.top + rect.height * saved.fraction - saved.y;
    }
    anchor.current = null;
    committing.current = false;
  }, [ref]);
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    return bindChartTextGestures(element, {
      getSize: () => current.current.size,
      onSize: value => current.current.onSize(value),
      onPinching: value => { committing.current = !value; setPinching(value); },
      onStart: point => {
        const content = element.firstElementChild as HTMLElement | null;
        if (!content) return;
        const rect = content.getBoundingClientRect();
        content.style.transformOrigin = `${point.x - rect.left}px ${point.y - rect.top}px`;
        content.style.willChange = 'transform';
        const section = Array.from(content.querySelectorAll<HTMLElement>('[data-chart-section]')).find(node => {
          const bounds = node.getBoundingClientRect();
          return point.y >= bounds.top && point.y <= bounds.bottom && point.x >= bounds.left && point.x <= bounds.right;
        }) || content;
        const bounds = section.getBoundingClientRect();
        anchor.current = { node: section, fraction: (point.y - bounds.top) / Math.max(1, bounds.height), y: point.y };
      },
      onPreview: scale => {
        const content = element.firstElementChild as HTMLElement | null;
        if (!content) return;
        // Reset alongside the committed font size in the layout effect.
        if (!committing.current) content.style.transform = scale === 1 ? '' : `scale(${scale})`;
      },
    });
  }, [ref, enabled]);
  return { pinching, restoreAnchor };
}
