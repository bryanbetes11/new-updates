import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed top-4 left-4 right-4 sm:left-auto sm:top-auto sm:bottom-4 sm:right-4 z-[100] flex flex-col gap-2 sm:max-w-sm">
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              className={`animate-slide-up flex items-start gap-3 rounded-xl p-4 shadow-lg ring-1 ${colors[t.type]}`}
            >
              <Icon className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium flex-1">{t.message}</p>
              <button onClick={() => removeToast(t.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
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
