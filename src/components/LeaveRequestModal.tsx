import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CalendarDays, Loader2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './Modal';
import { DatePicker } from './DatePicker';
import { useRecoverableDraft } from '../hooks/useRecoverableDraft';
import { draftRecoveryKey } from '../lib/draftRecovery';

const emptyLeaveDraft = { leaveType: 'single' as 'single' | 'range', formDate: '', formStartDate: '', formEndDate: '', formReason: '' };
function isLeaveDraft(value: unknown): value is typeof emptyLeaveDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as typeof emptyLeaveDraft;
  return ['single', 'range'].includes(draft.leaveType) && [draft.formDate, draft.formStartDate, draft.formEndDate, draft.formReason].every(value => typeof value === 'string');
}

interface TeamLeaveProfile {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface TeamLeaveOverlap {
  id: string;
  user_id: string;
  leave_type: 'single' | 'range';
  unavailable_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'pending' | 'approved';
  profiles: TeamLeaveProfile | null;
}

function formatTeamLeaveDate(leave: TeamLeaveOverlap) {
  if (leave.leave_type === 'range' && leave.start_date && leave.end_date) {
    const start = parseISO(leave.start_date);
    const end = parseISO(leave.end_date);
    return format(start, 'MMM yyyy') === format(end, 'MMM yyyy')
      ? `${format(start, 'MMM d')}–${format(end, 'd, yyyy')}`
      : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }

  return leave.unavailable_date
    ? format(parseISO(leave.unavailable_date), 'EEEE, MMM d, yyyy')
    : 'Date unavailable';
}

interface LeaveRequestModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LeaveRequestModal({ open, onClose, onSuccess }: LeaveRequestModalProps) {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const { toast } = useToast();
  const [draft, setDraft, recovery] = useRecoverableDraft(draftRecoveryKey('leave', profile?.org_id, userId), emptyLeaveDraft, isLeaveDraft);
  const { leaveType, formDate, formStartDate, formEndDate, formReason } = draft;
  const setLeaveType = (leaveType: 'single' | 'range') => setDraft(current => ({ ...current, leaveType }));
  const setFormDate = (formDate: string) => setDraft(current => ({ ...current, formDate }));
  const setFormStartDate = (formStartDate: string) => setDraft(current => ({ ...current, formStartDate }));
  const setFormEndDate = (formEndDate: string) => setDraft(current => ({ ...current, formEndDate }));
  const setFormReason = (formReason: string) => setDraft(current => ({ ...current, formReason }));
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [teamLeaveOverlaps, setTeamLeaveOverlaps] = useState<TeamLeaveOverlap[]>([]);
  const [teamLeaveLoading, setTeamLeaveLoading] = useState(false);
  const [teamLeaveError, setTeamLeaveError] = useState(false);
  const [leavePolicy, setLeavePolicy] = useState({
    approval_required: true,
    reason_required: true,
    allow_date_ranges: true,
    minimum_notice_days: 0,
  });

  useEffect(() => {
    if (!open) return;
    setTeamLeaveOverlaps([]);
    setTeamLeaveError(false);
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

  const selectedStartDate = leaveType === 'single' ? formDate : formStartDate;
  const selectedEndDate = leaveType === 'single' ? formDate : formEndDate;
  const hasCompleteDateSelection = Boolean(selectedStartDate && selectedEndDate);
  const hasInvalidDateRange = Boolean(
    leaveType === 'range'
    && formStartDate
    && formEndDate
    && formEndDate < formStartDate,
  );

  useEffect(() => {
    if (!open || !userId || !profile?.org_id || !hasCompleteDateSelection || hasInvalidDateRange) {
      setTeamLeaveOverlaps([]);
      setTeamLeaveLoading(false);
      setTeamLeaveError(false);
      return;
    }

    let active = true;
    setTeamLeaveLoading(true);
    setTeamLeaveError(false);

    void supabase
      .from('user_availability')
      .select('id,user_id,leave_type,unavailable_date,start_date,end_date,status,profiles!user_availability_user_id_fkey(first_name,last_name,avatar_url)')
      .in('status', ['pending', 'approved'])
      .neq('user_id', userId)
      .or(`and(unavailable_date.gte.${selectedStartDate},unavailable_date.lte.${selectedEndDate}),and(start_date.lte.${selectedEndDate},end_date.gte.${selectedStartDate})`)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setTeamLeaveOverlaps([]);
          setTeamLeaveError(true);
        } else {
          const overlaps = (data || []) as unknown as TeamLeaveOverlap[];
          setTeamLeaveOverlaps(overlaps.sort((a, b) => {
            const aDate = a.leave_type === 'range' ? a.start_date : a.unavailable_date;
            const bDate = b.leave_type === 'range' ? b.start_date : b.unavailable_date;
            return String(aDate || '').localeCompare(String(bDate || ''));
          }));
        }
        setTeamLeaveLoading(false);
      });

    return () => { active = false; };
  }, [
    hasCompleteDateSelection,
    hasInvalidDateRange,
    open,
    profile?.org_id,
    selectedEndDate,
    selectedStartDate,
    userId,
  ]);

