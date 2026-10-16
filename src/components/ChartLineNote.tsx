import { Lock, Pencil, Users } from 'lucide-react';

export function ChartLineNote({ text, scope, fontSize, onEdit, label, section = false }: {
  text: string;
  scope: 'self' | 'team';
  fontSize: number;
  onEdit: () => void;
  label?: string;
  section?: boolean;
}) {
  const Icon = scope === 'self' ? Lock : Users;
  return (
    <button type="button" onClick={onEdit} data-chart-note-scope={scope}
      aria-label={`Edit ${scope === 'self' ? 'private' : 'team'} note${label ? ` for ${label}` : ''}: ${text}`}
      className={`group/note ${section ? 'w-full' : 'w-fit'} min-h-11 max-w-full rounded-xl border px-3 py-2 text-left font-sans leading-relaxed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${scope === 'self'
        ? 'border-sky-200/70 bg-sky-50/70 text-gray-800 hover:bg-sky-100/70 dark:border-sky-400/15 dark:bg-sky-400/[0.055] dark:text-white/85 dark:hover:bg-sky-400/10'
        : 'border-emerald-200/70 bg-emerald-50/70 text-gray-800 hover:bg-emerald-100/70 dark:border-emerald-400/15 dark:bg-emerald-400/[0.055] dark:text-white/85 dark:hover:bg-emerald-400/10'}`}>
      <span className={`mb-1 flex items-center gap-1.5 whitespace-normal text-[10px] font-semibold ${scope === 'self' ? 'text-sky-700 dark:text-sky-300/80' : 'text-emerald-700 dark:text-emerald-300/80'}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />{scope === 'self' ? 'Only me' : 'Team'}
        <Pencil className="ml-auto h-3 w-3 opacity-40 group-hover/note:opacity-80" aria-hidden="true" />
      </span>
      <span className="block whitespace-pre-wrap break-words" style={{ fontSize }}>{text}</span>
    </button>
  );
}
