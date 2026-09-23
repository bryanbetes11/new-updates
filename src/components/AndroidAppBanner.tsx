import { Link } from 'react-router-dom';

function AndroidIcon() {
  return (
    <svg aria-hidden="true" className="mr-1 h-12 w-12 shrink-0 text-emerald-300 sm:mr-0 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="m6.6 5.1-1-1.7a.65.65 0 1 1 1.1-.65l1.1 1.8a8.1 8.1 0 0 1 8.4 0l1.1-1.8a.65.65 0 1 1 1.1.65l-1 1.7A7.7 7.7 0 0 1 20 10H4a7.7 7.7 0 0 1 2.6-4.9ZM8.5 7.7a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3Zm7 0a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3ZM4 11.3h16v6.5a1.5 1.5 0 0 1-1.5 1.5H18V21a1 1 0 1 1-2 0v-1.7H8V21a1 1 0 1 1-2 0v-1.7h-.5A1.5 1.5 0 0 1 4 17.8v-6.5ZM2 11.4a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1Zm20 0a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0v-5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function AndroidAppBanner() {
  return (
    <div className="relative flex items-center gap-2 bg-[#09261b] px-3 py-3 text-white shadow-lg shadow-black/25 sm:gap-3 sm:px-4 lg:mx-[30px] lg:rounded-2xl">
      <AndroidIcon />
      <div className="min-w-0 flex-1">
        <p className="whitespace-nowrap text-[14px] font-black tracking-tight">Android App Available</p>
        <p className="mt-0.5 text-[12px] leading-4 text-white/65">Try our Android app before{' '}<br className="sm:hidden" />its official release.</p>
      </div>
      <Link
        to="/download/android"
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 px-2.5 text-[12px] font-black text-[#062318] transition hover:bg-emerald-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-3 lg:rounded-full"
      >
        <span>Get App</span>
      </Link>
    </div>
  );
}
