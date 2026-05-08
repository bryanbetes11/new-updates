import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Calendar, Trash2, Pencil, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LeaveRequestModal } from '../components/LeaveRequestModal';
import { Modal } from '../components/Modal';
import { PageLoader } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import type { UserAvailability } from '../types';

const statusBadge: Record<string, string> = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
  withdrawn: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-lg text-xs font-semibold',
};

export function RequestLeave() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: 'delete' | 'withdraw'; displayDate: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAvailability = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_availability')
      .select('*')
      .eq('user_id', user.id)
      .order('unavailable_date', { ascending: false });
    setAvailability(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAvailability(); }, [user]);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    if (confirmAction.type === 'delete') {
      const { error } = await supabase.from('user_availability').delete().eq('id', confirmAction.id);
      if (error) { toast('error', 'Failed to withdraw leave request'); setActionLoading(false); return; }
      setAvailability(prev => prev.filter(a => a.id !== confirmAction.id));
      toast('success', 'Leave request withdrawn');
    } else {
      const { error } = await supabase.from('user_availability').update({ status: 'withdrawn' }).eq('id', confirmAction.id);
      if (error) { toast('error', 'Failed to cancel leave request'); setActionLoading(false); return; }
      setAvailability(prev => prev.map(a => a.id === confirmAction.id ? { ...a, status: 'withdrawn' } : a));
      toast('success', 'Leave request cancelled');
    }
    setActionLoading(false);
    setConfirmAction(null);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page-container page-bottom-pad">
      <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-5">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="page-header">Request Leave</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Submit and manage your leave requests</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> New Request
          </button>
        </div>

        {availability.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="No leave requests"
            description="Submit a leave request to let leaders know when you're unavailable."
            action={
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Request Leave
              </button>
            }
          />
        ) : (
          <div className="space-y-3 animate-slide-up">
            {availability.map(a => {
              const displayDate = a.leave_type === 'single' && a.unavailable_date
                ? format(parseISO(a.unavailable_date), 'EEEE, MMMM d, yyyy')
                : a.start_date && a.end_date
                  ? `${format(parseISO(a.start_date), 'MMM d')} – ${format(parseISO(a.end_date), 'MMM d, yyyy')}`
                  : 'Invalid date';

              const dateForIcon = a.leave_type === 'single' && a.unavailable_date
                ? a.unavailable_date
                : a.start_date ?? null;

              return (
                <div key={a.id} className="card p-4 sm:p-5 flex items-center gap-4">
                  {dateForIcon && (
                    <div className="flex flex-col items-center justify-center h-14 w-14 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 shrink-0">
                      <span className="text-xs font-medium leading-none">{format(parseISO(dateForIcon), 'MMM')}</span>
                      <span className="text-xl font-bold leading-none mt-0.5">{format(parseISO(dateForIcon), 'd')}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{displayDate}</p>
                      <span className={statusBadge[a.status] || 'badge-yellow'}>{a.status}</span>
                    </div>
                    {a.reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{a.reason}</p>
                    )}
                  </div>
                  {(a.status === 'pending' || a.status === 'approved') && (
                    <div className="flex items-center gap-1 shrink-0">
                      {a.status === 'pending' && (
                        <button
                          onClick={() => setShowModal(true)}
                          className="p-2 text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                          title="Edit request"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {a.status === 'pending' && (
                        <button
                          onClick={() => setConfirmAction({ id: a.id, type: 'delete', displayDate })}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                          title="Withdraw request"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      {a.status === 'approved' && (
                        <button
                          onClick={() => setConfirmAction({ id: a.id, type: 'withdraw', displayDate })}
                          className="p-2 text-gray-400 hover:text-amber-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                          title="Cancel approved request"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={!!confirmAction}
        onClose={() => !actionLoading && setConfirmAction(null)}
        title={confirmAction?.type === 'delete' ? 'Withdraw Request' : 'Cancel Approved Request'}
        size="sm"
      >
        {confirmAction && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {confirmAction.type === 'delete'
                ? <>Are you sure you want to withdraw your leave request for <span className="font-semibold text-gray-900 dark:text-white">{confirmAction.displayDate}</span>? This will permanently remove the request.</>
                : <>Are you sure you want to cancel your approved leave for <span className="font-semibold text-gray-900 dark:text-white">{confirmAction.displayDate}</span>? Leadership will be notified of the change.</>
              }
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmAction(null)} disabled={actionLoading} className="btn-secondary">Keep it</button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`btn-primary ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700 ring-red-300' : 'bg-amber-600 hover:bg-amber-700 ring-amber-300'}`}
              >
                {actionLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : confirmAction.type === 'delete' ? <Trash2 className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />
                }
                {actionLoading ? 'Processing...' : confirmAction.type === 'delete' ? 'Withdraw' : 'Cancel Request'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <LeaveRequestModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchAvailability}
      />
    </div>
  );
}
