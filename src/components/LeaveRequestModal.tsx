import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './Modal';
import { DatePicker } from './DatePicker';

interface LeaveRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LeaveRequestModal({ open, onClose, onSuccess }: LeaveRequestModalProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [leaveType, setLeaveType] = useState<'single' | 'range'>('single');
  const [formDate, setFormDate] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [leavePolicy, setLeavePolicy] = useState({
    approval_required: true,
    reason_required: true,
    allow_date_ranges: true,
    minimum_notice_days: 0,
  });

  useEffect(() => {
    if (!open) return;
    setLeaveType('single');
    setFormDate('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
  }, [open]);

  useEffect(() => {
    if (!open || !profile?.org_id) return;
    let active = true;
    void supabase.from('organization_policy_settings').select('leave_policy').eq('org_id', profile.org_id).maybeSingle().then(({ data }) => {
      if (!active || !data?.leave_policy || typeof data.leave_policy !== 'object' || Array.isArray(data.leave_policy)) return;
      setLeavePolicy(current => ({ ...current, ...(data.leave_policy as Partial<typeof leavePolicy>) }));
    });
    return () => { active = false; };
  }, [open, profile?.org_id]);

  const resetForm = () => {
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

  const handleLeaveTypeChange = (type: 'single' | 'range') => {
    setLeaveType(type);
    setFormDate('');
    setFormStartDate('');
    setFormEndDate('');
  };

  const handleSubmit = async () => {
    if (!user) return;
    const isValid = (!leavePolicy.reason_required || formReason.trim()) && (leaveType === 'single' ? formDate : (formStartDate && formEndDate));
    if (!isValid) return;

    const payload = leaveType === 'single'
      ? {
          user_id: user.id,
          leave_type: 'single' as const,
          unavailable_date: formDate,
          start_date: null,
          end_date: null,
          reason: formReason.trim() || null,
          status: 'pending',
        }
      : {
          user_id: user.id,
          leave_type: 'range' as const,
          unavailable_date: null,
          start_date: formStartDate,
          end_date: formEndDate,
          reason: formReason.trim() || null,
          status: 'pending',
        };

    const { error } = await supabase.from('user_availability').insert(payload);
    if (error) {
      toast('error', error.message.includes('duplicate') ? 'Date already marked' : 'Failed to submit');
      return;
    }
    toast('success', leavePolicy.approval_required ? 'Leave request submitted for approval' : 'Leave request approved automatically');

    resetForm();
    handleClose();
    onSuccess?.();
  };

  const isSubmitDisabled = (leavePolicy.reason_required && !formReason.trim()) || (leaveType === 'single' ? !formDate : (!formStartDate || !formEndDate));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Request Leave / Paalam"
      size="md"
      mobileView="dialog"
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
              disabled={!leavePolicy.allow_date_ranges}
              className={`py-2.5 px-3 rounded-lg font-medium text-sm transition-colors ${
                leaveType === 'range'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-45'
              }`}
            >
              Multiple Dates{!leavePolicy.allow_date_ranges ? ' (disabled)' : ''}
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
            Reason {leavePolicy.reason_required && <span className="text-red-500">*</span>}
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

        <p className="text-xs text-gray-400 dark:text-gray-500">
          {leavePolicy.approval_required ? 'Your leave request will be sent to leaders for approval.' : 'Valid leave requests are approved automatically by your church policy.'}
        </p>

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
            Submit Request
          </button>
        </div>
      </div>
    </Modal>
  );
}
