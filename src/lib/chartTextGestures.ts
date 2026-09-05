export function bindChartTextGestures(element: HTMLElement, options: {getSize: () => number; onSize: (size: number) => void; onPinching: (active: boolean) => void}) {
    let startDistance = 0;
    let startSize = 0;
    let wheelDelta = 0;
    const apply = (value: number) => options.onSize(Math.max(8, Math.min(36, Math.round(value))));
    const distance = (event: TouchEvent) => Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      event.stopPropagation();
      startDistance = distance(event);
      startSize = options.getSize();
      options.onPinching(true);
    };
    const move = (event: TouchEvent) => {
      if (!startDistance || event.touches.length !== 2) return;
      event.preventDefault();
      event.stopPropagation();
      apply(startSize * distance(event) / startDistance);
    };
    const end = () => { startDistance = 0; options.onPinching(false); };
    const wheel = (event: WheelEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      wheelDelta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      const steps = Math.trunc(wheelDelta / 40);
      if (steps) { apply(options.getSize() - steps); wheelDelta -= steps * 40; }
    };
    element.addEventListener('touchstart', start, { passive: false, capture: true });
    element.addEventListener('touchmove', move, { passive: false, capture: true });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', end);
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      element.removeEventListener('touchstart', start, true);
      element.removeEventListener('touchmove', move, true);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', end);
      element.removeEventListener('wheel', wheel);
      options.onPinching(false);
    };
}
