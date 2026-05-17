import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaveType, setLeaveType] = useState<'single' | 'range'>('single');
  const [formDate, setFormDate] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setLeaveType('single');
    setFormDate('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
  }, [open]);

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

    const { error } = await supabase.from('user_availability').insert(payload);
    if (error) {
      toast('error', error.message.includes('duplicate') ? 'Date already marked' : 'Failed to submit');
      return;
    }
    toast('success', 'Leave request submitted for approval');

    resetForm();
    handleClose();
    onSuccess?.();
  };

  const isSubmitDisabled = !formReason.trim() || (leaveType === 'single' ? !formDate : (!formStartDate || !formEndDate));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Request Leave / Paalam"
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

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Your leave request will be sent to leaders for approval.
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
