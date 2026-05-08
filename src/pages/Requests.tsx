import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { UserX, Check, X, Shield, MessageSquare, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PageLoader } from '../components/LoadingSpinner';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
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
      <div className={embedded ? 'p-6' : 'page-container page-bottom-pad'}>
        <div className={embedded ? '' : 'px-4 sm:px-5 lg:px-6 py-5 sm:py-6'}>
          <div className="card p-12 text-center">
            <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Only authorized leaders can manage leave requests.</p>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
    <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-5">
        {!embedded && (
          <div className="flex items-center justify-between animate-fade-in">
            <div>
              <h1 className="page-header">Leave Requests</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Review and respond to member unavailability requests
              </p>
            </div>
            <button onClick={fetchRequests} className="btn-ghost text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {embedded && (
          <div className="flex items-center justify-between animate-fade-in">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Review and respond to member unavailability requests
            </p>
            <button onClick={fetchRequests} className="btn-ghost text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="space-y-3 animate-slide-up">
          {requests.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] p-12 text-center" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <UserX className="h-7 w-7 text-gray-300 dark:text-gray-600" />
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">All Caught Up</h2>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">No pending leave requests.</p>
            </div>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] transition-all duration-200" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start gap-3.5 px-4 py-4">
                  <Avatar src={request.profiles.avatar_url} firstName={request.profiles.first_name} lastName={request.profiles.last_name} size="md" className="shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {request.profiles.first_name} {request.profiles.last_name}
                      </p>
                      {request.is_recurring && request.recurrence_type && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
                          Recurring: {request.recurrence_type}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 font-medium">
                      Unavailable {(() => {
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
                      })()}
                    </p>
                    {request.reason && (
                      <div className="mt-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/[0.03] ring-1 ring-black/[0.04] dark:ring-white/[0.05]">
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          <span className="font-bold text-gray-700 dark:text-gray-300">Reason: </span>{request.reason}
                        </p>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">
                      Submitted {format(parseISO(request.created_at), "MMM d 'at' h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 pb-4">
                  <button
                    onClick={() => openApprovalModal(request, false)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-800/50 transition-all active:scale-[0.98]"
                  >
                    <X className="h-4 w-4" /> Deny
                  </button>
                  <button
                    onClick={() => openApprovalModal(request, true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-800/50 transition-all active:scale-[0.98]"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
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
            <div className="flex justify-end gap-3">
              <button onClick={() => setApprovalModal(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleApproval}
                disabled={saving}
                className={`btn-primary ${approvalModal.approved ? '' : 'bg-red-600 hover:bg-red-700 ring-red-300'}`}
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
      {content}
    </div>
  );
}
