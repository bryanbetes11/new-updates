import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Search, Filter, Download, RotateCcw, ChevronDown, ChevronUp, History, CheckCircle, Clock, XCircle, FileCheck } from 'lucide-react';
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
  present_count: number;
  late_count: number;
  absent_count: number;
  excused_count: number;
  offense_level: number;
}

interface AttendanceHistoryRow {
  attendance_id: string;
  event_id: string;
  event_title: string;
  event_date: string;
  event_type: string;
  status: string;
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
};

const ministryStatusBadge: Record<string, string> = {
  active: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  restoration: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
  suspended: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  inactive: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

function getQuarterFromDate(date: Date): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

export function AttendanceMonitoring() {
  const { canManageDiscipline } = useAuth();
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

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const quarters = [
    { value: 1, label: 'Q1 (Jan - Mar)' },
    { value: 2, label: 'Q2 (Apr - Jun)' },
    { value: 3, label: 'Q3 (Jul - Sep)' },
    { value: 4, label: 'Q4 (Oct - Dec)' },
  ];

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc('get_all_members_attendance_stats', {
      p_year: selectedYear,
      p_quarter: selectedQuarter,
    });

    if (error) {
      setLoadError('Attendance records could not be loaded. Check your connection and try again.');
      toast('error', 'Failed to load attendance data');
      setLoading(false);
      return;
    }

    setStats(data || []);
    setLoading(false);
  }, [selectedYear, selectedQuarter, toast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const openHistory = async (member: MemberStats) => {
    setHistoryMember(member);
    setHistoryLoading(true);
    const { data, error } = await supabase.rpc('get_member_attendance_history', {
      p_user_id: member.user_id,
      p_limit: 30,
    });
    if (error) {
      toast('error', 'Failed to load attendance history');
    } else {
      setHistory((data || []) as AttendanceHistoryRow[]);
    }
    setHistoryLoading(false);
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
    const headers = ['Name', 'Ministry Status', 'Events Assigned', 'Present', 'Late', 'Absent', 'Excused', 'Attendance %', 'Offense Level', 'Action Required'];
    const rows = filteredAndSorted.map(m => {
      const attendanceRate = m.events_assigned > 0
        ? Math.round(((m.present_count + m.late_count) / m.events_assigned) * 100)
        : 0;
      return [
        `${m.first_name} ${m.last_name}`,
        m.ministry_status,
        m.events_assigned,
        m.present_count,
        m.late_count,
        m.absent_count,
        m.excused_count,
        `${attendanceRate}%`,
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
    totalEvents: Math.max(...stats.map(s => s.events_assigned), 0),
    membersWithOffenses: stats.filter(s => s.offense_level > 0).length,
    averageAttendance: stats.length > 0
      ? Math.round((stats.reduce((sum, s) => sum + s.present_count, 0) / Math.max(stats.reduce((sum, s) => sum + s.events_assigned, 0), 1)) * 100)
      : 0,
    suspended: stats.filter(s => s.ministry_status === 'suspended').length,
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
          <button onClick={handleExport} className="btn-secondary min-h-11 flex-1 text-xs sm:flex-none">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          {canManageDiscipline && (
            <button onClick={() => setShowResetModal(true)} className="btn-ghost min-h-11 flex-1 text-xs text-amber-600 hover:text-amber-700 sm:flex-none">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summaryStats.totalEvents}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Events in Quarter</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summaryStats.averageAttendance}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Attendance</p>
        </div>
        <div className="card p-4">
          <p className={`text-2xl font-bold ${summaryStats.membersWithOffenses > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {summaryStats.membersWithOffenses}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">With Offenses</p>
        </div>
        <div className="card p-4">
          <p className={`text-2xl font-bold ${summaryStats.suspended > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
            {summaryStats.suspended}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Suspended</p>
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
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Events</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Present</th>
                <th className="text-center px-3 py-3">
                  <button onClick={() => handleSort('late')} className="mx-auto flex min-h-11 items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-400">
                    Late {sortBy === 'late' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="text-center px-3 py-3">
                  <button onClick={() => handleSort('absent')} className="mx-auto flex min-h-11 items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-400">
                    Absent {sortBy === 'absent' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </button>
                </th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Excused</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">Rate</th>
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
                const attendanceRate = m.events_assigned > 0
                  ? Math.round(((m.present_count + m.late_count) / m.events_assigned) * 100)
                  : 0;
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
                    <td className="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400">{m.events_assigned}</td>
                    <td className="px-3 py-3 text-center text-sm text-green-600 dark:text-green-400">{m.present_count}</td>
                    <td className="px-3 py-3 text-center text-sm text-amber-600 dark:text-amber-400">{m.late_count}</td>
                    <td className="px-3 py-3 text-center text-sm text-red-600 dark:text-red-400">{m.absent_count}</td>
                    <td className="px-3 py-3 text-center text-sm text-blue-600 dark:text-blue-400">{m.excused_count}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-medium ${attendanceRate >= 80 ? 'text-green-600 dark:text-green-400' : attendanceRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {attendanceRate}%
                      </span>
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
                        title="View history"
                        aria-label={`View attendance history for ${m.first_name} ${m.last_name}`}
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

      <div className="space-y-2 xl:hidden">
        {filteredAndSorted.map(m => {
          const info = offenseLevelInfo[m.offense_level] || offenseLevelInfo[0];
          const isExpanded = expandedMember === m.user_id;
          const attendanceRate = m.events_assigned > 0
            ? Math.round(((m.present_count + m.late_count) / m.events_assigned) * 100)
            : 0;
          return (
            <div key={m.user_id} className="card">
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
                    <span className={`text-xs font-medium ${attendanceRate >= 80 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {attendanceRate}%
                    </span>
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
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {[
                      { label: 'Events', value: m.events_assigned, color: 'text-gray-700 dark:text-gray-300' },
                      { label: 'Present', value: m.present_count, color: 'text-green-600' },
                      { label: 'Late', value: m.late_count, color: 'text-amber-600' },
                      { label: 'Absent', value: m.absent_count, color: 'text-red-600' },
                      { label: 'Excused', value: m.excused_count, color: 'text-blue-600' },
                    ].map(s => (
                      <div key={s.label}>
                        <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-gray-500">{s.label}</p>
                      </div>
                    ))}
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
                    <History className="h-3.5 w-3.5" /> View Full History
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filteredAndSorted.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-200 py-8 text-center dark:border-gray-800">
            <Search className="mx-auto h-6 w-6 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm text-gray-400">No members match these filters</p>
          </div>
        )}
      </div>

      <Modal open={showResetModal} onClose={() => setShowResetModal(false)} title="Reset Offense Notifications" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This will reset the offense notification tracking for Q{selectedQuarter} {selectedYear}. Leadership will be notified again if members reach offense thresholds. Attendance records will not be affected.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowResetModal(false)} className="btn-secondary min-h-11">Cancel</button>
            <button onClick={handleReset} disabled={resetting} className="btn-primary min-h-11 bg-amber-600 hover:bg-amber-700">
              {resetting ? 'Resetting...' : 'Reset Notifications'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!historyMember}
        onClose={() => setHistoryMember(null)}
        title={historyMember ? `${historyMember.first_name} ${historyMember.last_name} - Attendance History` : ''}
        size="lg"
      >
        {historyMember && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {[
                { label: 'Present', value: historyMember.present_count, color: 'text-green-600' },
                { label: 'Late', value: historyMember.late_count, color: 'text-amber-600' },
                { label: 'Absent', value: historyMember.absent_count, color: 'text-red-600' },
                { label: 'Excused', value: historyMember.excused_count, color: 'text-blue-600' },
              ].map(s => (
                <div key={s.label} className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

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
                        <p className="text-xs text-gray-500 dark:text-gray-400">{row.event_type}</p>
                        {row.excused_reason && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 truncate">Reason: {row.excused_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {sInfo && <sInfo.icon className={`h-4 w-4 ${sInfo.color}`} />}
                        <span className={`text-xs font-medium ${sInfo?.color || 'text-gray-500'}`}>
                          {sInfo?.label || row.status}
                        </span>
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
    </div>
  );
}
