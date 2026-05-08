import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-scale-in">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-gray-500 mb-5 ring-1 ring-black/[0.05] dark:ring-white/[0.07]">
        {icon}
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1.5" style={{ letterSpacing: '-0.02em' }}>{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6 leading-relaxed">{description}</p>
      {action}
    </div>
  );
}
