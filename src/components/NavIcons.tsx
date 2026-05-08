interface IconProps {
  active?: boolean;
  className?: string;
}

const size = 22;

export function HomeIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12.707 2.293a1 1 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13h1v7a2 2 0 0 0 2 2h4v-5a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5h4a2 2 0 0 0 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 21v-5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v5" />
      <path d="M3 12l9-9 9 9" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

export function CalendarIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <path fill="currentColor" d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v2H3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Z" />
        <path fill="currentColor" d="M3 11h18v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-8Z" opacity="0.85" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="white" strokeWidth="1.5" opacity="0.4" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function NewsIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" />
        <rect x="6" y="6.5" width="5" height="4.5" rx="0.75" fill="white" />
        <line x1="14" y1="7.5" x2="18" y2="7.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="14" y1="10.5" x2="18" y2="10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="14.5" x2="18" y2="14.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="17.5" x2="14" y2="17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 7h4v4H7zM15 7h2M15 11h2M7 15h10" />
    </svg>
  );
}

export function MediaIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <rect x="2" y="4" width="20" height="16" rx="2" fill="currentColor" />
        <path d="M10 8.5v7l5.5-3.5L10 8.5Z" fill="white" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m10 9 5 3.25L10 15.5V9Z" />
    </svg>
  );
}

export function UserIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <circle cx="12" cy="8" r="4" />
        <path d="M5.34 19.67A7.97 7.97 0 0 1 12 16a7.97 7.97 0 0 1 6.66 3.67A1 1 0 0 1 17.82 21H6.18a1 1 0 0 1-.84-1.33Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
    </svg>
  );
}

export function TeamIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <circle cx="9" cy="7" r="3.5" />
        <path d="M2.34 18.67A6.97 6.97 0 0 1 9 15a6.97 6.97 0 0 1 6.66 3.67A1 1 0 0 1 14.82 20H3.18a1 1 0 0 1-.84-1.33Z" />
        <circle cx="18" cy="8" r="2.5" />
        <path d="M16 16.5a4.97 4.97 0 0 1 5 4v.5h-3.82" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="7" r="3.5" />
      <path d="M3 21v-1a5 5 0 0 1 10 0v1" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M15 15a4 4 0 0 1 6 3.5V21" />
    </svg>
  );
}

export function MoreIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

export function LeaveIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <rect x="3" y="4" width="18" height="18" rx="2" fill="currentColor" />
        <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3 10h18" stroke="white" strokeWidth="1.5" opacity="0.4" />
        <path d="M9 15l2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M9 15l2 2 4-4" />
    </svg>
  );
}

export function RequestsIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <circle cx="9" cy="9" r="7" fill="currentColor" />
        <path d="M9 6v3l2 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 17l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="9" r="7" />
      <path d="M9 6v3l2 1.5" />
      <path d="M17 17l5 5" />
    </svg>
  );
}

export function MessageIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M20 2H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h3l3 3 3-3h7a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z" />
        <path d="M8 9.5h8M8 13.5h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9.5h8M8 13.5h5" />
    </svg>
  );
}

export function ShieldNavIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2Z" />
        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function BellIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2a7 7 0 0 1 7 7v3.586l1.707 1.707A1 1 0 0 1 20 16H4a1 1 0 0 1-.707-1.707L5 12.586V9a7 7 0 0 1 7-7Z" />
        <path d="M10 18a2 2 0 1 0 4 0H10Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 10a6 6 0 0 1 12 0v3.586l1.707 1.707A1 1 0 0 1 19 17H5a1 1 0 0 1-.707-1.707L6 13.586V10Z" />
      <path d="M10 18a2 2 0 1 0 4 0" />
    </svg>
  );
}
