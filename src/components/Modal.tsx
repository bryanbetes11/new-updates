import { useCallback, useEffect, useState, type ReactNode } from 'react';
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

function lockBodyScroll() {
  const body = document.body;
  const nextCount = Number(body.getAttribute(MODAL_LOCK_ATTR) || '0') + 1;
  body.setAttribute(MODAL_LOCK_ATTR, String(nextCount));
  body.style.overflow = 'hidden';

  return () => {
    const currentCount = Number(body.getAttribute(MODAL_LOCK_ATTR) || '1');
    const nextCount = Math.max(0, currentCount - 1);

    if (nextCount === 0) {
      body.removeAttribute(MODAL_LOCK_ATTR);
      body.style.overflow = '';
    } else {
      body.setAttribute(MODAL_LOCK_ATTR, String(nextCount));
    }
  };
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

  const requestClose = useCallback(() => {
    if (closing) return;
    onClose();
  }, [closing, onClose]);

  useEffect(() => {
    if (open) {
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
    const handleEsc = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [visible, closeOnEscape, closing]);

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
        className={`relative w-full ${desktopSizes[size]} ${isMobilePage ? 'h-[100dvh] rounded-none sm:h-auto sm:rounded-2xl' : 'rounded-t-[28px] sm:rounded-2xl'} bg-white dark:bg-[#1c1b1e] ring-1 ring-black/[0.06] dark:ring-white/[0.08] ${sheetClass} ${isMobilePage ? 'max-h-[100dvh] sm:max-h-[85vh]' : 'max-h-[92dvh] sm:max-h-[85vh]'} flex flex-col overflow-hidden ${isMobilePage ? '' : 'sm:mx-4'}`}
        style={{
          boxShadow: '0 24px 64px -16px rgba(0,0,0,0.3), 0 8px 24px -8px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
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
          className={`overflow-y-auto overflow-x-hidden flex-1 px-5 py-5 scrollbar-thin overscroll-contain ${bodyClassName}`}
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
