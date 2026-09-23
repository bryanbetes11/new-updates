import { appAccessKinds, appKindLabels, accessPlatformLabels, type MemberAppAccess } from '../lib/memberAppAccess';

export function MemberAppAccessBadges({ rows }: { rows: MemberAppAccess[] }) {
  const kinds = appAccessKinds(rows);
  return <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Observed app access">
    {kinds.length ? kinds.map(kind => <span key={kind} className="rounded-lg bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">{appKindLabels[kind]}</span>)
      : <span className="text-[11px] text-gray-500 dark:text-white/45">App access: Not yet detected</span>}
  </div>;
}

export function MemberAppAccessDetails({ rows }: { rows: MemberAppAccess[] }) {
  return <section className="border-t border-gray-100 px-4 py-3 dark:border-white/5">
    <h3 className="text-xs font-bold text-gray-900 dark:text-white">App access</h3>
    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-white/50">Last observed use, not proof an app is still installed. Browser access does not rule out an installed app. Older APKs need an update before they report here.</p>
    {rows.length ? <ul className="mt-3 space-y-2">{rows.map(row => <li key={`${row.app_kind}:${row.platform}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs">
      <span className="font-semibold">{appKindLabels[row.app_kind]} · {accessPlatformLabels[row.platform]}</span>
      <time dateTime={row.last_seen_at} className="text-gray-500 dark:text-white/50">Last seen {new Date(row.last_seen_at).toLocaleString()}</time>
    </li>)}</ul> : <p className="mt-2 text-xs text-gray-500 dark:text-white/50">No access recorded yet. This starts when the member opens a supported app version while signed in.</p>}
  </section>;
}
