import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  mobileView?: 'sheet' | 'page';
  hideCloseButton?: boolean;
  hideHeader?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  titleAlign?: 'left' | 'center';
  bodyClassName?: string;
}

const desktopSizes = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
};

const MODAL_LOCK_ATTR = 'data-modal-lock-count';
const MODAL_LOCK_PREVIOUS_STYLES_ATTR = 'data-modal-lock-previous-styles';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const modalStack: HTMLElement[] = [];

interface ScrollLockSnapshot {
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
}

function readScrollLockSnapshot(): ScrollLockSnapshot | null {
  const rawSnapshot = document.body.getAttribute(MODAL_LOCK_PREVIOUS_STYLES_ATTR);
  if (!rawSnapshot) return null;

  try {
    return JSON.parse(rawSnapshot) as ScrollLockSnapshot;
  } catch {
    return null;
  }
}

function writeScrollLockSnapshot(snapshot: ScrollLockSnapshot) {
  document.body.setAttribute(MODAL_LOCK_PREVIOUS_STYLES_ATTR, JSON.stringify(snapshot));
}

function lockBodyScroll() {
  const root = document.documentElement;
  const body = document.body;
  const nextCount = Number(body.getAttribute(MODAL_LOCK_ATTR) || '0') + 1;

  if (nextCount === 1) {
    writeScrollLockSnapshot({
      htmlOverflow: root.style.overflow,
      htmlOverscrollBehavior: root.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
    });
  }

  body.setAttribute(MODAL_LOCK_ATTR, String(nextCount));
  root.style.overflow = 'hidden';
  root.style.overscrollBehavior = 'none';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';

  return () => {
    const currentCount = Number(body.getAttribute(MODAL_LOCK_ATTR) || '1');
    const nextCount = Math.max(0, currentCount - 1);

    if (nextCount === 0) {
      const snapshot = readScrollLockSnapshot();

      body.removeAttribute(MODAL_LOCK_ATTR);
      body.removeAttribute(MODAL_LOCK_PREVIOUS_STYLES_ATTR);

      root.style.overflow = snapshot?.htmlOverflow || '';
      root.style.overscrollBehavior = snapshot?.htmlOverscrollBehavior || '';
      body.style.overflow = snapshot?.bodyOverflow || '';
      body.style.overscrollBehavior = snapshot?.bodyOverscrollBehavior || '';
    } else {
      body.setAttribute(MODAL_LOCK_ATTR, String(nextCount));
    }
  };
}

function isAvailableForFocus(element: HTMLElement) {
  if (element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => element.tabIndex >= 0 && isAvailableForFocus(element),
  );
}

function focusElement(element: HTMLElement) {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function focusInitialElement(dialog: HTMLElement) {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && dialog.contains(activeElement)) return;

  const preferredElement = dialog.querySelector<HTMLElement>(
    '[data-modal-initial-focus], [data-autofocus], [autofocus]',
  );
  const firstFocusableElement = getFocusableElements(dialog)[0];
  const target = preferredElement && isAvailableForFocus(preferredElement)
    ? preferredElement
    : firstFocusableElement || dialog;

  focusElement(target);
}

