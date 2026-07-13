import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Check, X, Shield, MessageSquare, RefreshCw, ClipboardCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PageLoader } from '../components/LoadingSpinner';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { LeadershipHeroCard } from '../components/LeadershipHeroCard';
import type { Profile } from '../types';

interface UnavailabilityRequest {
  id: string;
  user_id: string;
  unavailable_date: string | null;
  reason: string;
  status: string;
  created_at: string;
  is_recurring: boolean;
  recurrence_type: string | null;
  approval_notes: string | null;
  leave_type: string | null;
  start_date: string | null;
  end_date: string | null;
  profiles: Profile;
}

interface RequestsProps {
  embedded?: boolean;
}

export function Requests({ embedded }: RequestsProps = {}) {
  const { canApproveLeave } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<UnavailabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalModal, setApprovalModal] = useState<{ request: UnavailabilityRequest; approved: boolean } | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('user_availability')
      .select('*, profiles!user_availability_user_id_fkey(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching requests:', error);
    }

    setRequests((data || []) as UnavailabilityRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('user_availability_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_availability' }, fetchRequests)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const openApprovalModal = (request: UnavailabilityRequest, approved: boolean) => {
    setApprovalNotes('');
    setApprovalModal({ request, approved });
  };

  const handleApproval = async () => {
    if (!approvalModal) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('user_availability')
      .update({
        status: approvalModal.approved ? 'approved' : 'rejected',
        approved_by: user.id,
        reviewed_at: new Date().toISOString(),
        approval_notes: approvalNotes || null,
      })
      .eq('id', approvalModal.request.id);

    if (error) {
      toast('error', 'Failed to update request');
      setSaving(false);
      return;
    }

    toast('success', approvalModal.approved ? 'Request approved' : 'Request denied');
    setSaving(false);
    setApprovalModal(null);
    fetchRequests();
  };

  if (loading) return <PageLoader />;

  if (!canApproveLeave) {
    return (
      <div className={embedded ? '' : 'page-container page-bottom-pad'}>
        <div className={embedded ? '' : 'relative max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto pt-4 sm:pt-5 pb-6 px-4 sm:px-6 lg:px-8'}>
          <div className="rounded-3xl border border-gray-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.025] p-12 text-center" style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}>
            <div
              className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(145deg, #94a3b8, #64748b)', boxShadow: '0 4px 14px rgba(100,116,139,0.25)' }}
            >
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>Access Restricted</h2>
            <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Only authorized leaders can manage leave requests.</p>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
    <div className={embedded ? 'space-y-5' : 'space-y-5 sm:space-y-6'}>
        {!embedded && (
          <LeadershipHeroCard
            tone="amber"
            icon={ClipboardCheck}
            eyebrow="Pending Review"
            title="Leave Requests."
            description="Review member leave requests and respond quickly so the team can plan ahead."
            action={(
              <button
                onClick={fetchRequests}
                className="inline-flex items-center justify-center h-11 w-11 rounded-full text-gray-600 dark:text-white/55 bg-white/78 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] hover:bg-white dark:hover:bg-white/[0.08] active:scale-[0.95] transition-colors shrink-0"
                title="Refresh"
                aria-label="Refresh leave requests"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          />
        )}
        {embedded && (
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2.5 px-0.5">
              <span className="text-[10px] font-mono font-semibold tabular-nums text-gray-400/70 dark:text-white/25 tracking-widest">01</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45 flex items-center gap-1.5">
                <ClipboardCheck className="h-3 w-3" /> Pending Requests
              </span>
              {requests.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md bg-amber-50 dark:bg-amber-500/[0.18] text-amber-700 dark:text-amber-400 text-[10px] font-black border border-amber-200 dark:border-amber-500/25">
                  {requests.length}
                </span>
              )}
            </div>
            <button
              onClick={fetchRequests}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.06] bg-white/70 text-gray-500 transition-colors hover:bg-white active:scale-[0.95] dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white/45 dark:hover:bg-white/[0.07]"
              title="Refresh"
              aria-label="Refresh leave requests"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}

        {requests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] p-12 text-center"
            style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
          >
            <div
              className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(145deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}
            >
              <Check className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>All Caught Up</h2>
            <p className="text-sm text-gray-400 dark:text-white/40 mt-1">No pending leave requests.</p>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            className="space-y-2.5"
          >
            {requests.map((request) => (
              <motion.div
                key={request.id}
                variants={{ hidden: { opacity: 0, y: 10, filter: 'blur(4px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } }}
                className="relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] transition-all duration-200"
                style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
              >
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

                <div className="relative flex items-start gap-3.5 px-5 py-4">
                  <Avatar src={request.profiles.avatar_url} firstName={request.profiles.first_name} lastName={request.profiles.last_name} size="md" className="shrink-0 mt-0.5 ring-1 ring-black/[0.06] dark:ring-white/[0.08]" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-[14px] font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.015em' }}>
                        {request.profiles.first_name} {request.profiles.last_name}
                      </p>
                      {request.is_recurring && request.recurrence_type && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25">
                          Recurring: {request.recurrence_type}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-gray-700 dark:text-white/65 mt-1 font-medium">
                      Unavailable <span className="font-bold text-gray-900 dark:text-white">{(() => {
                        if (request.leave_type === 'range' && request.start_date && request.end_date) {
                          const s = parseISO(request.start_date);
                          const e = parseISO(request.end_date);
                          if (format(s, 'MMM yyyy') === format(e, 'MMM yyyy')) {
                            return `${format(s, 'MMM d')}–${format(e, 'd, yyyy')}`;
                          }
                          return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
                        }
                        return request.unavailable_date
                          ? format(parseISO(request.unavailable_date), 'EEEE, MMM d, yyyy')
                          : '—';
                      })()}</span>
                    </p>
                    {request.reason && (
                      <div className="mt-2.5 px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06]">
                        <p className="text-[12px] text-gray-600 dark:text-white/55 leading-relaxed">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/30 block mb-1">Reason</span>
                          {request.reason}
                        </p>
                      </div>
                    )}
                    <p className="text-[11px] font-mono text-gray-400 dark:text-white/30 mt-2 tracking-wide">
                      Submitted {format(parseISO(request.created_at), "MMM d 'at' h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="relative flex items-center gap-2 px-5 pb-4">
                  <button
                    onClick={() => openApprovalModal(request, false)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 text-[12px] font-semibold text-red-700 transition-colors hover:bg-red-100 active:scale-[0.97] dark:border-red-500/25 dark:bg-red-500/[0.12] dark:text-red-300 dark:hover:bg-red-500/[0.18]"
                  >
                    <X className="h-3.5 w-3.5" /> Deny
                  </button>
                  <button
                    onClick={() => openApprovalModal(request, true)}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold text-white transition-all active:scale-[0.97]"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' }}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <Modal
        open={!!approvalModal}
        onClose={() => setApprovalModal(null)}
        title={approvalModal?.approved ? 'Approve Request' : 'Deny Request'}
        size="sm"
      >
        {approvalModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {approvalModal.approved ? 'Approving' : 'Denying'} leave request for{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {approvalModal.request.profiles.first_name} {approvalModal.request.profiles.last_name}
              </span>{' '}
              on {
                approvalModal.request.leave_type === 'range' && approvalModal.request.start_date && approvalModal.request.end_date
                  ? `${format(parseISO(approvalModal.request.start_date), 'MMM d')} – ${format(parseISO(approvalModal.request.end_date), 'MMM d, yyyy')}`
                  : approvalModal.request.unavailable_date
                    ? format(parseISO(approvalModal.request.unavailable_date), 'MMM d, yyyy')
                    : '—'
              }.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Note to member (optional)
                </span>
              </label>
              <textarea
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                className="input-field min-h-[72px] resize-none"
                placeholder={approvalModal.approved ? 'e.g., Thank you for letting us know.' : 'e.g., We need you for this service.'}
                autoFocus
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button onClick={() => setApprovalModal(null)} className="btn-secondary min-h-11 justify-center">Cancel</button>
              <button
                onClick={handleApproval}
                disabled={saving}
                className={`btn-primary min-h-11 justify-center ${approvalModal.approved ? '' : 'bg-red-600 hover:bg-red-700 ring-red-300'}`}
              >
                {saving ? 'Saving...' : approvalModal.approved ? 'Approve' : 'Deny'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );

  if (embedded) return content;

  return (
    <div className="page-container page-bottom-pad">
      <div className="relative max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto pt-4 sm:pt-5 pb-6 px-4 sm:px-6 lg:px-8">
        {content}
      </div>
    </div>
  );
}
