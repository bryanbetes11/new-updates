interface AvatarProps {
  src?: string | null;
  firstName: string;
  lastName?: string | null;
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  xxs: 'h-4 w-4 text-[8px]',
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function Avatar({ src, firstName, lastName, size = 'sm', className = '' }: AvatarProps) {
  const initials = `${firstName[0]}${lastName?.[0] || ''}`;
  const baseClasses = `${sizeClasses[size]} object-cover shrink-0`;
  const roundedClass = className.includes('rounded-') ? '' : 'rounded-full';

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName || ''}`}
        className={`${baseClasses} ${roundedClass} ${className}`}
      />
    );
  }

  return (
    <div className={`flex items-center justify-center ${baseClasses} ${roundedClass} bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold ${className}`}>
      {initials}
    </div>
  );
}
