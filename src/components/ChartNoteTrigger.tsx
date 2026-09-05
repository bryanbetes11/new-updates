import { useEffect, useRef, type ReactNode } from 'react';

/** Opens line notes without taking over normal scrolling or two-finger zoom. */
export function ChartNoteTrigger({ children, enabled, label, onOpen }: {
  children: ReactNode;
  enabled: boolean;
  label: string;
  onOpen: () => void;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = triggerRef.current;
    if (!element) return;
    const preventSelection = (event: Event) => event.preventDefault();
    element.addEventListener('selectstart', preventSelection);
    return () => element.removeEventListener('selectstart', preventSelection);
  }, []);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const cancel = () => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  };
  useEffect(() => {
    const interrupt = (event: PointerEvent) => { if (!event.isPrimary) cancel(); };
    document.addEventListener('pointerdown', interrupt, true);
    window.addEventListener('blur', cancel);
    document.addEventListener('scroll', cancel, true);
    return () => {
      cancel();
      document.removeEventListener('pointerdown', interrupt, true);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('scroll', cancel, true);
    };
  }, []);

  return <div ref={triggerRef} data-chart-reading-text="true" data-chart-note-trigger={enabled ? 'true' : undefined} className="min-w-0 max-w-full rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
    role={enabled ? 'button' : undefined} tabIndex={enabled ? 0 : undefined}
    aria-label={enabled ? `Notes for ${label}` : undefined}
    title={enabled ? 'Hold to open notes, or double-click. Keyboard: Enter.' : undefined}
    style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
    onPointerDown={event => {
      cancel();
      if (!enabled || !event.isPrimary || event.button !== 0 || (event.target as Element).closest('[data-chart-chords="true"]')) return;
      pending.current = { x: event.clientX, y: event.clientY, timer: setTimeout(() => { pending.current = null; onOpen(); }, 550) };
    }}
    onPointerMove={event => {
      if (pending.current && Math.hypot(event.clientX - pending.current.x, event.clientY - pending.current.y) > 8) cancel();
    }}
    onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
    onContextMenu={event => event.preventDefault()}
    onDoubleClick={event => { if (enabled && !(event.target as Element).closest('[data-chart-chords="true"]')) { cancel(); onOpen(); } }}
    onKeyDown={event => {
      if (enabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); onOpen(); }
    }}
  >{children}</div>;
}
