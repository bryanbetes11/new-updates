import { ArrowRight, Smile } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AndroidAppBanner() {
  return (
    <div className="relative flex items-center gap-3 bg-[#09261b] px-4 py-3 text-white shadow-lg shadow-black/25 lg:mx-[30px] lg:rounded-2xl">
      <Smile aria-hidden="true" className="h-6 w-6 shrink-0 text-emerald-300" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-black">Get the Android app</p>
        <p className="mt-0.5 text-[12px] leading-4 text-white/65">Install ServeSync on your phone.</p>
      </div>
      <Link
        to="/download/android"
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-emerald-400 px-3 text-[12px] font-black text-[#062318] transition hover:bg-emerald-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:rounded-full"
      >
        <span>Get app</span>
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
