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

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 animate-fade-in">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-400" />
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Loading...</p>
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
    <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 page-bottom-pad space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-7 w-40" />
        <SkeletonBlock className="h-9 w-24 rounded-xl" />
      </div>
      <SkeletonBlock className="h-10 w-full rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] p-5 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <SkeletonBlock className="h-4 w-1/2" />
                <SkeletonBlock className="h-3 w-1/3" />
              </div>
            </div>
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
            <div className="flex gap-2 pt-1">
              <SkeletonBlock className="h-6 w-16 rounded-full" />
              <SkeletonBlock className="h-6 w-16 rounded-full" />
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
