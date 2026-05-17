import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowLeftRight, Calendar, Check, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PageLoader } from '../components/LoadingSpinner';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { LeadershipHeroCard } from '../components/LeadershipHeroCard';
import { formatTime12Hour } from '../lib/timeFormat';
import type { SwapRequest } from '../types';

interface Props {
  embedded?: boolean;
}

export function SwapRequests({ embedded }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState<{ request: SwapRequest; approved: boolean } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('user_availability')
      .select(`
        *,
        requester:user_id(id, first_name, last_name, nickname, avatar_url),
        target:target_id(id, first_name, last_name, nickname, avatar_url),
        requester_assignment:requester_assignment_id(*, events(*), roles(*)),
        target_assignment:target_assignment_id(*, events(*), roles(*))
      `)
      .in('request_type', ['sub', 'swap'])
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    setRequests((data || []) as any[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('swap-requests-leadership')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_availability' }, fetchRequests)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleReview = async () => {
    if (!reviewModal || !user) return;
    setSaving(true);
    try {
      const { request, approved } = reviewModal;

      if (approved) {
        const ops = [
          supabase.from('event_assignments')
            .update({ user_id: request.target_id, status: 'confirmed' })
            .eq('id', request.requester_assignment_id)
        ];
        if (request.request_type === 'swap') {
          ops.push(
            supabase.from('event_assignments')
              .update({ user_id: request.user_id, status: 'confirmed' })
              .eq('id', request.target_assignment_id)
          );
        }
        const results = await Promise.all(ops);
        const firstError = results.find(r => r.error)?.error;
        if (firstError) throw firstError;
      }

      await supabase.from('user_availability').update({
        status: approved ? 'approved' : 'rejected',
        approved_by: user.id,
        approval_notes: reviewNote.trim() || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', request.id);

      const requesterName = request.requester?.nickname || `${request.requester?.first_name} ${request.requester?.last_name}`.trim();
      const targetName = request.target?.nickname || `${request.target?.first_name} ${request.target?.last_name}`.trim();
      const noteSnippet = reviewNote.trim() ? ` Note: ${reviewNote.trim()}` : '';
      const isSub = request.request_type === 'sub';
      const typeLabel = isSub ? 'sub' : 'swap';

      const notifications = approved
        ? [
            { user_id: request.user_id, type: isSub ? 'sub_approved' : 'swap_approved', title: `Schedule ${typeLabel} approved`, body: `Your ${typeLabel} with ${targetName} was approved by leadership.`, data: { url: '/my-assignments', swap_request_id: request.id } },
            { user_id: request.target_id, type: isSub ? 'sub_approved' : 'swap_approved', title: `Schedule ${typeLabel} approved`, body: `Your ${typeLabel} with ${requesterName} was approved by leadership.`, data: { url: '/my-assignments', swap_request_id: request.id } },
          ]
        : [
            { user_id: request.user_id, type: isSub ? 'sub_declined' : 'swap_declined', title: `Schedule ${typeLabel} declined`, body: `Your ${typeLabel} request with ${targetName} was not approved.${noteSnippet}`, data: { url: '/my-assignments', swap_request_id: request.id } },
            { user_id: request.target_id, type: isSub ? 'sub_declined' : 'swap_declined', title: `Schedule ${typeLabel} declined`, body: `The ${typeLabel} request between you and ${requesterName} was not approved.${noteSnippet}`, data: { url: '/my-assignments', swap_request_id: request.id } },
          ];

      await supabase.from('notifications').insert(notifications);

      toast('success', approved ? 'Swap approved — assignments updated!' : 'Swap declined');
      setReviewModal(null);
      setReviewNote('');
      fetchRequests();
    } catch {
      toast('error', 'Failed to process swap request');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !embedded) return <PageLoader />;

  return (
    <div className={embedded ? '' : 'page-container page-bottom-pad'}>
      <div className={embedded ? '' : 'relative max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto pt-4 sm:pt-5 pb-6 px-4 sm:px-6 lg:px-8'}>

        {!embedded && (
          <LeadershipHeroCard
            tone="sky"
            icon={ArrowLeftRight}
            eyebrow="Leadership Flow"
            title="Swap Requests."
            description="Review schedule swaps and approve the handoff only when both assignments are safe to exchange."
          />
        )}

        {loading ? (
          <PageLoader />
        ) : requests.length === 0 ? (
          <div className="rounded-3xl border border-gray-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.025] px-5 py-14 text-center" style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}>
            <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight className="h-5 w-5 text-gray-400 dark:text-white/25" />
            </div>
            <p className="text-[14px] font-medium text-gray-500 dark:text-white/40">No pending swap requests</p>
            <p className="text-[12px] text-gray-400 dark:text-white/25 mt-1">Swaps that both parties agree to will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => {
              const requesterName = req.requester?.nickname || `${req.requester?.first_name} ${req.requester?.last_name}`.trim();
              const targetName = req.target?.nickname || `${req.target?.first_name} ${req.target?.last_name}`.trim();
              return (
                <div
                  key={req.id}
                  className="rounded-3xl border border-gray-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.025] overflow-hidden"
                  style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.06] bg-amber-50/60 dark:bg-amber-500/[0.06]">
                    <ArrowLeftRight className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 dark:text-white">
                        {requesterName} ↔ {targetName}
                      </p>
                      <p className="text-[10px] font-mono text-gray-400 dark:text-white/30 mt-0.5">
                        Requested {format(parseISO(req.created_at), 'MMM d, yyyy')} · Both parties agreed
                      </p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-500/[0.15] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 shrink-0">
                      Awaiting Approval
                    </span>
                  </div>

                  {/* Assignments grid */}
                  <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-white/[0.06]">
                    {[
                      { person: req.requester, assignment: req.requester_assignment, label: requesterName },
                      { person: req.target, assignment: req.target_assignment, label: targetName },
                    ].map(({ person, assignment, label }) => (
                      <div key={label} className="px-4 py-4">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Avatar src={person?.avatar_url} firstName={person?.first_name || '?'} lastName={person?.last_name} size="xs" className="rounded-lg shrink-0" />
                          <span className="text-[11px] font-semibold text-gray-700 dark:text-white/60 truncate">{label}</span>
                        </div>
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate leading-tight" style={{ letterSpacing: '-0.01em' }}>
                          {assignment?.events?.title}
                        </p>
                        <div className="flex flex-col gap-0.5 mt-1.5">
                          {assignment?.events?.event_date && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-white/35 font-mono">
                              <Calendar className="h-3 w-3" />
                              {format(parseISO(assignment.events.event_date), 'EEE, MMM d')}
                            </span>
                          )}
                          {assignment?.events?.start_time && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-white/35 font-mono">
                              <Clock className="h-3 w-3" />
                              {formatTime12Hour(assignment.events.start_time)}
                            </span>
                          )}
                          {assignment?.roles?.name && (
                            <span className="text-[10px] font-semibold text-gray-500 dark:text-white/40 mt-0.5">{assignment.roles.name}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reason */}
                  <div className="px-5 py-3 border-t border-gray-100 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.015]">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-white/25 mb-1">Reason</p>
                    <p className="text-[12px] text-gray-600 dark:text-white/55 leading-relaxed">{req.reason}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 px-5 py-3.5 border-t border-gray-100 dark:border-white/[0.06]">
                    <button
                      onClick={() => { setReviewModal({ request: req, approved: false }); setReviewNote(''); }}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/[0.10] border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/[0.16] transition-colors"
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                    <button
                      onClick={() => { setReviewModal({ request: req, approved: true }); setReviewNote(''); }}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[12px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/[0.10] border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/[0.16] transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve Swap
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review confirmation modal */}
      <Modal
        open={!!reviewModal}
        onClose={() => setReviewModal(null)}
        title={reviewModal?.approved ? 'Approve Swap' : 'Decline Swap'}
        size="sm"
      >
        {reviewModal && (
          <>
            <p className="text-[13px] text-gray-600 dark:text-white/55 mb-4 leading-relaxed">
              {reviewModal.approved
                ? 'This will swap the assignments between both members and notify them. This cannot be undone.'
                : 'Both members will be notified that the swap was not approved.'}
            </p>
            <div className="mb-4">
              <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-white/40 mb-1.5">
                Note for members <span className="text-gray-400 dark:text-white/25 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Add a note…"
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/25 outline-none focus:border-brand-400 dark:focus:border-brand-500 resize-none transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setReviewModal(null)} className="flex-1 btn-secondary" disabled={saving}>Cancel</button>
              <button
                onClick={handleReview}
                disabled={saving}
                className={`flex-1 font-bold py-2 rounded-xl text-[13px] transition-colors disabled:opacity-50 ${
                  reviewModal.approved
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {saving ? 'Processing…' : reviewModal.approved ? 'Approve & Swap' : 'Decline'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
