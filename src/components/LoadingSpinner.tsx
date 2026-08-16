import { useLocation } from 'react-router-dom';

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function LoadingSpinner({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className={`${className} animate-spin rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-400`} />
    </div>
  );
}

type LoaderCopy = {
  eyebrow: string;
  title: string;
  description: string;
  steps: [string, string, string];
};

function getLoaderCopy(pathname: string): LoaderCopy {
  if (pathname === '/dashboard') return {
    eyebrow: 'Opening Home',
    title: 'Preparing your team board.',
    description: 'Gathering your assignments, upcoming events, and ministry updates.',
    steps: ['Checking assignments', 'Loading events', 'Almost ready'],
  };
  if (pathname.startsWith('/events/')) return {
    eyebrow: 'Opening Event',
    title: 'Preparing the event workspace.',
    description: 'Bringing together the schedule, assignments, setlist, and team details.',
    steps: ['Loading event', 'Syncing the team', 'Opening workspace'],
  };
  if (pathname === '/events') return {
    eyebrow: 'Opening Events',
    title: 'Lining up the calendar.',
    description: 'Gathering services, meetings, assignments, and upcoming ministry dates.',
    steps: ['Loading events', 'Checking schedules', 'Almost ready'],
  };
  if (pathname.startsWith('/announcements/')) return {
    eyebrow: 'Opening News',
    title: 'Preparing this update.',
    description: 'Loading the announcement, reactions, and team conversation.',
    steps: ['Loading update', 'Checking replies', 'Almost ready'],
  };
  if (pathname === '/announcements') return {
    eyebrow: 'Opening News',
    title: 'Gathering the latest updates.',
    description: 'Bringing together announcements, urgent notices, and team responses.',
    steps: ['Loading updates', 'Checking unread news', 'Almost ready'],
  };
  if (['/library', '/songs', '/sets', '/videos'].some(path => pathname.startsWith(path))) return {
    eyebrow: 'Opening Library',
    title: 'Preparing your ministry resources.',
    description: 'Gathering songs, setlists, videos, and the latest library changes.',
    steps: ['Loading resources', 'Syncing the library', 'Almost ready'],
  };
  if (pathname.startsWith('/messages')) return {
    eyebrow: 'Opening Chat',
    title: 'Bringing your conversations together.',
    description: 'Loading team messages, recent replies, and conversation details.',
    steps: ['Loading messages', 'Checking replies', 'Almost ready'],
  };
  if (pathname === '/profile') return {
    eyebrow: 'Opening Profile',
    title: 'Preparing your ministry profile.',
    description: 'Loading your roles, activity, availability, and account details.',
    steps: ['Loading profile', 'Checking roles', 'Almost ready'],
  };
  if (pathname === '/notifications') return {
    eyebrow: 'Opening Notifications',
    title: 'Checking what needs your attention.',
    description: 'Gathering recent alerts, reminders, and ministry updates.',
    steps: ['Loading alerts', 'Checking unread items', 'Almost ready'],
  };
  if (pathname === '/my-assignments') return {
    eyebrow: 'Opening Assignments',
    title: 'Preparing your serving schedule.',
    description: 'Gathering assigned events, roles, and upcoming responsibilities.',
    steps: ['Loading assignments', 'Checking events', 'Almost ready'],
  };
  if (pathname === '/leadership/accountability') return {
    eyebrow: 'Opening Accountability',
    title: 'Reviewing ministry accountability.',
    description: 'Gathering attendance, offense levels, and open conduct records.',
    steps: ['Loading attendance', 'Checking records', 'Almost ready'],
  };
  if (pathname === '/leadership/team') return {
    eyebrow: 'Opening Team Roster',
    title: 'Gathering your ministry team.',
    description: 'Loading members, roles, access, and current ministry status.',
    steps: ['Loading members', 'Checking roles', 'Almost ready'],
  };
  if (pathname === '/leadership/setlists') return {
    eyebrow: 'Opening Setlist Queue',
    title: 'Preparing setlists for review.',
    description: 'Gathering submitted proposals, deadlines, and event details.',
    steps: ['Loading proposals', 'Checking deadlines', 'Almost ready'],
  };
  if (pathname === '/leadership/notifications') return {
    eyebrow: 'Opening Notification Settings',
    title: 'Preparing team notification controls.',
    description: 'Loading delivery settings, subscriptions, and member readiness.',
    steps: ['Loading settings', 'Checking subscriptions', 'Almost ready'],
  };
  if (pathname === '/leadership/surveys' || pathname === '/reflection') return {
    eyebrow: 'Opening Reflections',
    title: 'Preparing ministry reflections.',
    description: 'Loading campaigns, participation, responses, and results.',
    steps: ['Loading campaign', 'Checking responses', 'Almost ready'],
  };
  if (['/leadership/leave', '/leadership/swaps', '/request-leave', '/unavailable-members'].includes(pathname)) return {
    eyebrow: 'Opening Team Requests',
    title: 'Checking availability and requests.',
    description: 'Gathering leave, swaps, availability, and upcoming team changes.',
    steps: ['Loading requests', 'Checking availability', 'Almost ready'],
  };
  if (pathname.startsWith('/leadership')) return {
    eyebrow: 'Opening Leadership',
    title: 'Preparing the ministry overview.',
    description: 'Gathering team health, current queues, and leadership updates.',
    steps: ['Loading ministry health', 'Checking queues', 'Almost ready'],
  };
  return {
    eyebrow: 'ServeSync is opening',
    title: 'Warming up the team board.',
    description: 'Gathering schedules, messages, and setlists so your ministry team lands in the right place.',
    steps: ['Checking your session', 'Syncing updates', 'Almost ready'],
  };
}

