import { splitSetlistGuideNote } from '../lib/setlistGuideNote';

/** Shared presentation for the saved discussion and the revision-request preview. */
export function SetlistGuideNote({ text }: { text: string }) {
  const { note, sections } = splitSetlistGuideNote(text);
  return <div className="space-y-3 sm:space-y-4">
    {note && <p className="whitespace-pre-wrap break-words text-[13px] leading-5 text-amber-800 dark:text-amber-200 sm:text-sm sm:leading-relaxed">{note}</p>}
    {sections.length > 0 && <section aria-label="Attached setlist guide" className="border-t border-amber-500/20 pt-3 sm:pt-4">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200 sm:mb-3 sm:text-xs">Attached Setlist Guide</h3>
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
        {sections.map((section, index) => <div key={`${section.title}-${index}`} className="rounded-lg border border-amber-500/15 bg-white/60 p-2.5 dark:bg-black/15 sm:rounded-xl sm:p-3.5">
          <h4 className="mb-1 text-[13px] font-bold text-gray-900 dark:text-white/90 sm:mb-1.5 sm:text-sm">{section.title}</h4>
          <p className="whitespace-pre-wrap break-words text-[13px] leading-5 text-gray-600 dark:text-white/65 sm:text-sm sm:leading-relaxed">{section.text}</p>
        </div>)}
      </div>
    </section>}
  </div>;
}
