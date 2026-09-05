import { bindChartTextGestures } from '../lib/chartTextGestures';
import { useEffect, useRef, useState, type RefObject } from 'react';

export function useChartTextGestures(ref: RefObject<HTMLElement>, enabled: boolean, size: number, onSize: (size: number) => void) {
  const current = useRef({ size, onSize });
  current.current = { size, onSize };
  const [pinching, setPinching] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    return bindChartTextGestures(element, {
      getSize: () => current.current.size,
      onSize: value => current.current.onSize(value),
      onPinching: setPinching,
      onPreview: scale => {
        const content = element.firstElementChild as HTMLElement | null;
        if (!content) return;
        content.style.transformOrigin = `0 ${element.scrollTop}px`;
        content.style.transform = scale === 1 ? '' : `scale(${scale})`;
      },
    });
  }, [ref, enabled]);
  return pinching;
}
