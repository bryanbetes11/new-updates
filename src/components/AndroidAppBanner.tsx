import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

function AndroidIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6 shrink-0 text-emerald-300" viewBox="0 0 24 24" fill="currentColor">
      <path d="m6.6 5.1-1-1.7a.65.65 0 1 1 1.1-.65l1.1 1.8a8.1 8.1 0 0 1 8.4 0l1.1-1.8a.65.65 0 1 1 1.1.65l-1 1.7A7.7 7.7 0 0 1 20 10H4a7.7 7.7 0 0 1 2.6-4.9ZM8.5 7.7a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3Zm7 0a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3ZM4 11.3h16v6.5a1.5 1.5 0 0 1-1.5 1.5H18V21a1 1 0 1 1-2 0v-1.7H8V21a1 1 0 1 1-2 0v-1.7h-.5A1.5 1.5 0 0 1 4 17.8v-6.5ZM2 11.4a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1Zm20 0a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function AndroidAppBanner() {
  return (
    <div className="relative flex items-center gap-3 bg-[#09261b] px-4 py-3 text-white shadow-lg shadow-black/25 lg:mx-[30px] lg:rounded-2xl">
      <AndroidIcon />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-black">Try the Android app early</p>
        <p className="mt-0.5 text-[12px] leading-4 text-white/65">Not the PWA; not on Play Store yet.</p>
      </div>
      <Link
        to="/download/android"
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-emerald-400 px-3 text-[12px] font-black text-[#062318] transition hover:bg-emerald-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:rounded-full"
      >
        <span>Get APK</span>
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