export function PageLoader() {
  const { pathname } = useLocation();
  const copy = getLoaderCopy(pathname);

  return (
    <div className="page-loader-shell relative isolate -mx-4 flex items-center justify-center overflow-hidden bg-[#f5f5f7] px-6 py-10 text-gray-950 animate-fade-in dark:bg-[#050806] dark:text-white sm:-mx-6 lg:-mx-8" aria-live="polite" aria-busy="true">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_28%,rgba(34,197,94,0.22),transparent_34%),linear-gradient(180deg,#f7fff9_0%,#f4f5f7_52%,#eefbf3_100%)] dark:bg-[radial-gradient(circle_at_50%_25%,rgba(34,197,94,0.22),transparent_32%),radial-gradient(circle_at_50%_84%,rgba(16,185,129,0.12),transparent_36%),linear-gradient(180deg,#050806_0%,#09120c_55%,#030504_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-20 bg-gradient-to-b from-[#f5f5f7] via-[#f5f5f7]/70 to-transparent dark:from-[#141414] dark:via-[#141414]/45" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-0 w-24 bg-gradient-to-r from-[#f5f5f7] via-[#f5f5f7]/55 to-transparent dark:from-[#141414] dark:via-[#141414]/35" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-0 w-24 bg-gradient-to-l from-[#f5f5f7] via-[#f5f5f7]/55 to-transparent dark:from-[#141414] dark:via-[#141414]/35" />
      <div className="absolute left-1/2 top-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/10 bg-white/30 blur-3xl dark:bg-emerald-400/[0.04]" />
      <div className="absolute left-[12%] top-[18%] h-24 w-24 rounded-full bg-emerald-300/20 blur-2xl animate-bob" />
      <div className="absolute bottom-[16%] right-[14%] h-32 w-32 rounded-full bg-lime-200/30 blur-3xl animate-bob-delayed dark:bg-emerald-500/10" />

      <div className="relative w-full max-w-[27rem] text-center">
        <div className="relative mx-auto mb-8 flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
          <div className="absolute inset-0 rounded-full border border-emerald-500/15 dark:border-white/10" />
          <div className="absolute inset-4 rounded-full border border-dashed border-emerald-500/20 animate-[spin_14s_linear_infinite] dark:border-emerald-300/20" />
          <div className="absolute inset-8 rounded-[2rem] bg-emerald-400/10 blur-2xl dark:bg-emerald-300/10" />
          <div className="absolute -right-1 top-10 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_20px_rgba(74,222,128,0.9)] animate-pulse" />
          <div className="absolute bottom-10 left-0 h-2 w-2 rounded-full bg-emerald-300/80 shadow-[0_0_16px_rgba(134,239,172,0.75)] animate-pulse" style={{ animationDelay: '0.8s' }} />
          <img
            src="/generated/servesync-mark-dark.png"
            alt="ServeSync"
            className="relative h-28 w-28 object-contain drop-shadow-[0_16px_28px_rgba(15,23,42,0.2)] dark:hidden sm:h-32 sm:w-32"
          />
          <img
            src="/generated/servesync-mark-light.png"
            alt=""
            aria-hidden="true"
            className="relative hidden h-28 w-28 object-contain drop-shadow-[0_0_30px_rgba(74,222,128,0.22)] dark:block sm:h-32 sm:w-32"
          />
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-mono font-bold uppercase tracking-[0.34em] text-emerald-600 dark:text-emerald-300/80">
            {copy.eyebrow}
          </p>
          <h1 className="text-3xl font-black tracking-[-0.055em] text-gray-950 dark:text-white sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-6 text-gray-500 dark:text-white/45">
            {copy.description}
          </p>
        </div>

        <div className="mx-auto mt-7 flex max-w-sm flex-wrap items-center justify-center gap-2">
          {copy.steps.map((label, index) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-gray-600 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.05] dark:text-white/55"
              style={{ animation: `shimmerPulse 1.8s ease-in-out ${index * 0.28}s infinite` }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.75)]" />
              {label}
            </span>
          ))}
        </div>

        <div className="mx-auto mt-8 h-1.5 max-w-[13rem] overflow-hidden rounded-full bg-emerald-950/10 dark:bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-emerald-300 via-emerald-500 to-lime-300 animate-[loader-drift_1.45s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] p-4 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-3.5 w-2/3" />
          <SkeletonBlock className="h-3 w-1/3" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 page-bottom-pad space-y-6 animate-fade-in">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-48" />
        <SkeletonBlock className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] p-4 space-y-2.5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <SkeletonBlock className="h-8 w-8 rounded-xl" />
            <SkeletonBlock className="h-6 w-12" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <SkeletonBlock className="h-5 w-32" />
        <ListSkeleton count={3} />
      </div>
    </div>
  );
}

