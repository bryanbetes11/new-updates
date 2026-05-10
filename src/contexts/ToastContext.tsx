import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  actionLabel?: string;
  onClick?: () => void;
  leaving?: boolean;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, options?: { actionLabel?: string; onClick?: () => void }) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const icons: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 ring-green-200 dark:ring-green-800',
  error: 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 ring-red-200 dark:ring-red-800',
  warning: 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 ring-amber-200 dark:ring-amber-800',
  info: 'bg-brand-50 dark:bg-brand-900/30 text-brand-800 dark:text-brand-200 ring-brand-200 dark:ring-brand-800',
};

const TOAST_VISIBLE_MS = 6500;
const TOAST_EXIT_MS = 280;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_EXIT_MS);
  }, []);

  const addToast = useCallback((type: ToastType, message: string, options?: { actionLabel?: string; onClick?: () => void }) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message, ...options }]);
    setTimeout(() => {
      removeToast(id);
    }, TOAST_VISIBLE_MS);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div
        className="pointer-events-none fixed left-4 right-4 sm:left-auto sm:top-auto sm:bottom-4 sm:right-4 z-[100] flex flex-col gap-2 sm:max-w-sm"
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        {toasts.map(t => {
          const Icon = icons[t.type];
          const runAction = () => {
            if (!t.onClick) return;
            t.onClick();
            removeToast(t.id);
          };

          return (
            <div
              key={t.id}
              onClick={runAction}
              onKeyDown={(e) => {
                if (!t.onClick || (e.key !== 'Enter' && e.key !== ' ')) return;
                e.preventDefault();
                runAction();
              }}
              className={`pointer-events-auto ${t.leaving ? 'animate-toast-out pointer-events-none' : 'animate-toast-in'} flex items-center gap-3 rounded-full px-4 py-3 ring-1 backdrop-blur-xl ${colors[t.type]} ${t.onClick && !t.leaving ? 'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.01] active:translate-y-0 active:scale-[0.99] transition-transform' : ''}`}
              style={{
                boxShadow:
                  '0 18px 48px rgba(15,23,42,0.22), 0 8px 18px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
              role={t.onClick ? 'button' : undefined}
              tabIndex={t.onClick ? 0 : undefined}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/55 dark:bg-white/[0.08]">
                <Icon className="h-4.5 w-4.5 shrink-0" />
              </div>
              <div className="flex-1 leading-snug">
                <p className="text-sm font-semibold">{t.message}</p>
                {t.actionLabel && <p className="text-[11px] font-bold opacity-75 mt-0.5">{t.actionLabel}</p>}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(t.id);
                }}
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/45 dark:bg-white/[0.06] opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
