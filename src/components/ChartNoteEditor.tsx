import { Lock, Trash2, Users } from 'lucide-react';

interface ChartNoteEditorProps {
  scope: 'self' | 'team';
  label: string;
  text: string;
  fontSize: number;
  saving: boolean;
  hasNote: boolean;
  recoveryAvailable: boolean;
  line?: boolean;
  onScopeChange: (scope: 'self' | 'team') => void;
  onTextChange: (text: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onDiscard: () => void;
}

export function ChartNoteEditor({ scope, label, text, fontSize, saving, hasNote, recoveryAvailable, line = false, onScopeChange, onTextChange, onSave, onDelete, onDiscard }: ChartNoteEditorProps) {
  return <div aria-label={`Edit note for ${label}`} aria-busy={saving} className="mt-2 w-full rounded-2xl border border-gray-200 bg-white p-3 font-sans whitespace-normal shadow-sm dark:border-white/10 dark:bg-[#161c18] dark:shadow-none">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="Note visibility" className="inline-flex rounded-full bg-gray-100 p-1 dark:bg-white/[0.055]">
        {(['self', 'team'] as const).map(value => {
          const Icon = value === 'self' ? Lock : Users;
          return <button key={value} type="button" aria-pressed={scope === value} disabled={saving} onClick={() => onScopeChange(value)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 ${scope === value ? 'bg-white text-emerald-700 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-300 dark:shadow-none' : 'text-gray-500 hover:text-gray-800 dark:text-white/50 dark:hover:text-white/80'}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{value === 'self' ? 'Only me' : 'Team'}</button>;
        })}
      </div>
      <button type="button" aria-label="Clear note draft" disabled={saving || !text} onClick={() => onTextChange('')} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-30 dark:hover:bg-white/[0.06] dark:hover:text-white/75"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
    </div>
    <textarea aria-label={line ? 'Line note text' : 'Section note text'} autoFocus value={text} onChange={event => onTextChange(event.target.value)} disabled={saving} rows={line ? 2 : 3} placeholder="Write a cue or flow note…" className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 leading-relaxed text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 disabled:opacity-60 dark:border-white/[0.08] dark:bg-black/15 dark:text-white/90 dark:placeholder:text-white/30" style={{ fontSize }} />
    {!recoveryAvailable && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">Draft recovery is unavailable. Keep this chart open until your note saves.</p>}
    <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
      {hasNote && <button type="button" disabled={saving} onClick={onDelete} className="mr-auto inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete note</button>}
      <button type="button" disabled={saving} onClick={onDiscard} className="min-h-11 rounded-xl px-3 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-50 dark:text-white/50 dark:hover:bg-white/[0.06]">Discard draft</button>
      <button type="button" disabled={saving || !text.trim()} onClick={onSave} className="min-h-11 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-[#1ed760] dark:text-black dark:hover:bg-emerald-400">{saving ? 'Saving…' : 'Save note'}</button>
    </div>
  </div>;
}