function isTopmostModal(dialog: HTMLElement) {
  return modalStack[modalStack.length - 1] === dialog;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  mobileView = 'sheet',
  hideCloseButton = false,
  hideHeader = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  titleAlign = 'left',
  bodyClassName = '',
}: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const requestClose = useCallback(() => {
    if (closing) return;
    onClose();
  }, [closing, onClose]);

  useEffect(() => {
    if (open) {
      if (!visible) {
        restoreFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      }
      setClosing(false);
      setVisible(true);
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open, visible]);

  useEffect(() => {
    if (!visible) return;
    return lockBodyScroll();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = restoreFocusRef.current;
    modalStack.push(dialog);

    const animationFrame = window.requestAnimationFrame(() => {
      if (isTopmostModal(dialog)) focusInitialElement(dialog);
    });

    const handleFocusIn = (event: FocusEvent) => {
      if (!isTopmostModal(dialog)) return;
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        focusInitialElement(dialog);
      }
    };

    document.addEventListener('focusin', handleFocusIn);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener('focusin', handleFocusIn);

      const shouldRestoreFocus = isTopmostModal(dialog);
      const stackIndex = modalStack.lastIndexOf(dialog);
      if (stackIndex !== -1) modalStack.splice(stackIndex, 1);

      if (shouldRestoreFocus && previouslyFocused?.isConnected) {
        focusElement(previouslyFocused);
      }
      if (restoreFocusRef.current === previouslyFocused) restoreFocusRef.current = null;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || !isTopmostModal(dialog)) return;

      if (event.key === 'Escape') {
        if (closeOnEscape) requestClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusElement(dialog);
        return;
      }

      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusIsOutsideDialog = !(activeElement instanceof Node) || !dialog.contains(activeElement);

      if (event.shiftKey && (activeElement === firstFocusableElement || activeElement === dialog || focusIsOutsideDialog)) {
        event.preventDefault();
        focusElement(lastFocusableElement);
      } else if (!event.shiftKey && (activeElement === lastFocusableElement || activeElement === dialog || focusIsOutsideDialog)) {
        event.preventDefault();
        focusElement(firstFocusableElement);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, closeOnEscape, requestClose]);

  if (!visible) return null;

  const backdropClass = closing ? 'animate-fade-out' : 'animate-fade-in';
  const isMobilePage = mobileView === 'page';
  const sheetClass = closing
    ? `${isMobilePage ? 'animate-fade-out sm:animate-scale-out' : 'animate-slide-sheet-out sm:animate-scale-out'}`
    : `${isMobilePage ? 'animate-fade-in sm:animate-scale-in' : 'animate-slide-sheet sm:animate-scale-in'}`;

  return createPortal(
    <div
      className={`fixed inset-0 z-[2147483647] flex justify-center ${isMobilePage ? 'items-stretch sm:items-center' : 'items-end sm:items-center'}`}
      onClick={() => { if (closeOnBackdrop) requestClose(); }}
      role="presentation"
    >
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm ${backdropClass}`} />
      <div
        ref={dialogRef}
        className={`relative w-full ${desktopSizes[size]} ${isMobilePage ? 'h-[100dvh] rounded-none sm:h-auto sm:rounded-2xl' : 'rounded-t-[28px] sm:rounded-2xl'} bg-white dark:bg-[#1c1b1e] ring-1 ring-black/[0.06] dark:ring-white/[0.08] ${sheetClass} ${isMobilePage ? 'max-h-[100dvh] sm:max-h-[85vh]' : 'max-h-[92dvh] sm:max-h-[85vh]'} flex flex-col overflow-hidden ${isMobilePage ? '' : 'sm:mx-4'}`}
        style={{
          boxShadow: '0 24px 64px -16px rgba(0,0,0,0.3), 0 8px 24px -8px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={!hideHeader && title ? titleId : undefined}
        aria-label={hideHeader || !title ? title || 'Dialog' : undefined}
        tabIndex={-1}
        data-modal-sheet
      >
        {!hideHeader && (
          <div
            className={`relative flex items-center justify-between px-5 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0 ${titleAlign === 'center' ? 'pt-8 pb-5' : 'pt-7 pb-4'} ${isMobilePage ? 'sm:pt-7 sm:pb-4' : ''}`}
            style={isMobilePage ? { paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' } : undefined}
          >
            {!isMobilePage && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gray-200 dark:bg-gray-700 sm:hidden" />
            )}
            <h2
              id={titleId}
              className={`text-[15px] font-bold text-gray-900 dark:text-white ${titleAlign === 'center' ? 'absolute left-1/2 -translate-x-1/2 text-center' : ''}`}
              style={{ letterSpacing: '-0.02em' }}
            >
              {title}
            </h2>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={requestClose}
                className="p-1.5 -mr-1 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.07] hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        {hideHeader && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gray-200 dark:bg-gray-700 sm:hidden z-10" />
        )}
        <div
          className={`overflow-y-auto overflow-x-hidden flex-1 px-5 py-5 scrollbar-thin overscroll-contain touch-action-pan-y ${bodyClassName}`}
          style={isMobilePage ? { paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' } : undefined}
          data-modal-body
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
