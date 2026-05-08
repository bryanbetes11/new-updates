import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, Trash2, Pencil, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './Modal';
import { DatePicker } from './DatePicker';
import type { UserAvailability } from '../types';

const statusBadge: Record<string, string> = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-red',
};

interface LeaveRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LeaveRequestModal({ open, onClose, onSuccess }: LeaveRequestModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [editingItem, setEditingItem] = useState<UserAvailability | null>(null);
  const [leaveType, setLeaveType] = useState<'single' | 'range'>('single');
  const [formDate, setFormDate] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
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
  };

  useEffect(() => {
    if (open) fetchAvailability();
  }, [open, user]);

  const resetForm = () => {
    setEditingItem(null);
    setLeaveType('single');
    setFormDate('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const openEdit = (item: UserAvailability) => {
    setEditingItem(item);
    const type = item.leave_type || 'single';
    setLeaveType(type);
    if (type === 'single') {
      setFormDate(item.unavailable_date || '');
      setFormStartDate('');
      setFormEndDate('');
    } else {
      setFormDate('');
      setFormStartDate(item.start_date || '');
      setFormEndDate(item.end_date || '');
    }
    setFormReason(item.reason || '');
  };

  const handleLeaveTypeChange = (type: 'single' | 'range') => {
    setLeaveType(type);
    setFormDate('');
    setFormStartDate('');
    setFormEndDate('');
  };

  const handleSubmit = async () => {
    if (!user) return;
    const isValid = formReason.trim() && (leaveType === 'single' ? formDate : (formStartDate && formEndDate));
    if (!isValid) return;

    const payload = leaveType === 'single'
      ? {
          user_id: user.id,
          leave_type: 'single' as const,
          unavailable_date: formDate,
          start_date: null,
          end_date: null,
          reason: formReason,
          status: 'pending',
        }
      : {
          user_id: user.id,
          leave_type: 'range' as const,
          unavailable_date: null,
          start_date: formStartDate,
          end_date: formEndDate,
          reason: formReason,
          status: 'pending',
        };

    if (editingItem) {
      const { error } = await supabase.from('user_availability').update(payload).eq('id', editingItem.id);
      if (error) { toast('error', 'Failed to update leave request'); return; }
      toast('success', 'Leave request updated');
    } else {
      const { error } = await supabase.from('user_availability').insert(payload);
      if (error) {
        toast('error', error.message.includes('duplicate') ? 'Date already marked' : 'Failed to submit');
        return;
      }
      toast('success', 'Leave request submitted for approval');
    }

    resetForm();
    fetchAvailability();
    onSuccess?.();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('user_availability').delete().eq('id', id);
    if (error) { toast('error', 'Failed to withdraw request'); return; }
    toast('success', 'Leave request withdrawn');
    if (editingItem?.id === id) resetForm();
    setAvailability(prev => prev.filter(a => a.id !== id));
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    if (confirmAction.type === 'delete') {
      const { error } = await supabase.from('user_availability').delete().eq('id', confirmAction.id);
      if (error) { toast('error', 'Failed to withdraw leave request'); setActionLoading(false); return; }
      if (editingItem?.id === confirmAction.id) resetForm();
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
    onSuccess?.();
  };

  const isSubmitDisabled = !formReason.trim() || (leaveType === 'single' ? !formDate : (!formStartDate || !formEndDate));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editingItem ? 'Edit Leave Request' : 'Request Leave / Paalam'}
      size="md"
    >
      <div className="space-y-3">
        {/* Leave Type Toggle */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
            Leave Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleLeaveTypeChange('single')}
              className={`py-2.5 px-3 rounded-lg font-medium text-sm transition-colors ${
                leaveType === 'single'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Single Date
            </button>
            <button
              onClick={() => handleLeaveTypeChange('range')}
              className={`py-2.5 px-3 rounded-lg font-medium text-sm transition-colors ${
                leaveType === 'range'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Date Range
            </button>
          </div>
        </div>

        {/* Date Fields */}
        {leaveType === 'single' ? (
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Date
            </label>
            <DatePicker value={formDate} onChange={setFormDate} placeholder="Select date" required />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                Start Date
              </label>
              <DatePicker value={formStartDate} onChange={setFormStartDate} placeholder="Select start date" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                End Date
              </label>
              <DatePicker value={formEndDate} onChange={setFormEndDate} placeholder="Select end date" required />
            </div>
          </>
        )}

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Reason <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formReason}
            onChange={e => setFormReason(e.target.value)}
            className="input-field"
            placeholder="e.g., Vacation, family event"
          />
          <p className="text-[11.5px] text-gray-400 dark:text-gray-500 mt-1.5 leading-snug">
            Be as detailed as possible — this helps the team and leaders plan and understand your request better.
          </p>
        </div>

        {!editingItem && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Your leave request will be sent to leaders for approval.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
          <button onClick={handleClose} className="btn-secondary w-full sm:w-auto">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="btn-primary w-full sm:w-auto"
          >
            {editingItem ? 'Update Request' : 'Submit Request'}
          </button>
        </div>

        {/* Confirm Action Modal */}
        {confirmAction && (
          <Modal
            open={!!confirmAction}
            onClose={() => !actionLoading && setConfirmAction(null)}
            title={confirmAction.type === 'delete' ? 'Withdraw Request' : 'Cancel Approved Request'}
            size="sm"
          >
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
          </Modal>
        )}

        {/* Request History */}
        {availability.length > 0 && (
          <div className="border-t border-black/[0.05] dark:border-white/[0.06] pt-4 mt-2">
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              Your Requests
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {availability.map(avail => {
                const type = avail.leave_type || 'single';
                const displayDate = type === 'single' && avail.unavailable_date
                  ? format(parseISO(avail.unavailable_date), 'MMM d, yyyy')
                  : avail.start_date && avail.end_date
                    ? `${format(parseISO(avail.start_date), 'MMM d')} – ${format(parseISO(avail.end_date), 'MMM d, yyyy')}`
                    : 'Invalid date';

                return (
                  <div
                    key={avail.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl ring-1 ring-black/[0.05] dark:ring-white/[0.06]"
                  >
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{displayDate}</p>
                      {avail.reason && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{avail.reason}</p>
                      )}
                      <span className={`inline-block mt-1 ${statusBadge[avail.status] || 'badge-yellow'}`}>
                        {avail.status}
                      </span>
                    </div>
                    {(avail.status === 'pending' || avail.status === 'approved') && (
                      <div className="flex gap-1 shrink-0">
                        {avail.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => openEdit(avail)}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-white/[0.08] rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                          </button>
                        )}
                        {avail.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ id: avail.id, type: 'delete', displayDate })}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Withdraw"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                          </button>
                        )}
                        {avail.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ id: avail.id, type: 'withdraw', displayDate })}
                            className="p-1.5 hover:bg-amber-100 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                            title="Cancel approved request"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
