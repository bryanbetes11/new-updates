import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function AdminPageBackLink() {
  const location = useLocation();

  if (!location.pathname.startsWith('/admin/') || location.pathname === '/admin/settings') {
    return null;
  }

  return (
    <Link
      to="/admin/settings"
      className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200/80 bg-white/70 px-3.5 text-xs font-black text-gray-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-white/[0.08] dark:bg-white/[0.045] dark:text-white/55 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/[0.08] dark:hover:text-emerald-300"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
      Back to Admin Settings
    </Link>
  );
}
