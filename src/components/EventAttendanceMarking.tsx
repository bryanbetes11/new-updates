import { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, CheckCircle, Clock, XCircle, FileCheck, Search, Save, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import type { Event } from '../types';

interface RosterMember {
  user_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  avatar_url: string | null;
  gender: string;
  role_name: string;
  attendance_id: string | null;
  status: 'present' | 'late' | 'absent' | 'excused' | null;
  checked_in_at: string | null;
  marked_at: string | null;
  excused_reason: string | null;
  notes: string | null;
  is_assigned: boolean;
}

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

const statusConfig: Record<AttendanceStatus, { label: string; color: string; icon: React.ElementType; ring: string }> = {
  present: { label: 'Present', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300', ring: 'ring-green-300 dark:ring-green-700', icon: CheckCircle },
  late: { label: 'Late', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300', ring: 'ring-amber-300 dark:ring-amber-700', icon: Clock },
  absent: { label: 'Absent', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300', ring: 'ring-red-300 dark:ring-red-700', icon: XCircle },
  excused: { label: 'Excused', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300', ring: 'ring-blue-300 dark:ring-blue-700', icon: FileCheck },
};

interface Props {
  event: Event;
}

export function EventAttendanceMarking({ event }: Props) {
  const { user, isLeader } = useAuth();
  const { toast } = useToast();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [excuseModal, setExcuseModal] = useState<{ userId: string; name: string } | null>(null);
  const [excuseReason, setExcuseReason] = useState('');
  const [savingAll, setSavingAll] = useState(false);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc('get_event_attendance_roster', { p_event_id: event.id });
    if (error) {
      setLoadError('Attendance could not be loaded. Check your connection and try again.');
      toast('error', 'Failed to load attendance roster');
    } else {
      setRoster((data || []) as RosterMember[]);
    }
    setLoading(false);
  }, [event.id, toast]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const markAttendance = async (member: RosterMember, status: AttendanceStatus, excusedReason?: string) => {
    if (!user || !isLeader) return;
    setSaving(member.user_id);

    const payload = {
      event_id: event.id,
      user_id: member.user_id,
      status,
      is_assigned: true,
      marked_by: user.id,
      marked_at: new Date().toISOString(),
      excused_reason: excusedReason || null,
      checked_in_at: status === 'present' || status === 'late' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (member.attendance_id) {
      const { error } = await supabase
        .from('event_attendance')
        .update({ ...payload, override_by: user.id, override_at: new Date().toISOString() })
        .eq('id', member.attendance_id);
      if (error) { toast('error', 'Failed to update attendance'); setSaving(null); return; }
    } else {
      const { error } = await supabase
        .from('event_attendance')
        .insert(payload);
      if (error) { toast('error', 'Failed to mark attendance'); setSaving(null); return; }
    }

    setSaving(null);
    fetchRoster();
  };

  const handleStatusClick = (member: RosterMember, status: AttendanceStatus) => {
    if (status === 'excused') {
      setExcuseReason(member.excused_reason || '');
      setExcuseModal({ userId: member.user_id, name: `${member.first_name} ${member.last_name}` });
      return;
    }
    markAttendance(member, status);
  };

  const handleExcuseSubmit = async () => {
    if (!excuseModal) return;
    const member = roster.find(m => m.user_id === excuseModal.userId);
    if (!member) return;
    await markAttendance(member, 'excused', excuseReason);
    setExcuseModal(null);
    setExcuseReason('');
  };

  const handleMarkAllPresent = async () => {
    const unmarked = filtered.filter(m => !m.status);
    if (unmarked.length === 0) { toast('info', 'All members already marked'); return; }
    setSavingAll(true);
    for (const member of unmarked) {
      await markAttendance(member, 'present');
    }
    setSavingAll(false);
    toast('success', `Marked ${unmarked.length} members as present`);
  };

  const filtered = roster.filter(m => {
    if (!search) return true;
    return `${m.first_name} ${m.last_name} ${m.nickname || ''}`.toLowerCase().includes(search.toLowerCase());
  });

  const summary = {
    total: roster.length,
    present: roster.filter(m => m.status === 'present').length,
    late: roster.filter(m => m.status === 'late').length,
    absent: roster.filter(m => m.status === 'absent').length,
    excused: roster.filter(m => m.status === 'excused').length,
    unmarked: roster.filter(m => !m.status).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="sr-only">Loading attendance roster</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-5 py-6 text-center" role="alert">
        <AlertTriangle className="mx-auto h-7 w-7 text-red-400" />
        <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">Could not load attendance</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-gray-500 dark:text-white/50">{loadError}</p>
        <button type="button" onClick={fetchRoster} className="btn-secondary mt-4 min-h-11">Try again</button>
      </div>
    );
  }

  if (roster.length === 0) {
    return (
      <div className="text-center py-10">
        <ClipboardCheck className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No confirmed assignments for this event</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {[
          { label: 'Total', value: summary.total, color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Present', value: summary.present, color: 'text-green-600 dark:text-green-400' },
          { label: 'Late', value: summary.late, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Absent', value: summary.absent, color: 'text-red-600 dark:text-red-400' },
          { label: 'Excused', value: summary.excused, color: 'text-blue-600 dark:text-blue-400' },
        ].map(s => (
          <div key={s.label} className="card min-w-0 px-1 py-2.5 text-center sm:p-3">
            <p className={`text-lg font-bold sm:text-xl ${s.color}`}>{s.value}</p>
            <p className="truncate text-[9px] text-gray-500 dark:text-gray-400 sm:text-[10px]">{s.label}</p>
          </div>
        ))}
      </div>

      {summary.unmarked > 0 && (
        <div className="flex flex-col items-stretch gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300 flex-1">
            {summary.unmarked} member{summary.unmarked !== 1 ? 's' : ''} not yet marked
          </p>
          <button
            onClick={handleMarkAllPresent}
            disabled={savingAll}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-3 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-300 dark:hover:bg-amber-800/30"
          >
            {savingAll ? 'Marking...' : 'Mark all present'}
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search members..."
          className="input-field pl-10"
        />
      </div>

      <div className="space-y-2">
        {filtered.map(member => {
          const currentStatus = member.status as AttendanceStatus | null;
          const isSaving = saving === member.user_id;

          return (
            <div key={member.user_id} className="card p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <Avatar src={member.avatar_url} firstName={member.first_name} lastName={member.last_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {member.first_name} {member.last_name}
                    {member.nickname && <span className="text-gray-400 font-normal text-xs"> ({member.nickname})</span>}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{member.role_name}</p>
                  {currentStatus === 'excused' && member.excused_reason && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">Reason: {member.excused_reason}</p>
                  )}
                </div>
                {isSaving ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400 shrink-0" />
                ) : (
                  <AttendanceStatusPicker
                    currentStatus={currentStatus}
                    onSelect={(status) => handleStatusClick(member, status)}
                  />
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center dark:border-white/[0.1]">
            <Search className="mx-auto h-6 w-6 text-gray-300 dark:text-white/25" />
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-white/50">No members match your search</p>
          </div>
        )}
      </div>

      <Modal open={!!excuseModal} onClose={() => setExcuseModal(null)} title="Mark as Excused" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Marking <span className="font-medium text-gray-900 dark:text-white">{excuseModal?.name}</span> as excused.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason (optional)</label>
            <input
              type="text"
              value={excuseReason}
              onChange={e => setExcuseReason(e.target.value)}
              className="input-field"
              placeholder="e.g., Medical, family emergency..."
              autoFocus
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button onClick={() => setExcuseModal(null)} className="btn-secondary min-h-11">Cancel</button>
            <button onClick={handleExcuseSubmit} className="btn-primary min-h-11">
              <Save className="h-4 w-4" /> Confirm Excused
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface AttendanceStatusPickerProps {
  currentStatus: AttendanceStatus | null;
  onSelect: (status: AttendanceStatus) => void;
}

function AttendanceStatusPicker({ currentStatus, onSelect }: AttendanceStatusPickerProps) {
  const [open, setOpen] = useState(false);
  const statuses: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

  const current = currentStatus ? statusConfig[currentStatus] : null;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={current ? `Attendance status: ${current.label}` : 'Mark attendance status'}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          current
            ? `${current.color} ${current.ring}`
            : 'bg-gray-50 dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 text-gray-500 dark:text-gray-400'
        }`}
      >
        {current ? (
          <>
            <current.icon className="h-3.5 w-3.5" />
            {current.label}
          </>
        ) : (
          'Mark'
        )}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] rounded-lg bg-white py-1 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700" role="menu" aria-label="Attendance status">
            {statuses.map(s => {
              const cfg = statusConfig[s];
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => { onSelect(s); setOpen(false); }}
                  role="menuitemradio"
                  aria-checked={currentStatus === s}
                  className={`flex min-h-11 w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 dark:hover:bg-gray-700 ${
                    currentStatus === s ? 'opacity-50' : ''
                  }`}
                >
                  <cfg.icon className={`h-3.5 w-3.5 ${
                    s === 'present' ? 'text-green-600' :
                    s === 'late' ? 'text-amber-600' :
                    s === 'absent' ? 'text-red-600' : 'text-blue-600'
                  }`} />
                  <span className="text-gray-700 dark:text-gray-300">{cfg.label}</span>
                  {currentStatus === s && <span className="ml-auto text-[10px] text-gray-400">current</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
