const EVENT_TYPE_COLORS: Record<string, { lightBg: string; lightText: string; darkBg: string; darkText: string }> = {
  'Sunday Service':  { lightBg: 'rgba(37,99,235,0.10)',  lightText: '#1d4ed8', darkBg: 'rgba(37,99,235,0.18)',  darkText: '#93c5fd' },
  'Prayer Meeting':  { lightBg: 'rgba(124,58,237,0.10)', lightText: '#7c3aed', darkBg: 'rgba(124,58,237,0.18)', darkText: '#c4b5fd' },
  'LGTF (Midweek)': { lightBg: 'rgba(20,184,166,0.10)', lightText: '#0f766e', darkBg: 'rgba(20,184,166,0.18)', darkText: '#5eead4' },
  'Rehearsal':       { lightBg: 'rgba(217,119,6,0.10)',  lightText: '#b45309', darkBg: 'rgba(217,119,6,0.18)',  darkText: '#fcd34d' },
  'Rehearsals':      { lightBg: 'rgba(217,119,6,0.10)',  lightText: '#b45309', darkBg: 'rgba(217,119,6,0.18)',  darkText: '#fcd34d' },
  'Online Devotion': { lightBg: 'rgba(219,39,119,0.10)', lightText: '#be185d', darkBg: 'rgba(219,39,119,0.18)', darkText: '#f9a8d4' },
  'Equipping':       { lightBg: 'rgba(22,163,74,0.10)',  lightText: '#15803d', darkBg: 'rgba(22,163,74,0.18)',  darkText: '#86efac' },
  'Revamp Session':  { lightBg: 'rgba(234,88,12,0.10)',  lightText: '#c2410c', darkBg: 'rgba(234,88,12,0.18)',  darkText: '#fdba74' },
  'Youth Recharge':  { lightBg: 'rgba(225,29,72,0.10)',  lightText: '#be123c', darkBg: 'rgba(225,29,72,0.18)',  darkText: '#fda4af' },
};

export function EventTypeLabel({ type, filled = false }: { type: string; filled?: boolean }) {
  const colors = EVENT_TYPE_COLORS[type];
  const sharedClass = `inline-flex shrink-0 items-center gap-1.5 text-[10px] font-bold ${filled ? 'rounded-full px-2 py-1' : ''}`;

  if (!colors) return (
    <span className={`${sharedClass} ${filled ? 'bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-white/55' : 'text-gray-500 dark:text-white/45'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {type}
    </span>
  );

  return (
    <>
      <span className={`${sharedClass} dark:hidden`} style={{ color: colors.lightText, backgroundColor: filled ? colors.lightBg : undefined }}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {type}
      </span>
      <span className={`${sharedClass} hidden dark:inline-flex`} style={{ color: colors.darkText, backgroundColor: filled ? colors.darkBg : undefined }}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" /> {type}
      </span>
    </>
  );
}
