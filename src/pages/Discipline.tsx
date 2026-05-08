import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Shield, Plus, ChevronDown, Search,
  Filter, CheckCircle, Clock, XCircle, FileCheck, MessageSquare,
  Eye, X, Lock
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

const statusConfig: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  open:           { label: 'Open',           cls: 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-white/55 border border-gray-200 dark:border-white/[0.08]', icon: Clock },
  verbal_warning: { label: 'Verbal Warning', cls: 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25', icon: MessageSquare },
  counselling:    { label: 'Counselling',    cls: 'bg-orange-50 dark:bg-orange-500/[0.12] text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/25', icon: MessageSquare },
  suspension:     { label: 'Suspended',      cls: 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25', icon: XCircle },
  resolved:       { label: 'Resolved',       cls: 'bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25', icon: CheckCircle },
};

const sourceConfig: Record<string, { label: string; cls: string }> = {
  attendance: { label: 'Attendance', cls: 'bg-sky-50 dark:bg-sky-500/[0.12] text-sky-700 dark:text-sky-300' },
  setlist:    { label: 'Setlist',    cls: 'bg-teal-50 dark:bg-teal-500/[0.12] text-teal-700 dark:text-teal-300' },
  manual:     { label: 'Manual',     cls: 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-white/55' },
};

const offenseLabels: Record<number, { label: string; cls: string }> = {
  1: { label: '1st Offense', cls: 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25' },
  2: { label: '2nd Offense', cls: 'bg-orange-50 dark:bg-orange-500/[0.12] text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/25' },
  3: { label: '3rd Offense', cls: 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25' },
  4: { label: '4th Offense', cls: 'bg-red-100 dark:bg-red-500/[0.18] text-red-800 dark:text-red-200 border border-red-300 dark:border-red-500/40' },
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
      <div className={embedded ? 'space-y-5' : 'space-y-5 sm:space-y-6'}>
        {!embedded && (
          <motion.div
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-start justify-between gap-3"
          >
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.32), transparent 70%)', filter: 'blur(10px)', transform: 'scale(1.5)' }}
                />
                <div
                  className="relative h-11 w-11 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(145deg, #ef4444, #b91c1c)', boxShadow: '0 4px 14px rgba(239,68,68,0.32)' }}
                >
                  <Shield className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-red-600 dark:text-red-400/80 mb-0.5">
                  Pastoral care
                </p>
                <h1 className="text-[1.5rem] sm:text-[1.75rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
                  {isOwnView ? 'My Record.' : 'Conduct.'}
                </h1>
              </div>
            </div>
            {canManageDiscipline && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-[12px] font-semibold text-white shrink-0 transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 4px 14px rgba(239,68,68,0.35)' }}
              >
                <Plus className="h-3.5 w-3.5" /> New Record
              </button>
            )}
          </motion.div>
        )}
        {embedded && (
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2.5 px-0.5">
              <span className="text-[10px] font-mono font-semibold tabular-nums text-gray-400/70 dark:text-white/25 tracking-widest">01</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45 flex items-center gap-1.5">
                <Shield className="h-3 w-3" /> Discipline Records
              </span>
            </div>
            {canManageDiscipline && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold text-white shrink-0 transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', boxShadow: '0 3px 10px rgba(239,68,68,0.3)' }}
              >
                <Plus className="h-3.5 w-3.5" /> New Record
              </button>
            )}
          </div>
        )}

        {isOwnView && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-3xl overflow-hidden border border-sky-200 dark:border-sky-500/25 p-4 flex items-start gap-3"
            style={{
              backgroundImage: 'linear-gradient(135deg, rgba(14,165,233,0.10), rgba(14,165,233,0.025) 50%, transparent 80%)',
              backgroundColor: 'white',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(14,165,233,0.18)',
            }}
          >
            <div className="absolute inset-0 dark:bg-white/[0.025]" />
            <div className="relative flex items-center justify-center h-9 w-9 rounded-2xl shrink-0" style={{ background: 'linear-gradient(145deg, #0ea5e9, #0369a1)', boxShadow: '0 3px 10px rgba(14,165,233,0.3)' }}>
              <Eye className="h-4 w-4 text-white" />
            </div>
            <p className="relative text-[13px] text-gray-700 dark:text-white/70 leading-relaxed">
              This is your personal record. Leadership will speak with you regarding any open items.
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row gap-2"
        >
          {isLeader && (
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by member or title…"
                className="w-full h-10 pl-10 pr-9 rounded-2xl text-[13px] bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 dark:focus:border-red-500/50 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
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
        </motion.div>

        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] p-12 text-center"
            style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
          >
            <div
              className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(145deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}
            >
              <FileCheck className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>
              {isOwnView ? 'Clean Record' : 'No Records Found'}
            </h2>
            <p className="text-sm text-gray-400 dark:text-white/40 mt-1">
              {isOwnView ? 'You have no discipline records. Keep it up!' : 'No records match your filters.'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            className="space-y-2.5"
          >
            {filtered.map((record) => {
              const sCfg = statusConfig[record.status] ?? statusConfig.open;
              const srcCfg = sourceConfig[record.source] ?? sourceConfig.manual;
              const offCfg = record.offense_number ? offenseLabels[record.offense_number] : null;
              const isExp = expanded === record.id;
              const member = record.profile;
              const StatusIcon = sCfg.icon;
              const isResolved = record.status === 'resolved';

              return (
                <motion.div
                  key={record.id}
                  variants={{ hidden: { opacity: 0, y: 10, filter: 'blur(4px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } }}
                  className="relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] transition-all duration-200"
                  style={{
                    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)',
                    opacity: isResolved ? 0.7 : 1,
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

                  <button
                    onClick={() => setExpanded(isExp ? null : record.id)}
                    className="relative w-full flex items-start gap-3.5 px-5 py-4 text-left hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {isLeader && member && (
                      <Avatar src={member.avatar_url} firstName={member.first_name} lastName={member.last_name} size="sm" className="shrink-0 mt-0.5 ring-1 ring-black/[0.06] dark:ring-white/[0.08]" />
                    )}
                    <div className="flex-1 min-w-0">
                      {isLeader && member && (
                        <p className="text-[11px] font-mono font-semibold text-gray-400 dark:text-white/30 mb-0.5 tracking-wide">
                          {member.first_name} {member.last_name}
                          {member.nickname && ` (${member.nickname})`}
                        </p>
                      )}
                      <p className="text-[14px] font-bold text-gray-900 dark:text-white leading-snug" style={{ letterSpacing: '-0.015em' }}>{record.title}</p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${srcCfg.cls}`}>
                          {srcCfg.label}
                        </span>
                        {offCfg && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${offCfg.cls}`}>
                            {offCfg.label}
                          </span>
                        )}
                        {record.quarter_year && (
                          <span className="text-[10px] font-mono text-gray-400 dark:text-white/30 tracking-wide">Q{record.quarter_number} {record.quarter_year}</span>
                        )}
                        <span className="text-[10px] font-mono text-gray-400 dark:text-white/30 tracking-wide">{format(parseISO(record.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${sCfg.cls}`}>
                        <StatusIcon className="h-3 w-3" />
                        {sCfg.label}
                      </span>
                      <div className={`flex items-center justify-center w-7 h-7 rounded-xl transition-all ${isExp ? 'bg-gray-100 dark:bg-white/[0.06] rotate-180' : ''}`}>
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400 dark:text-white/35" />
                      </div>
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
                </motion.div>
              );
            })}
          </motion.div>
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
      <div className="max-w-5xl mx-auto px-1 sm:px-2 pt-6 sm:pt-8">
        {content}
      </div>
    </div>
  );
}
