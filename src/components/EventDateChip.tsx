import { format, parseISO } from 'date-fns';

export function EventDateChip({
  date,
  dim = false,
  tone = 'default',
  compact = false,
  mobileLarge = false,
}: {
  date: string;
  dim?: boolean;
  tone?: 'default' | 'warning' | 'danger';
  compact?: boolean;
  mobileLarge?: boolean;
}) {
  const parsed = parseISO(date);

  const surfaceClasses = dim
    ? 'border-black/[0.06] bg-gray-100 dark:border-white/[0.06] dark:bg-[#202020]'
    : 'border-black/[0.08] bg-white dark:border-white/[0.08] dark:bg-[#222222]';

  const monthClasses = dim
    ? 'text-gray-400 dark:text-white/28'
    : tone === 'danger'
    ? 'text-red-500 dark:text-red-300'
    : tone === 'warning'
    ? 'text-amber-600 dark:text-amber-300'
    : 'text-[#1DB954]';

  if (compact) {
    return (
      <div className={`relative flex shrink-0 flex-col items-center justify-center ${mobileLarge ? 'h-20 w-[4.5rem] sm:h-16 sm:w-14' : 'h-16 w-14'}`}>
        <span className={`${mobileLarge ? 'text-[10px] sm:text-[9px]' : 'text-[9px]'} font-black uppercase tracking-widest leading-none ${monthClasses}`}>
          {format(parsed, 'EEE')}
        </span>
        <span className={`mt-0.5 ${mobileLarge ? 'text-[22px] sm:text-[18px]' : 'text-[18px]'} font-black leading-none ${dim ? 'text-gray-500 dark:text-white/58' : 'text-gray-900 dark:text-white'}`}>
          {format(parsed, 'MMM')}
        </span>
        <span className={`${mobileLarge ? 'text-[30px] sm:text-[24px]' : 'text-[24px]'} font-black leading-none ${dim ? 'text-gray-500 dark:text-white/58' : 'text-gray-900 dark:text-white'}`}>
          {format(parsed, 'dd')}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[0.35rem] border ${surfaceClasses}`}>
      <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${monthClasses}`}>
        {format(parsed, 'MMM')}
      </span>
      <span className={`mt-0.5 text-[24px] font-black leading-none ${dim ? 'text-gray-500 dark:text-white/58' : 'text-gray-900 dark:text-white'}`} style={{ letterSpacing: '-0.05em' }}>
        {format(parsed, 'dd')}
      </span>
      <span className={`mt-0.5 text-[8px] font-bold leading-none ${dim ? 'text-gray-400 dark:text-white/24' : 'text-gray-500 dark:text-white/42'}`}>
        {format(parsed, 'EEE')}
      </span>
    </div>
  );
}
