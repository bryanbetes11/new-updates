import { splitSetlistGuideNote } from '../lib/setlistGuideNote';

/** Shared presentation for the saved discussion and the revision-request preview. */
export function SetlistGuideNote({ text }: { text: string }) {
  const { note, sections } = splitSetlistGuideNote(text);
  return <div className="space-y-4">
    {note && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-amber-800 dark:text-amber-200">{note}</p>}
    {sections.length > 0 && <section aria-label="Attached setlist guide" className="border-t border-amber-500/20 pt-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Attached setlist guide</h3>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {sections.map((section, index) => <div key={`${section.title}-${index}`} className="rounded-xl border border-amber-500/15 bg-white/60 p-3.5 dark:bg-black/15">
          <h4 className="mb-1.5 text-sm font-bold text-gray-900 dark:text-white/90">{section.title}</h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600 dark:text-white/65">{section.text}</p>
        </div>)}
      </div>
    </section>}
  </div>;
}
