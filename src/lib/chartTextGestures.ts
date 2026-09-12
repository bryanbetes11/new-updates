export function bindChartTextGestures(element: HTMLElement, options: {
  getSize: () => number;
  onSize: (size: number) => void;
  onPinching: (active: boolean) => void;
  onStart?: (point: { x: number; y: number }) => void;
  onPreview?: (scale: number) => void;
}) {
  let startDistance = 0;
  let startSize = 0;
  let pendingSize = 0;
  let active: 'touch' | 'wheel' | null = null;
  let frame = 0;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  const clamp = (value: number) => Math.max(8, Math.min(36, value));
  const distance = (event: TouchEvent) => Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
  const preview = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      options.onPreview?.(pendingSize / startSize);
    });
  };
  const finish = () => {
    if (!active) return;
    active = null;
    clearTimeout(wheelTimer);
    cancelAnimationFrame(frame);
    frame = 0;
    // Keep the preview continuous; round only the final saved font size.
    const size = Math.round(clamp(pendingSize));
    if (size !== startSize) options.onSize(size);
    options.onPinching(false);
    options.onPreview?.(1);
  };
  const begin = (kind: 'touch' | 'wheel', x: number, y: number) => {
    active = kind;
    startSize = options.getSize();
    pendingSize = startSize;
    options.onStart?.({ x, y });
    options.onPinching(true);
  };
  const start = (event: TouchEvent) => {
    if (event.touches.length !== 2 || active === 'touch') return;
    finish();
    event.preventDefault();
    event.stopPropagation();
    startDistance = distance(event);
    begin('touch', (event.touches[0].clientX + event.touches[1].clientX) / 2, (event.touches[0].clientY + event.touches[1].clientY) / 2);
  };
  const move = (event: TouchEvent) => {
    if (active !== 'touch') return;
    event.preventDefault();
    event.stopPropagation();
    if (!startDistance || event.touches.length !== 2) return;
    pendingSize = clamp(startSize * distance(event) / startDistance);
    preview();
  };
  const end = (event: TouchEvent) => {
    if (active !== 'touch') return;
    event.preventDefault();
    event.stopPropagation();
    // Retain ownership through one-finger tails, avoiding accidental navigation.
    if (event.type !== 'touchcancel' && event.touches?.length) return;
    finish();
  };
  const wheel = (event: WheelEvent) => {
    // Preserve ordinary scrolling and browser Ctrl/Cmd zoom shortcuts.
    if (!event.altKey || event.ctrlKey || event.metaKey || active === 'touch') return;
    event.preventDefault();
    event.stopPropagation();
    if (!active) begin('wheel', event.clientX, event.clientY);
    pendingSize = clamp(pendingSize - event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1) / 40);
    preview();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(finish, 120);
  };
  element.addEventListener('touchstart', start, { passive: false, capture: true });
  element.addEventListener('touchmove', move, { passive: false, capture: true });
  element.addEventListener('touchend', end, { passive: false, capture: true });
  element.addEventListener('touchcancel', end, { passive: false, capture: true });
  element.addEventListener('wheel', wheel, { passive: false });
  return () => {
    clearTimeout(wheelTimer);
    cancelAnimationFrame(frame);
    element.removeEventListener('touchstart', start, true);
    element.removeEventListener('touchmove', move, true);
    element.removeEventListener('touchend', end, true);
    element.removeEventListener('touchcancel', end, true);
    element.removeEventListener('wheel', wheel);
    options.onPreview?.(1);
    options.onPinching(false);
  };
}
