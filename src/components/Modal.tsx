import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  hideCloseButton?: boolean;
  hideHeader?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  titleAlign?: 'left' | 'center';
}

const desktopSizes = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
};

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  hideCloseButton = false,
  hideHeader = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  titleAlign = 'left',
}: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setClosing(false);
      setVisible(true);
      document.body.style.overflow = 'hidden';
    } else if (visible) {
      setClosing(true);
      const t = setTimeout(() => {
        setVisible(false);
        setClosing(false);
        document.body.style.overflow = '';
      }, 200);
      return () => clearTimeout(t);
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [visible, onClose, closeOnEscape]);

  if (!visible) return null;

  const backdropClass = closing ? 'animate-fade-out' : 'animate-fade-in';
  const sheetClass = closing
    ? 'animate-slide-sheet-out sm:animate-scale-out'
    : 'animate-slide-sheet sm:animate-scale-in';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      onClick={() => { if (closeOnBackdrop) onClose(); }}
    >
      <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm ${backdropClass}`} />
      <div
        className={`relative w-full ${desktopSizes[size]} rounded-t-[28px] sm:rounded-2xl bg-white dark:bg-[#1c1b1e] ring-1 ring-black/[0.06] dark:ring-white/[0.08] ${sheetClass} max-h-[92dvh] sm:max-h-[85vh] flex flex-col overflow-hidden sm:mx-4`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 24px 64px -16px rgba(0,0,0,0.3), 0 8px 24px -8px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {!hideHeader && (
          <div className="relative flex items-center justify-between px-5 pt-7 pb-4 border-b border-black/[0.05] dark:border-white/[0.06] shrink-0">
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gray-200 dark:bg-gray-700 sm:hidden" />
            <h2
              className={`text-[15px] font-bold text-gray-900 dark:text-white ${titleAlign === 'center' ? 'absolute left-1/2 -translate-x-1/2 text-center' : ''}`}
              style={{ letterSpacing: '-0.02em' }}
            >
              {title}
            </h2>
            {!hideCloseButton && (
              <button
                onClick={onClose}
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
        <div className="overflow-y-auto flex-1 px-5 py-5 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
