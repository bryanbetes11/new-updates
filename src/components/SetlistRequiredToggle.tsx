export function SetlistRequiredToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 p-3 dark:border-white/10">
    <span>
      <span className="block text-sm font-semibold">Setlist needed</span>
      <span className="mt-1 block text-xs text-gray-500 dark:text-white/50">{checked ? 'Include songs, setlist preparation and review.' : 'No setlist or submission deadline. Existing songs are kept if you turn this back on.'}</span>
    </span>
    <input type="checkbox" role="switch" aria-label="Setlist needed" checked={checked} onChange={e => onChange(e.target.checked)} className="h-6 w-6 shrink-0 accent-green-500" />
  </label>;
}
