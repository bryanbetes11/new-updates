import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Calendar, CheckCircle, Eye, RotateCcw, X } from 'lucide-react';

export interface EventActionAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type EventLifecycleDialogMode = 'options' | 'confirm';

interface EventLifecycleActionModalProps {
  open: boolean;
  mode: EventLifecycleDialogMode;
  anchorRect: EventActionAnchorRect | null;
  eventName: string;
  eventMeta: string;
  isPast: boolean;
  saving: boolean;
  onClose: () => void;
  onModeChange: (mode: EventLifecycleDialogMode) => void;
  onOpenEvent: () => void;
  onConfirm: () => void;
}

interface DialogPlacement {
  left: number;
  top: number;
  width: number;
  opensAbove: boolean;
  pointerLeft: number;
}

const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 12;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function EventLifecycleActionModal({
  open,
  mode,
  anchorRect,
  eventName,
  eventMeta,
  isPast,
  saving,
  onClose,
  onModeChange,
  onOpenEvent,
  onConfirm,
}: EventLifecycleActionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const savingRef = useRef(saving);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [placement, setPlacement] = useState<DialogPlacement | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
    savingRef.current = saving;
  }, [onClose, saving]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    initialFocusRef.current?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      restoreFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchorRect) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const dialogHeight = dialogRef.current?.getBoundingClientRect().height || 280;
      const width = Math.min(380, Math.max(280, Math.min(anchorRect.width, viewport.width - (VIEWPORT_MARGIN * 2))));
      const centeredLeft = anchorRect.left + ((anchorRect.width - width) / 2);
      const left = clamp(centeredLeft, VIEWPORT_MARGIN, viewport.width - width - VIEWPORT_MARGIN);
      const roomBelow = viewport.height - anchorRect.bottom - VIEWPORT_MARGIN;
      const roomAbove = anchorRect.top - VIEWPORT_MARGIN;
      const opensAbove = roomBelow < dialogHeight + ANCHOR_GAP && roomAbove > roomBelow;
      const preferredTop = opensAbove
        ? anchorRect.top - dialogHeight - ANCHOR_GAP
        : anchorRect.bottom + ANCHOR_GAP;
      const top = clamp(preferredTop, VIEWPORT_MARGIN, viewport.height - dialogHeight - VIEWPORT_MARGIN);
      const pointerLeft = clamp((anchorRect.left + (anchorRect.width / 2)) - left, 28, width - 28);
      setPlacement({ left, top, width, opensAbove, pointerLeft });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [anchorRect, mode, open, viewport]);

  if (!open || !anchorRect) return null;

  const halo = {
    left: clamp(anchorRect.left - 5, 0, viewport.width),
    top: clamp(anchorRect.top - 5, 0, viewport.height),
    right: clamp(anchorRect.right + 5, 0, viewport.width),
    bottom: clamp(anchorRect.bottom + 5, 0, viewport.height),
  };
  const backdropClass = 'fixed bg-black/65 backdrop-blur-[5px] animate-fade-in pointer-events-auto';
  const lifecycleLabel = isPast ? 'Move to Upcoming' : 'Move to Past events';

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[2147483647]" role="presentation">
      <div aria-hidden="true" onClick={onClose} className={backdropClass} style={{ inset: `0 0 auto 0`, height: halo.top }} />
      <div aria-hidden="true" onClick={onClose} className={backdropClass} style={{ inset: `${halo.bottom}px 0 0 0` }} />
      <div aria-hidden="true" onClick={onClose} className={backdropClass} style={{ left: 0, top: halo.top, width: halo.left, height: halo.bottom - halo.top }} />
      <div aria-hidden="true" onClick={onClose} className={backdropClass} style={{ left: halo.right, right: 0, top: halo.top, height: halo.bottom - halo.top }} />

      <div
        aria-hidden="true"
        onClick={onClose}
        className="pointer-events-auto fixed rounded-[0.8rem] border border-emerald-300/45 bg-transparent shadow-[0_0_0_1px_rgba(34,197,94,0.12),0_18px_55px_-24px_rgba(34,197,94,0.9)]"
        style={{ left: halo.left, top: halo.top, width: halo.right - halo.left, height: halo.bottom - halo.top }}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'options' ? `Options for ${eventName}` : lifecycleLabel}
        className="pointer-events-auto fixed overflow-hidden rounded-[1.35rem] border border-white/[0.10] bg-[#121512]/98 text-white shadow-[0_28px_80px_-24px_rgba(0,0,0,0.95)] ring-1 ring-emerald-400/[0.08] animate-scale-in"
        style={placement ? {
          left: placement.left,
          top: placement.top,
          width: placement.width,
          transformOrigin: placement.opensAbove ? 'bottom center' : 'top center',
        } : { left: VIEWPORT_MARGIN, top: anchorRect.bottom + ANCHOR_GAP, width: Math.min(380, viewport.width - 24), opacity: 0 }}
      >
        {placement && (
          <span
            aria-hidden="true"
            className={`absolute h-3 w-3 rotate-45 border-white/[0.10] bg-[#121512] ${placement.opensAbove ? '-bottom-1.5 border-b border-r' : '-top-1.5 border-l border-t'}`}
            style={{ left: placement.pointerLeft - 6 }}
          />
        )}

        <div className="relative border-b border-white/[0.07] px-4 pb-3 pt-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300/70">
            {isPast ? 'Past event' : 'Finished event'}
          </p>
          <p className="mt-1 truncate pr-9 text-[15px] font-black tracking-[-0.02em]">{eventName}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-white/42">{eventMeta}</p>
          <button
            ref={initialFocusRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === 'options' ? (
          <div className="space-y-2 p-3">
            <button
              type="button"
              onClick={onOpenEvent}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/70"><Eye className="h-4.5 w-4.5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold">Open event</span><span className="mt-0.5 block text-[10px] text-white/38">View details, team and setlist</span></span>
              <ArrowRight className="h-4 w-4 text-white/30" />
            </button>
            <button
              type="button"
              onClick={() => onModeChange('confirm')}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-emerald-400/[0.08] px-3 text-left transition-colors hover:bg-emerald-400/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/[0.12] text-emerald-300">
                {isPast ? <RotateCcw className="h-4.5 w-4.5" /> : <CheckCircle className="h-4.5 w-4.5" />}
              </span>
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-emerald-200">{lifecycleLabel}</span><span className="mt-0.5 block text-[10px] text-emerald-100/38">Change where this event appears</span></span>
              <ArrowRight className="h-4 w-4 text-emerald-300/40" />
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex gap-3 rounded-2xl bg-emerald-400/[0.07] p-3.5">
              <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <p className="text-[12px] leading-relaxed text-white/60">
                {isPast
                  ? 'Move this event back to Upcoming events?'
                  : 'Confirm this event is finished and move it to Past events. Post-event observations will become available.'}
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => onModeChange('options')} disabled={saving} className="h-11 flex-1 rounded-xl border border-white/[0.09] text-[12px] font-bold text-white/55 transition-colors hover:bg-white/[0.05] disabled:opacity-40">Back</button>
              <button type="button" onClick={onConfirm} disabled={saving} className="h-11 flex-[1.35] rounded-xl bg-emerald-500 text-[12px] font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50">
                {saving ? 'Moving…' : lifecycleLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
