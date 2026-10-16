import { Guitar, Minus, Plus } from 'lucide-react';
import { MAX_CAPO_FRET } from '../lib/personalCapo';

interface GuitarCapoControlProps {
  fret: number;
  isOn: boolean;
  shapesKey: string;
  soundingKey: string;
  disabled: boolean;
  saving: boolean;
  dirty: boolean;
  message: string;
  onChange: (fret: number) => void;
  onToggle: (isOn: boolean) => void;
  onRetry: () => void;
}

export function GuitarCapoControl({ fret, isOn, shapesKey, soundingKey, disabled, saving, dirty, message, onChange, onToggle, onRetry }: GuitarCapoControlProps) {
  const controlClass = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-white/60 dark:hover:bg-white/[0.08]';
  return <section aria-label="Your guitar capo" className="mt-3 border-t border-gray-200/70 pt-3 dark:border-white/[0.07]" onKeyDown={event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') event.stopPropagation();
  }}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-600 dark:text-white/60"><Guitar className="h-4 w-4" aria-hidden="true" />Capo</span>
        {soundingKey && <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-white/45">Band key <span className="font-bold text-gray-700 dark:text-white/75">{soundingKey}</span></p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5 shadow-sm dark:border-white/[0.09] dark:bg-white/[0.045] dark:shadow-none">
          <button type="button" aria-label="Decrease capo fret" disabled={disabled || !isOn || fret === 0} onClick={() => onChange(fret - 1)} className={controlClass}><Minus className="h-4 w-4" /></button>
          <span className={`inline-flex h-11 min-w-[72px] select-none items-center justify-center rounded-full px-3 text-[13px] font-bold ${disabled ? 'opacity-40 ' : ''}${isOn ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'text-gray-600 dark:text-white/45'}`}>
            {fret ? `Fret ${fret}` : 'Off'}
          </span>
          <button type="button" aria-label="Increase capo fret" disabled={disabled || !isOn || fret === MAX_CAPO_FRET} onClick={() => onChange(fret + 1)} className={controlClass}><Plus className="h-4 w-4" /></button>
        </div>
        <button type="button" role="switch" aria-label="Use capo" aria-checked={isOn} disabled={disabled} onClick={() => onToggle(!isOn)} className="inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40"><span className={`inline-flex h-6 w-10 items-center rounded-full p-0.5 transition-colors ${isOn ? 'bg-emerald-600 dark:bg-[#1ed760]' : 'bg-gray-300 dark:bg-white/20'}`}><span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0'}`} /></span></button>
      </div>
    </div>
    <p role="status" className="sr-only">{isOn ? `Capo fret ${fret}. ` : `Capo off.${fret ? ` Fret ${fret} remembered.` : ''} `}{disabled ? 'A signed-in account and chart key are needed to save capo.' : message}{shapesKey && isOn ? ` ${shapesKey} chord shapes sound in ${soundingKey}. Only your guitar view changes.` : ''}</p>
    {dirty && !saving && !disabled && <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] text-gray-500 dark:text-white/45"><span>Couldn’t sync.</span><button type="button" aria-label="Retry capo save" onClick={onRetry} className="min-h-11 rounded-lg px-2 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10">Retry</button></div>}
  </section>;
}
