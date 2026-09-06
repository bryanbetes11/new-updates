import { SONG_ROLE_GUIDE } from '../lib/songRoleGuide';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, ChevronDown, ShieldCheck } from 'lucide-react';



export function SetlistBuilderPage({ title, onBack, children, footer }: { title: string; onBack: () => void; children: ReactNode; footer: ReactNode }) {
  const [activeRole, setActiveRole] = useState('Opening');
  const roleColors: Record<string, string> = { Opening: 'bg-sky-100 text-sky-800 dark:bg-sky-300/15 dark:text-sky-200', Praise: 'bg-amber-100 text-amber-800 dark:bg-amber-300/15 dark:text-amber-200', Worship: 'bg-violet-100 text-violet-800 dark:bg-violet-300/15 dark:text-violet-200', Closing: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/15 dark:text-emerald-200' };
  const roleCaptions: Record<string, string> = { Opening: 'Who God is', Praise: 'Celebrate Him', Worship: 'What Christ has done', Closing: 'Our response' };
  const reviewQuestions = [
    'Does it exalt Jesus clearly?',
    'Are its lyrics grounded in Scripture?',
    "Does it proclaim Christ's finished work?",
    "Is its theology sound, free from manipulation, prosperity promises, or earning God's favor?",
    'Could someone new to faith understand the gospel through it?',
  ];
  const heading = useRef<HTMLHeadingElement>(null);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  useEffect(() => {
    const root = document.getElementById('root');
    const previousInert = root?.inert ?? false;
    const overflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    heading.current?.focus();
    return () => { if (root) root.inert = previousInert; document.body.style.overflow = overflow; document.documentElement.style.overflow = htmlOverflow; };
  }, []);
  return createPortal(<main aria-label="Setlist builder" className="setlist-builder-page fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-gray-50 text-gray-900 dark:bg-[#101312] dark:text-white">
    <header className="shrink-0 border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#101312]">
      <div className="mx-auto flex max-w-5xl items-center gap-3"><button type="button" onClick={onBack} aria-label="Back to event" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button><div><h1 ref={heading} tabIndex={-1} className="text-lg font-bold outline-none">{title}</h1><p className="text-xs text-gray-500 dark:text-gray-400">Choose songs, set their roles, then arrange the service.</p></div></div>
    </header>
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-hidden"><div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-4 md:p-6">
      <section aria-label="Song category guide" className="shrink-0 rounded-2xl border border-black/[0.08] bg-white dark:border-white/10 dark:bg-[#181d1b]">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200"><BookOpen className="h-4 w-4" /></span>
          <span className="flex-1"><span className="block text-sm font-bold">Choose with purpose</span><span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">A guide for each part of the service</span></span>
        </div>
        <div className="px-3 pb-3">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-black/20 md:hidden" role="group" aria-label="Song roles">
            {Object.keys(SONG_ROLE_GUIDE).map(role => <button key={role} type="button" aria-pressed={activeRole===role} onClick={()=>setActiveRole(role)} className={`min-h-11 rounded-lg px-1 text-xs font-bold transition-colors ${activeRole===role ? roleColors[role] : 'text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5'}`}>{role}</button>)}
          </div>
          <div className="pt-2.5 md:hidden" aria-live="polite">
            <p className={`mb-2 inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${roleColors[activeRole]}`}>{roleCaptions[activeRole]}</p>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{SONG_ROLE_GUIDE[activeRole]}</p>
          </div>
          <div className="hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4">
            {Object.entries(SONG_ROLE_GUIDE).map(([role, description], index) => (
              <section key={role} className="rounded-xl border border-black/5 bg-gray-50 p-3 dark:border-white/5 dark:bg-black/15">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${roleColors[role]}`}>{index + 1}</span>
                  <h2 className="text-sm font-bold">{role}</h2>
                </div>
                <p className={`mb-2 inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${roleColors[role]}`}>{roleCaptions[role]}</p>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{description}</p>
              </section>
            ))}
          </div>
        <section className="mt-2.5 overflow-hidden rounded-xl border border-emerald-500/15 bg-emerald-50/50 dark:bg-emerald-400/[0.035]">
          <button
            type="button"
            aria-expanded={questionsOpen}
            aria-controls="setlist-song-questions"
            onClick={() => setQuestionsOpen(open => !open)}
            className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-emerald-500/[0.05]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">5 questions before choosing</span>
              <span className="mt-0.5 block text-[11px] font-normal text-gray-500 dark:text-gray-400">A quick lyrics and theology check</span>
            </span>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-300 ease-in-out ${questionsOpen ? 'rotate-180' : ''}`} />
          </button>
          <div
            id="setlist-song-questions"
            aria-hidden={!questionsOpen}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${questionsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="border-t border-emerald-500/15 px-3 pb-3 pt-3">
                <ol className="space-y-1.5 text-sm leading-relaxed">
                  {reviewQuestions.map((question, index) => (
                    <li key={question} className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-gray-200">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-100 text-center text-[11px] font-black text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200">
                        {index + 1}
                      </span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-2.5 rounded-lg bg-emerald-100/70 px-3 py-2.5 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-300/[0.08] dark:text-emerald-100/80">
                  Review the lyrics, prioritize biblical depth over popularity, balance English and Filipino songs, and consider how the set supports the sermon.
                </div>
              </div>
            </div>
          </div>
        </section>
        </div>
      </section>
      <div
        className="no-scrollbar min-h-0 flex-1 overflow-hidden pt-3 md:pt-4"
        onScrollCapture={event => {
          if ((event.target as HTMLElement).dataset.setlistSongScroll === 'true' && questionsOpen) {
            setQuestionsOpen(false);
          }
        }}
      >{children}</div>
    </div></div>
    <footer className="shrink-0 border-t border-black/10 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-[#101312]"><div className="mx-auto flex max-w-5xl flex-row gap-2">{footer}</div></footer>
  </main>, document.body);
}
