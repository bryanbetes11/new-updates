import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Shield, AlertTriangle, Plus, ChevronDown, ChevronUp, Search,
  Filter, CheckCircle, Clock, XCircle, FileCheck, MessageSquare,
  Lock, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Avatar } from '../components/Avatar';
import { Select } from '../components/Select';
import { PageLoader } from '../components/LoadingSpinner';
import type { DisciplineRecord, Profile } from '../types';

interface DisciplineRecordWithProfile extends DisciplineRecord {
  profile?: Profile;
  created_by_profile?: Profile;
}

const statusConfig: Record<string, { label: string; textColor: string; bgColor: string; ringColor: string; icon: React.ElementType }> = {
  open: { label: 'Open', textColor: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-800', ringColor: 'ring-gray-200 dark:ring-gray-700', icon: Clock },
  verbal_warning: { label: 'Verbal Warning', textColor: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-900/20', ringColor: 'ring-amber-200 dark:ring-amber-800/50', icon: MessageSquare },
  counselling: { label: 'Counselling', textColor: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-50 dark:bg-orange-900/20', ringColor: 'ring-orange-200 dark:ring-orange-800/50', icon: MessageSquare },
  suspension: { label: 'Suspended', textColor: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900/20', ringColor: 'ring-red-200 dark:ring-red-800/50', icon: XCircle },
  resolved: { label: 'Resolved', textColor: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', ringColor: 'ring-emerald-200 dark:ring-emerald-800/50', icon: CheckCircle },
};

const sourceConfig: Record<string, { label: string; textColor: string; bgColor: string }> = {
  attendance: { label: 'Attendance', textColor: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  setlist: { label: 'Setlist', textColor: 'text-teal-700 dark:text-teal-300', bgColor: 'bg-teal-50 dark:bg-teal-900/20' },
  manual: { label: 'Manual', textColor: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
};

const offenseLabels: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: '1st Offense', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  2: { label: '2nd Offense', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  3: { label: '3rd Offense', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20' },
  4: { label: '4th Offense', color: 'text-red-800 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900/30' },
};

interface DisciplineProps {
  embedded?: boolean;
}

export function Discipline({ embedded }: DisciplineProps = {}) {
  const { user, isLeader, canManageDiscipline } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<DisciplineRecordWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DisciplineRecordWithProfile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);

  const [formData, setFormData] = useState({
    user_id: '',
    source: 'manual' as 'attendance' | 'setlist' | 'manual',
    offense_number: '' as '' | number,
    quarter_year: new Date().getFullYear(),
    quarter_number: Math.ceil((new Date().getMonth() + 1) / 3),
    status: 'open' as string,
    title: '',
    notes: '',
    leader_notes: '',
    final_decision: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('discipline_records')
      .select('*, profile:user_id(id, first_name, last_name, nickname, avatar_url, gender), created_by_profile:created_by(first_name, last_name)')
      .order('created_at', { ascending: false });

    if (!isLeader) {
      query = query.eq('user_id', user?.id);
    }

    const { data, error } = await query;
    if (error) {
      toast('error', 'Failed to load records');
    } else {
      setRecords((data || []) as DisciplineRecordWithProfile[]);
    }
    setLoading(false);
  }, [isLeader, user?.id]);

  const fetchMembers = useCallback(async () => {
    if (!canManageDiscipline) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, nickname, avatar_url, gender')
      .eq('is_onboarded', true)
      .order('first_name');
    setMembers((data || []) as Profile[]);
  }, [canManageDiscipline]);

  useEffect(() => {
    fetchRecords();
    fetchMembers();
  }, [fetchRecords, fetchMembers]);

  const resetForm = () => {
    setFormData({
      user_id: '',
      source: 'manual',
      offense_number: '',
      quarter_year: new Date().getFullYear(),
      quarter_number: Math.ceil((new Date().getMonth() + 1) / 3),
      status: 'open',
      title: '',
      notes: '',
      leader_notes: '',
      final_decision: '',
    });
  };

  const openCreate = () => {
    resetForm();
    setEditingRecord(null);
    setShowCreateModal(true);
  };

  const openEdit = (record: DisciplineRecordWithProfile) => {
    setFormData({
      user_id: record.user_id,
      source: record.source,
      offense_number: record.offense_number ?? '',
      quarter_year: record.quarter_year ?? new Date().getFullYear(),
      quarter_number: record.quarter_number ?? Math.ceil((new Date().getMonth() + 1) / 3),
      status: record.status,
      title: record.title,
      notes: record.notes ?? '',
      leader_notes: record.leader_notes ?? '',
      final_decision: record.final_decision ?? '',
    });
    setEditingRecord(record);
    setShowCreateModal(true);
  };

  const handleSave = async () => {
    if (!user || !formData.title || (!editingRecord && !formData.user_id)) {
      toast('error', 'Please fill in all required fields');
      return;
    }
    setSaving(true);

    const payload = {
      user_id: formData.user_id || (editingRecord?.user_id ?? user.id),
      created_by: editingRecord?.created_by ?? user.id,
      source: formData.source,
      offense_number: formData.offense_number ? Number(formData.offense_number) : null,
      quarter_year: formData.quarter_year,
      quarter_number: formData.quarter_number,
      status: formData.status,
      title: formData.title,
      notes: formData.notes || null,
      leader_notes: formData.leader_notes || null,
      final_decision: formData.final_decision || null,
      resolved_at: formData.status === 'resolved' && !editingRecord?.resolved_at ? new Date().toISOString() : (editingRecord?.resolved_at ?? null),
      resolved_by: formData.status === 'resolved' && !editingRecord?.resolved_by ? user.id : (editingRecord?.resolved_by ?? null),
      updated_at: new Date().toISOString(),
    };

    if (editingRecord) {
      const { error } = await supabase.from('discipline_records').update(payload).eq('id', editingRecord.id);
      if (error) { toast('error', 'Failed to update record'); setSaving(false); return; }
      toast('success', 'Record updated');
    } else {
      const { error } = await supabase.from('discipline_records').insert({ ...payload, created_at: new Date().toISOString() });
      if (error) { toast('error', 'Failed to create record'); setSaving(false); return; }
      toast('success', 'Discipline record created');
    }

    setSaving(false);
    setShowCreateModal(false);
    fetchRecords();
  };

  const filtered = records.filter(r => {
    const member = r.profile;
    const matchSearch = !search || (member && `${member.first_name} ${member.last_name}`.toLowerCase().includes(search.toLowerCase())) || r.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (loading) return <PageLoader />;

  const isOwnView = !isLeader;

  const content = (
    <>
      <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-5">
        {!embedded && (
          <div className="flex items-center justify-between animate-fade-in">
            <div>
              <h1 className="page-header">{isOwnView ? 'My Discipline Record' : 'Discipline Records'}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isOwnView
                  ? 'Your personal discipline record and history'
                  : 'Track and manage member conduct with pastoral care'}
              </p>
            </div>
            {canManageDiscipline && (
              <button onClick={openCreate} className="btn-primary shrink-0">
                <Plus className="h-4 w-4" /> New Record
              </button>
            )}
          </div>
        )}
        {embedded && (
          <div className="flex items-center justify-between animate-fade-in">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track and manage member conduct with pastoral care
            </p>
            {canManageDiscipline && (
              <button onClick={openCreate} className="btn-primary shrink-0">
                <Plus className="h-4 w-4" /> New Record
              </button>
            )}
          </div>
        )}

        {isOwnView && (
          <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800/50 p-4 flex items-start gap-3 animate-fade-in">
            <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
              This is your personal record. Leadership will speak with you regarding any open items.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
          {isLeader && (
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by member or title..."
                className="input-field pl-10"
              />
            </div>
          )}
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'open', label: 'Open' },
              { value: 'verbal_warning', label: 'Verbal Warning' },
              { value: 'counselling', label: 'Counselling' },
              { value: 'suspension', label: 'Suspended' },
              { value: 'resolved', label: 'Resolved' },
            ]}
            placeholder="Filter by status"
            className="sm:w-44"
            icon={<Filter className="h-4 w-4" />}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] p-12 text-center animate-slide-up" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <FileCheck className="h-7 w-7 text-gray-300 dark:text-gray-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {isOwnView ? 'Clean Record' : 'No Records Found'}
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {isOwnView ? 'You have no discipline records. Keep it up!' : 'No records match your filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 animate-slide-up">
            {filtered.map((record) => {
              const sCfg = statusConfig[record.status] ?? statusConfig.open;
              const srcCfg = sourceConfig[record.source] ?? sourceConfig.manual;
              const offCfg = record.offense_number ? offenseLabels[record.offense_number] : null;
              const isExp = expanded === record.id;
              const member = record.profile;
              const StatusIcon = sCfg.icon;
              const isResolved = record.status === 'resolved';

              return (
                <div
                  key={record.id}
                  className={`rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 transition-all duration-200 ${
                    isResolved
                      ? 'ring-black/[0.04] dark:ring-white/[0.04] opacity-75'
                      : `ring-black/[0.05] dark:ring-white/[0.06]`
                  }`}
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                >
                  {!isResolved && record.status !== 'open' && (
                    <div className={`h-0.5 w-full ${
                      record.status === 'suspension' ? 'bg-red-400' :
                      record.status === 'counselling' ? 'bg-orange-400' :
                      'bg-amber-400'
                    }`} />
                  )}

                  <button
                    onClick={() => setExpanded(isExp ? null : record.id)}
                    className="w-full flex items-start gap-3.5 px-4 py-4 text-left hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {isLeader && member && (
                      <Avatar src={member.avatar_url} firstName={member.first_name} lastName={member.last_name} size="sm" className="shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      {isLeader && member && (
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">
                          {member.first_name} {member.last_name}
                          {member.nickname && ` (${member.nickname})`}
                        </p>
                      )}
                      <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{record.title}</p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${srcCfg.bgColor} ${srcCfg.textColor}`}>
                          {srcCfg.label}
                        </span>
                        {offCfg && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${offCfg.bg} ${offCfg.color}`}>
                            {offCfg.label}
                          </span>
                        )}
                        {record.quarter_year && (
                          <span className="text-[10px] font-medium text-gray-400">Q{record.quarter_number} {record.quarter_year}</span>
                        )}
                        <span className="text-[10px] text-gray-400">{format(parseISO(record.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl ring-1 ${sCfg.bgColor} ${sCfg.textColor} ${sCfg.ringColor}`}>
                        <StatusIcon className="h-3 w-3" />
                        {sCfg.label}
                      </span>
                      {isExp
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />
                      }
                    </div>
                  </button>

                  {isExp && (
                    <div className="border-t border-black/[0.04] dark:border-white/[0.05] px-4 py-4 space-y-3.5">
                      {record.notes && (
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1.5">Details</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{record.notes}</p>
                        </div>
                      )}

                      {record.final_decision && (
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 p-3">
                          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Final Decision
                          </p>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">{record.final_decision}</p>
                        </div>
                      )}

                      {isLeader && record.leader_notes && (
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200/60 dark:ring-amber-800/40 p-3">
                          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Leadership Notes (internal)
                          </p>
                          <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">{record.leader_notes}</p>
                        </div>
                      )}

                      {record.resolved_at && (
                        <p className="text-xs text-gray-400">
                          Resolved on {format(parseISO(record.resolved_at), 'MMMM d, yyyy')}
                        </p>
                      )}

                      {canManageDiscipline && (
                        <div className="flex justify-end pt-1">
                          <button onClick={() => openEdit(record)} className="btn-secondary text-xs">
                            Edit Record
                          </button>
                        </div>
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
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={editingRecord ? 'Edit Discipline Record' : 'New Discipline Record'}
        size="lg"
      >
        <div className="space-y-4">
          {!editingRecord && canManageDiscipline && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Member *</label>
              <Select
                value={formData.user_id}
                onChange={v => setFormData({ ...formData, user_id: v })}
                options={members.map(m => ({
                  value: m.id,
                  label: `${m.first_name} ${m.last_name}${m.nickname ? ` (${m.nickname})` : ''}`,
                }))}
                placeholder="Select member"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="input-field"
              placeholder="e.g., 1st Offense - Attendance Warning"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Source</label>
              <Select
                value={formData.source}
                onChange={v => setFormData({ ...formData, source: v as 'attendance' | 'setlist' | 'manual' })}
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'attendance', label: 'Attendance' },
                  { value: 'setlist', label: 'Setlist' },
                ]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Offense Level</label>
              <Select
                value={formData.offense_number?.toString() ?? ''}
                onChange={v => setFormData({ ...formData, offense_number: v ? parseInt(v) : '' })}
                options={[
                  { value: '', label: 'None' },
                  { value: '1', label: '1st Offense' },
                  { value: '2', label: '2nd Offense' },
                  { value: '3', label: '3rd Offense' },
                  { value: '4', label: '4th Offense' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quarter</label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={formData.quarter_year.toString()}
                  onChange={v => setFormData({ ...formData, quarter_year: parseInt(v) })}
                  options={[2024, 2025, 2026, 2027].map(y => ({ value: y.toString(), label: y.toString() }))}
                />
                <Select
                  value={formData.quarter_number.toString()}
                  onChange={v => setFormData({ ...formData, quarter_number: parseInt(v) })}
                  options={[1, 2, 3, 4].map(q => ({ value: q.toString(), label: `Q${q}` }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
              <Select
                value={formData.status}
                onChange={v => setFormData({ ...formData, status: v })}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'verbal_warning', label: 'Verbal Warning' },
                  { value: 'counselling', label: 'Counselling' },
                  { value: 'suspension', label: 'Suspended' },
                  { value: 'resolved', label: 'Resolved' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="input-field min-h-[80px] resize-none"
              placeholder="Details visible to the member..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-amber-500" />
                Leadership Notes (internal only)
              </span>
            </label>
            <textarea
              value={formData.leader_notes}
              onChange={e => setFormData({ ...formData, leader_notes: e.target.value })}
              className="input-field min-h-[60px] resize-none"
              placeholder="Internal notes not shown to the member..."
            />
          </div>

          {(formData.status === 'resolved' || editingRecord?.status === 'resolved') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Final Decision</label>
              <textarea
                value={formData.final_decision}
                onChange={e => setFormData({ ...formData, final_decision: e.target.value })}
                className="input-field min-h-[60px] resize-none"
                placeholder="Outcome of the discipline process..."
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.title}
              className="btn-primary"
            >
              {saving ? 'Saving...' : editingRecord ? 'Update Record' : 'Create Record'}
            </button>
          </div>
        </div>
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
