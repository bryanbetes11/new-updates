import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Heart, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLeaveHistoryFilters } from '../lib/leavePlanning';

interface LeaveRequestGuidanceProps {
  userId?: string;
  orgId?: string | null;
  includesSaturday: boolean;
  teamSummary: { approved: number; pending: number; total: number } | null;
  checkingTeamLeave: boolean;
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  onReadyChange: (value: boolean) => void;
}

export function LeaveRequestGuidance({ userId, orgId, includesSaturday, teamSummary, checkingTeamLeave, acknowledged, onAcknowledgedChange, onReadyChange }: LeaveRequestGuidanceProps) {
  const [history, setHistory] = useState<{ recent: number; upcoming: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setHistory(null);
    setError(false);
    onReadyChange(false);
    if (!userId || !orgId) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    const filters = getLeaveHistoryFilters();
    const countRequests = (filter: string) => supabase.from('user_availability')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('user_id', userId)
      .or('request_type.eq.leave,request_type.is.null')
      .in('status', ['pending', 'approved']).or(filter).abortSignal(controller.signal);
    void Promise.all([countRequests(filters.recent), countRequests(filters.upcoming)])
      .then(([recent, upcoming]) => {
        if (!active) return;
        onReadyChange(true);
        if (recent.error || upcoming.error || recent.count === null || upcoming.count === null) setError(true);
        else setHistory({ recent: recent.count, upcoming: upcoming.count });
      }).catch(() => { if (active) { setError(true); onReadyChange(true); } })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [userId, orgId, onReadyChange]);

  return (
    <section aria-label="Before you submit" className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-white text-xs leading-relaxed dark:border-emerald-400/15 dark:from-emerald-500/[0.09] dark:via-white/[0.025] dark:to-white/[0.015]">
      <div className="p-4">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/15"><Heart className="h-4 w-4" /></span>
          <div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300/70">A gentle reminder</p><p className="font-bold text-gray-900 dark:text-white">Before you submit</p></div>
        </div>
        <p className="text-gray-700 dark:text-gray-200">Is this an important commitment you cannot miss or move? Take a moment to consider your serving schedule before sending your request.</p>
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Mahalaga ba at hindi maaaring ipagpaliban? Important personal needs and emergencies matter, too.</p>
      </div>
      {teamSummary && teamSummary.total > 0 && (
        <div className="border-t border-amber-200/70 bg-amber-50/60 px-4 py-3 dark:border-amber-400/15 dark:bg-amber-400/[0.04]">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /><p className="font-bold">A shared date to keep in mind</p></div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold">
            {teamSummary.approved > 0 && <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">{teamSummary.approved} approved</span>}
            {teamSummary.pending > 0 && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">{teamSummary.pending} pending approval</span>}
          </div>
          <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">Other members have requested time away too. If your plans are flexible, consider another date to help keep the team supported.</p>
        </div>
      )}
      {includesSaturday && <div className="flex items-start gap-2 border-t border-emerald-200/60 px-4 py-3 dark:border-white/[0.06]"><CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" /><p className="text-[11px] text-gray-600 dark:text-gray-300"><span className="font-semibold text-gray-800 dark:text-gray-100">Keep Sunday in mind.</span> Saturday leave may affect preparation for Sunday. Sunday is only part of your leave if you select it.</p></div>}
      <div aria-live="polite">
        {error ? <p className="border-t border-amber-200/60 px-4 py-3 text-[11px] text-amber-700 dark:border-white/[0.06] dark:text-amber-300">Your leave history could not be checked. You can still submit your request.</p>
          : !history ? <p className="px-4 pb-3 text-[11px] text-gray-500 dark:text-gray-400">Checking your recent and upcoming requests…</p>
            : history.recent + history.upcoming >= 3 ? (
              <div className="border-t border-amber-200/70 bg-amber-50/60 px-4 py-3 dark:border-amber-400/15 dark:bg-amber-400/[0.04]">
                <p className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200"><History className="h-3.5 w-3.5" /> Your leave plans at a glance</p>
                <div className="my-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-amber-200/60 bg-white/70 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.035]"><span className="text-lg font-bold leading-none text-gray-900 dark:text-white">{history.recent}</span><p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">Ended in the past 90 days</p></div>
                  <div className="rounded-lg border border-amber-200/60 bg-white/70 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.035]"><span className="text-lg font-bold leading-none text-gray-900 dark:text-white">{history.upcoming}</span><p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">Ongoing or upcoming</p></div>
                </div>
                <p className="text-[11px] text-gray-700 dark:text-gray-300">You already have several leave requests. Consider your existing plans and serving commitments before adding another.</p>
                <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">Pending and approved requests only · counts requests, not days away.</p>
              </div>
            ) : null}
      </div>
      <div className="border-t border-emerald-200/70 bg-emerald-50/70 px-4 py-2 dark:border-emerald-400/15 dark:bg-emerald-400/[0.04]">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-xs font-semibold text-gray-800 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60 dark:text-gray-100">
          <input type="checkbox" checked={acknowledged} disabled={checkingTeamLeave || (!history && !error)} onChange={event => onAcknowledgedChange(event.target.checked)} className="h-5 w-5 shrink-0 cursor-pointer rounded border-gray-300 accent-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500" />
          <span>I’ve read and understood these reminders.</span>
        </label>
        {(checkingTeamLeave || (!history && !error)) && <p className="pb-2 text-[10px] text-gray-500 dark:text-gray-400">Finishing the checks above before you acknowledge.</p>}
      </div>
    </section>
  );
}