  const resetForm = () => {
    recovery.discard();
  };

  const handleClose = () => {
    if (submittingRef.current) return;
    onClose();
  };

  const handleLeaveTypeChange = (type: 'single' | 'range') => {
    setLeaveType(type);
  };

  const handleSubmit = async () => {
    if (!user || submittingRef.current || hasInvalidDateRange) return;
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

    submittingRef.current = true;
    setSubmitting(true);
    try {
    const { error } = await supabase.from('user_availability').insert(payload);
    if (error) {
      toast('error', error.message.includes('duplicate') ? 'Date already marked' : 'Failed to submit');
      return;
    }
    toast('success', leavePolicy.approval_required ? 'Leave request submitted for approval' : 'Leave request approved automatically');

    resetForm();
    onClose();
    onSuccess?.();
    } catch {
      toast('error', 'Could not submit. Your leave draft has been kept.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = submitting || (leavePolicy.reason_required && !formReason.trim())
    || (leaveType === 'single' ? !formDate : (!formStartDate || !formEndDate))
    || hasInvalidDateRange;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Request Leave / Paalam"
      size="md"
      mobileView="dialog"
    >
      <fieldset disabled={submitting} className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300" role="status">
          <span>{!recovery.available ? 'Recovery unavailable; keep this form open.' : recovery.restored ? 'Draft restored on this device.' : 'Your draft is kept when you close this form.'}</span>
          <button type="button" className="min-h-11 shrink-0 px-2 underline" disabled={submitting} onClick={resetForm}>Discard draft</button>
        </div>
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

        <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08]">
          <div className="flex items-center gap-2 border-b border-emerald-200/70 px-3.5 py-3 dark:border-emerald-500/15">
            <Users className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-emerald-950 dark:text-emerald-100">Team leave on these dates</p>
              <p className="mt-0.5 text-[11px] text-emerald-800/65 dark:text-emerald-200/55">Pending and approved requests from your church</p>
            </div>
            {hasCompleteDateSelection && !teamLeaveLoading && !teamLeaveError && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-black text-emerald-700 shadow-sm dark:bg-white/[0.08] dark:text-emerald-300">
                {teamLeaveOverlaps.length}
              </span>
            )}
          </div>

          <div className="px-3.5 py-3">
            {!hasCompleteDateSelection ? (
              <div className="flex items-center gap-2 text-xs text-emerald-800/70 dark:text-emerald-200/55">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                Choose {leaveType === 'single' ? 'a date' : 'your start and end dates'} to check who else is away.
              </div>
            ) : hasInvalidDateRange ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                End date must be on or after the start date.
              </div>
            ) : teamLeaveLoading ? (
              <div className="flex items-center gap-2 text-xs text-emerald-800/70 dark:text-emerald-200/55">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Checking team leave…
              </div>
            ) : teamLeaveError ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300" role="alert">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Team leave could not be checked. You can still submit your request.
              </div>
            ) : teamLeaveOverlaps.length === 0 ? (
              <p className="text-xs font-semibold text-emerald-800/75 dark:text-emerald-200/65">No one else has pending or approved leave on these dates.</p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {teamLeaveOverlaps.map(leave => {
                  const firstName = leave.profiles?.first_name || '';
                  const lastName = leave.profiles?.last_name || '';
                  const fullName = `${firstName} ${lastName}`.trim() || 'Church member';
                  const initials = `${firstName[0] || ''}${lastName[0] || ''}` || '?';
                  return (
                    <div key={leave.id} className="flex items-center gap-2.5 rounded-xl border border-white bg-white/90 px-2.5 py-2 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.05]">
                      {leave.profiles?.avatar_url ? (
                        <img src={leave.profiles.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{initials}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-gray-900 dark:text-white">{fullName}</p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-white/45">{formatTeamLeaveDate(leave)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>
                        {leave.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">
            Reason {leavePolicy.reason_required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            aria-label="Leave reason"
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
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </fieldset>
    </Modal>
  );
}