export function EventsSkeleton() {
  return (
    <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 page-bottom-pad space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-7 w-24" />
        <SkeletonBlock className="h-9 w-28 rounded-xl" />
      </div>
      <SkeletonBlock className="h-10 w-full rounded-xl" />
      <SkeletonBlock className="h-11 w-full rounded-2xl" />
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-start gap-3">
              <SkeletonBlock className="h-12 w-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-3 w-1/2" />
                <SkeletonBlock className="h-3 w-2/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnnouncementsSkeleton() {
  return (
    <div className="app-content-shell page-bottom-pad space-y-4 pb-6 pt-4 sm:pt-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-hidden">
          {['w-[4.5rem]', 'w-24', 'w-[5.75rem]', 'w-[5.5rem]'].map(widthClass => (
            <SkeletonBlock key={widthClass} className={`h-11 shrink-0 rounded-full ${widthClass}`} />
          ))}
        </div>
        <SkeletonBlock className="h-11 w-full shrink-0 rounded-full sm:w-36" />
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-lg border border-gray-200/70 bg-white p-2.5 dark:border-white/[0.075] dark:bg-[#101010] sm:p-3 lg:min-h-[5.5rem] lg:pr-[18.5rem]">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <SkeletonBlock className="h-[3.25rem] w-[3.25rem] shrink-0 rounded-md sm:h-16 sm:w-16" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className={`h-3 rounded-full ${i === 2 ? 'w-16' : 'w-11'}`} />
                <SkeletonBlock className={`h-[1.125rem] rounded-lg ${i % 2 === 0 ? 'w-3/5' : 'w-2/5'}`} />
                <SkeletonBlock className="h-3 w-4/5 rounded-lg" />
                <div className="flex items-center gap-2 pt-0.5">
                  <SkeletonBlock className="h-5 w-5 shrink-0 rounded-full" />
                  <SkeletonBlock className="h-3 w-16 rounded-full" />
                  <SkeletonBlock className="h-3 w-10 rounded-full" />
                </div>
              </div>
              <SkeletonBlock className="hidden h-9 w-9 shrink-0 rounded-full sm:block" />
            </div>
            <div className="ml-[4rem] mt-1.5 flex items-center gap-2 sm:ml-[5rem] lg:absolute lg:right-3 lg:top-1/2 lg:ml-0 lg:mt-0 lg:-translate-y-1/2">
              <SkeletonBlock className="h-11 w-11 rounded-full sm:h-9 sm:w-9" />
              <div className="flex-1" />
              <SkeletonBlock className="h-11 w-12 rounded-full sm:h-9" />
              <SkeletonBlock className="h-11 w-16 rounded-full sm:h-9" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 page-bottom-pad space-y-2 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBlock className="h-7 w-32" />
        <SkeletonBlock className="h-8 w-24 rounded-xl" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <SkeletonBlock className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3.5 w-3/4" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
          <SkeletonBlock className="h-2 w-2 rounded-full shrink-0 mt-2" />
        </div>
      ))}
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 page-bottom-pad space-y-4 animate-fade-in">
      <SkeletonBlock className="h-11 w-full rounded-2xl" />
      <SkeletonBlock className="h-10 w-full rounded-xl" />
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] px-4 py-3 flex items-center gap-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <SkeletonBlock className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-3.5 w-1/2" />
              <SkeletonBlock className="h-3 w-1/3" />
            </div>
            <SkeletonBlock className="h-7 w-7 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
