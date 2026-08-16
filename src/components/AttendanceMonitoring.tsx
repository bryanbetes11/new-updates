import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Search, Filter, Download, RotateCcw, ChevronDown, ChevronUp, History, CheckCircle, Clock, XCircle, FileCheck, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Select } from './Select';
import { Avatar } from './Avatar';
import { Modal } from './Modal';

interface MemberStats {
  user_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  avatar_url: string | null;
  ministry_status: string;
  events_assigned: number;
  confirmed_count: number;
  no_response_count: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  needs_review_count: number;
  dependability_incidents: number;
  offense_level: number;
}

interface AttendanceHistoryRow {
  attendance_id: string;
  event_id: string;
  event_title: string;
  event_date: string;
  event_type: string;
  assignment_status: 'confirmed' | 'pending' | 'declined';
  status: string;
  review_status: 'verified' | 'needs_review';
  record_source: 'member' | 'leader' | 'automatic';
  checked_in_at: string | null;
  marked_at: string | null;
  excused_reason: string | null;
  notes: string | null;
}

const offenseLevelInfo: Record<number, { label: string; color: string; action: string }> = {
  0: { label: 'Good Standing', color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300', action: 'None required' },
  1: { label: '1st Offense', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300', action: 'Verbal Warning by Admin Coordinator or Music Director' },
  2: { label: '2nd Offense', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', action: 'Verbal Warning by Production Director' },
  3: { label: '3rd Offense', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300', action: 'Counselling (closed door meeting with Pastors)' },
  4: { label: '4th Offense', color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200', action: 'Suspension' },
};

const statusInfo: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  present: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', label: 'Present' },
  late: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', label: 'Late' },
  absent: { icon: XCircle, color: 'text-red-600 dark:text-red-400', label: 'Absent' },
  excused: { icon: FileCheck, color: 'text-blue-600 dark:text-blue-400', label: 'Excused' },
  needs_review: { icon: AlertTriangle, color: 'text-violet-600 dark:text-violet-400', label: 'Needs review' },
};

type ReviewResolution = 'present' | 'late' | 'absent' | 'excused';

const ministryStatusBadge: Record<string, string> = {
  active: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  restoration: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  suspended: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  inactive: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

function getQuarterFromDate(date: Date): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

function getQuarterEndDate(year: number, quarter: number): Date {
  return new Date(year, quarter * 3, 0);
}

function getVerifiedOutcomeCount(member: MemberStats): number {
  return member.present_count + member.late_count + member.absent_count + member.excused_count;
}

export function AttendanceMonitoring() {
  const { canManageDiscipline, isOrgAdmin, isPlatformOwner } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [offenseFilter, setOffenseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'late' | 'absent' | 'offense'>('offense');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(getQuarterFromDate(new Date()));
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [historyMember, setHistoryMember] = useState<MemberStats | null>(null);
  const [history, setHistory] = useState<AttendanceHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<AttendanceHistoryRow | null>(null);
  const [reviewResolution, setReviewResolution] = useState<ReviewResolution>('absent');
  const [reviewNote, setReviewNote] = useState('');
  const [resolvingReview, setResolvingReview] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarters = [
    { value: 1, label: 'Q1 (Jan - Mar)' },
    { value: 2, label: 'Q2 (Apr - Jun)' },
    { value: 3, label: 'Q3 (Jul - Sep)' },
    { value: 4, label: 'Q4 (Oct - Dec)' },
  ];
  const selectedQuarterEnd = getQuarterEndDate(selectedYear, selectedQuarter);
  const isCurrentQuarter = selectedYear === currentYear && selectedQuarter === getQuarterFromDate(new Date());

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [{ data, error }, { data: inclusionRows }] = await Promise.all([
      supabase.rpc('get_all_members_attendance_stats', { p_year: selectedYear, p_quarter: selectedQuarter }),
      supabase.from('organization_member_settings').select('user_id, include_in_attendance'),
    ]);

    if (error) {
      setLoadError('Attendance records could not be loaded. Check your connection and try again.');
      toast('error', 'Failed to load attendance data');
      setLoading(false);
      return;
    }

    const excluded = new Set((inclusionRows || []).filter(row => !row.include_in_attendance).map(row => row.user_id));
    setStats((data || []).filter((member: MemberStats) => !excluded.has(member.user_id)));
    setLoading(false);
  }, [selectedYear, selectedQuarter, toast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const openHistory = async (member: MemberStats) => {
    setHistoryMember(member);
    setHistoryLoading(true);
    const { data, error } = await supabase.rpc('get_member_attendance_history', {
      p_user_id: member.user_id,
      p_limit: 30,
      p_year: selectedYear,
      p_quarter: selectedQuarter,
    });
    if (error) {
      toast('error', 'Failed to load attendance history');
    } else {
      setHistory((data || []) as AttendanceHistoryRow[]);
    }
    setHistoryLoading(false);
  };

  const handleResolveReview = async () => {
    if (!reviewTarget || !historyMember || resolvingReview) return;
    if (reviewResolution === 'excused' && !reviewNote.trim()) {
      toast('error', 'Please provide a reason for an excused resolution');
      return;
    }

    setResolvingReview(true);
    const { error } = await supabase.rpc('resolve_attendance_review', {
      p_event_id: reviewTarget.event_id,
      p_user_id: historyMember.user_id,
      p_status: reviewResolution,
      p_note: reviewNote.trim() || null,
    });

    if (error) {
      toast('error', 'Failed to resolve attendance review');
      setResolvingReview(false);
      return;
    }

    toast('success', 'Attendance review resolved');
    setReviewTarget(null);
    setReviewNote('');
    setResolvingReview(false);
    await Promise.all([openHistory(historyMember), fetchStats()]);
  };

  const handleSort = (column: 'name' | 'late' | 'absent' | 'offense') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const handleReset = async () => {
    setResetting(true);
    const { error } = await supabase
      .from('attendance_offense_notifications')
      .delete()
      .eq('quarter_year', selectedYear)
      .eq('quarter_number', selectedQuarter);

    if (error) {
      toast('error', 'Failed to reset offense notifications');
    } else {
      toast('success', `Offense notifications reset for Q${selectedQuarter} ${selectedYear}`);
    }
    setResetting(false);
    setShowResetModal(false);
  };

  const handleExport = () => {
    const headers = ['Name', 'Ministry Status', 'Finalized Schedules', 'Confirmed', 'No Response', 'Present', 'Late', 'Verified Absent', 'Excused', 'Needs Review', 'Verified Outcomes', 'Absence Incidents', 'Attendance Offense Level', 'Action Required'];
    const rows = filteredAndSorted.map(m => {
      const verifiedOutcomes = getVerifiedOutcomeCount(m);
      return [
        `${m.first_name} ${m.last_name}`,
        m.ministry_status,
        m.events_assigned,
        m.confirmed_count,
        m.no_response_count,
        m.present_count,
        m.late_count,
        m.absent_count,
        m.excused_count,
        m.needs_review_count,
        `${verifiedOutcomes}/${m.events_assigned}`,
        m.dependability_incidents,
        offenseLevelInfo[m.offense_level]?.label || 'Unknown',
        offenseLevelInfo[m.offense_level]?.action || '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_q${selectedQuarter}_${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('success', 'Attendance data exported');
  };

  const filtered = stats.filter(m => {
    const matchSearch = !search ||
      `${m.first_name} ${m.last_name} ${m.nickname || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchOffense = !offenseFilter || m.offense_level.toString() === offenseFilter;
    const matchStatus = !statusFilter || m.ministry_status === statusFilter;
    return matchSearch && matchOffense && matchStatus;
  });

  const filteredAndSorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        break;
      case 'late':
        comparison = a.late_count - b.late_count;
        break;
      case 'absent':
        comparison = a.absent_count - b.absent_count;
        break;
      case 'offense':
        comparison = a.offense_level - b.offense_level;
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const summaryStats = {
    maxAssignments: Math.max(...stats.map(s => s.events_assigned), 0),
    membersWithOffenses: stats.filter(s => s.offense_level > 0).length,
    noResponses: stats.reduce((sum, s) => sum + s.no_response_count, 0),
    needsReview: stats.reduce((sum, s) => sum + s.needs_review_count, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        <span className="sr-only">Loading attendance report</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-5 py-8 text-center" role="alert">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500 dark:text-red-400" />
        <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">Could not load attendance</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500 dark:text-gray-400">{loadError}</p>
        <button type="button" onClick={fetchStats} className="btn-secondary mt-4 min-h-11">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full gap-2 sm:w-auto">
          <Select
            value={selectedYear.toString()}
            onChange={v => setSelectedYear(parseInt(v))}
            options={years.map(y => ({ value: y.toString(), label: y.toString() }))}
            className="w-24 shrink-0"
          />
          <Select
            value={selectedQuarter.toString()}
            onChange={v => setSelectedQuarter(parseInt(v))}
            options={quarters.map(q => ({ value: q.value.toString(), label: q.label }))}
            className="min-w-0 flex-1 sm:w-40 sm:flex-none"
          />
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          {(isOrgAdmin || isPlatformOwner) && (
            <Link to="/leadership/attendance-qr-pilot" className="btn-secondary min-h-11 flex-1 text-xs sm:flex-none">
              <QrCode className="h-3.5 w-3.5" /> QR Test Lab
            </Link>
          )}
          <button onClick={handleExport} className="btn-secondary min-h-11 flex-1 text-xs sm:flex-none">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          {canManageDiscipline && (
            <button onClick={() => setShowResetModal(true)} className="btn-ghost min-h-11 flex-1 text-xs text-amber-600 hover:text-amber-700 sm:flex-none">
              <RotateCcw className="h-3.5 w-3.5" /> Re-send Alerts
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-brand-500/20 bg-brand-500/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Q{selectedQuarter} {selectedYear} dependability period
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Offense levels follow the Worship Ministry attendance policy: absences and accumulated lates count. Missed schedule responses stay visible for leader follow-up but do not create an offense.
          </p>
          <div className="mt-2 flex flex-col gap-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300 sm:flex-row sm:gap-4">
            <span><strong className="font-semibold text-gray-800 dark:text-gray-100">1. Schedule response:</strong> Confirmed or no response</span>
            <span><strong className="font-semibold text-gray-800 dark:text-gray-100">2. Attendance outcome:</strong> Present, late, absent, or excused</span>
          </div>
        </div>
        <span className="shrink-0 text-xs font-medium text-brand-700 dark:text-brand-300">
          {isCurrentQuarter ? `Resets automatically after ${format(selectedQuarterEnd, 'MMM d, yyyy')}` : `Ended ${format(selectedQuarterEnd, 'MMM d, yyyy')}`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { level: 'Level 1', threshold: '3 lates or 1 absence' },
          { level: 'Level 2', threshold: '6 lates or 2 absences' },
          { level: 'Level 3', threshold: '9 lates or 3 absences' },
          { level: 'Level 4', threshold: '12 lates or 4+ absences' },
        ].map(rule => (
          <div key={rule.level} className="rounded-xl border border-gray-200/80 bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">{rule.level}</p>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{rule.threshold}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summaryStats.maxAssignments}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Most Assignments</p>
        </div>
        <div className="card p-4">
          <p className={`text-2xl font-bold ${summaryStats.noResponses > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>{summaryStats.noResponses}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">No Responses</p>
        </div>
        <div className="card p-4">
          <p className={`text-2xl font-bold ${summaryStats.membersWithOffenses > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {summaryStats.membersWithOffenses}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">With Offenses</p>
        </div>
        <div className="card p-4">
          <p className={`text-2xl font-bold ${summaryStats.needsReview > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-gray-900 dark:text-white'}`}>
            {summaryStats.needsReview}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Needs Review</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search members..."
            aria-label="Search attendance members"
            className="input-field pl-10"
          />
        </div>
        <Select
          value={offenseFilter}
          onChange={setOffenseFilter}
          options={[
            { value: '', label: 'All Offenses' },
            { value: '0', label: 'Good Standing' },
            { value: '1', label: '1st Offense' },
            { value: '2', label: '2nd Offense' },
            { value: '3', label: '3rd Offense' },
            { value: '4', label: '4th Offense' },
          ]}
          placeholder="Filter offense"
          className="md:w-40"
          icon={<Filter className="h-4 w-4" />}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'active', label: 'Active' },
            { value: 'restoration', label: 'Restoration' },
            { value: 'suspended', label: 'Suspended' },
          ]}
          placeholder="Filter status"
          className="md:w-36"
        />
      </div>

      <div className="hidden xl:block">
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left px-4 py-3">
                  <button onClick={() => handleSort('name')} className="flex min-h-11 items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-400">
                    Member {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Schedule response</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Attendance verified</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Needs attendance review</th>
                <th className="text-center px-3 py-3">
                  <button onClick={() => handleSort('offense')} className="mx-auto flex min-h-11 items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-400">
                    Status {sortBy === 'offense' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="w-8 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredAndSorted.map(m => {
                const info = offenseLevelInfo[m.offense_level] || offenseLevelInfo[0];
                const verifiedOutcomes = getVerifiedOutcomeCount(m);
                return (
                  <tr key={m.user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={m.avatar_url} firstName={m.first_name} lastName={m.last_name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{m.first_name} {m.last_name}</p>
                          {m.nickname && <p className="text-xs text-gray-400">{m.nickname}</p>}
                          {m.ministry_status !== 'active' && (
                            <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-md font-medium ${ministryStatusBadge[m.ministry_status]}`}>
                              {m.ministry_status}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{m.events_assigned} scheduled</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="text-gray-700 dark:text-gray-300">{m.confirmed_count} confirmed</span>
                        <span aria-hidden="true"> · </span>
                        <span className={m.no_response_count > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}>{m.no_response_count} no response</span>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className={`text-sm font-semibold ${verifiedOutcomes === m.events_assigned ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                        {verifiedOutcomes} of {m.events_assigned} verified
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {m.present_count} present · {m.late_count} late · {m.absent_count} absent · {m.excused_count} excused
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {m.needs_review_count > 0 ? (
                        <div>
                          <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">{m.needs_review_count} assignment{m.needs_review_count === 1 ? '' : 's'}</p>
                          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Attendance still unknown</p>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-green-600 dark:text-green-400">All reviewed</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${info.color}`}>
                        {m.offense_level > 0 && <AlertTriangle className="h-3 w-3" />}
                        {info.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => openHistory(m)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                        title={`View Q${selectedQuarter} ${selectedYear} history`}
                        aria-label={`View Q${selectedQuarter} ${selectedYear} attendance history for ${m.first_name} ${m.last_name}`}
                      >
                        <History className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredAndSorted.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-400">No members found</div>
          )}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:hidden">
        {filteredAndSorted.map(m => {
          const info = offenseLevelInfo[m.offense_level] || offenseLevelInfo[0];
          const isExpanded = expandedMember === m.user_id;
          const verifiedOutcomes = getVerifiedOutcomeCount(m);
          return (
            <div key={m.user_id} className="card self-start">
              <button
                onClick={() => setExpandedMember(isExpanded ? null : m.user_id)}
                className="flex min-h-16 w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                aria-expanded={isExpanded}
              >
                <Avatar src={m.avatar_url} firstName={m.first_name} lastName={m.last_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.first_name} {m.last_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${info.color}`}>
                      {m.offense_level > 0 && <AlertTriangle className="h-3 w-3" />}
                      {info.label}
                    </span>
                    <span className={`text-xs font-semibold ${verifiedOutcomes === m.events_assigned ? 'text-green-600 dark:text-green-400' : 'text-violet-600 dark:text-violet-400'}`}>
                      {verifiedOutcomes} of {m.events_assigned} attendance verified
                    </span>
                    {m.no_response_count > 0 && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
                        {m.no_response_count} no response
                      </span>
                    )}
                    {m.needs_review_count > 0 && (
                      <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-300">
                        {m.needs_review_count} need attendance review
                      </span>
                    )}
                    {m.ministry_status !== 'active' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${ministryStatusBadge[m.ministry_status]}`}>
                        {m.ministry_status}
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">1. Schedule response</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{m.events_assigned} scheduled</p>
                      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{m.confirmed_count} confirmed · <span className={m.no_response_count > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}>{m.no_response_count} no response</span></p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">2. Attendance outcome</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{verifiedOutcomes} of {m.events_assigned} verified</p>
                      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{m.present_count} present · {m.late_count} late · {m.absent_count} absent · {m.excused_count} excused</p>
                      <p className={`mt-1 text-xs font-semibold ${m.needs_review_count > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-green-600 dark:text-green-400'}`}>
                        {m.needs_review_count > 0 ? `${m.needs_review_count} still need attendance review` : 'All attendance reviewed'}
                      </p>
                    </div>
                  </div>
                  {m.offense_level > 0 && (
                    <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Action Required:</p>
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">{info.action}</p>
                    </div>
                  )}
                  <button
                    onClick={() => openHistory(m)}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-400 dark:hover:bg-brand-900/20"
                  >
                    <History className="h-3.5 w-3.5" /> View Q{selectedQuarter} Details
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filteredAndSorted.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center dark:border-gray-800 md:col-span-2">
            <Search className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm text-gray-400">No members match these filters</p>
          </div>
        )}
      </div>

      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title="Re-send Offense Alerts" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This does not reset attendance or offense levels. It only clears alert tracking for Q{selectedQuarter} {selectedYear}, allowing leadership alerts to be sent again when attendance is updated. Quarterly totals reset automatically at the start of the next quarter.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowResetModal(false)} className="btn-secondary min-h-11">Cancel</button>
            <button onClick={handleReset} disabled={resetting} className="btn-primary min-h-11 bg-amber-600 hover:bg-amber-700">
              {resetting ? 'Preparing...' : 'Allow Alerts Again'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!historyMember}
        onClose={() => setHistoryMember(null)}
        title={historyMember ? `${historyMember.first_name} ${historyMember.last_name} - Q${selectedQuarter} ${selectedYear}` : ''}
        size="lg"
      >
        {historyMember && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {[
                { label: 'Scheduled', value: historyMember.events_assigned, color: 'text-gray-700 dark:text-gray-200' },
                { label: 'No response', value: historyMember.no_response_count, color: 'text-amber-600' },
                { label: 'Verified absent', value: historyMember.absent_count, color: 'text-red-600' },
                { label: 'Present', value: historyMember.present_count, color: 'text-green-600' },
                { label: 'Late', value: historyMember.late_count, color: 'text-amber-600' },
                { label: 'Excused', value: historyMember.excused_count, color: 'text-blue-600' },
                { label: 'Needs review', value: historyMember.needs_review_count, color: 'text-violet-600' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            <p className="rounded-lg bg-brand-500/[0.07] px-3 py-2 text-xs text-brand-700 dark:text-brand-300">
              Attendance offenses follow the written policy: accumulated lates and absences determine the level. A missed schedule response is shown for follow-up, but it does not increase the offense level. Missing attendance is automatically recorded as absent after the deadline.
            </p>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">No attendance records yet</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {history.map(row => {
                  const sInfo = statusInfo[row.status];
                  return (
                    <div key={row.attendance_id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <div className="flex flex-col items-center justify-center h-10 w-10 rounded-lg bg-white dark:bg-gray-700 shrink-0">
                        <span className="text-[10px] font-medium text-gray-500">{format(parseISO(row.event_date), 'MMM')}</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-white leading-tight">{format(parseISO(row.event_date), 'd')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{row.event_title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <span>{row.event_type}</span>
                          {row.assignment_status === 'pending' && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-600 dark:text-amber-300">No confirmation</span>
                          )}
                          {row.assignment_status === 'declined' && (
                            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-semibold text-blue-600 dark:text-blue-300">Declined with reason</span>
                          )}
                          {row.record_source === 'automatic' && (
                            <span className="rounded bg-violet-500/10 px-1.5 py-0.5 font-semibold text-violet-600 dark:text-violet-300">System inferred</span>
                          )}
                        </div>
                        {row.excused_reason && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 truncate">Reason: {row.excused_reason}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {sInfo && <sInfo.icon className={`h-4 w-4 ${sInfo.color}`} />}
                          <span className={`text-xs font-medium ${sInfo?.color || 'text-gray-500'}`}>
                            {sInfo?.label || row.status}
                          </span>
                        </div>
                        {(row.review_status === 'needs_review' || (row.record_source === 'automatic' && row.status === 'absent')) && canManageDiscipline && (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewTarget(row);
                              setReviewResolution('absent');
                              setReviewNote('');
                            }}
                            className="inline-flex min-h-9 items-center rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 text-[11px] font-bold text-violet-700 transition-colors hover:bg-violet-500/15 dark:text-violet-300"
                          >
                            {row.review_status === 'needs_review' ? 'Resolve' : 'Correct'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setHistoryMember(null)} className="btn-secondary min-h-11">Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!reviewTarget}
        onClose={() => !resolvingReview && setReviewTarget(null)}
        title="Resolve Attendance"
        size="sm"
      >
        {reviewTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.07] p-3">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{reviewTarget.event_title}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {format(parseISO(reviewTarget.event_date), 'MMM d, yyyy')} · {reviewTarget.assignment_status === 'pending' ? 'No schedule confirmation' : reviewTarget.assignment_status === 'declined' ? 'Declined with reason' : 'Confirmed schedule'}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Verified outcome</label>
              <Select
                value={reviewResolution}
                onChange={value => setReviewResolution(value as ReviewResolution)}
                options={[
                  { value: 'present', label: 'Present' },
                  { value: 'late', label: 'Late' },
                  { value: 'absent', label: 'Absent' },
                  { value: 'excused', label: 'Excused' },
                ]}
              />
            </div>
            <div>
              <label htmlFor="attendance-review-note" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Leader note {reviewResolution === 'excused' ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optional)</span>}
              </label>
              <textarea
                id="attendance-review-note"
                value={reviewNote}
                onChange={event => setReviewNote(event.target.value)}
                className="input-field h-20 resize-none"
                placeholder="Add the information used to resolve this record..."
                required={reviewResolution === 'excused'}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-gray-200/70 pt-4 dark:border-white/[0.08]">
              <button type="button" onClick={() => setReviewTarget(null)} disabled={resolvingReview} className="btn-secondary min-h-11">Cancel</button>
              <button
                type="button"
                onClick={handleResolveReview}
                disabled={resolvingReview || (reviewResolution === 'excused' && !reviewNote.trim())}
                className="btn-primary min-h-11 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resolvingReview ? 'Saving...' : 'Resolve'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
